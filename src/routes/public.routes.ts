import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/slides", async (_req, res) => {
  const slides = await prisma.homeSlide.findMany({
    where: { active: true },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
  });
  return res.json({ items: slides });
});

export default router;
