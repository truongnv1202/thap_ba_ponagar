-- AlterTable
ALTER TABLE "PuzzleTemplate" ADD COLUMN     "levelNumber" INTEGER;

-- CreateTable
CREATE TABLE "CampaignProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "totalTimeSec" INTEGER NOT NULL DEFAULT 0,
    "highestLevel" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignProgress_userId_key" ON "CampaignProgress"("userId");

-- CreateIndex
CREATE INDEX "CampaignProgress_highestLevel_totalTimeSec_idx" ON "CampaignProgress"("highestLevel", "totalTimeSec");

-- AddForeignKey
ALTER TABLE "CampaignProgress" ADD CONSTRAINT "CampaignProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
