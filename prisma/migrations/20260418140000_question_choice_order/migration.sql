-- Thứ tự đáp án A–D khớp Excel; trước đây thứ tự từ DB là không xác định.
ALTER TABLE "QuestionChoice" ADD COLUMN IF NOT EXISTS "orderIndex" INTEGER NOT NULL DEFAULT 0;

-- Gán 0..n-1 theo id ổn định cho dữ liệu đã có (không phải thứ tự gốc Excel nhưng tránh trùng slot).
WITH ord AS (
  SELECT id,
         (ROW_NUMBER() OVER (PARTITION BY "questionId" ORDER BY id) - 1)::int AS oi
  FROM "QuestionChoice"
)
UPDATE "QuestionChoice" q SET "orderIndex" = ord.oi FROM ord WHERE q.id = ord.id;

CREATE UNIQUE INDEX IF NOT EXISTS "QuestionChoice_questionId_orderIndex_key" ON "QuestionChoice"("questionId", "orderIndex");
