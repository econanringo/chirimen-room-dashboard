export const REFRESH_INTERVAL_MS = 10_000;

export function elapsedRefreshMs(startedAt: number, now = Date.now()) {
  return (now - startedAt) % REFRESH_INTERVAL_MS;
}

export function remainingRefreshSeconds(elapsedMs: number | null) {
  return Math.max(
    0,
    Math.ceil((REFRESH_INTERVAL_MS - (elapsedMs ?? 0)) / 1000),
  );
}
