-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Reading" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recordedAt" DATETIME NOT NULL,
    "temperature" REAL NOT NULL,
    "humidity" REAL NOT NULL,
    "pressure" REAL,
    "light" REAL,
    "occupied" BOOLEAN,
    "source" TEXT NOT NULL DEFAULT 'live',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Reading" ("createdAt", "humidity", "id", "light", "occupied", "pressure", "recordedAt", "temperature", "updatedAt") SELECT "createdAt", "humidity", "id", "light", "occupied", "pressure", "recordedAt", "temperature", "updatedAt" FROM "Reading";
DROP TABLE "Reading";
ALTER TABLE "new_Reading" RENAME TO "Reading";
CREATE INDEX "Reading_recordedAt_idx" ON "Reading"("recordedAt");
CREATE INDEX "Reading_source_recordedAt_idx" ON "Reading"("source", "recordedAt");
UPDATE "Reading"
SET "source" = 'seed'
WHERE CAST(strftime('%S', "recordedAt") AS INTEGER) = 0
  AND CAST(strftime('%M', "recordedAt") AS INTEGER) % 5 = 0;
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
