export interface CheckinRecord {
  done: boolean;
  time: string;
}

export interface CheckinState {
  date: string;
  records: Record<string, CheckinRecord>;
}

const KEY = "meal_checkin_v1";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const SUPABASE_TABLE = "meal_checkins";

interface SupabaseCheckinRow {
  date: string;
  name: string;
  time: string;
}

export function hasRemoteCheckinStore(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}

function getSupabaseEndpoint(query = ""): string {
  return `${SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/${SUPABASE_TABLE}${query}`;
}

async function supabaseFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function rowsToState(today: string, rows: SupabaseCheckinRow[]): CheckinState {
  const records: CheckinState["records"] = {};
  for (const row of rows) {
    if (!row.name) continue;
    records[row.name] = { done: true, time: row.time };
  }
  return { date: today, records };
}

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

export async function loadSharedCheckinState(today: string): Promise<CheckinState> {
  if (!hasRemoteCheckinStore()) return loadCheckinState(today);

  const query = `?select=date,name,time&date=eq.${encodeURIComponent(today)}`;
  const res = await supabaseFetch(getSupabaseEndpoint(query));
  if (!res.ok) throw new Error(`Failed to load checkins: ${res.status}`);

  const rows = (await res.json()) as SupabaseCheckinRow[];
  const state = rowsToState(today, rows);
  saveCheckinState(state);
  return state;
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

export async function markDoneShared(state: CheckinState, name: string): Promise<CheckinState> {
  const next = markDone(state, name);
  if (!hasRemoteCheckinStore()) return next;

  const time = next.records[name]?.time ?? "";
  const res = await supabaseFetch(getSupabaseEndpoint("?on_conflict=date,name"), {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ date: state.date, name, time }),
  });
  if (!res.ok) throw new Error(`Failed to save checkin: ${res.status}`);
  return next;
}

export function unmark(state: CheckinState, name: string): CheckinState {
  const records = { ...state.records };
  delete records[name];
  const next: CheckinState = { ...state, records };
  saveCheckinState(next);
  return next;
}

export async function unmarkShared(state: CheckinState, name: string): Promise<CheckinState> {
  const next = unmark(state, name);
  if (!hasRemoteCheckinStore()) return next;

  const query = `?date=eq.${encodeURIComponent(state.date)}&name=eq.${encodeURIComponent(name)}`;
  const res = await supabaseFetch(getSupabaseEndpoint(query), { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete checkin: ${res.status}`);
  return next;
}
