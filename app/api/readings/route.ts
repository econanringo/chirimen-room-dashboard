import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  aggregateReadings,
  isRangeKey,
  serializeReading,
  windowForRange,
  type RangeKey,
} from "@/lib/readings";

export const dynamic = "force-dynamic";

function parseEnd(value: string | null): Date {
  if (!value) {
    return new Date();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: NextRequest) {
  const rangeParam = request.nextUrl.searchParams.get("range") ?? "week";
  const range: RangeKey = isRangeKey(rangeParam) ? rangeParam : "week";
  const end = parseEnd(request.nextUrl.searchParams.get("end"));
  const { start } = windowForRange(range, end);
  const hasLive = await prisma.reading.findFirst({
    where: { source: "live" },
    select: { id: true },
  });
  const source = hasLive ? "live" : undefined;

  const [latest, readings] = await Promise.all([
    prisma.reading.findFirst({
      where: source ? { source } : undefined,
      orderBy: { recordedAt: "desc" },
    }),
    prisma.reading.findMany({
      where: {
        ...(source ? { source } : {}),
        recordedAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { recordedAt: "asc" },
    }),
  ]);

  const aggregated = aggregateReadings(readings, range, start, end);

  return Response.json(
    {
      latest: latest ? serializeReading(latest) : null,
      range: {
        key: range,
        start: start.toISOString(),
        end: end.toISOString(),
      },
      ...aggregated,
    },
    { headers: corsHeaders() },
  );
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === 1 || value === "1" || value === "true") {
    return true;
  }
  if (value === 0 || value === "0" || value === "false") {
    return false;
  }
  return null;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders() });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Expected an object" }, { status: 400, headers: corsHeaders() });
  }

  const payload = body as Record<string, unknown>;
  const temperature = asNumber(payload.temperature);
  const humidity = asNumber(payload.humidity);

  if (temperature == null || humidity == null) {
    return Response.json(
      { error: "temperature and humidity are required" },
      { status: 400, headers: corsHeaders() },
    );
  }

  const recordedAt = payload.recordedAt ? parseEnd(String(payload.recordedAt)) : new Date();
  const windowStart = new Date(recordedAt.getTime() - 1000);
  const windowEnd = new Date(recordedAt.getTime() + 1000);

  const existing = await prisma.reading.findFirst({
    where: {
      recordedAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    orderBy: { recordedAt: "desc" },
  });

  if (existing) {
    return Response.json(serializeReading(existing), { headers: corsHeaders() });
  }

  const created = await prisma.reading.create({
    data: {
      recordedAt,
      temperature,
      humidity,
      pressure: asNumber(payload.pressure),
      light: asNumber(payload.light),
      occupied: asBoolean(payload.occupied),
      source: "live",
    },
  });

  return Response.json(serializeReading(created), { status: 201, headers: corsHeaders() });
}
