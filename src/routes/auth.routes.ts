import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/auth.js";
import { authRequired } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/register", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    displayName: z.string().min(1),
  });
  const data = schema.safeParse(req.body);
  if (!data.success) return res.status(400).json({ error: data.error.flatten() });

  const exists = await prisma.user.findUnique({ where: { email: data.data.email } });
  if (exists) return res.status(409).json({ error: "Email already exists" });

  const user = await prisma.user.create({
    data: {
      email: data.data.email,
      passwordHash: await bcrypt.hash(data.data.password, 10),
      displayName: data.data.displayName,
    },
  });

  const token = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  return res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName } });
});

router.post("/login", async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
  const data = schema.safeParse(req.body);
  if (!data.success) return res.status(400).json({ error: data.error.flatten() });

  const user = await prisma.user.findUnique({ where: { email: data.data.email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(data.data.password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  return res.json({ token, user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName } });
});

router.get("/me", authRequired, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({ id: user.id, email: user.email, displayName: user.displayName, role: user.role, createdAt: user.createdAt });
});

export default router;
