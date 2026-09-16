-- Timelines built from the live feed stop wherever the last refresh left them.
-- This column records that the finished match's events were fetched in full, so
-- the pipeline can tell a complete timeline from a truncated one and fill the
-- gaps in. Existing rows are left NULL on purpose: every match played so far is
-- re-checked once by the catch-up pass.
ALTER TABLE "Match" ADD COLUMN "eventsFinalAt" TIMESTAMP(3);

CREATE INDEX "Match_status_eventsFinalAt_idx" ON "Match"("status", "eventsFinalAt");
