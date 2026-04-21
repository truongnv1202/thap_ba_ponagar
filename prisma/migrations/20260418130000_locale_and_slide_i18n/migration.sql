-- AlterTable
ALTER TABLE "QuestionBank" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'vi';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuestionBank_locale_isActive_idx" ON "QuestionBank"("locale", "isActive");

-- AlterTable
ALTER TABLE "HomeSlide" ADD COLUMN IF NOT EXISTS "i18n" JSONB;
