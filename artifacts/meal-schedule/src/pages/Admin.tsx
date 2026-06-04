import { useState } from "react";
import { parseTabSeparatedData } from "@/lib/storage";
import { fetchMealData, saveMealData } from "@/lib/api";
import type { MealEntry } from "@/lib/storage";

const DIRECT_SAMPLE = `date\tmenu\tusers
2026-05-12\t갈비탕\t김형진,오현찬
2026-05-13\t짬뽕밥\t오현찬
2026-05-14\t마제소바\t김형진,왕윤진`;

const CONVERTER_SAMPLE = `이름\t5/12\t5/13\t5/14
김형진\t갈비탕\t\t마제소바
오현찬\t갈비탕\t짬뽕밥\t`;

function parseDateHeader(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const year = new Date().getFullYear();
  const mmdd = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (mmdd) {
    const m = mmdd[1].padStart(2, "0");
    const d = mmdd[2].padStart(2, "0");
    return `${year}-${m}-${d}`;
  }
  const dotmmdd = s.match(/^(\d{1,2})\.(\d{1,2})\.?$/);
  if (dotmmdd) {
    const m = dotmmdd[1].padStart(2, "0");
    const d = dotmmdd[2].padStart(2, "0");
    return `${year}-${m}-${d}`;
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
  if (lines.length < 2) return { entries: [], error: "데이터가 너무 짧습니다. 헤더와 최소 1개 행이 필요합니다." };

  const header = lines[0].split("\t");
  if (header.length < 2) return { entries: [], error: "탭으로 구분된 데이터를 붙여넣어 주세요." };

  const firstCell = header[0].trim().toLowerCase();

  if (firstCell === "date" || firstCell === "날짜") {
    const menuIdx = header.findIndex((h) => h.trim().toLowerCase() === "menu" || h.trim() === "메뉴");
    const usersIdx = header.findIndex((h) => h.trim().toLowerCase() === "users" || h.trim() === "대상자" || h.trim() === "직원");
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

  const dateColumns: { index: number; date: string }[] = [];
  for (let i = 1; i < header.length; i++) {
    const date = parseDateHeader(header[i]);
    if (date) dateColumns.push({ index: i, date });
  }
  if (dateColumns.length === 0) {
    return { entries: [], error: "날짜 열을 인식할 수 없습니다. 열 헤더가 5/12, 2026-05-12 등의 형식인지 확인해주세요." };
  }

  const grouped = new Map<string, { menu: string; users: string[] }>();
  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split("\t");
    const userName = (cols[0] ?? "").trim();
    if (!userName) continue;
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

function entriesToTsv(entries: ConvertedEntry[]): string {
  const header = "date\tmenu\tusers";
  const rows = entries.map((e) => `${e.date}\t${e.menu}\t${e.users.join(",")}`);
  return [header, ...rows].join("\n");
}

type Mode = "converter" | "direct";

export default function Admin() {
  const [mode, setMode] = useState<Mode>("converter");

  const [converterInput, setConverterInput] = useState("");
  const [converterResult, setConverterResult] = useState<ConvertedEntry[] | null>(null);
  const [converterError, setConverterError] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [applyStatus, setApplyStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  const [raw, setRaw] = useState("");
  const [directStatus, setDirectStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [directMessage, setDirectMessage] = useState("");
  const [preview, setPreview] = useState<MealEntry[]>([]);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  async function loadPreview() {
    if (previewLoaded) return;
    try {
      const data = await fetchMealData();
      setPreview(data);
      setPreviewLoaded(true);
    } catch {
      /* ignore */
    }
  }

  function handleConvert() {
    setConverterError("");
    setConverterResult(null);
    setCopyState("idle");
    setApplyStatus("idle");
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

  function handleCopyTsv() {
    if (!converterResult) return;
    const tsv = entriesToTsv(converterResult);
    navigator.clipboard.writeText(tsv).then(() => {
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    });
  }

  async function handleApplyFromConverter() {
    if (!converterResult) return;
    setApplyStatus("saving");
    try {
      await saveMealData(converterResult);
      setPreview(converterResult);
      setPreviewLoaded(true);
      window.dispatchEvent(new Event("meal-schedule-updated"));
      setApplyStatus("success");
      setTimeout(() => setApplyStatus("idle"), 3000);
    } catch {
      setApplyStatus("error");
      setTimeout(() => setApplyStatus("idle"), 3000);
    }
  }

  async function handleApplyDirect() {
    if (!raw.trim()) {
      setDirectStatus("error");
      setDirectMessage("데이터를 입력해주세요.");
      return;
    }
    const entries = parseTabSeparatedData(raw);
    if (entries.length === 0) {
      setDirectStatus("error");
      setDirectMessage("올바른 형식의 데이터가 아닙니다. 헤더(date / menu / users)를 확인해주세요.");
      return;
    }
    setDirectStatus("saving");
    try {
      await saveMealData(entries);
      setPreview(entries);
      setPreviewLoaded(true);
      window.dispatchEvent(new Event("meal-schedule-updated"));
      setDirectStatus("success");
      setDirectMessage(`${entries.length}개의 일정이 저장되었습니다.`);
    } catch {
      setDirectStatus("error");
      setDirectMessage("저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  }

  async function handleClearDirect() {
    setDirectStatus("saving");
    try {
      await saveMealData([]);
      setPreview([]);
      setRaw("");
      setDirectStatus("idle");
      setDirectMessage("");
      window.dispatchEvent(new Event("meal-schedule-updated"));
    } catch {
      setDirectStatus("error");
      setDirectMessage("초기화에 실패했습니다.");
    }
  }

  const tsvOutput = converterResult ? entriesToTsv(converterResult) : "";

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
            onClick={() => { setMode(m); loadPreview(); }}
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
            {m === "converter" ? "🔄 스프레드시트 변환" : "📋 직접 입력"}
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
              행 = 직원 이름 / 열 = 날짜 / 셀 = 메뉴
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
                setApplyStatus("idle");
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
                    data-testid="button-copy-tsv"
                    onClick={handleCopyTsv}
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
                  {tsvOutput}
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

              <div className="flex flex-col gap-2">
                <button
                  data-testid="button-apply-from-converter"
                  onClick={handleApplyFromConverter}
                  disabled={applyStatus === "saving"}
                  className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
                  style={
                    applyStatus === "success"
                      ? {
                          background: "hsl(142 72% 50% / 0.15)",
                          color: "hsl(142 72% 55%)",
                          border: "1px solid hsl(142 72% 50% / 0.3)",
                        }
                      : applyStatus === "error"
                      ? {
                          background: "hsl(0 72% 55% / 0.1)",
                          color: "hsl(0 72% 60%)",
                          border: "1px solid hsl(0 72% 55% / 0.3)",
                        }
                      : {
                          background: "hsl(221 83% 60% / 0.15)",
                          color: "hsl(var(--primary))",
                          border: "1px solid hsl(var(--primary) / 0.3)",
                        }
                  }
                >
                  {applyStatus === "saving"
                    ? "저장 중..."
                    : applyStatus === "success"
                    ? "✓ 저장되었습니다 — 모든 기기에 반영됩니다"
                    : applyStatus === "error"
                    ? "저장 실패 — 다시 시도해주세요"
                    : "앱에 바로 적용하기"}
                </button>
                <p className="text-xs text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
                  서버에 저장되어 모든 기기에서 동일하게 보입니다
                </p>
              </div>
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
              데이터 형식 예시
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
              헤더: <code>date</code> / <code>menu</code> / <code>users</code> (탭 구분, 이름은 쉼표 구분)
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold">데이터 붙여넣기</label>
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
              onClick={handleApplyDirect}
              disabled={directStatus === "saving"}
              className="flex-1 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
            >
              {directStatus === "saving" ? "저장 중..." : "적용하기"}
            </button>
            <button
              data-testid="button-clear"
              onClick={handleClearDirect}
              disabled={directStatus === "saving"}
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
                저장된 일정 ({preview.length}건)
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
