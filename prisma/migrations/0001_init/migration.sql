-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "season" TEXT NOT NULL,
    "teamCount" INTEGER NOT NULL,
    "rounds" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "zones" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "stadium" TEXT NOT NULL,
    "founded" INTEGER NOT NULL,
    "colors" TEXT[],
    "manager" TEXT,
    "leagueId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamCompetition" (
    "teamId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "season" TEXT NOT NULL,

    CONSTRAINT "TeamCompetition_pkey" PRIMARY KEY ("teamId","competitionId","season")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "shirtNumber" INTEGER NOT NULL,
    "nationality" TEXT NOT NULL,
    "nationalityCode" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "heightCm" INTEGER,
    "preferredFoot" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "stage" TEXT,
    "kickoff" TIMESTAMP(3) NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "minute" INTEGER,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "homeHtScore" INTEGER,
    "awayHtScore" INTEGER,
    "venue" TEXT,
    "attendance" INTEGER,
    "referee" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchEvent" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "minute" INTEGER NOT NULL,
    "addedTime" INTEGER,
    "teamId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "playerId" TEXT,
    "relatedPlayerId" TEXT,
    "detail" TEXT,

    CONSTRAINT "MatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lineup" (
    "matchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "formation" TEXT NOT NULL,
    "starting" JSONB NOT NULL,
    "bench" JSONB NOT NULL,
    "coach" TEXT,

    CONSTRAINT "Lineup_pkey" PRIMARY KEY ("matchId","teamId")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "trigger" TEXT NOT NULL,
    "providers" TEXT[],
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "written" INTEGER NOT NULL DEFAULT 0,
    "conflicts" INTEGER NOT NULL DEFAULT 0,
    "aiResolved" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceRecord" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discrepancy" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "resolution" JSONB,
    "resolvedBy" TEXT,
    "confidence" DOUBLE PRECISION,
    "reasoning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Discrepancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityAlias" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalName" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "EntityAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Competition_slug_key" ON "Competition"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");

-- CreateIndex
CREATE INDEX "TeamCompetition_competitionId_season_idx" ON "TeamCompetition"("competitionId", "season");

-- CreateIndex
CREATE UNIQUE INDEX "Player_slug_key" ON "Player"("slug");

-- CreateIndex
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

-- CreateIndex
CREATE INDEX "Match_kickoff_idx" ON "Match"("kickoff");

-- CreateIndex
CREATE INDEX "Match_competitionId_season_round_idx" ON "Match"("competitionId", "season", "round");

-- CreateIndex
CREATE INDEX "Match_homeTeamId_idx" ON "Match"("homeTeamId");

-- CreateIndex
CREATE INDEX "Match_awayTeamId_idx" ON "Match"("awayTeamId");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE INDEX "MatchEvent_matchId_idx" ON "MatchEvent"("matchId");

-- CreateIndex
CREATE INDEX "MatchEvent_playerId_idx" ON "MatchEvent"("playerId");

-- CreateIndex
CREATE INDEX "SourceRecord_entityType_entityId_idx" ON "SourceRecord"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceRecord_provider_entityType_externalId_key" ON "SourceRecord"("provider", "entityType", "externalId");

-- CreateIndex
CREATE INDEX "Discrepancy_entityType_entityId_idx" ON "Discrepancy"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Discrepancy_resolvedBy_idx" ON "Discrepancy"("resolvedBy");

-- CreateIndex
CREATE INDEX "EntityAlias_entityType_entityId_idx" ON "EntityAlias"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityAlias_provider_entityType_externalId_key" ON "EntityAlias"("provider", "entityType", "externalId");

-- AddForeignKey
ALTER TABLE "TeamCompetition" ADD CONSTRAINT "TeamCompetition_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamCompetition" ADD CONSTRAINT "TeamCompetition_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lineup" ADD CONSTRAINT "Lineup_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lineup" ADD CONSTRAINT "Lineup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discrepancy" ADD CONSTRAINT "Discrepancy_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

