import { useState, useEffect } from "react";
import {
  getSelectedUser,
  saveSelectedUser,
  getAllUsers,
  getEntryForDate,
  getTodayString,
  formatDate,
  formatWeekday,
} from "@/lib/storage";
import { useMealData } from "@/hooks/useMealData";

export default function TodayMenu() {
  const [selectedUser, setSelectedUser] = useState(getSelectedUser);
  const { schedule, loading, error } = useMealData();

  useEffect(() => {
    const onStorage = () => setSelectedUser(getSelectedUser());
    window.addEventListener("meal-schedule-updated", onStorage);
    return () => window.removeEventListener("meal-schedule-updated", onStorage);
  }, []);

  const today = getTodayString();
  const entry = getEntryForDate(schedule, today);
  const users = getAllUsers(schedule);
  const isIncluded = !!selectedUser && !!entry && entry.users.includes(selectedUser);

  function handleUserChange(name: string) {
    setSelectedUser(name);
    saveSelectedUser(name);
  }

  const dayOfWeekLabel = formatWeekday(today);
  const dateLabel = formatDate(today);

  return (
    <div className="flex flex-col gap-5 px-4 py-6 max-w-md mx-auto w-full">
      <div>
        <p className="text-sm font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
          {dayOfWeekLabel}
        </p>
        <h1 className="text-2xl font-bold mt-0.5" data-testid="text-today-date">
          {dateLabel}
        </h1>
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl p-5 animate-pulse"
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", height: 80 }}
            />
          ))}
        </div>
      )}

      {error && !loading && (
        <div
          className="rounded-2xl px-4 py-3 text-sm"
          style={{
            background: "hsl(0 72% 55% / 0.1)",
            color: "hsl(0 72% 60%)",
            border: "1px solid hsl(0 72% 55% / 0.3)",
          }}
        >
          데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </div>
      )}

      {!loading && !error && (
        <>
          <div
            className="rounded-2xl p-5"
            style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
              오늘의 메뉴
            </p>
            {entry ? (
              <p className="text-xl font-bold" data-testid="text-today-menu">{entry.menu}</p>
            ) : (
              <p className="text-base" style={{ color: "hsl(var(--muted-foreground))" }} data-testid="text-no-menu">
                오늘 등록된 메뉴가 없습니다
              </p>
            )}
          </div>

          <div
            className="rounded-2xl p-5"
            style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>
              내 이름 선택
            </p>
            {users.length === 0 ? (
              <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                관리 탭에서 일정을 먼저 등록해주세요
              </p>
            ) : (
              <div className="flex flex-wrap gap-2" data-testid="user-list">
                {users.map((u) => (
                  <button
                    key={u}
                    data-testid={`button-user-${u}`}
                    onClick={() => handleUserChange(u)}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
                    style={
                      selectedUser === u
                        ? {
                            background: "hsl(var(--primary))",
                            color: "hsl(var(--primary-foreground))",
                          }
                        : {
                            background: "hsl(var(--secondary))",
                            color: "hsl(var(--secondary-foreground))",
                          }
                    }
                  >
                    {u}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedUser && entry && (
            <div
              className="rounded-2xl p-5"
              style={{
                background: isIncluded ? "hsl(142 72% 50% / 0.12)" : "hsl(0 72% 55% / 0.10)",
                border: `1px solid ${isIncluded ? "hsl(142 72% 50% / 0.3)" : "hsl(0 72% 55% / 0.3)"}`,
              }}
              data-testid="meal-status"
            >
              <p
                className="text-lg font-bold text-center"
                style={{ color: isIncluded ? "hsl(142 72% 55%)" : "hsl(0 72% 60%)" }}
              >
                {isIncluded ? "오늘 식사 대상입니다" : "오늘은 식사 대상이 아닙니다"}
              </p>
            </div>
          )}

          {selectedUser && !entry && users.length > 0 && (
            <div
              className="rounded-2xl p-5"
              style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}
              data-testid="meal-status-no-entry"
            >
              <p className="text-base text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
                오늘 식사 일정이 없습니다
              </p>
            </div>
          )}

          {entry && entry.users.length > 0 && (
            <div
              className="rounded-2xl p-5"
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>
                오늘 식사 대상자
              </p>
              <div className="flex flex-wrap gap-2">
                {entry.users.map((u) => (
                  <span
                    key={u}
                    className="px-3 py-1 rounded-lg text-sm font-medium"
                    style={{
                      background: u === selectedUser ? "hsl(var(--primary) / 0.2)" : "hsl(var(--secondary))",
                      color: u === selectedUser ? "hsl(var(--primary))" : "hsl(var(--secondary-foreground))",
                      border: u === selectedUser ? "1px solid hsl(var(--primary) / 0.4)" : "1px solid transparent",
                    }}
                  >
                    {u}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
