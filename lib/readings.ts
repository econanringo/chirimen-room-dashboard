export const RANGE_KEYS = ["hour", "day", "week", "month"] as const;

export type RangeKey = (typeof RANGE_KEYS)[number];

export const METRIC_KEYS = [
  "temperature",
  "humidity",
  "pressure",
  "light",
  "occupied",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export type SensorSample = {
  recordedAt: string;
  temperature: number;
  humidity: number;
  pressure: number | null;
  light: number | null;
  occupied: boolean | null;
};

export type ChartPoint = {
  t: number;
  value: number;
};

export type MetricStats = {
  min: number;
  avg: number;
  max: number;
};

export type ReadingsResponse = {
  latest: SensorSample | null;
  range: {
    key: RangeKey;
    start: string;
    end: string;
  };
  occupiedAsRate: boolean;
  series: Record<MetricKey, ChartPoint[]>;
  stats: Record<MetricKey, MetricStats | null>;
};

export function isRangeKey(value: string): value is RangeKey {
  return (RANGE_KEYS as readonly string[]).includes(value);
}

export function isMetricKey(value: string): value is MetricKey {
  return (METRIC_KEYS as readonly string[]).includes(value);
}

export function rangeDurationMs(key: RangeKey): number {
  switch (key) {
    case "hour":
      return 60 * 60 * 1000;
    case "day":
      return 24 * 60 * 60 * 1000;
    case "week":
      return 7 * 24 * 60 * 60 * 1000;
    case "month":
      return 30 * 24 * 60 * 60 * 1000;
  }
}

export function bucketMsForRange(key: RangeKey): number {
  switch (key) {
    case "hour":
      return 60 * 1000;
    case "day":
      return 15 * 60 * 1000;
    case "week":
      return 60 * 60 * 1000;
    case "month":
      return 3 * 60 * 60 * 1000;
  }
}

export function windowForRange(key: RangeKey, end: Date): { start: Date; end: Date } {
  return {
    start: new Date(end.getTime() - rangeDurationMs(key)),
    end,
  };
}

export function occupiedAsRate(key: RangeKey): boolean {
  return key === "week" || key === "month";
}

type NumericReading = {
  recordedAt: Date;
  temperature: number;
  humidity: number;
  pressure: number | null;
  light: number | null;
  occupied: boolean | null;
};

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function statsFromValues(values: number[]): MetricStats | null {
  if (values.length === 0) {
    return null;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = average(values);
  if (avg === null) {
    return null;
  }
  return { min, avg, max };
}

function bucketStart(timestamp: number, bucketMs: number, origin: number): number {
  return origin + Math.floor((timestamp - origin) / bucketMs) * bucketMs;
}

export function aggregateReadings(
  readings: NumericReading[],
  key: RangeKey,
  start: Date,
  end: Date,
): Pick<ReadingsResponse, "series" | "stats" | "occupiedAsRate"> {
  const bucketMs = bucketMsForRange(key);
  const origin = start.getTime();
  const asRate = occupiedAsRate(key);

  const buckets = new Map<
    number,
    {
      temperature: number[];
      humidity: number[];
      pressure: number[];
      light: number[];
      occupied: number[];
    }
  >();

  for (let t = origin; t < end.getTime(); t += bucketMs) {
    buckets.set(t, {
      temperature: [],
      humidity: [],
      pressure: [],
      light: [],
      occupied: [],
    });
  }

  const all = {
    temperature: [] as number[],
    humidity: [] as number[],
    pressure: [] as number[],
    light: [] as number[],
    occupied: [] as number[],
  };

  for (const reading of readings) {
    const t = bucketStart(reading.recordedAt.getTime(), bucketMs, origin);
    const bucket = buckets.get(t);
    if (!bucket) {
      continue;
    }

    bucket.temperature.push(reading.temperature);
    bucket.humidity.push(reading.humidity);
    all.temperature.push(reading.temperature);
    all.humidity.push(reading.humidity);

    if (reading.pressure != null) {
      bucket.pressure.push(reading.pressure);
      all.pressure.push(reading.pressure);
    }
    if (reading.light != null) {
      bucket.light.push(reading.light);
      all.light.push(reading.light);
    }
    if (reading.occupied != null) {
      const flag = reading.occupied ? 1 : 0;
      bucket.occupied.push(flag);
      all.occupied.push(flag);
    }
  }

  const toSeries = (
    metric: Exclude<MetricKey, "occupied">,
  ): ChartPoint[] => {
    const points: ChartPoint[] = [];
    for (const [t, bucket] of buckets) {
      const avg = average(bucket[metric]);
      if (avg != null) {
        points.push({ t, value: avg });
      }
    }
    return points;
  };

  const occupiedSeries: ChartPoint[] = [];
  for (const [t, bucket] of buckets) {
    if (bucket.occupied.length === 0) {
      continue;
    }
    if (asRate) {
      const rate = (average(bucket.occupied) ?? 0) * 100;
      occupiedSeries.push({ t, value: rate });
    } else {
      occupiedSeries.push({ t, value: bucket.occupied.some((flag) => flag === 1) ? 1 : 0 });
    }
  }

  const occupiedStats = statsFromValues(all.occupied);
  const occupiedDisplayStats = occupiedStats
    ? asRate
      ? {
          min: occupiedStats.min * 100,
          avg: occupiedStats.avg * 100,
          max: occupiedStats.max * 100,
        }
      : occupiedStats
    : null;

  return {
    occupiedAsRate: asRate,
    series: {
      temperature: toSeries("temperature"),
      humidity: toSeries("humidity"),
      pressure: toSeries("pressure"),
      light: toSeries("light"),
      occupied: occupiedSeries,
    },
    stats: {
      temperature: statsFromValues(all.temperature),
      humidity: statsFromValues(all.humidity),
      pressure: statsFromValues(all.pressure),
      light: statsFromValues(all.light),
      occupied: occupiedDisplayStats,
    },
  };
}

export function serializeReading(reading: NumericReading): SensorSample {
  return {
    recordedAt: reading.recordedAt.toISOString(),
    temperature: reading.temperature,
    humidity: reading.humidity,
    pressure: reading.pressure,
    light: reading.light,
    occupied: reading.occupied,
  };
}
