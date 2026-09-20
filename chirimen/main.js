import { requestGPIOAccess } from "node-web-gpio";
import { requestI2CAccess } from "node-web-i2c";
import BMP180 from "@chirimen/bmp180";
import PCF8591 from "@chirimen/pcf8591";
import SHT30 from "@chirimen/sht30";
import { setTimeout as sleep } from "node:timers/promises";
import WebSocket from "ws";

import { ADS7830 } from "./ads7830.js";

const RELAY_URL =
  process.env.RELAY_URL ?? "wss://chirimen-web-socket-relay.herokuapp.com";
const RELAY_TOKEN = process.env.RELAY_TOKEN ?? "chirimenSocket";
const CHANNEL = process.env.RELAY_CHANNEL ?? "chirimenRoom";
const INGEST_URL = process.env.INGEST_URL ?? "";
const PIR_PIN = Number(process.env.PIR_PIN ?? 17);
const INTERVAL_MS = Number(process.env.INTERVAL_MS ?? 10_000);
const I2C_RETRY_GAP_MS = 80;
const I2C_SENSOR_GAP_MS = 20;
const SAMPLE_CACHE_MS = 1_500;

let i2cPort;
let sht30;
let bmp180;
let adc;
let pirPort;
let relaySocket;
let lastSample = null;
let lastReadAt = 0;
let i2cChain = Promise.resolve();
let recovering = false;

function withI2cLock(fn) {
  const run = i2cChain.then(fn, fn);
  i2cChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function tryInit(label, fn) {
  try {
    const device = await fn();
    console.log(`${label}: OK`);
    return device;
  } catch (error) {
    console.warn(`${label} を初期化できませんでした`, error.message ?? error);
    return null;
  }
}

function isI2cTimeout(error) {
  return /timed?\s*out|ETIMEDOUT/i.test(String(error?.message ?? error ?? ""));
}

function occupiedFromValue(value) {
  return value === 1 || value === "high" || value === true;
}

async function detectAdc() {
  const candidates = [
    {
      label: "ADS7830",
      init: async () => {
        const device = new ADS7830(i2cPort, 0x4b);
        await device.init();
        await device.analogRead(0);
        return { kind: "ads7830", device };
      },
    },
    {
      label: "PCF8591",
      init: async () => {
        const device = new PCF8591(i2cPort, 0x48);
        await device.init();
        await device.readADC(0);
        return { kind: "pcf8591", device };
      },
    },
  ];

  for (const candidate of candidates) {
    try {
      const adcDevice = await candidate.init();
      console.log(`${candidate.label}: OK`);
      return adcDevice;
    } catch (error) {
      if (isI2cTimeout(error)) {
        console.warn(
          `${candidate.label} がタイムアウトしました。I2C バスが停止している可能性があります`,
          error.message ?? error,
        );
        return null;
      }
    }
  }

  console.warn("ADC（ADS7830 / PCF8591）が見つかりませんでした");
  return null;
}

async function initI2cDevices() {
  sht30 = await tryInit("SHT30", async () => {
    const device = new SHT30(i2cPort, 0x44);
    await device.init();
    return device;
  });
  adc = await detectAdc();
  bmp180 = await tryInit("BMP180", async () => {
    const device = new BMP180(i2cPort, 0x77);
    await device.init();
    return device;
  });
}

async function recoverI2c(reason) {
  if (recovering) {
    return;
  }
  recovering = true;
  console.warn(`I2C を再初期化します (${reason})`);
  try {
    await sleep(200);
    await initI2cDevices();
  } finally {
    recovering = false;
  }
}

function invertLightPercent(fraction) {
  const percent = Math.round((1 - fraction) * 1000) / 10;
  return Math.min(100, Math.max(0, percent));
}

async function readLightPercent() {
  if (!adc) {
    return null;
  }
  if (adc.kind === "pcf8591") {
    const volts = await adc.device.readADC(0);
    if (volts < 0) {
      return null;
    }
    return invertLightPercent(volts / 3.3);
  }
  const raw = await adc.device.analogRead(0);
  return invertLightPercent(raw / 255);
}

async function readOccupied() {
  if (!pirPort) {
    return null;
  }
  const value = await pirPort.read();
  return occupiedFromValue(value);
}

async function tryRead(label, reader) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return { value: await reader(), timedOut: false };
    } catch (error) {
      const timedOut = isI2cTimeout(error);
      console.warn(
        `${label} read failed${timedOut && attempt < 2 ? " (retry)" : ""}`,
        error.message ?? error,
      );
      if (!timedOut || attempt === 2) {
        return { value: null, timedOut };
      }
      await sleep(I2C_RETRY_GAP_MS);
    }
  }
  return { value: null, timedOut: true };
}

