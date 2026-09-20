"use client";

import { useCallback, useMemo, useState } from "react";

import { MetricCards } from "@/components/dashboard/metric-cards";
import { RangeToolbar } from "@/components/dashboard/range-toolbar";
import { SensorChart } from "@/components/dashboard/sensor-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useChirimenLive } from "@/hooks/use-chirimen";
import { useReadings } from "@/hooks/use-readings";
import { formatDateTime } from "@/lib/format";
import type { MetricKey, RangeKey } from "@/lib/readings";

export function RoomDashboard() {
  const [range, setRange] = useState<RangeKey>("week");
  const [metric, setMetric] = useState<MetricKey>("temperature");
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [end, setEnd] = useState(() => new Date());

  const { data, error, loading, refresh } = useReadings(range, end);
  const onPersisted = useCallback(() => {
    void refresh();
  }, [refresh]);
  const { live, connected } = useChirimenLive(onPersisted, data?.latest ?? null);

  const latest = live ?? data?.latest ?? null;
  const start = useMemo(
    () => (data ? new Date(data.range.start) : null),
    [data],
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">部屋のようす</p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">ダッシュボード</h1>
        </div>
        <p className="max-w-36 text-right text-xs text-muted-foreground">
          {live ? "ライブ受信" : connected ? "リレー待機" : "履歴表示"}
          {latest ? (
            <>
              <br />
              {formatDateTime(new Date(latest.recordedAt))}
            </>
          ) : null}
        </p>
      </header>

      <MetricCards latest={latest} selected={metric} onSelect={setMetric} />
      <RangeToolbar
        range={range}
        end={end}
        chartType={chartType}
        onRangeChange={setRange}
        onEndChange={setEnd}
        onChartTypeChange={setChartType}
      />

      {loading && !data ? (
        <Skeleton className="h-80 w-full rounded-4xl" />
      ) : error ? (
        <p className="rounded-4xl bg-destructive/10 px-4 py-6 text-sm text-destructive">
          {error}
        </p>
      ) : data && start ? (
        <SensorChart
          metric={metric}
          range={range}
          chartType={chartType}
          points={data.series[metric]}
          stats={data.stats[metric]}
          occupiedAsRate={metric === "occupied" ? data.occupiedAsRate : false}
          start={start}
          end={new Date(data.range.end)}
        />
      ) : (
        <p className="rounded-4xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          データがありません
        </p>
      )}
    </div>
  );
}
