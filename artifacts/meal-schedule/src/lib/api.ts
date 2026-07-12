import type { MealEntry } from "./storage";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const SUPABASE_MEAL_TABLE = "meal_schedules";

interface SupabaseMealRow {
  date: string;
  menu: string;
  users: string[];
  ticket_users?: string[] | null;
}

async function readMealData(res: Response): Promise<MealEntry[] | null> {
  if (!res.ok) return null;
  try {
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as MealEntry[]) : null;
  } catch {
    return null;
  }
}

function hasRemoteMealDataStore(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}

function getSupabaseEndpoint(query = ""): string {
  return `${SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/${SUPABASE_MEAL_TABLE}${query}`;
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

function normalizeMealEntries(entries: MealEntry[]): MealEntry[] {
  return entries
    .filter((entry) => entry.date && entry.menu)
    .map((entry) => ({
      date: entry.date,
      menu: entry.menu,
      users: Array.from(new Set(entry.users.filter(Boolean))),
      ticketUsers: entry.ticketUsers
        ? Array.from(new Set(entry.ticketUsers.filter(Boolean)))
        : undefined,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchRemoteMealData(): Promise<MealEntry[] | null> {
  if (!hasRemoteMealDataStore()) return null;

  let res = await supabaseFetch(getSupabaseEndpoint("?select=date,menu,users,ticket_users&order=date.asc"));
  if (!res.ok) {
    res = await supabaseFetch(getSupabaseEndpoint("?select=date,menu,users&order=date.asc"));
  }
  if (!res.ok) return null;

  const rows = (await res.json()) as SupabaseMealRow[];
  if (!Array.isArray(rows) || rows.length === 0) return null;

  return normalizeMealEntries(
    rows.map((row) => ({
      date: row.date,
      menu: row.menu,
      users: row.users,
      ticketUsers: row.ticket_users ?? undefined,
    })),
  );
}

async function saveRemoteMealData(entries: MealEntry[]): Promise<void> {
  if (!hasRemoteMealDataStore()) {
    throw new Error("Supabase 환경변수가 없습니다.");
  }

  const normalized = normalizeMealEntries(entries);
  const deleteRes = await supabaseFetch(getSupabaseEndpoint("?date=not.is.null"), {
    method: "DELETE",
  });
  if (!deleteRes.ok) throw new Error(`Failed to clear remote meal data: ${deleteRes.status}`);

  if (normalized.length === 0) return;

  const rows = normalized.map((entry) => ({
    date: entry.date,
    menu: entry.menu,
    users: entry.users,
    ticket_users: entry.ticketUsers ?? entry.users,
  }));

  const saveRes = await supabaseFetch(getSupabaseEndpoint("?on_conflict=date,menu"), {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(rows),
  });
  if (!saveRes.ok) throw new Error(`Failed to save remote meal data: ${saveRes.status}`);
}

export async function fetchMealData(): Promise<MealEntry[]> {
  const remoteData = await fetchRemoteMealData();
  if (remoteData) return remoteData;

  const apiData = await readMealData(await fetch("/api/meal-data"));
  if (apiData) return apiData;

  const fallbackData = await readMealData(await fetch("/meal-data.json"));
  if (fallbackData) return fallbackData;

  throw new Error("Failed to fetch meal data");
}

export async function saveMealData(entries: MealEntry[]): Promise<void> {
  if (hasRemoteMealDataStore()) {
    await saveRemoteMealData(entries);
    return;
  }

  const res = await fetch("/api/meal-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entries),
  });
  if (!res.ok) throw new Error(`Failed to save meal data: ${res.status}`);
}
