"use client";

import { useEffect, useState } from "react";

import { Progress, ProgressLabel } from "@/components/ui/progress";
import {
  REFRESH_INTERVAL_MS,
  elapsedRefreshMs,
  remainingRefreshSeconds,
} from "@/lib/refresh";

export function RefreshProgress() {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    let frame = 0;
    const tick = () => {
      setElapsedMs(elapsedRefreshMs(startedAt));
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <Progress
      value={elapsedMs}
      max={REFRESH_INTERVAL_MS}
      locale="ja"
      className="w-full gap-0 [&_[data-slot=progress-indicator]]:transition-none [&_[data-slot=progress-track]]:bg-foreground/10"
      getAriaValueText={(_, value) =>
        `次の更新まであと${remainingRefreshSeconds(value)}秒`
      }
    >
      <ProgressLabel className="sr-only">次の更新</ProgressLabel>
    </Progress>
  );
}
