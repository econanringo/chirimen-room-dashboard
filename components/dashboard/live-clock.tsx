"use client";

import { useEffect, useState } from "react";

import { formatDateTimeSeconds } from "@/lib/format";

export function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      setNow(new Date());
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    tick();
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <time
      dateTime={now.toISOString()}
      className="text-right text-sm tabular-nums text-muted-foreground"
    >
      {formatDateTimeSeconds(now)}
    </time>
  );
}
