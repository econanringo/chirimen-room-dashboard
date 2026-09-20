-- CreateTable
CREATE TABLE "Reading" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recordedAt" DATETIME NOT NULL,
    "temperature" REAL NOT NULL,
    "humidity" REAL NOT NULL,
    "pressure" REAL,
    "light" REAL,
    "occupied" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Reading_recordedAt_idx" ON "Reading"("recordedAt");
