import type { MetricKey, RangeKey } from "@/lib/readings";

export const RANGE_LABELS: Record<RangeKey, string> = {
  hour: "時",
  day: "日",
  week: "週",
  month: "月",
};

export const METRIC_LABELS: Record<MetricKey, string> = {
  temperature: "温度",
  humidity: "相対湿度",
  pressure: "気圧",
  light: "明るさ",
  occupied: "在室",
};

export function formatDateTime(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

export function formatAxisTick(timestamp: number, range: RangeKey) {
  const date = new Date(timestamp);
  const md = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
  const hm = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  if (range === "hour") {
    return hm;
  }
  if (range === "day") {
    return hm;
  }
  if (range === "week") {
    return md;
  }
  return md;
}

export function formatMetricNumber(
  metric: MetricKey,
  value: number,
  occupiedAsRate: boolean,
) {
  if (metric === "occupied") {
    if (occupiedAsRate) {
      return `${Math.round(value)}`;
    }
    return value >= 0.5 ? "在室" : "不在";
  }
  if (metric === "temperature" || metric === "pressure") {
    return value.toFixed(1);
  }
  return String(Math.round(value));
}

export function metricUnit(metric: MetricKey, occupiedAsRate: boolean) {
  switch (metric) {
    case "temperature":
      return "℃";
    case "humidity":
    case "light":
      return "%";
    case "pressure":
      return "hPa";
    case "occupied":
      return occupiedAsRate ? "%" : "";
  }
}

export function formatMetricWithUnit(
  metric: MetricKey,
  value: number,
  occupiedAsRate: boolean,
) {
  if (metric === "occupied" && !occupiedAsRate) {
    return value >= 0.5 ? "在室" : "不在";
  }
  return `${formatMetricNumber(metric, value, occupiedAsRate)}${metricUnit(metric, occupiedAsRate)}`;
}
