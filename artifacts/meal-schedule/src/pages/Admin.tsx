import { useState } from "react";
import { parseTabSeparatedData } from "@/lib/storage";
import { canUseMealTicket } from "@/lib/meal-ticket";
import type { MealEntry } from "@/lib/storage";

const DIRECT_SAMPLE = `[
  {
    "date": "2026-06-07",
    "menu": "콩나물밥, 애호박찌개",
    "users": ["이기환", "임지웅"]
  }
]`;

const CONVERTER_SAMPLE = `부서\t성함\t(6/1일 월요일\t(2일 화요일\t(3일 수요일
Prep full-time\t오현찬\t라볶이\t돼지고기 수육\t
FOH\t김선태\t\t돼지고기 수육\t우삼겹 두부 짜글이
BOH\t한영민\t라볶이\t돼지고기 수육\t우삼겹 두부 짜글이`;

function normalizeHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

function isMealTicketDepartment(raw: string): boolean {
  const dept = raw.trim().toUpperCase();
  return dept === "BOH" || dept === "FOH";
}

function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseTimestamp(raw: string): Date | null {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!month || !day || !year) return null;
  return new Date(year, month - 1, day);
}

function getNextSunday(date: Date): Date {
  const next = new Date(date);
  const daysUntilSunday = (7 - next.getDay()) % 7 || 7;
  next.setDate(next.getDate() + daysUntilSunday);
  return next;
}

function getDateAfter(start: Date, dayOffset: number): string {
  const date = new Date(start);
  date.setDate(start.getDate() + dayOffset);
  return formatIsoDate(date);
}

