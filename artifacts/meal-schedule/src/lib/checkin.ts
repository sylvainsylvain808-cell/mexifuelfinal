export interface CheckinRecord {
  done: boolean;
  time: string;
}

export interface CheckinState {
  date: string;
  records: Record<string, CheckinRecord>;
}

const KEY = "meal_checkin_v1";

export function loadCheckinState(today: string): CheckinState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { date: today, records: {} };
    const parsed = JSON.parse(raw) as CheckinState;
    if (parsed.date !== today) return { date: today, records: {} };
    return parsed;
  } catch {
    return { date: today, records: {} };
  }
}

export function saveCheckinState(state: CheckinState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function markDone(state: CheckinState, name: string): CheckinState {
  const now = new Date();
  const time = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const next: CheckinState = {
    ...state,
    records: { ...state.records, [name]: { done: true, time } },
  };
  saveCheckinState(next);
  return next;
}

export function unmark(state: CheckinState, name: string): CheckinState {
  const records = { ...state.records };
  delete records[name];
  const next: CheckinState = { ...state, records };
  saveCheckinState(next);
  return next;
}
