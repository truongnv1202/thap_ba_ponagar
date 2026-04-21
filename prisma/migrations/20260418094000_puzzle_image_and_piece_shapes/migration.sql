-- AlterTable
ALTER TABLE "PuzzleTemplate" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "RunPieceInventory" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RunPieceInventory" ADD COLUMN IF NOT EXISTS "shapeJson" JSONB;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RunPieceInventory_runId_displayOrder_idx" ON "RunPieceInventory"("runId", "displayOrder");
