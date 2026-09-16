-- The scorer chart as the primary source publishes it. Counting goals from our
-- own events cannot be complete on a free plan — we only hold the events of
-- matches we fetched detail for — and a chart that is quietly short is worse
-- than one with a source behind it.
CREATE TABLE "SeasonScorer" (
    "competitionId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "goals" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "penalties" INTEGER NOT NULL DEFAULT 0,
    "appearances" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonScorer_pkey" PRIMARY KEY ("competitionId","season","playerId")
);

CREATE INDEX "SeasonScorer_competitionId_season_goals_idx" ON "SeasonScorer"("competitionId", "season", "goals");

ALTER TABLE "SeasonScorer" ADD CONSTRAINT "SeasonScorer_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonScorer" ADD CONSTRAINT "SeasonScorer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonScorer" ADD CONSTRAINT "SeasonScorer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
