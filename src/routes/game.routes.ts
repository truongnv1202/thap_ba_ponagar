import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const router = Router();

function randomPick<T>(arr: T[], count: number): T[] {
  const clone = [...arr];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone.slice(0, count);
}

/** Xoay vòng trái: mỗi level thêm 1 bước (0…3) để vị trí đáp án đúng trên UI đổi theo cấp. */
function rotateChoicesLeft<T>(items: T[], steps: number): T[] {
  const n = items.length;
  if (n === 0) return items;
  const k = ((steps % n) + n) % n;
  return items.slice(k).concat(items.slice(0, k));
}

function getRunAccessToken(req: { headers: Record<string, unknown> }) {
  const raw = req.headers["x-run-access-token"];
  return typeof raw === "string" ? raw : null;
}

/** Cấp chiến dịch: ưu tiên DB; fallback parse `ponagar-level-3` khi `levelNumber` null (template cũ / chưa seed). */
function resolveCampaignLevel(template: { levelNumber: number | null; code: string }): number | null {
  if (template.levelNumber != null && template.levelNumber >= 1) return template.levelNumber;
  const m = /^ponagar-level-(\d+)$/i.exec(template.code.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n >= 1 && n <= 99 ? n : null;
}

/** Chỉ lấy đúng một mảnh cho mỗi ô 0..totalPieces-1; bỏ mảnh thừa trong DB (đúng với totalPieces trên template). */
function pickPiecesForInventory(
  templatePieces: Array<{ id: string; correctSlot: number }>,
  totalPieces: number,
): Array<{ id: string; correctSlot: number }> {
  if (totalPieces <= 0) return [];
  const bySlot = new Map<number, { id: string; correctSlot: number }>();
  for (const p of templatePieces) {
    if (p.correctSlot < 0 || p.correctSlot >= totalPieces) continue;
    if (!bySlot.has(p.correctSlot)) bySlot.set(p.correctSlot, p);
  }
  const out: Array<{ id: string; correctSlot: number }> = [];
  for (let s = 0; s < totalPieces; s++) {
    const hit = bySlot.get(s);
    if (hit) out.push(hit);
  }
  return out;
}

async function generatePuzzleInventory(
  runId: string,
  userId: string,
  templatePieces: Array<{ id: string; correctSlot: number }>,
  totalPieces: number,
) {
  const ordered = pickPiecesForInventory(templatePieces, totalPieces);
  const shuffled = [...ordered];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  await prisma.$transaction(async (tx) => {
    await tx.runPiecePlacement.deleteMany({ where: { runId } });
    await tx.runPieceInventory.deleteMany({ where: { runId } });
    for (let i = 0; i < shuffled.length; i++) {
      const p = shuffled[i]!;
      await tx.runPieceInventory.create({
        data: {
          runId,
          userId,
          pieceId: p.id,
          displayOrder: i,
        },
      });
    }
  });
}

async function createGuestUser(guestKey?: string) {
  const normalizedKey = guestKey?.trim();
  if (normalizedKey) {
    const email = `guest-${normalizedKey}@guest.local`;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return exists;
    return prisma.user.create({
      data: {
        email,
        passwordHash: crypto.randomUUID(),
        displayName: `Khach ${normalizedKey.slice(0, 6)}`,
      },
    });
  }

  const guestId = crypto.randomUUID();
  return prisma.user.create({
    data: {
      email: `guest-${guestId}@guest.local`,
      passwordHash: crypto.randomUUID(),
      displayName: `Khach ${guestId.slice(0, 6)}`,
    },
  });
}

router.post("/runs", async (req, res) => {
  const body = z
    .object({
      configCode: z.string().default("default"),
      puzzleCode: z.string(),
      guestKey: z.string().optional(),
      locale: z.enum(["vi", "en", "zh", "ko"]).default("vi"),
      excludedQuestionIds: z.array(z.string().uuid()).max(2000).optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const [config, puzzle] = await Promise.all([
    prisma.gameConfig.findFirst({ where: { code: body.data.configCode, active: true } }),
    prisma.puzzleTemplate.findFirst({ where: { code: body.data.puzzleCode, isActive: true }, include: { pieces: true } }),
  ]);
  if (!config) return res.status(404).json({ error: "Game config not found" });
  if (!puzzle) return res.status(404).json({ error: "Puzzle template not found" });

  const excluded = body.data.excludedQuestionIds ?? [];
  const questions = await prisma.questionBank.findMany({
    where: {
      isActive: true,
      locale: body.data.locale,
      ...(excluded.length > 0 ? { id: { notIn: excluded } } : {}),
    },
    include: { choices: { orderBy: { orderIndex: "asc" }, select: { id: true, content: true } } },
  });
  if (questions.length < config.questionsPerRun) {
    return res.status(400).json({
      error:
        excluded.length > 0
          ? "Not enough unused questions for this level (need a larger question bank or start a new campaign)."
          : "Not enough active questions",
    });
  }

  const selected = randomPick(questions, config.questionsPerRun);
  const choiceRotateSteps = ((puzzle.levelNumber ?? 1) - 1) % 4;
  const guestUser = await createGuestUser(body.data.guestKey);
  const accessToken = crypto.randomUUID();
  const run = await prisma.gameRun.create({
    data: {
      accessToken,
      userId: guestUser.id,
      configId: config.id,
      puzzleTemplateId: puzzle.id,
      questions: {
        create: selected.map((q, idx) => ({ userId: guestUser.id, questionId: q.id, orderNo: idx + 1 })),
      },
    },
    include: {
      questions: {
        include: {
          question: { include: { choices: { orderBy: { orderIndex: "asc" }, select: { id: true, content: true } } } },
        },
        orderBy: { orderNo: "asc" },
      },
    },
  });

  return res.status(201).json({
    runId: run.id,
    runAccessToken: accessToken,
    status: run.status,
    timeLimitSec: config.timeLimitSec,
    questions: run.questions.map((x) => ({
      runQuestionId: x.id,
      orderNo: x.orderNo,
      questionId: x.questionId,
      content: x.question.content,
      choices: rotateChoicesLeft(x.question.choices, choiceRotateSteps),
    })),
  });
});

const answerBodySchema = z
  .object({
    runQuestionId: z.string().uuid(),
    /** Một trong ba cách gửi đáp án; API so với đáp án đúng đã lưu (từ cột Correct khi import Excel). */
    selectedChoiceId: z.string().uuid().optional(),
    selectedLetter: z.enum(["A", "B", "C", "D", "a", "b", "c", "d"]).optional(),
    selectedOrderIndex: z.number().int().min(0).max(3).optional(),
  })
  .superRefine((val, ctx) => {
    const n =
      (val.selectedChoiceId ? 1 : 0) +
      (val.selectedLetter !== undefined && val.selectedLetter !== null ? 1 : 0) +
      (val.selectedOrderIndex !== undefined ? 1 : 0);
    if (n !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide exactly one of: selectedChoiceId, selectedLetter (A–D), selectedOrderIndex (0–3)",
      });
    }
  });

router.post("/runs/:runId/answers", async (req, res) => {
  const params = z.object({ runId: z.string().uuid() }).safeParse(req.params);
  const body = answerBodySchema.safeParse(req.body);
  if (!params.success) return res.status(400).json({ error: params.error.flatten() });
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const runAccessToken = getRunAccessToken(req);
  if (!runAccessToken) return res.status(401).json({ error: "Missing run access token" });

  const run = await prisma.gameRun.findFirst({
    where: { id: params.data.runId, accessToken: runAccessToken },
    include: { config: true, puzzleTemplate: { include: { pieces: true } } },
  });
  if (!run) return res.status(404).json({ error: "Run not found" });
  if (run.status !== "IN_PROGRESS") return res.status(409).json({ error: "Run already completed" });

  const runQuestion = await prisma.gameRunQuestion.findFirst({
    where: { id: body.data.runQuestionId, runId: run.id },
    include: { question: { include: { choices: { orderBy: { orderIndex: "asc" } } } } },
  });
  if (!runQuestion) return res.status(404).json({ error: "Run question not found" });

  const choices = runQuestion.question.choices;
  const byId = new Map(choices.map((c) => [c.id, c]));

  let resolvedChoiceId: string;
  if (body.data.selectedChoiceId) {
    const hit = byId.get(body.data.selectedChoiceId);
    if (!hit) return res.status(400).json({ error: "selectedChoiceId does not belong to this question" });
    resolvedChoiceId = hit.id;
  } else if (body.data.selectedLetter !== undefined) {
    const ord = body.data.selectedLetter.toUpperCase().charCodeAt(0) - 65;
    if (ord < 0 || ord > 3 || ord >= choices.length) return res.status(400).json({ error: "Invalid selectedLetter" });
    resolvedChoiceId = choices[ord]!.id;
  } else {
    const idx = body.data.selectedOrderIndex!;
    if (idx >= choices.length) return res.status(400).json({ error: "Invalid selectedOrderIndex" });
    resolvedChoiceId = choices[idx]!.id;
  }

  const correctChoice = choices.find((c) => c.isCorrect);
  const isCorrect = correctChoice?.id === resolvedChoiceId;

  await prisma.gameRunQuestion.update({
    where: { id: runQuestion.id },
    data: { selectedChoiceId: resolvedChoiceId, isCorrect, answeredAt: new Date() },
  });

  const [totalAnswered, totalCorrect, totalQuestions] = await Promise.all([
    prisma.gameRunQuestion.count({ where: { runId: run.id, selectedChoiceId: { not: null } } }),
    prisma.gameRunQuestion.count({ where: { runId: run.id, isCorrect: true } }),
    prisma.gameRunQuestion.count({ where: { runId: run.id } }),
  ]);

  const quizFinished = totalAnswered === totalQuestions;
  const puzzleUnlocked = quizFinished && totalCorrect === totalQuestions;

  if (quizFinished) {
    if (puzzleUnlocked) {
      await prisma.gameRun.update({ where: { id: run.id }, data: { status: "QUIZ_DONE" } });
      await generatePuzzleInventory(run.id, run.userId, run.puzzleTemplate.pieces, run.puzzleTemplate.totalPieces);
    } else {
      await prisma.gameRun.update({ where: { id: run.id }, data: { status: "LOST", finishedAt: new Date() } });
    }
  }

  const runAfter = await prisma.gameRun.findFirst({
    where: { id: run.id },
    select: { status: true },
  });

  return res.json({
    runId: run.id,
    isCorrect,
    totalAnswered,
    totalCorrect,
    totalQuestions,
    quizFinished,
    puzzleUnlocked,
    runStatus: runAfter?.status ?? run.status,
  });
});

router.get("/runs/:runId/pieces", async (req, res) => {
  const params = z.object({ runId: z.string().uuid() }).safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "Invalid run id" });
  const runAccessToken = getRunAccessToken(req);
  if (!runAccessToken) return res.status(401).json({ error: "Missing run access token" });
  const run = await prisma.gameRun.findFirst({
    where: { id: params.data.runId, accessToken: runAccessToken },
    include: { puzzleTemplate: true },
  });
  if (!run) return res.status(404).json({ error: "Run not found" });
  if (run.status !== "QUIZ_DONE") {
    return res.status(409).json({
      error: run.status === "LOST" ? "Quiz not passed — need all answers correct to unlock puzzle" : "Puzzle locked until quiz is passed",
    });
  }
  const totalPieces = run.puzzleTemplate.totalPieces;
  const pieces = await prisma.runPieceInventory.findMany({
    where: { runId: params.data.runId, userId: run.userId },
    include: { piece: true },
    orderBy: { displayOrder: "asc" },
  });
  const inPlay = pieces.filter((p) => p.piece.correctSlot >= 0 && p.piece.correctSlot < totalPieces);
  const defaultImage = "/images/ponagar-bg.png";
  return res.json({
    runId: params.data.runId,
    totalPieces,
    imageUrl: run.puzzleTemplate.imageUrl ?? defaultImage,
    pieces: inPlay.map((p) => ({
      pieceId: p.pieceId,
      pieceCode: p.piece.pieceCode,
      correctSlot: p.piece.correctSlot,
      displayOrder: p.displayOrder,
    })),
  });
});

