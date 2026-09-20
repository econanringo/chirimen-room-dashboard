"use client";

import { useCallback, useEffect, useState } from "react";

import { REFRESH_INTERVAL_MS } from "@/lib/refresh";
import { resolveQueryEnd, type RangeKey, type ReadingsResponse } from "@/lib/readings";

export function useReadings(range: RangeKey, end: Date) {
  const [data, setData] = useState<ReadingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams({
      range,
      end: resolveQueryEnd(end).toISOString(),
    });
    const response = await fetch(`/api/readings?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("履歴の取得に失敗しました");
    }
    const json = (await response.json()) as ReadingsResponse;
    setData(json);
    setError(null);
  }, [end, range]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh()
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "読み込みエラー");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refresh]);

  return { data, error, loading, refresh };
}
