-- Seed rows are written on a 5-minute grid with seconds and milliseconds zero.
-- Live rows use `new Date()` and almost always have a fractional second.
UPDATE "Reading"
SET "source" = 'seed'
WHERE "recordedAt" LIKE '%:00.000%';
