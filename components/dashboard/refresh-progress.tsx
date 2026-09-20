"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { Progress, ProgressLabel } from "@/components/ui/progress";
import {
  REFRESH_INTERVAL_MS,
  elapsedRefreshMs,
  refreshCycleIndex,
  remainingRefreshSeconds,
} from "@/lib/refresh";

type RefreshProgressProps = {
  onCycle: () => void;
};

export function RefreshProgress({ onCycle }: RefreshProgressProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const onCycleRef = useRef(onCycle);
  onCycleRef.current = onCycle;

  useLayoutEffect(() => {
    let lastCycle = refreshCycleIndex();
    let frame = 0;
    const tick = () => {
      const now = new Date();
      const cycle = refreshCycleIndex(now);
      setElapsedMs(elapsedRefreshMs(now));
      if (cycle !== lastCycle) {
        lastCycle = cycle;
        onCycleRef.current();
      }
      frame = window.requestAnimationFrame(tick);
    };
    tick();
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
