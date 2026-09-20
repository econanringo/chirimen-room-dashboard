"use client";

import {
  Droplets,
  Gauge,
  SunMedium,
  Thermometer,
  UserRound,
} from "lucide-react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatMetricNumber,
  METRIC_LABELS,
  metricUnit,
} from "@/lib/format";
import type { MetricKey, SensorSample } from "@/lib/readings";

const ICONS = {
  temperature: Thermometer,
  humidity: Droplets,
  pressure: Gauge,
  light: SunMedium,
  occupied: UserRound,
} as const;

const ICON_COLORS = {
  temperature: "text-emerald-500",
  humidity: "text-sky-500",
  pressure: "text-amber-500",
  light: "text-yellow-500",
  occupied: "text-violet-500",
} as const;

type MetricCardsProps = {
  latest: SensorSample | null;
  selected: MetricKey;
  onSelect: (metric: MetricKey) => void;
};

function valueOf(latest: SensorSample | null, metric: MetricKey): number | null {
  if (!latest) {
    return null;
  }
  if (metric === "occupied") {
    if (latest.occupied == null) {
      return null;
    }
    return latest.occupied ? 1 : 0;
  }
  const value = latest[metric];
  return typeof value === "number" ? value : null;
}

function HeroCard({
  metric,
  latest,
  selected,
  onSelect,
}: {
  metric: "temperature" | "humidity";
  latest: SensorSample | null;
  selected: MetricKey;
  onSelect: (metric: MetricKey) => void;
}) {
  const Icon = ICONS[metric];
  const value = valueOf(latest, metric);

  return (
    <Card
      size="sm"
      className={cn(
        "cursor-pointer py-4 shadow-none ring-foreground/8 transition-shadow",
        selected === metric && "ring-2 ring-foreground/20",
      )}
    >
      <CardContent>
        <button
          type="button"
          className="flex w-full flex-col items-start gap-3 text-left"
          onClick={() => onSelect(metric)}
        >
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Icon className={cn("size-4", ICON_COLORS[metric])} />
            {METRIC_LABELS[metric]}
          </span>
          <span className="flex items-end gap-1 font-heading">
            <span className="text-4xl font-semibold tracking-tight">
              {value == null ? "--" : formatMetricNumber(metric, value, false)}
            </span>
            <span className="mb-1 text-base text-muted-foreground">
              {metricUnit(metric, false)}
            </span>
          </span>
        </button>
      </CardContent>
    </Card>
  );
}

function RowCard({
  metric,
  latest,
  selected,
  onSelect,
}: {
  metric: Exclude<MetricKey, "temperature" | "humidity">;
  latest: SensorSample | null;
  selected: MetricKey;
  onSelect: (metric: MetricKey) => void;
}) {
  const Icon = ICONS[metric];
  const value = valueOf(latest, metric);

  return (
    <button
      type="button"
      onClick={() => onSelect(metric)}
      className={cn(
        "flex w-full items-center justify-between rounded-3xl px-4 py-3 text-left transition-colors hover:bg-muted/60",
        selected === metric && "bg-muted",
      )}
    >
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={cn("size-4", ICON_COLORS[metric])} />
        {METRIC_LABELS[metric]}
      </span>
      {metric === "occupied" ? (
        <Badge variant={value === 1 ? "default" : "secondary"}>
          {value == null ? "不明" : value === 1 ? "在室" : "不在"}
        </Badge>
      ) : (
        <span className="font-heading text-lg font-medium">
          {value == null ? "--" : formatMetricNumber(metric, value, false)}
          <span className="ml-0.5 text-sm font-normal text-muted-foreground">
            {metricUnit(metric, false)}
          </span>
        </span>
      )}
    </button>
  );
}

export function MetricCards({ latest, selected, onSelect }: MetricCardsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <HeroCard
          metric="temperature"
          latest={latest}
          selected={selected}
          onSelect={onSelect}
        />
        <HeroCard
          metric="humidity"
          latest={latest}
          selected={selected}
          onSelect={onSelect}
        />
      </div>
      <Card size="sm" className="gap-0 py-1 shadow-none ring-foreground/8">
        <RowCard metric="pressure" latest={latest} selected={selected} onSelect={onSelect} />
        <RowCard metric="light" latest={latest} selected={selected} onSelect={onSelect} />
        <RowCard metric="occupied" latest={latest} selected={selected} onSelect={onSelect} />
      </Card>
    </div>
  );
}
