import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { type ParsedRow, parseQuestionsFromXlsxBuffer } from "../lib/excel-import-questions.js";
import { buildHomeSlideI18n } from "../lib/slide-translate.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});
router.use(authRequired, requireRole(["ADMIN"]));

router.post("/configs", async (req, res) => {
  const body = z.object({
    code: z.string().min(1),
    questionsPerRun: z.coerce.number().int().min(1).max(100),
    minCorrectUnlockPuzzle: z.coerce.number().int().min(1),
    timeLimitSec: z.coerce.number().int().min(30).max(3600).default(300),
    active: z.coerce.boolean().default(true),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const config = await prisma.gameConfig.create({ data: body.data });
  return res.status(201).json(config);
});

router.post("/questions", async (req, res) => {
  const body = z.object({
    content: z.string().min(1),
    topic: z.string().optional(),
    difficulty: z.coerce.number().int().min(1).max(5).default(1),
    locale: z.enum(["vi", "en", "zh", "ko"]).default("vi"),
    choices: z.array(z.object({ content: z.string().min(1), isCorrect: z.coerce.boolean() })).min(2),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  if (body.data.choices.filter((c) => c.isCorrect).length !== 1) {
    return res.status(400).json({ error: "Exactly one correct choice is required" });
  }

  const question = await prisma.questionBank.create({
    data: {
      content: body.data.content,
      topic: body.data.topic,
      difficulty: body.data.difficulty,
      locale: body.data.locale,
      choices: { create: body.data.choices.map((c, i) => ({ ...c, orderIndex: i })) },
    },
    include: { choices: { orderBy: { orderIndex: "asc" } } },
  });
  return res.status(201).json(question);
});

router.post("/puzzle-templates", async (req, res) => {
  const body = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    pieces: z.array(z.object({ pieceCode: z.string().min(1), correctSlot: z.coerce.number().int().min(0) })).min(1),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const tpl = await prisma.puzzleTemplate.create({
    data: {
      code: body.data.code,
      name: body.data.name,
      totalPieces: body.data.pieces.length,
      pieces: { create: body.data.pieces },
    },
    include: { pieces: true },
  });
  return res.status(201).json(tpl);
});

router.post("/questions/bulk-generate", async (req, res) => {
  const body = z
    .object({
      topic: z.string().min(1).default("Thap Ba Ponagar"),
      difficulty: z.coerce.number().int().min(1).max(5).default(2),
      count: z.coerce.number().int().min(1).max(1000).default(1000),
      choiceCount: z.coerce.number().int().min(2).max(6).default(4),
    })
    .safeParse(req.body);

  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const { topic, difficulty, count, choiceCount } = body.data;
  const batchSize = 100;
  let created = 0;

  while (created < count) {
    const remaining = count - created;
    const thisBatch = Math.min(batchSize, remaining);

    await prisma.$transaction(
      Array.from({ length: thisBatch }, (_, idx) => {
        const sequence = created + idx + 1;
        const correctIndex = sequence % choiceCount;
        const choices = Array.from({ length: choiceCount }, (_v, choiceIdx) => ({
          content:
            choiceIdx === correctIndex
              ? `Dap an dung #${choiceIdx + 1} cho cau ${sequence}`
              : `Phuong an #${choiceIdx + 1} cho cau ${sequence}`,
          isCorrect: choiceIdx === correctIndex,
          orderIndex: choiceIdx,
        }));

        return prisma.questionBank.create({
          data: {
            topic,
            difficulty,
            locale: "vi",
            content: `Cau hoi #${sequence} ve ${topic}`,
            choices: { create: choices },
          },
        });
      }),
    );

    created += thisBatch;
  }

  return res.status(201).json({ created });
});

/** importMode=replace: vô hiệu hóa mọi câu đang active của `locale` rồi thêm câu mới; append: chỉ thêm. */
router.post("/questions/import-excel", upload.single("file"), async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ error: "Missing file (.xlsx)" });
  }
  const meta = z
    .object({
      locale: z.preprocess((v) => (typeof v === "string" ? v.trim() : v) || "vi", z.enum(["vi", "en", "zh", "ko"])),
      importMode: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.enum(["append", "replace"])),
      topic: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.string().min(1).optional()),
      difficulty: z.coerce.number().int().min(1).max(5).optional(),
    })
    .safeParse(req.body);
  if (!meta.success) return res.status(400).json({ error: meta.error.flatten() });

  let rows: ParsedRow[];
  try {
    rows = await parseQuestionsFromXlsxBuffer(req.file.buffer);
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "Invalid Excel file" });
  }

  const topic = meta.data.topic ?? "Thap Ba Ponagar";
  const difficulty = meta.data.difficulty ?? 2;
  const { locale, importMode } = meta.data;

  const created = await prisma.$transaction(async (tx) => {
    if (importMode === "replace") {
      await tx.questionBank.updateMany({
        where: { locale, isActive: true },
        data: { isActive: false },
      });
    }
    let n = 0;
    for (const row of rows) {
      await tx.questionBank.create({
        data: {
          content: row.content,
          topic,
          difficulty,
          locale,
          isActive: true,
          choices: {
            create: row.choices.map((c, i) => ({
              content: c,
              isCorrect: i === row.correctIndex,
              orderIndex: i,
            })),
          },
        },
      });
      n += 1;
    }
    return n;
  });

  return res.status(201).json({
    created,
    locale,
    importMode,
    message:
      importMode === "replace"
        ? `Deactivated previous active questions for locale ${locale}, imported ${created} questions.`
        : `Appended ${created} questions for locale ${locale}.`,
  });
});

router.get("/slides", async (_req, res) => {
  const items = await prisma.homeSlide.findMany({
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
  });
  return res.json({ items });
});

router.post("/slides", async (req, res) => {
  const body = z
    .object({
      title: z.string().min(1),
      description: z.string().optional(),
      imageUrl: z.string().min(1),
      orderIndex: z.coerce.number().int().default(0),
      active: z.coerce.boolean().default(true),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const i18n = await buildHomeSlideI18n(body.data.title, body.data.description);
  const slide = await prisma.homeSlide.create({ data: { ...body.data, i18n } });
  return res.status(201).json(slide);
});

router.patch("/slides/:id", async (req, res) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(req.params);
  const body = z
    .object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      imageUrl: z.string().min(1).optional(),
      orderIndex: z.number().int().optional(),
      active: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ error: "Invalid payload" });

  const existing = await prisma.homeSlide.findUnique({ where: { id: params.data.id } });
  if (!existing) return res.status(404).json({ error: "Slide not found" });

  const nextTitle = body.data.title ?? existing.title;
  const nextDesc = body.data.description !== undefined ? body.data.description : existing.description;
  const retranslate = body.data.title !== undefined || body.data.description !== undefined;
  const i18n = retranslate ? await buildHomeSlideI18n(nextTitle, nextDesc) : undefined;

  const slide = await prisma.homeSlide.update({
    where: { id: params.data.id },
    data: { ...body.data, ...(i18n ? { i18n } : {}) },
  });
  return res.json(slide);
});

router.delete("/slides/:id", async (req, res) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "Invalid id" });
  await prisma.homeSlide.delete({ where: { id: params.data.id } });
  return res.json({ ok: true });
});

export default router;
