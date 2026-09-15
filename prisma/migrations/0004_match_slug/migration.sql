-- Readable match URLs. Team ids double as their slugs, so existing rows can be
-- backfilled in place before the column becomes required.
ALTER TABLE "Match" ADD COLUMN "slug" TEXT;

UPDATE "Match"
   SET "slug" = "homeTeamId" || '-vs-' || "awayTeamId" || '-'
                || to_char("kickoff" AT TIME ZONE 'UTC', 'YYYY-MM-DD');

ALTER TABLE "Match" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Match_slug_key" ON "Match"("slug");
