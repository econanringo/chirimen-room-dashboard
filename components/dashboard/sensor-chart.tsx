"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import {
  formatAxisTick,
  formatDateTime,
  formatMetricNumber,
  formatMetricWithUnit,
  METRIC_LABELS,
  metricUnit,
} from "@/lib/format";
import type { ChartPoint, MetricKey, MetricStats, RangeKey } from "@/lib/readings";

type SensorChartProps = {
  metric: MetricKey;
  range: RangeKey;
  chartType: "line" | "bar";
  points: ChartPoint[];
  stats: MetricStats | null;
  occupiedAsRate: boolean;
  start: Date;
  end: Date;
};

const chartConfig = {
  value: {
    label: "値",
    color: "var(--foreground)",
  },
} satisfies ChartConfig;

function ChartTooltipBody({
  active,
  payload,
  metric,
  occupiedAsRate,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: ChartPoint }>;
  metric: MetricKey;
  occupiedAsRate: boolean;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const point = payload[0]?.payload;
  const value = payload[0]?.value;
  if (!point || typeof value !== "number") {
    return null;
  }

  return (
    <div className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium shadow-sm">
      {formatMetricWithUnit(metric, value, occupiedAsRate)}{" "}
      <span className="text-muted-foreground">{formatDateTime(new Date(point.t))}</span>
    </div>
  );
}

function yDomain(
  metric: MetricKey,
  occupiedAsRate: boolean,
  stats: MetricStats | null,
): [number, number] | ["auto", "auto"] {
  if (!stats) {
    return ["auto", "auto"];
  }
  if (metric === "occupied" && !occupiedAsRate) {
    return [-0.05, 1.05];
  }
  const span = Math.max(stats.max - stats.min, metric === "occupied" ? 10 : 1);
  const padding = span * 0.18;
  return [stats.min - padding, stats.max + padding];
}

export function SensorChart({
  metric,
  range,
  chartType,
  points,
  stats,
  occupiedAsRate,
  start,
  end,
}: SensorChartProps) {
  const unit = metricUnit(metric, occupiedAsRate);
  const data = points.map((point) => ({ ...point }));
  const domain = yDomain(metric, occupiedAsRate, stats);
  const yTicks =
    metric === "occupied" && !occupiedAsRate ? [0, 1] : undefined;

  return (
    <Card className="shadow-none ring-foreground/8">
      <CardContent className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-medium">{METRIC_LABELS[metric]}</h2>
        <div className="flex min-h-56 gap-3 md:min-h-80 lg:min-h-112">
          <div className="flex w-16 shrink-0 flex-col justify-between py-2 text-xs">
            <div>
              <p className="text-muted-foreground">最高</p>
              <p className="font-heading text-sm font-medium">
                {stats ? formatMetricNumber(metric, stats.max, occupiedAsRate) : "--"}
                {stats && unit ? <span className="text-[10px]">{unit}</span> : null}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">平均</p>
              <p className="font-heading text-sm font-medium">
                {stats ? formatMetricNumber(metric, stats.avg, occupiedAsRate) : "--"}
                {stats && unit ? <span className="text-[10px]">{unit}</span> : null}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">最低</p>
              <p className="font-heading text-sm font-medium">
                {stats ? formatMetricNumber(metric, stats.min, occupiedAsRate) : "--"}
                {stats && unit ? <span className="text-[10px]">{unit}</span> : null}
              </p>
            </div>
          </div>
          <ChartContainer config={chartConfig} className="aspect-auto! h-56 w-full flex-1 md:h-80 lg:h-112">
            {chartType === "bar" ? (
              <BarChart
                data={data}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="t"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tickFormatter={(value) => formatAxisTick(Number(value), range)}
                />
                <YAxis
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  domain={domain}
                  ticks={yTicks}
                  tickFormatter={(value) =>
                    metric === "occupied" && !occupiedAsRate
                      ? Number(value) >= 0.5
                        ? "在室"
                        : "不在"
                      : String(Math.round(Number(value)))
                  }
                />
                {stats ? (
                  <ReferenceLine
                    y={stats.avg}
                    stroke="var(--color-border)"
                    strokeDasharray="4 4"
                  />
                ) : null}
                <ChartTooltip
                  cursor={{ stroke: "var(--color-value)", strokeWidth: 1 }}
                  content={
                    <ChartTooltipBody metric={metric} occupiedAsRate={occupiedAsRate} />
                  }
                />
                <Bar
                  dataKey="value"
                  fill="var(--color-value)"
                  radius={3}
                  isAnimationActive={false}
                />
              </BarChart>
            ) : (
              <LineChart
                data={data}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="t"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tickFormatter={(value) => formatAxisTick(Number(value), range)}
                />
                <YAxis
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  domain={domain}
                  ticks={yTicks}
                  tickFormatter={(value) =>
                    metric === "occupied" && !occupiedAsRate
                      ? Number(value) >= 0.5
                        ? "在室"
                        : "不在"
                      : String(Math.round(Number(value)))
                  }
                />
                {stats ? (
                  <ReferenceLine
                    y={stats.avg}
                    stroke="var(--color-border)"
                    strokeDasharray="4 4"
                  />
                ) : null}
                <ChartTooltip
                  cursor={{ stroke: "var(--color-value)", strokeWidth: 1 }}
                  content={
                    <ChartTooltipBody metric={metric} occupiedAsRate={occupiedAsRate} />
                  }
                />
                <Area
                  dataKey="value"
                  type="monotone"
                  fill="var(--color-value)"
                  fillOpacity={0.06}
                  stroke="none"
                  isAnimationActive={false}
                />
                <Line
                  dataKey="value"
                  type={metric === "occupied" && !occupiedAsRate ? "stepAfter" : "monotone"}
                  stroke="var(--color-value)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  activeDot={{
                    r: 5,
                    strokeWidth: 2,
                    fill: "var(--background)",
                    stroke: "var(--color-value)",
                  }}
                />
              </LineChart>
            )}
          </ChartContainer>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {formatDateTime(start)} ~ {formatDateTime(end)}
        </p>
      </CardContent>
    </Card>
  );
}
