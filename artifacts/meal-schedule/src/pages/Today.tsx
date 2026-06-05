import { useState, useEffect, useCallback } from "react";
import { getTodayString, formatDate, formatWeekday, getEntryForDate } from "@/lib/storage";
import { useMealData } from "@/hooks/useMealData";
import { getMealTicketUsers } from "@/lib/meal-ticket";
import {
  hasRemoteCheckinStore,
  loadCheckinState,
  loadSharedCheckinState,
  markDoneShared,
  unmarkShared,
  type CheckinState,
} from "@/lib/checkin";

const MINT = "160 84% 39%";
const MINT_BG = "160 84% 39% / 0.12";
const MINT_BORDER = "160 84% 39% / 0.35";

export default function Today() {
  const today = getTodayString();
  const { schedule, loading } = useMealData();
  const entry = getEntryForDate(schedule, today);
  const staff: string[] = getMealTicketUsers(entry?.users ?? []);

  const [checkin, setCheckin] = useState<CheckinState>(() => loadCheckinState(today));
  const [modal, setModal] = useState<{ name: string } | null>(null);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    setCheckin(loadCheckinState(today));
  }, [today]);

  useEffect(() => {
    let cancelled = false;

    async function refreshSharedState() {
      if (!hasRemoteCheckinStore()) return;
      try {
        const state = await loadSharedCheckinState(today);
        if (!cancelled) {
          setCheckin(state);
          setSyncError("");
        }
      } catch {
        if (!cancelled) setSyncError("실시간 동기화 연결을 확인해주세요");
      }
    }

    refreshSharedState();
    const interval = window.setInterval(refreshSharedState, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [today]);

  const handleCardPress = useCallback((name: string) => {
    setModal({ name });
  }, []);

  const handleConfirmDone = useCallback(() => {
    if (!modal) return;
    const name = modal.name;
    setCheckin((prev) => {
      void markDoneShared(prev, name).catch(() => {
        setSyncError("저장에 실패했습니다. 다시 시도해주세요");
      });
      return {
        ...prev,
        records: {
          ...prev.records,
          [name]: {
            done: true,
            time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
          },
        },
      };
    });
    setModal(null);
  }, [modal]);

  const handleUndo = useCallback((name: string) => {
    setCheckin((prev) => {
      void unmarkShared(prev, name).catch(() => {
        setSyncError("취소 저장에 실패했습니다. 다시 시도해주세요");
      });
      const records = { ...prev.records };
      delete records[name];
      return { ...prev, records };
    });
    setModal(null);
  }, []);

  const doneCount = staff.filter((name) => checkin.records[name]?.done).length;
  const remainCount = staff.length - doneCount;
  const isDone = modal ? !!checkin.records[modal.name]?.done : false;
  const doneTime = modal ? checkin.records[modal.name]?.time : undefined;

  return (
    <div
      style={{
        minHeight: "100%",
        background: "hsl(var(--background))",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Header today={today} menu={entry?.menu} />

      <StatsBar total={staff.length} done={doneCount} remaining={remainCount} />
      {syncError && <SyncNotice message={syncError} />}

      <div style={{ flex: 1, padding: "12px 14px 16px" }}>
        {loading ? (
          <LoadingSkeleton />
        ) : staff.length === 0 ? (
          <EmptyState />
        ) : (
          <StaffGrid
            staff={staff}
            checkin={checkin}
            onPress={handleCardPress}
          />
        )}
      </div>

      {modal && (
        <ModalSheet
          name={modal.name}
          isDone={isDone}
          doneTime={doneTime}
          onConfirm={handleConfirmDone}
          onUndo={() => handleUndo(modal.name)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function SyncNotice({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "8px 14px",
        fontSize: 12,
        fontWeight: 600,
        color: "hsl(0 72% 60%)",
        background: "hsl(0 72% 55% / 0.1)",
        borderBottom: "1px solid hsl(0 72% 55% / 0.25)",
      }}
    >
      {message}
    </div>
  );
}

function Header({ today, menu }: { today: string; menu?: string }) {
  return (
    <div
      style={{
        padding: "16px 16px 12px",
        borderBottom: "1px solid hsl(var(--border))",
        background: "hsl(0 0% 9%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "hsl(var(--foreground))",
          }}
        >
          {formatDate(today)}
        </span>
        <span style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", fontWeight: 500 }}>
          {formatWeekday(today)}
        </span>
      </div>
      {menu && (
        <div
          style={{
            marginTop: 4,
            fontSize: 13,
            color: `hsl(${MINT})`,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <span style={{ fontSize: 11, opacity: 0.7 }}>오늘 메뉴</span>
          {menu}
        </div>
      )}
    </div>
  );
}

function StatsBar({
  total,
  done,
  remaining,
}: {
  total: number;
  done: number;
  remaining: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 1,
        background: "hsl(var(--border))",
        borderBottom: "1px solid hsl(var(--border))",
      }}
      data-testid="stats-bar"
    >
      {[
        { label: "총 식수", value: total, color: "hsl(var(--foreground))" },
        {
          label: "식사 완료",
          value: done,
          color: done > 0 ? `hsl(${MINT})` : "hsl(var(--muted-foreground))",
        },
        {
          label: "남은 인원",
          value: remaining,
          color:
            remaining > 0
              ? "hsl(var(--foreground))"
              : `hsl(${MINT})`,
        },
      ].map((stat) => (
        <div
          key={stat.label}
          style={{
            background: "hsl(0 0% 10%)",
            padding: "12px 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
          }}
        >
          <span
            style={{
              fontSize: 26,
              fontWeight: 800,
              lineHeight: 1,
              color: stat.color,
              letterSpacing: "-0.03em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {stat.value}
          </span>
          <span
            style={{
              fontSize: 11,
              color: "hsl(var(--muted-foreground))",
              fontWeight: 500,
              letterSpacing: "0.02em",
            }}
          >
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function StaffGrid({
  staff,
  checkin,
  onPress,
}: {
  staff: string[];
  checkin: CheckinState;
  onPress: (name: string) => void;
}) {
  const pending = staff.filter((n) => !checkin.records[n]?.done);
  const done = staff.filter((n) => !!checkin.records[n]?.done);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {pending.length > 0 && (
        <section>
          <SectionLabel text={`대기 ${pending.length}명`} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 8,
            }}
          >
            {pending.map((name) => (
              <StaffCard
                key={name}
                name={name}
                done={false}
                time={undefined}
                onPress={onPress}
              />
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <SectionLabel text={`완료 ${done.length}명`} accent />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 8,
            }}
          >
            {done.map((name) => (
              <StaffCard
                key={name}
                name={name}
                done
                time={checkin.records[name]?.time}
                onPress={onPress}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionLabel({ text, accent }: { text: string; accent?: boolean }) {
  return (
    <p
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: accent ? `hsl(${MINT})` : "hsl(var(--muted-foreground))",
        textTransform: "uppercase",
        marginBottom: 8,
        paddingLeft: 2,
      }}
    >
      {text}
    </p>
  );
}

function StaffCard({
  name,
  done,
  time,
  onPress,
}: {
  name: string;
  done: boolean;
  time?: string;
  onPress: (name: string) => void;
}) {
  return (
    <button
      data-testid={`card-staff-${name}`}
      onClick={() => onPress(name)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "space-between",
        padding: "14px 14px 12px",
        borderRadius: 14,
        border: done
          ? `1px solid hsl(${MINT_BORDER})`
          : "1px solid hsl(var(--border))",
        background: done
          ? `hsl(${MINT_BG})`
          : "hsl(var(--card))",
        cursor: "pointer",
        minHeight: 72,
        width: "100%",
        textAlign: "left",
        WebkitTapHighlightColor: "transparent",
        transition: "opacity 0.1s",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {done && (
        <span
          style={{
            position: "absolute",
            top: 10,
            right: 11,
            fontSize: 15,
            lineHeight: 1,
          }}
        >
          ✓
        </span>
      )}
      <span
        style={{
          fontSize: 16,
          fontWeight: done ? 600 : 700,
          color: done ? `hsl(${MINT})` : "hsl(var(--foreground))",
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
        }}
      >
        {name}
      </span>
      {done && time ? (
        <span
          style={{
            fontSize: 11,
            color: `hsl(${MINT})`,
            opacity: 0.75,
            marginTop: 6,
            fontWeight: 500,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {time}
        </span>
      ) : (
        <span
          style={{
            fontSize: 11,
            color: "hsl(var(--muted-foreground))",
            marginTop: 6,
            fontWeight: 400,
          }}
        >
          대기 중
        </span>
      )}
    </button>
  );
}

function ModalSheet({
  name,
  isDone,
  doneTime,
  onConfirm,
  onUndo,
  onClose,
}: {
  name: string;
  isDone: boolean;
  doneTime?: string;
  onConfirm: () => void;
  onUndo: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "hsl(0 0% 0% / 0.6)",
          zIndex: 200,
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 201,
          background: "hsl(0 0% 12%)",
          borderTop: "1px solid hsl(var(--border))",
          borderRadius: "20px 20px 0 0",
          padding: "8px 20px",
          paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
        }}
        data-testid="modal-sheet"
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 99,
            background: "hsl(var(--border))",
            margin: "10px auto 22px",
          }}
        />

        <div style={{ marginBottom: 24 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "hsl(var(--muted-foreground))",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            직원
          </p>
          <p
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: isDone ? `hsl(${MINT})` : "hsl(var(--foreground))",
              lineHeight: 1.1,
            }}
            data-testid="modal-name"
          >
            {name}
          </p>
          {isDone && doneTime && (
            <p
              style={{
                marginTop: 6,
                fontSize: 13,
                color: `hsl(${MINT})`,
                fontWeight: 500,
              }}
            >
              ✓ {doneTime} 식사 완료
            </p>
          )}
        </div>

        {!isDone ? (
          <button
            data-testid="button-confirm-done"
            onClick={onConfirm}
            style={{
              width: "100%",
              padding: "18px 0",
              borderRadius: 16,
              border: "none",
              background: `hsl(${MINT})`,
              color: "#fff",
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            식사 완료
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                width: "100%",
                padding: "16px 0",
                borderRadius: 16,
                border: `1px solid hsl(${MINT_BORDER})`,
                background: `hsl(${MINT_BG})`,
                color: `hsl(${MINT})`,
                fontSize: 16,
                fontWeight: 700,
                textAlign: "center",
              }}
            >
              ✓ 이미 식사 완료됨
            </div>
            <button
              data-testid="button-undo"
              onClick={onUndo}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: 14,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--secondary))",
                color: "hsl(var(--muted-foreground))",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              완료 취소하기
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 8,
        marginTop: 26,
      }}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            height: 72,
            borderRadius: 14,
            background: "hsl(var(--card))",
          }}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 60,
        gap: 10,
        textAlign: "center",
      }}
    >
      <span style={{ fontSize: 36 }}>🍽️</span>
      <p style={{ fontSize: 16, fontWeight: 700, color: "hsl(var(--foreground))" }}>
        오늘 식사 일정 없음
      </p>
      <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
        관리 탭에서 식사 일정을 등록해주세요
      </p>
    </div>
  );
}
