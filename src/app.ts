import "./express-async-patch.js";
import express from "express";
import cors from "cors";
import { Prisma } from "@prisma/client";
import authRoutes from "./routes/auth.routes.js";
import gameRoutes from "./routes/game.routes.js";
import leaderboardRoutes from "./routes/leaderboard.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import publicRoutes from "./routes/public.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/public", publicRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = Array.isArray(err.meta?.target) ? (err.meta?.target as string[]).join(", ") : "unique field";
      return res.status(409).json({ error: `Trùng dữ liệu (mã đã tồn tại): ${target}` });
    }
    if (err.code === "P2003") {
      return res.status(400).json({ error: "Tham chiếu không hợp lệ (foreign key)." });
    }
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ error: "Dữ liệu không khớp schema cơ sở dữ liệu." });
  }
  return res.status(500).json({ error: "Internal server error" });
});

export default app;