async function readSensors() {
  const sample = {
    temperature: null,
    humidity: null,
    pressure: null,
    light: null,
    occupied: null,
  };
  let timedOut = false;

  if (sht30) {
    const sht = await tryRead("SHT30", () => sht30.readData());
    timedOut ||= sht.timedOut;
    if (sht.value) {
      sample.temperature = sht.value.temperature;
      sample.humidity = sht.value.humidity;
    }
    await sleep(I2C_SENSOR_GAP_MS);
  }

  if (bmp180) {
    const pressure = await tryRead("BMP180", () => bmp180.readPressure());
    timedOut ||= pressure.timedOut;
    sample.pressure = pressure.value;
    await sleep(I2C_SENSOR_GAP_MS);
  }

  const light = await tryRead("light", readLightPercent);
  timedOut ||= light.timedOut;
  sample.light = light.value;

  try {
    sample.occupied = await readOccupied();
  } catch (error) {
    console.warn("PIR read failed", error.message ?? error);
  }

  return { sample, timedOut };
}

async function readSensorsExclusive() {
  return withI2cLock(async () => {
    if (lastSample && Date.now() - lastReadAt < SAMPLE_CACHE_MS) {
      return { sample: lastSample, fromCache: true };
    }
    const { sample, timedOut } = await readSensors();
    lastSample = sample;
    lastReadAt = Date.now();
    if (timedOut) {
      await recoverI2c("timeout");
    }
    return { sample, fromCache: false };
  });
}

function sendRelay(message) {
  if (!relaySocket || relaySocket.readyState !== WebSocket.OPEN) {
    return;
  }
  relaySocket.send(JSON.stringify({ body: message }));
}

async function publish(sample) {
  console.log(JSON.stringify(sample));
  sendRelay(sample);

  if (!INGEST_URL) {
    return;
  }
  try {
    await fetch(INGEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sample),
    });
  } catch (error) {
    console.warn("ingest failed", error.message ?? error);
  }
}

async function publishOccupied(occupied) {
  lastSample = lastSample
    ? { ...lastSample, occupied }
    : {
        temperature: null,
        humidity: null,
        pressure: null,
        light: null,
        occupied,
      };
  await publish(lastSample);
}

async function connectRelay() {
  const url = `${RELAY_URL.replace(/\/$/, "")}/${RELAY_TOKEN}/${CHANNEL}`;
  const socket = new WebSocket(url);
  relaySocket = socket;

  socket.on("open", () => {
    console.log("リレーに接続しました");
  });

  socket.on("message", async (data) => {
    const raw = data.toString();
    if (!raw) {
      return;
    }
    let body = raw;
    try {
      const parsed = JSON.parse(raw);
      body = parsed.body ?? parsed;
    } catch {
      // keep raw string
    }
    if (body !== "GET SENSOR DATA") {
      return;
    }
    const { sample, fromCache } = await readSensorsExclusive();
    if (fromCache) {
      sendRelay(sample);
      return;
    }
    await publish(sample);
  });

  socket.on("close", () => {
    console.warn("リレーが切断されました。5秒後に再接続します");
    setTimeout(() => {
      void connectRelay();
    }, 5000);
  });

  socket.on("error", (error) => {
    console.warn("リレー接続エラー", error.message ?? error);
  });
}

async function main() {
  const i2cAccess = await requestI2CAccess();
  i2cPort = i2cAccess.ports.get(1);
  await initI2cDevices();

  pirPort = await tryInit("HW416A", async () => {
    const gpioAccess = await requestGPIOAccess();
    const port = gpioAccess.ports.get(PIR_PIN);
    await port.export("in", { edge: "both", debounce: 300 });
    port.onchange = (event) => {
      const value = event?.value;
      if (value === 0 || value === 1) {
        void publishOccupied(occupiedFromValue(value));
        return;
      }
      void readOccupied().then((occupied) => {
        if (occupied != null) {
          void publishOccupied(occupied);
        }
      });
    };
    return port;
  });

  await connectRelay();

  while (true) {
    if (relaySocket?.readyState === WebSocket.OPEN) {
      relaySocket.send("");
    }
    const { sample, fromCache } = await readSensorsExclusive();
    if (!fromCache) {
      await publish(sample);
    }
    await sleep(INTERVAL_MS);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
