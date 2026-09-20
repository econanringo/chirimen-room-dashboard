"use client";

import { useEffect, useRef, useState } from "react";

import {
  connectChirimenRelay,
  persistReading,
  type SensorPayload,
} from "@/lib/chirimen-relay";
import type { SensorSample } from "@/lib/readings";

function toSample(payload: SensorPayload, previous: SensorSample | null): SensorSample | null {
  const temperature = payload.temperature ?? previous?.temperature;
  const humidity = payload.humidity ?? previous?.humidity;
  if (typeof temperature !== "number" || typeof humidity !== "number") {
    return null;
  }
  return {
    recordedAt: new Date().toISOString(),
    temperature,
    humidity,
    pressure: payload.pressure ?? previous?.pressure ?? null,
    light: payload.light ?? previous?.light ?? null,
    occupied: payload.occupied ?? previous?.occupied ?? null,
  };
}

export function useChirimenLive(onPersisted: () => void, previous: SensorSample | null) {
  const [live, setLive] = useState<SensorSample | null>(null);
  const [connected, setConnected] = useState(false);
  const previousRef = useRef(previous);
  previousRef.current = previous;

  useEffect(() => {
    const relay = connectChirimenRelay({
      onStatus: setConnected,
      onOpen: (send) => {
        send("GET SENSOR DATA");
      },
      onMessage: (payload) => {
        const sample = toSample(payload, previousRef.current);
        if (sample) {
          setLive(sample);
        }
        void persistReading(payload)
          .then(() => onPersisted())
          .catch(() => undefined);
      },
    });

    const requestTimer = window.setInterval(() => {
      relay.send("GET SENSOR DATA");
    }, 30_000);

    return () => {
      window.clearInterval(requestTimer);
      relay.close();
    };
  }, [onPersisted]);

  return { live, connected };
}
