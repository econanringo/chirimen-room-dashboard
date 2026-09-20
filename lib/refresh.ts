export const REFRESH_INTERVAL_MS = 10_000;

export function localTimeMs(date = new Date()) {
  return (
    ((date.getHours() * 60 + date.getMinutes()) * 60 + date.getSeconds()) *
      1000 +
    date.getMilliseconds()
  );
}

export function elapsedRefreshMs(date = new Date()) {
  return localTimeMs(date) % REFRESH_INTERVAL_MS;
}

export function refreshCycleIndex(date = new Date()) {
  return Math.floor(localTimeMs(date) / REFRESH_INTERVAL_MS);
}

export function remainingRefreshSeconds(elapsedMs: number | null) {
  return Math.max(
    0,
    Math.ceil((REFRESH_INTERVAL_MS - (elapsedMs ?? 0)) / 1000),
  );
}
