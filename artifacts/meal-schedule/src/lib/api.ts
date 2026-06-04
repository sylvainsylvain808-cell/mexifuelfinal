import type { MealEntry } from "./storage";

async function readMealData(res: Response): Promise<MealEntry[] | null> {
  if (!res.ok) return null;
  try {
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as MealEntry[]) : null;
  } catch {
    return null;
  }
}

export async function fetchMealData(): Promise<MealEntry[]> {
  const apiData = await readMealData(await fetch("/api/meal-data"));
  if (apiData) return apiData;

  const fallbackData = await readMealData(await fetch("/meal-data.json"));
  if (fallbackData) return fallbackData;

  throw new Error("Failed to fetch meal data");
}

export async function saveMealData(entries: MealEntry[]): Promise<void> {
  const res = await fetch("/api/meal-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entries),
  });
  if (!res.ok) throw new Error(`Failed to save meal data: ${res.status}`);
}
