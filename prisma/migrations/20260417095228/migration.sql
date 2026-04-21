/*
  Warnings:

  - A unique constraint covering the columns `[accessToken]` on the table `GameRun` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `accessToken` to the `GameRun` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GameResult" ADD COLUMN     "playerAge" INTEGER,
ADD COLUMN     "playerName" TEXT;

-- AlterTable
ALTER TABLE "GameRun" ADD COLUMN     "accessToken" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "HomeSlide" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeSlide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeSlide_active_orderIndex_idx" ON "HomeSlide"("active", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "GameRun_accessToken_key" ON "GameRun"("accessToken");
