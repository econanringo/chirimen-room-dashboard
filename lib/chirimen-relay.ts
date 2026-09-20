export type SensorPayload = {
  temperature?: number;
  humidity?: number;
  pressure?: number | null;
  light?: number | null;
  occupied?: boolean | null;
};

type RelayHandle = {
  send: (message: unknown) => void;
  close: () => void;
};

function relayUrl() {
  const host =
    process.env.NEXT_PUBLIC_RELAY_URL ??
    "wss://chirimen-web-socket-relay.herokuapp.com";
  const token = process.env.NEXT_PUBLIC_RELAY_TOKEN ?? "chirimenSocket";
  const channel = process.env.NEXT_PUBLIC_RELAY_CHANNEL ?? "chirimenRoom";
  return `${host.replace(/\/$/, "")}/${token}/${channel}`;
}

function parseBody(raw: string): unknown {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as { body?: unknown };
    if (parsed && typeof parsed === "object" && "body" in parsed) {
      return parsed.body;
    }
    return parsed;
  } catch {
    return raw;
  }
}

function isSensorPayload(value: unknown): value is SensorPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const payload = value as SensorPayload;
  return typeof payload.temperature === "number" || typeof payload.humidity === "number";
}

export function connectChirimenRelay(options: {
  onMessage: (payload: SensorPayload) => void;
  onStatus?: (connected: boolean) => void;
  onOpen?: (send: (message: unknown) => void) => void;
}): RelayHandle {
  const socket = new WebSocket(relayUrl());
  let pingTimer: number | undefined;

  const send = (message: unknown) => {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify({ body: message }));
  };

  socket.addEventListener("open", () => {
    options.onStatus?.(true);
    options.onOpen?.(send);
    pingTimer = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send("");
      }
    }, 45_000);
  });

  socket.addEventListener("close", () => {
    options.onStatus?.(false);
    if (pingTimer) {
      window.clearInterval(pingTimer);
    }
  });

  socket.addEventListener("error", () => {
    options.onStatus?.(false);
  });

  socket.addEventListener("message", (event) => {
    const body = parseBody(String(event.data));
    if (body === "GET SENSOR DATA" || body == null) {
      return;
    }
    if (isSensorPayload(body)) {
      options.onMessage(body);
    }
  });

  return {
    send,
    close() {
      if (pingTimer) {
        window.clearInterval(pingTimer);
      }
      socket.close();
    },
  };
}

export async function persistReading(payload: SensorPayload) {
  if (typeof payload.temperature !== "number" || typeof payload.humidity !== "number") {
    return;
  }

  await fetch("/api/readings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      temperature: payload.temperature,
      humidity: payload.humidity,
      pressure: payload.pressure ?? null,
      light: payload.light ?? null,
      occupied: payload.occupied ?? null,
    }),
  });
}