function parseHeaderDateAnchor(raw: string): { month?: number; day: number } | null {
  const s = raw.trim().split(/\s+\/\s+/)[0];
  const explicit = s.match(/(\d{1,2})\/(\d{1,2})/);
  if (explicit) {
    return { month: Number(explicit[1]), day: Number(explicit[2]) };
  }
  const dayOnly = s.match(/\(?\s*(\d{1,2})일/);
  if (dayOnly) {
    return { day: Number(dayOnly[1]) };
  }
  return null;
}

function buildDateColumnsFromHeaders(
  header: string[],
  excludedIndexes: Set<number>,
): { index: number; date: string }[] {
  const year = new Date().getFullYear();
  const candidates = header
    .map((h, index) => ({ index, parsed: parseHeaderDateAnchor(h) }))
    .filter((item): item is { index: number; parsed: { month?: number; day: number } } => {
      return !excludedIndexes.has(item.index) && item.parsed !== null;
    });

  if (candidates.length === 0) return [];

  const firstExplicit = candidates.find((item) => item.parsed.month !== undefined);
  if (firstExplicit) {
    const anchor = new Date(year, firstExplicit.parsed.month! - 1, firstExplicit.parsed.day);
    return candidates.map(({ index }) => {
      const offset = candidates.findIndex((item) => item.index === index) -
        candidates.findIndex((item) => item.index === firstExplicit.index);
      return { index, date: getDateAfter(anchor, offset) };
    });
  }

  let activeMonth = String(new Date().getMonth() + 1).padStart(2, "0");
  const columns: { index: number; date: string }[] = [];
  for (const { index } of candidates) {
    const parsed = parseDateHeader(header[index], activeMonth);
    if (!parsed) continue;
    activeMonth = parsed.month;
    columns.push({ index, date: parsed.date });
  }
  return columns;
}

function parseDateHeader(
  raw: string,
  fallbackMonth: string,
): { date: string; month: string } | null {
  const s = raw.trim().split(/\s+\/\s+/)[0];
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return { date: s, month: s.slice(5, 7) };
  }
  const year = new Date().getFullYear();
  const mmdd = s.match(/(\d{1,2})\/(\d{1,2})/);
  if (mmdd) {
    const m = mmdd[1].padStart(2, "0");
    const d = mmdd[2].padStart(2, "0");
    return { date: `${year}-${m}-${d}`, month: m };
  }
  const dotmmdd = s.match(/(\d{1,2})\.(\d{1,2})\.?/);
  if (dotmmdd) {
    const m = dotmmdd[1].padStart(2, "0");
    const d = dotmmdd[2].padStart(2, "0");
    return { date: `${year}-${m}-${d}`, month: m };
  }
  const dayOnly = s.match(/\(?\s*(\d{1,2})일/);
  if (dayOnly) {
    const d = dayOnly[1].padStart(2, "0");
    return { date: `${year}-${fallbackMonth}-${d}`, month: fallbackMonth };
  }
  return null;
}

interface ConvertedEntry {
  date: string;
  menu: string;
  users: string[];
}

function convertSpreadsheet(raw: string): { entries: ConvertedEntry[]; error: string | null } {
  const lines = raw.trim().split("\n").map((l) => l.replace(/\r$/, ""));
  if (lines.length < 1) return { entries: [], error: "데이터를 붙여넣어 주세요." };

  const header = lines[0].split("\t");
  if (header.length < 2) return { entries: [], error: "탭으로 구분된 데이터를 붙여넣어 주세요." };

  const normalizedHeader = header.map(normalizeHeader);
  const firstCell = normalizedHeader[0];

  const firstTimestamp = parseTimestamp(header[0]);
  const hasHeader = firstCell === "date" || firstCell === "날짜" || normalizedHeader.includes("성함") || normalizedHeader.includes("이름");
  const startRow = hasHeader ? 1 : 0;

  if (firstCell === "date" || firstCell === "날짜") {
    const menuIdx = normalizedHeader.findIndex((h) => h === "menu" || h === "메뉴");
    const usersIdx = normalizedHeader.findIndex((h) => h === "users" || h === "대상자" || h === "직원");
    if (menuIdx === -1 || usersIdx === -1) {
      return { entries: [], error: "헤더에 menu와 users 열이 필요합니다. (예: date\\tmenu\\tusers)" };
    }
    const entries: ConvertedEntry[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split("\t");
      const date = (cols[0] ?? "").trim();
      const menu = (cols[menuIdx] ?? "").trim();
      const usersRaw = (cols[usersIdx] ?? "").trim();
      if (!date || !menu) continue;
      const users = usersRaw.split(",").map((u) => u.trim()).filter(Boolean);
      entries.push({ date, menu, users });
    }
    if (entries.length === 0) {
      return { entries: [], error: "변환된 데이터가 없습니다. 데이터 행을 확인해주세요." };
    }
    return { entries, error: null };
  }

  const deptIdx = normalizedHeader.findIndex((h) => h === "부서" || h === "department" || h === "dept");
  const nameIdx = normalizedHeader.findIndex((h) => h === "성함" || h === "이름" || h === "name" || h === "직원");
  const userNameIdx = nameIdx === -1 ? 2 : nameIdx;
  const departmentIdx = deptIdx === -1 ? 1 : deptIdx;

  const dateColumns: { index: number; date: string }[] = [];
  if (!hasHeader && firstTimestamp) {
    const firstMenuDate = getNextSunday(firstTimestamp);
    for (let i = 3; i < header.length; i++) {
      dateColumns.push({ index: i, date: getDateAfter(firstMenuDate, i - 3) });
    }
  } else {
    dateColumns.push(
      ...buildDateColumnsFromHeaders(header, new Set([deptIdx, nameIdx])),
    );
  }
  if (dateColumns.length === 0) {
    return { entries: [], error: "날짜 열을 인식할 수 없습니다. 헤더를 포함하거나 Timestamp부터 복사해주세요." };
  }

  const grouped = new Map<string, { menu: string; users: string[] }>();
  for (let r = startRow; r < lines.length; r++) {
    const cols = lines[r].split("\t");
    const userName = (cols[userNameIdx] ?? "").trim();
    if (!userName) continue;
    if (!isMealTicketDepartment(cols[departmentIdx] ?? "")) continue;
    if (!canUseMealTicket(userName)) continue;
    for (const { index, date } of dateColumns) {
      const menu = (cols[index] ?? "").trim();
      if (!menu) continue;
      const key = `${date}__${menu}`;
      if (!grouped.has(key)) grouped.set(key, { menu, users: [] });
      grouped.get(key)!.users.push(userName);
    }
  }

  const entries: ConvertedEntry[] = Array.from(grouped.entries())
    .map(([key, val]) => ({ date: key.split("__")[0], menu: val.menu, users: val.users }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (entries.length === 0) {
    return { entries: [], error: "변환된 데이터가 없습니다. 셀에 메뉴 이름이 입력되어 있는지 확인해주세요." };
  }
  return { entries, error: null };
}

function entriesToJson(entries: ConvertedEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

function parseMealJson(raw: string): MealEntry[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  const entries: MealEntry[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const date = typeof record.date === "string" ? record.date.trim() : "";
    const menu = typeof record.menu === "string" ? record.menu.trim() : "";
    const users = Array.isArray(record.users)
      ? record.users.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
      : [];
    if (date && menu) entries.push({ date, menu, users });
  }
  return entries;
}

type Mode = "converter" | "direct";

export default function Admin() {
  const [mode, setMode] = useState<Mode>("converter");

  const [converterInput, setConverterInput] = useState("");
  const [converterResult, setConverterResult] = useState<ConvertedEntry[] | null>(null);
  const [converterError, setConverterError] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const [raw, setRaw] = useState("");
  const [directStatus, setDirectStatus] = useState<"idle" | "success" | "error">("idle");
  const [directMessage, setDirectMessage] = useState("");
  const [preview, setPreview] = useState<MealEntry[]>([]);

  function handleConvert() {
    setConverterError("");
    setConverterResult(null);
    setCopyState("idle");
    if (!converterInput.trim()) {
      setConverterError("데이터를 붙여넣어 주세요.");
      return;
    }
    const { entries, error } = convertSpreadsheet(converterInput);
    if (error) {
      setConverterError(error);
      return;
    }
    setConverterResult(entries);
  }

  function handleCopyJson() {
    if (!converterResult) return;
    navigator.clipboard.writeText(entriesToJson(converterResult)).then(() => {
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    });
  }

  function handleValidateJson() {
    if (!raw.trim()) {
      setDirectStatus("error");
      setDirectMessage("데이터를 입력해주세요.");
      return;
    }
    try {
      const entries = raw.trim().startsWith("[")
        ? parseMealJson(raw)
        : parseTabSeparatedData(raw);
      if (entries.length === 0) {
        throw new Error("empty");
      }
      setPreview(entries);
      setDirectStatus("success");
      setDirectMessage(`${entries.length}개의 JSON 일정이 확인되었습니다.`);
    } catch {
      setDirectStatus("error");
      setDirectMessage("올바른 meal-data.json 형식이 아닙니다.");
    }
  }

  function handleCopyDirectJson() {
    if (preview.length === 0) return;
    navigator.clipboard.writeText(entriesToJson(preview)).then(() => {
      setDirectStatus("success");
      setDirectMessage("meal-data.json 내용이 복사되었습니다.");
    });
  }

  function handleClearDirect() {
    setPreview([]);
    setRaw("");
    setDirectStatus("idle");
    setDirectMessage("");
  }

  const jsonOutput = converterResult ? entriesToJson(converterResult) : "";

  return (
    <div className="flex flex-col gap-5 px-4 py-6 max-w-md mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold">관리</h1>
        <p className="text-sm mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
          일정 데이터 관리
        </p>
      </div>

      <div
        className="flex p-1 rounded-2xl gap-1"
        style={{ background: "hsl(var(--secondary))" }}
        data-testid="mode-toggle"
      >
        {(["converter", "direct"] as Mode[]).map((m) => (
          <button
            key={m}
            data-testid={`tab-${m}`}
            onClick={() => setMode(m)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
            style={
              mode === m
                ? {
                    background: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                    boxShadow: "0 1px 4px hsl(0 0% 0% / 0.25)",
                  }
                : {
                    background: "transparent",
                    color: "hsl(var(--muted-foreground))",
                  }
            }
          >
            {m === "converter" ? "🔄 스프레드시트 변환" : "📋 JSON 직접 입력"}
          </button>
        ))}
      </div>

      {mode === "converter" && (
        <>
          <div
            className="rounded-2xl p-5"
            style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
              붙여넣기 형식 예시
            </p>
            <p className="text-xs mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
              헤더 포함 또는 Timestamp부터 복사한 응답 데이터를 붙여넣으면 BOH, FOH만 변환됩니다
            </p>
            <pre
              className="text-xs rounded-xl p-3 overflow-x-auto"
              style={{
                background: "hsl(var(--secondary))",
                color: "hsl(var(--muted-foreground))",
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                lineHeight: 1.7,
              }}
            >
              {CONVERTER_SAMPLE}
            </pre>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold">엑셀 / 구글 시트 데이터 붙여넣기</label>
            <textarea
              data-testid="input-converter"
              value={converterInput}
              onChange={(e) => {
                setConverterInput(e.target.value);
                setConverterError("");
                setConverterResult(null);
                setCopyState("idle");
              }}
              placeholder={CONVERTER_SAMPLE}
              className="w-full rounded-2xl p-4 text-sm resize-none focus:outline-none transition-all"
              rows={7}
              style={{
                background: "hsl(var(--input))",
                color: "hsl(var(--foreground))",
                border: "1px solid hsl(var(--border))",
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                lineHeight: 1.7,
                caretColor: "hsl(var(--primary))",
              }}
              spellCheck={false}
            />
          </div>

          {converterError && (
            <div
              className="rounded-xl px-4 py-3 text-sm font-medium"
              style={{
                background: "hsl(0 72% 55% / 0.1)",
                color: "hsl(0 72% 60%)",
                border: "1px solid hsl(0 72% 55% / 0.3)",
              }}
              data-testid="converter-error"
            >
              {converterError}
            </div>
          )}

          <button
            data-testid="button-convert"
            onClick={handleConvert}
            className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-95"
            style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          >
            변환하기
          </button>

          {converterResult && (
            <>
              <div
                className="rounded-2xl p-5 flex flex-col gap-3"
                style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))" }}>
                    변환 결과 ({converterResult.length}건)
                  </p>
                  <button
                    data-testid="button-copy-json"
                    onClick={handleCopyJson}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                    style={
                      copyState === "copied"
                        ? {
                            background: "hsl(142 72% 50% / 0.15)",
                            color: "hsl(142 72% 55%)",
                            border: "1px solid hsl(142 72% 50% / 0.3)",
                          }
                        : { background: "hsl(var(--secondary))", color: "hsl(var(--secondary-foreground))" }
                    }
                  >
                    {copyState === "copied" ? "✓ 복사됨" : "복사"}
                  </button>
                </div>

                <pre
                  className="text-xs rounded-xl p-3 overflow-x-auto"
                  style={{
                    background: "hsl(var(--secondary))",
                    color: "hsl(var(--foreground))",
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                    lineHeight: 1.7,
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}
                  data-testid="converter-output"
                >
                  {jsonOutput}
                </pre>

                <div className="flex flex-col gap-2 mt-1">
                  {converterResult.map((entry) => (
                    <div
                      key={`${entry.date}-${entry.menu}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: "hsl(var(--secondary))" }}
                      data-testid={`converted-row-${entry.date}`}
                    >
                      <span className="text-xs font-semibold w-24 flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {entry.date.slice(5).replace("-", "/")}
                      </span>
                      <span className="text-sm font-medium flex-1 truncate">{entry.menu}</span>
                      <span className="text-xs flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {entry.users.join(", ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
                복사한 JSON을 <code>artifacts/meal-schedule/public/meal-data.json</code>에 반영한 뒤 Git에 올리면 유지됩니다
              </p>
            </>
          )}
        </>
      )}

      {mode === "direct" && (
        <>
          <div
            className="rounded-2xl p-5"
            style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>
              meal-data.json 형식 예시
            </p>
            <pre
              className="text-xs rounded-xl p-3 overflow-x-auto"
              style={{
                background: "hsl(var(--secondary))",
                color: "hsl(var(--muted-foreground))",
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                lineHeight: 1.6,
              }}
            >
              {DIRECT_SAMPLE}
            </pre>
            <p className="text-xs mt-2" style={{ color: "hsl(var(--muted-foreground))" }}>
              JSON 배열 형식입니다. 기존 TSV도 붙여넣으면 JSON으로 검증/복사할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold">JSON 데이터 붙여넣기</label>
            <textarea
              data-testid="input-paste"
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setDirectStatus("idle");
                setDirectMessage("");
              }}
              placeholder={DIRECT_SAMPLE}
              className="w-full rounded-2xl p-4 text-sm resize-none focus:outline-none transition-all"
              rows={8}
              style={{
                background: "hsl(var(--input))",
                color: "hsl(var(--foreground))",
                border: "1px solid hsl(var(--border))",
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                lineHeight: 1.6,
                caretColor: "hsl(var(--primary))",
              }}
              spellCheck={false}
            />
          </div>

          {directStatus !== "idle" && directMessage && (
            <div
              className="rounded-xl px-4 py-3 text-sm font-medium"
              style={
                directStatus === "success"
                  ? {
                      background: "hsl(142 72% 50% / 0.12)",
                      color: "hsl(142 72% 55%)",
                      border: "1px solid hsl(142 72% 50% / 0.3)",
                    }
                  : {
                      background: "hsl(0 72% 55% / 0.1)",
                      color: "hsl(0 72% 60%)",
                      border: "1px solid hsl(0 72% 55% / 0.3)",
                    }
              }
              data-testid="status-admin"
            >
              {directMessage}
            </div>
          )}

          <div className="flex gap-3">
            <button
              data-testid="button-apply"
              onClick={handleValidateJson}
              className="flex-1 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
            >
              검증하기
            </button>
            <button
              data-testid="button-copy-direct-json"
              onClick={handleCopyDirectJson}
              disabled={preview.length === 0}
              className="px-5 py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
              style={{ background: "hsl(221 83% 60% / 0.15)", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary) / 0.3)" }}
            >
              복사
            </button>
            <button
              data-testid="button-clear"
              onClick={handleClearDirect}
              className="px-5 py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
              style={{ background: "hsl(var(--secondary))", color: "hsl(var(--secondary-foreground))" }}
            >
              초기화
            </button>
          </div>

          {preview.length > 0 && (
            <div
              className="rounded-2xl p-5"
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>
                검증된 일정 ({preview.length}건)
              </p>
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {preview.map((entry) => (
                  <div
                    key={entry.date}
                    className="flex items-start gap-3 py-2"
                    style={{ borderBottom: "1px solid hsl(var(--border))" }}
                    data-testid={`row-admin-${entry.date}`}
                  >
                    <span className="text-sm font-medium w-24 flex-shrink-0">{entry.date}</span>
                    <span className="text-sm flex-1 truncate">{entry.menu}</span>
                    <span className="text-xs flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>
                      {entry.users.join(", ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
