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
const INTERVAL_MS = Number(process.env.INTERVAL_MS ?? 30_000);

let sht30;
let bmp180;
let adc;
let pirPort;
let relaySocket;

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

async function detectAdc(i2cPort) {
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
  return value === 1 || value === "high" || value === true;
}

async function readSensors() {
  const sample = {
    temperature: null,
    humidity: null,
    pressure: null,
    light: null,
    occupied: null,
  };

  if (sht30) {
    try {
      const sht = await sht30.readData();
      sample.temperature = sht.temperature;
      sample.humidity = sht.humidity;
    } catch (error) {
      console.warn("SHT30 read failed", error.message ?? error);
    }
  }

  if (bmp180) {
    try {
      sample.pressure = await bmp180.readPressure();
    } catch (error) {
      console.warn("BMP180 read failed", error.message ?? error);
    }
  }

  try {
    sample.light = await readLightPercent();
  } catch (error) {
    console.warn("light read failed", error.message ?? error);
  }

  try {
    sample.occupied = await readOccupied();
  } catch (error) {
    console.warn("PIR read failed", error.message ?? error);
  }

  return sample;
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
    if (body === "GET SENSOR DATA") {
      await publish(await readSensors());
    }
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
  const i2cPort = i2cAccess.ports.get(1);

  sht30 = await tryInit("SHT30", async () => {
    const device = new SHT30(i2cPort, 0x44);
    await device.init();
    return device;
  });

  adc = await detectAdc(i2cPort);

  bmp180 = await tryInit("BMP180", async () => {
    const device = new BMP180(i2cPort, 0x77);
    await device.init();
    return device;
  });

  pirPort = await tryInit("HW416A", async () => {
    const gpioAccess = await requestGPIOAccess();
    const port = gpioAccess.ports.get(PIR_PIN);
    await port.export("in", { edge: "both" });
    port.onchange = async () => {
      await publish(await readSensors());
    };
    return port;
  });

  await connectRelay();

  while (true) {
    if (relaySocket?.readyState === WebSocket.OPEN) {
      relaySocket.send("");
    }
    await publish(await readSensors());
    await sleep(INTERVAL_MS);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
