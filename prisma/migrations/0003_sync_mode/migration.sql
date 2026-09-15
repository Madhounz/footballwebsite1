-- AlterTable
ALTER TABLE "SyncRun" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'full';
ALTER TABLE "SyncRun" ADD COLUMN "detailRequests" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "SyncRun_startedAt_idx" ON "SyncRun"("startedAt");
