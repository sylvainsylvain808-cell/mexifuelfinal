export interface MealEntry {
  date: string;
  menu: string;
  users: string[];
}

const USER_KEY = "meal_selected_user";

export function getSelectedUser(): string {
  return localStorage.getItem(USER_KEY) ?? "";
}

export function saveSelectedUser(name: string): void {
  localStorage.setItem(USER_KEY, name);
}

export function parseTabSeparatedData(raw: string): MealEntry[] {
  const lines = raw.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split("\t").map((h) => h.trim());
  const dateIdx = header.findIndex((h) => h === "date" || h === "날짜");
  const menuIdx = header.findIndex((h) => h === "menu" || h === "메뉴");
  const usersIdx = header.findIndex((h) => h === "users" || h === "대상자" || h === "직원");
  if (dateIdx === -1 || menuIdx === -1 || usersIdx === -1) return [];
  const entries: MealEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    const date = (cols[dateIdx] ?? "").trim();
    const menu = (cols[menuIdx] ?? "").trim();
    const usersRaw = (cols[usersIdx] ?? "").trim();
    if (!date || !menu) continue;
    const users = usersRaw.split(",").map((u) => u.trim()).filter(Boolean);
    entries.push({ date, menu, users });
  }
  return entries;
}

export function getAllUsers(schedule: MealEntry[]): string[] {
  const set = new Set<string>();
  for (const entry of schedule) {
    for (const u of entry.users) set.add(u);
  }
  return Array.from(set).sort();
}

export function getEntryForDate(schedule: MealEntry[], date: string): MealEntry | undefined {
  return schedule.find((e) => e.date === date);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}월 ${day}일`;
}

export function formatWeekday(dateStr: string): string {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const d = new Date(dateStr + "T00:00:00");
  return days[d.getDay()] + "요일";
}

export function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getWeekDates(): string[] {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}

export function getMonthDates(year: number, month: number): string[] {
  const dates: string[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const m = String(month).padStart(2, "0");
    const day = String(d).padStart(2, "0");
    dates.push(`${year}-${m}-${day}`);
  }
  return dates;
}