router.post("/runs/:runId/placements", async (req, res) => {
  const params = z.object({ runId: z.string().uuid() }).safeParse(req.params);
  const body = z.object({ pieceId: z.string().uuid(), slotPosition: z.number().int().min(0) }).safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ error: "Invalid payload" });
  const runAccessToken = getRunAccessToken(req);
  if (!runAccessToken) return res.status(401).json({ error: "Missing run access token" });

  const inv = await prisma.runPieceInventory.findFirst({
    where: { runId: params.data.runId, pieceId: body.data.pieceId, run: { accessToken: runAccessToken } },
    include: { piece: true, run: { include: { puzzleTemplate: true } } },
  });
  if (!inv) return res.status(404).json({ error: "Piece not unlocked for this run" });
  if (inv.run.status !== "QUIZ_DONE") return res.status(409).json({ error: "Puzzle locked until quiz is done" });
  const maxSlot = inv.run.puzzleTemplate.totalPieces - 1;
  if (body.data.slotPosition < 0 || body.data.slotPosition > maxSlot) {
    return res.status(400).json({ error: "Invalid slot position" });
  }
  if (inv.piece.correctSlot !== body.data.slotPosition) {
    return res.status(400).json({ error: "WRONG_SLOT" });
  }

  const placement = await prisma.runPiecePlacement.upsert({
    where: { runId_pieceId: { runId: params.data.runId, pieceId: body.data.pieceId } },
    create: {
      runId: params.data.runId,
      userId: inv.run.userId,
      pieceId: body.data.pieceId,
      slotPosition: body.data.slotPosition,
      isCorrectPos: inv.piece.correctSlot === body.data.slotPosition,
    },
    update: {
      slotPosition: body.data.slotPosition,
      isCorrectPos: inv.piece.correctSlot === body.data.slotPosition,
      placedAt: new Date(),
    },
  });

  return res.json({ runId: params.data.runId, pieceId: placement.pieceId, slotPosition: placement.slotPosition, isCorrectPosition: placement.isCorrectPos });
});

