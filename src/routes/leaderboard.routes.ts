import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", async (_req, res) => {
  const results = await prisma.gameResult.findMany({
    where: { won: true },
    orderBy: [{ scoreTotal: "desc" }, { completionTimeSec: "asc" }, { createdAt: "asc" }],
    take: 100,
    include: { user: { select: { id: true, displayName: true } } },
  });

  return res.json({
    items: results.map((x, idx) => ({
      rank: idx + 1,
      userId: x.userId,
      displayName: x.playerName ?? x.user.displayName,
      score: x.scoreTotal,
      completionTimeSec: x.completionTimeSec,
      wonAt: x.createdAt,
    })),
  });
});

router.get("/campaign", async (req, res) => {
  const level = Number(req.query.level ?? 1);
  if (!Number.isInteger(level) || level < 1 || level > 5) {
    return res.status(400).json({ error: "level must be integer 1..5" });
  }

  const items = await prisma.campaignProgress.findMany({
    where: { highestLevel: { gte: level } },
    orderBy: [{ totalTimeSec: "asc" }, { updatedAt: "asc" }],
    take: 100,
    include: { user: { select: { id: true, displayName: true } } },
  });

  return res.json({
    level,
    items: items.map((entry, idx) => ({
      rank: idx + 1,
      userId: entry.userId,
      displayName: entry.displayName ?? entry.user.displayName,
      totalTimeSec: entry.totalTimeSec,
      highestLevel: entry.highestLevel,
      completedAt: entry.completedAt,
    })),
  });
});

export default router;
