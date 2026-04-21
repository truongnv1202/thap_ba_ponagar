-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('IN_PROGRESS', 'QUIZ_DONE', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameConfig" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "questionsPerRun" INTEGER NOT NULL DEFAULT 10,
    "minCorrectUnlockPuzzle" INTEGER NOT NULL DEFAULT 6,
    "timeLimitSec" INTEGER NOT NULL DEFAULT 300,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionBank" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "topic" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionChoice" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuestionChoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuzzleTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalPieces" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PuzzleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuzzlePiece" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "pieceCode" TEXT NOT NULL,
    "correctSlot" INTEGER NOT NULL,

    CONSTRAINT "PuzzlePiece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "puzzleTemplateId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "GameRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameRunQuestion" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "orderNo" INTEGER NOT NULL,
    "selectedChoiceId" TEXT,
    "isCorrect" BOOLEAN,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "GameRunQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunPieceInventory" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,
    "earnedFromRunQuestionId" TEXT,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunPieceInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunPiecePlacement" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,
    "slotPosition" INTEGER NOT NULL,
    "isCorrectPos" BOOLEAN NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunPiecePlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "wrongCount" INTEGER NOT NULL,
    "scoreTotal" INTEGER NOT NULL,
    "completionTimeSec" INTEGER NOT NULL,
    "won" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GameConfig_code_key" ON "GameConfig"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PuzzleTemplate_code_key" ON "PuzzleTemplate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PuzzlePiece_templateId_pieceCode_key" ON "PuzzlePiece"("templateId", "pieceCode");

-- CreateIndex
CREATE INDEX "GameRun_userId_startedAt_idx" ON "GameRun"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameRunQuestion_runId_questionId_key" ON "GameRunQuestion"("runId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "GameRunQuestion_runId_orderNo_key" ON "GameRunQuestion"("runId", "orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "RunPieceInventory_runId_pieceId_key" ON "RunPieceInventory"("runId", "pieceId");

-- CreateIndex
CREATE UNIQUE INDEX "RunPiecePlacement_runId_pieceId_key" ON "RunPiecePlacement"("runId", "pieceId");

-- CreateIndex
CREATE UNIQUE INDEX "GameResult_runId_key" ON "GameResult"("runId");

-- AddForeignKey
ALTER TABLE "QuestionChoice" ADD CONSTRAINT "QuestionChoice_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuestionBank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzlePiece" ADD CONSTRAINT "PuzzlePiece_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PuzzleTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRun" ADD CONSTRAINT "GameRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRun" ADD CONSTRAINT "GameRun_configId_fkey" FOREIGN KEY ("configId") REFERENCES "GameConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRun" ADD CONSTRAINT "GameRun_puzzleTemplateId_fkey" FOREIGN KEY ("puzzleTemplateId") REFERENCES "PuzzleTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRunQuestion" ADD CONSTRAINT "GameRunQuestion_runId_fkey" FOREIGN KEY ("runId") REFERENCES "GameRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRunQuestion" ADD CONSTRAINT "GameRunQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRunQuestion" ADD CONSTRAINT "GameRunQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuestionBank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunPieceInventory" ADD CONSTRAINT "RunPieceInventory_runId_fkey" FOREIGN KEY ("runId") REFERENCES "GameRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunPieceInventory" ADD CONSTRAINT "RunPieceInventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunPieceInventory" ADD CONSTRAINT "RunPieceInventory_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "PuzzlePiece"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunPiecePlacement" ADD CONSTRAINT "RunPiecePlacement_runId_fkey" FOREIGN KEY ("runId") REFERENCES "GameRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunPiecePlacement" ADD CONSTRAINT "RunPiecePlacement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunPiecePlacement" ADD CONSTRAINT "RunPiecePlacement_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "PuzzlePiece"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "GameRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
