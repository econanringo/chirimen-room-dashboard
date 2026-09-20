"use client";

import { useCallback, useMemo, useState } from "react";

import { LiveClock } from "@/components/dashboard/live-clock";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { RangeToolbar } from "@/components/dashboard/range-toolbar";
import { RefreshProgress } from "@/components/dashboard/refresh-progress";
import { SensorChart } from "@/components/dashboard/sensor-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useChirimenLive } from "@/hooks/use-chirimen";
import { useReadings } from "@/hooks/use-readings";
import {
  applyLiveSampleToSeries,
  resolveQueryEnd,
  type MetricKey,
  type RangeKey,
} from "@/lib/readings";

export function RoomDashboard() {
  const [range, setRange] = useState<RangeKey>("week");
  const [metric, setMetric] = useState<MetricKey>("temperature");
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [end, setEnd] = useState(() => new Date());

  const { data, error, loading, refresh } = useReadings(range, end);
  const onPersisted = useCallback(() => {
    void refresh();
  }, [refresh]);
  const { live, request } = useChirimenLive(onPersisted, data?.latest ?? null);
  const onCycle = useCallback(() => {
    request();
    void refresh().catch(() => undefined);
  }, [refresh, request]);

  const latest = live ?? data?.latest ?? null;
  const start = useMemo(
    () => (data ? new Date(data.range.start) : null),
    [data],
  );
  const occupiedAsRate = metric === "occupied" && (data?.occupiedAsRate ?? false);
  const liveChart = useMemo(() => {
    if (!data || !start) {
      return null;
    }
    return applyLiveSampleToSeries(
      data.series[metric],
      data.stats[metric],
      live,
      metric,
      range,
      start,
      occupiedAsRate,
    );
  }, [data, live, metric, occupiedAsRate, range, start]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 md:gap-5 md:py-8 lg:px-8 lg:py-10">
      <header className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">部屋のようす</p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
              ダッシュボード
            </h1>
          </div>
          <LiveClock />
        </div>
        <RefreshProgress onCycle={onCycle} />
      </header>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <MetricCards latest={latest} selected={metric} onSelect={setMetric} />
        <div className="flex min-w-0 flex-col gap-4">
          <RangeToolbar
            range={range}
            end={end}
            chartType={chartType}
            onRangeChange={setRange}
            onEndChange={setEnd}
            onChartTypeChange={setChartType}
          />

          {loading && !data ? (
            <Skeleton className="h-80 w-full rounded-4xl lg:h-112" />
          ) : error ? (
            <p className="rounded-4xl bg-destructive/10 px-4 py-6 text-sm text-destructive">
              {error}
            </p>
          ) : data && start && liveChart ? (
            <SensorChart
              metric={metric}
              range={range}
              chartType={chartType}
              points={liveChart.points}
              stats={liveChart.stats}
              occupiedAsRate={occupiedAsRate}
              start={start}
              end={resolveQueryEnd(end)}
            />
          ) : (
            <p className="rounded-4xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
              データがありません
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
