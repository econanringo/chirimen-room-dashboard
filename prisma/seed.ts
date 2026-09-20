import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hourOfDay(date: Date) {
  return date.getHours() + date.getMinutes() / 60;
}

function isOccupiedAt(date: Date) {
  const hour = hourOfDay(date);
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  if (weekend) {
    return hour >= 9 && hour < 24;
  }
  return (hour >= 7 && hour < 9) || (hour >= 12 && hour < 13.5) || (hour >= 18 && hour < 23.5);
}

async function main() {
  await prisma.reading.deleteMany();

  const end = new Date();
  end.setSeconds(0, 0);
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const stepMs = 5 * 60 * 1000;
  const rows = [];

  for (let t = start.getTime(); t <= end.getTime(); t += stepMs) {
    const date = new Date(t);
    const hour = hourOfDay(date);
    const dayWave = Math.sin(((hour - 7) / 24) * Math.PI * 2);
    const noise = Math.sin(t / 3_600_000) * 0.4 + Math.cos(t / 7_200_000) * 0.25;

    const temperature = clamp(26.4 + dayWave * 3.2 + noise, 22.5, 32);
    const humidity = clamp(58 - dayWave * 8 + noise * 3, 38, 78);
    const pressure = clamp(1012.4 + Math.sin(t / 86_400_000) * 4.5 + noise * 0.4, 1002, 1024);
    const daylight = hour >= 6.5 && hour <= 18.5 ? Math.sin(((hour - 6.5) / 12) * Math.PI) : 0;
    const light = clamp(daylight * 88 + (hour >= 19 && hour <= 23 ? 18 : 4) + noise * 2, 2, 98);
    const occupied = isOccupiedAt(date) && Math.sin(t / 900_000) > -0.55;

    rows.push({
      recordedAt: date,
      temperature: Number(temperature.toFixed(2)),
      humidity: Number(humidity.toFixed(1)),
      pressure: Number(pressure.toFixed(2)),
      light: Number(light.toFixed(1)),
      occupied,
    });
  }

  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    await prisma.reading.createMany({
      data: rows.slice(i, i + chunkSize),
    });
  }

  console.log(`Seeded ${rows.length} readings`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