router.post("/runs/:runId/finalize", async (req, res) => {
  const params = z.object({ runId: z.string().uuid() }).safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "Invalid run id" });
  const runAccessToken = getRunAccessToken(req);
  if (!runAccessToken) return res.status(401).json({ error: "Missing run access token" });

  const run = await prisma.gameRun.findFirst({
    where: { id: params.data.runId, accessToken: runAccessToken },
    include: { questions: true, puzzleTemplate: true },
  });
  if (!run) return res.status(404).json({ error: "Run not found" });
  if (run.status !== "QUIZ_DONE") return res.status(409).json({ error: "Run not ready for finalization" });

  const [correctCount, wrongCount, correctPlacements, placementCount] = await Promise.all([
    prisma.gameRunQuestion.count({ where: { runId: run.id, isCorrect: true } }),
    prisma.gameRunQuestion.count({ where: { runId: run.id, isCorrect: false } }),
    prisma.runPiecePlacement.count({ where: { runId: run.id, isCorrectPos: true } }),
    prisma.runPiecePlacement.count({ where: { runId: run.id } }),
  ]);

  const puzzleCompleted = placementCount === run.puzzleTemplate.totalPieces && correctPlacements === run.puzzleTemplate.totalPieces;
  const completionTimeSec = Math.max(1, Math.floor((Date.now() - run.startedAt.getTime()) / 1000));
  const scoreTotal = correctCount * 100 + (puzzleCompleted ? 500 : 0) + Math.max(0, 600 - completionTimeSec);
  const won = puzzleCompleted;

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.gameResult.upsert({
      where: { runId: run.id },
      create: {
        runId: run.id,
        userId: run.userId,
        correctCount,
        wrongCount,
        scoreTotal,
        completionTimeSec,
        won,
      },
      update: {
        correctCount,
        wrongCount,
        scoreTotal,
        completionTimeSec,
        won,
      },
    });
    await tx.gameRun.update({
      where: { id: run.id },
      data: { status: won ? "WON" : "LOST", finishedAt: new Date() },
    });

    const campaignLevel = resolveCampaignLevel(run.puzzleTemplate);
    if (won && campaignLevel != null) {
      const existing = await tx.campaignProgress.findUnique({ where: { userId: run.userId } });
      if (!existing) {
        await tx.campaignProgress.create({
          data: {
            userId: run.userId,
            totalTimeSec: completionTimeSec,
            highestLevel: campaignLevel,
            completedAt: campaignLevel >= 5 ? new Date() : null,
          },
        });
      } else {
        const nextHighest = Math.max(existing.highestLevel, campaignLevel);
        await tx.campaignProgress.update({
          where: { userId: run.userId },
          data: {
            totalTimeSec: existing.totalTimeSec + completionTimeSec,
            highestLevel: nextHighest,
            completedAt: nextHighest >= 5 ? new Date() : existing.completedAt,
          },
        });
      }
    }

    return created;
  });

  const ranked = await prisma.gameResult.findMany({
    where: { won: true },
    orderBy: [{ scoreTotal: "desc" }, { completionTimeSec: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const rank = ranked.findIndex((x) => x.id === result.id) + 1;
  const isTop3 = result.won && rank > 0 && rank <= 3;

  return res.json({
    ...result,
    rank,
    isTop3,
    messageKey: result.won ? (isTop3 ? "won_top3" : "won_rank") : "lost",
    message: result.won
      ? isTop3
        ? "Ban thang va dang trong top 3! Vui long nhap ten va tuoi de vinh danh."
        : `Ban thang va dang xep vi tri thu ${rank}. Can choi nhanh hon de co thu hang tot hon.`
      : "Ban chua ghep dung toan bo thap. Hay thu lai.",
  });
});

router.post("/runs/:runId/winner-profile", async (req, res) => {
  const params = z.object({ runId: z.string().uuid() }).safeParse(req.params);
  const body = z.object({ playerName: z.string().min(2).max(60), playerAge: z.number().int().min(7).max(18) }).safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ error: "Invalid payload" });
  const runAccessToken = getRunAccessToken(req);
  if (!runAccessToken) return res.status(401).json({ error: "Missing run access token" });

  const run = await prisma.gameRun.findFirst({ where: { id: params.data.runId, accessToken: runAccessToken } });
  if (!run) return res.status(404).json({ error: "Run not found" });

  const result = await prisma.gameResult.findUnique({ where: { runId: run.id } });
  if (!result || !result.won) return res.status(409).json({ error: "Run has no winning result" });

  const ranked = await prisma.gameResult.findMany({
    where: { won: true },
    orderBy: [{ scoreTotal: "desc" }, { completionTimeSec: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const rank = ranked.findIndex((x) => x.id === result.id) + 1;
  if (!(rank > 0 && rank <= 3)) {
    return res.status(409).json({ error: "Only top 3 winners can submit profile" });
  }

  const updated = await prisma.gameResult.update({
    where: { id: result.id },
    data: { playerName: body.data.playerName, playerAge: body.data.playerAge },
  });

  await prisma.$transaction([
    prisma.user.update({
      where: { id: run.userId },
      data: { displayName: body.data.playerName },
    }),
    prisma.campaignProgress.upsert({
      where: { userId: run.userId },
      update: { displayName: body.data.playerName },
      create: {
        userId: run.userId,
        displayName: body.data.playerName,
        totalTimeSec: 0,
        highestLevel: 0,
      },
    }),
  ]);

  return res.json({ ok: true, resultId: updated.id, rank });
});

export default router;
