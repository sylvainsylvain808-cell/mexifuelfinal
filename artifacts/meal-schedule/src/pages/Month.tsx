import { useState, useEffect } from "react";
import {
  getSelectedUser,
  getEntryForDate,
  getMonthDates,
  formatDate,
  formatWeekday,
  getTodayString,
} from "@/lib/storage";
import { useMealData } from "@/hooks/useMealData";

export default function Month() {
  const [selectedUser, setSelectedUser] = useState(getSelectedUser);
  const { schedule, loading, error } = useMealData();

  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);

  useEffect(() => {
    const onUpdate = () => setSelectedUser(getSelectedUser());
    window.addEventListener("meal-schedule-updated", onUpdate);
    return () => window.removeEventListener("meal-schedule-updated", onUpdate);
  }, []);

  const dates = getMonthDates(year, month);
  const today = getTodayString();
  const monthLabel = `${year}년 ${month}월`;

  return (
    <div className="flex flex-col gap-4 px-4 py-6 max-w-md mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold">{monthLabel}</h1>
        <p className="text-sm mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
          월간 식사 일정
        </p>
      </div>

      {loading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl animate-pulse"
              style={{ background: "hsl(var(--card))", height: 44 }}
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
        <div className="flex flex-col gap-2">
          {dates.map((date) => {
            const entry = getEntryForDate(schedule, date);
            const isToday = date === today;
            const isIncluded = !!selectedUser && !!entry && entry.users.includes(selectedUser);
            const isPast = date < today;
            const weekday = formatWeekday(date);
            const isSunday = weekday === "일요일";
            const isSaturday = weekday === "토요일";

            if (!entry && !isToday) {
              return (
                <div
                  key={date}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                  style={{ opacity: isPast ? 0.4 : 0.6 }}
                  data-testid={`row-month-${date}`}
                >
                  <span
                    className="text-sm w-16 flex-shrink-0"
                    style={{
                      color: isSunday
                        ? "hsl(0 72% 60%)"
                        : isSaturday
                        ? "hsl(221 83% 65%)"
                        : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {formatDate(date).replace("월 ", "/").replace("일", "")}
                  </span>
                  <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {weekday.replace("요일", "")}
                  </span>
                  <span className="text-xs ml-auto" style={{ color: "hsl(var(--muted-foreground))" }}>
                    —
                  </span>
                </div>
              );
            }

            return (
              <div
                key={date}
                data-testid={`row-month-${date}`}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all"
                style={{
                  background: isIncluded
                    ? "hsl(142 72% 50% / 0.1)"
                    : isToday
                    ? "hsl(var(--primary) / 0.1)"
                    : entry
                    ? "hsl(var(--card))"
                    : "transparent",
                  border: isIncluded
                    ? "1px solid hsl(142 72% 50% / 0.25)"
                    : isToday
                    ? "1px solid hsl(var(--primary) / 0.35)"
                    : entry
                    ? "1px solid hsl(var(--border))"
                    : "none",
                  opacity: isPast && !isToday ? 0.65 : 1,
                }}
              >
                <div className="flex items-center gap-2 w-20 flex-shrink-0">
                  <span
                    className="text-sm font-semibold"
                    style={{
                      color: isToday
                        ? "hsl(var(--primary))"
                        : isSunday
                        ? "hsl(0 72% 60%)"
                        : isSaturday
                        ? "hsl(221 83% 65%)"
                        : "hsl(var(--foreground))",
                    }}
                  >
                    {formatDate(date).replace("월 ", "/").replace("일", "")}
                  </span>
                  <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {weekday.replace("요일", "")}
                  </span>
                </div>

                <span className="text-sm font-medium flex-1 truncate" data-testid={`text-menu-month-${date}`}>
                  {entry?.menu}
                </span>

                {selectedUser && entry && (
                  <span
                    className="text-xs px-2 py-1 rounded-lg flex-shrink-0 font-semibold"
                    style={
                      isIncluded
                        ? { background: "hsl(142 72% 50% / 0.2)", color: "hsl(142 72% 55%)" }
                        : { background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" }
                    }
                    data-testid={`status-month-${date}`}
                  >
                    {isIncluded ? "✓ 식사" : "제외"}
                  </span>
                )}

                {isToday && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0"
                    style={{
                      background: "hsl(var(--primary))",
                      color: "hsl(var(--primary-foreground))",
                    }}
                  >
                    오늘
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
