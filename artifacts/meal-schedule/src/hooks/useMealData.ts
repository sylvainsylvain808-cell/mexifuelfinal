import { useState, useEffect, useCallback } from "react";
import type { MealEntry } from "@/lib/storage";
import { fetchMealData } from "@/lib/api";

export interface UseMealDataResult {
  schedule: MealEntry[];
  loading: boolean;
  error: string;
  reload: () => void;
}

export function useMealData(): UseMealDataResult {
  const [schedule, setSchedule] = useState<MealEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    fetchMealData()
      .then((data) => {
        setSchedule(data);
        setError("");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    window.addEventListener("meal-schedule-updated", reload);
    return () => window.removeEventListener("meal-schedule-updated", reload);
  }, [reload]);

  return { schedule, loading, error, reload };
}
