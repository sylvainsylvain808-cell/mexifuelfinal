import { useState, useEffect } from "react";
import {
  getSelectedUser,
  getEntryForDate,
  getWeekDates,
  formatDate,
  formatWeekday,
  getTodayString,
} from "@/lib/storage";
import { useMealData } from "@/hooks/useMealData";

export default function Week() {
  const [selectedUser, setSelectedUser] = useState(getSelectedUser);
  const { schedule, loading, error } = useMealData();

  useEffect(() => {
    const onUpdate = () => setSelectedUser(getSelectedUser());
    window.addEventListener("meal-schedule-updated", onUpdate);
    return () => window.removeEventListener("meal-schedule-updated", onUpdate);
  }, []);

  const weekDates = getWeekDates();
  const today = getTodayString();

  return (
    <div className="flex flex-col gap-4 px-4 py-6 max-w-md mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold">이번 주</h1>
        <p className="text-sm mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
          주간 식사 일정
        </p>
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          {weekDates.map((d) => (
            <div
              key={d}
              className="rounded-2xl animate-pulse"
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", height: 72 }}
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
          <div className="flex flex-col gap-3">
            {weekDates.map((date) => {
              const entry = getEntryForDate(schedule, date);
              const isToday = date === today;
              const isIncluded = !!selectedUser && !!entry && entry.users.includes(selectedUser);
              const isPast = date < today;

              return (
                <div
                  key={date}
                  data-testid={`card-week-${date}`}
                  className="rounded-2xl p-4 transition-all"
                  style={{
                    background: isToday ? "hsl(var(--primary) / 0.1)" : "hsl(var(--card))",
                    border: isToday
                      ? "1px solid hsl(var(--primary) / 0.4)"
                      : "1px solid hsl(var(--border))",
                    opacity: isPast && !isToday ? 0.55 : 1,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-sm font-semibold"
                          style={{ color: isToday ? "hsl(var(--primary))" : "hsl(var(--foreground))" }}
                        >
                          {formatDate(date)}
                        </span>
                        <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                          {formatWeekday(date)}
                        </span>
                        {isToday && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{
                              background: "hsl(var(--primary))",
                              color: "hsl(var(--primary-foreground))",
                            }}
                          >
                            오늘
                          </span>
                        )}
                      </div>
                      {entry ? (
                        <p className="text-base font-medium" data-testid={`text-menu-${date}`}>
                          {entry.menu}
                        </p>
                      ) : (
                        <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                          일정 없음
                        </p>
                      )}
                    </div>

                    {selectedUser && entry && (
                      <div className="flex-shrink-0">
                        <span
                          className="text-xs px-3 py-1.5 rounded-xl font-semibold"
                          style={
                            isIncluded
                              ? {
                                  background: "hsl(142 72% 50% / 0.15)",
                                  color: "hsl(142 72% 55%)",
                                  border: "1px solid hsl(142 72% 50% / 0.3)",
                                }
                              : {
                                  background: "hsl(var(--secondary))",
                                  color: "hsl(var(--muted-foreground))",
                                }
                          }
                          data-testid={`status-week-${date}`}
                        >
                          {isIncluded ? "식사 있음" : "해당 없음"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!selectedUser && (
            <p className="text-center text-sm py-4" style={{ color: "hsl(var(--muted-foreground))" }}>
              오늘 탭에서 이름을 선택하면 식사 여부를 확인할 수 있어요
            </p>
          )}
        </>
      )}
    </div>
  );
}
