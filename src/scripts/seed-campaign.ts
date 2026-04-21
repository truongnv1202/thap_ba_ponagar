import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const levels = [
  { code: "ponagar-level-1", name: "Level 1 - Thap 1", pieces: 4, levelNumber: 1, imageUrl: "/images/level-1.png" },
  { code: "ponagar-level-2", name: "Level 2 - Thap 2", pieces: 6, levelNumber: 2, imageUrl: "/images/level-2.png" },
  { code: "ponagar-level-3", name: "Level 3 - Thap 3", pieces: 9, levelNumber: 3, imageUrl: "/images/level-3.png" },
  { code: "ponagar-level-4", name: "Level 4 - Thap 4", pieces: 12, levelNumber: 4, imageUrl: "/images/level-4.png" },
  { code: "ponagar-level-5", name: "Level 5 - Quang canh chung", pieces: 16, levelNumber: 5, imageUrl: "/images/level-5.png" },
];

async function upsertConfig() {
  await prisma.gameConfig.upsert({
    where: { code: "default" },
    update: {
      questionsPerRun: 10,
      minCorrectUnlockPuzzle: 5,
      timeLimitSec: 180,
      active: true,
    },
    create: {
      code: "default",
      questionsPerRun: 10,
      minCorrectUnlockPuzzle: 5,
      timeLimitSec: 180,
      active: true,
    },
  });
}

async function upsertPuzzles() {
  for (const level of levels) {
    const existing = await prisma.puzzleTemplate.findUnique({ where: { code: level.code } });
    if (existing) {
      await prisma.puzzlePiece.deleteMany({ where: { templateId: existing.id } });
      await prisma.puzzleTemplate.update({
        where: { id: existing.id },
        data: {
          name: level.name,
          totalPieces: level.pieces,
          levelNumber: level.levelNumber,
          imageUrl: level.imageUrl,
          isActive: true,
        },
      });
      await prisma.puzzlePiece.createMany({
        data: Array.from({ length: level.pieces }, (_, idx) => ({
          templateId: existing.id,
          pieceCode: `piece-${idx + 1}`,
          correctSlot: idx,
        })),
      });
      continue;
    }

    const tpl = await prisma.puzzleTemplate.create({
      data: {
        code: level.code,
        name: level.name,
        totalPieces: level.pieces,
        levelNumber: level.levelNumber,
        imageUrl: level.imageUrl,
        isActive: true,
      },
    });
    await prisma.puzzlePiece.createMany({
      data: Array.from({ length: level.pieces }, (_, idx) => ({
        templateId: tpl.id,
        pieceCode: `piece-${idx + 1}`,
        correctSlot: idx,
      })),
    });
  }
}

async function ensureQuestions() {
  const count = await prisma.questionBank.count({ where: { isActive: true } });
  if (count >= 100) return;

  const missing = 100 - count;
  for (let i = 0; i < missing; i += 1) {
    const sequence = count + i + 1;
    const correct = sequence % 4;
    await prisma.questionBank.create({
      data: {
        content: `Cau hoi mau #${sequence} ve Thap Ba Ponagar`,
        topic: "Thap Ba Ponagar",
        difficulty: 2,
        choices: {
          create: Array.from({ length: 4 }, (_, idx) => ({
            content: idx === correct ? `Dap an dung ${idx + 1}` : `Phuong an ${idx + 1}`,
            isCorrect: idx === correct,
            orderIndex: idx,
          })),
        },
      },
    });
  }
}

function maskDatabaseUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "(invalid DATABASE_URL)";
  }
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "Missing DATABASE_URL. Create a .env file in the project root with:\n  DATABASE_URL=\"postgresql://USER:PASSWORD@localhost:5432/DBNAME?schema=public\"",
    );
    process.exit(1);
  }

  try {
    await prisma.$connect();
  } catch (e) {
    const hint = process.env.DATABASE_URL
      ? ` (${maskDatabaseUrl(process.env.DATABASE_URL)})`
      : "";
    console.error(
      "Cannot connect to PostgreSQL%s.\n" +
        "- Start the database (e.g. Docker: docker compose up -d, or: brew services start postgresql@16).\n" +
        "- Run migrations: npx prisma migrate deploy\n" +
        "- Check DATABASE_URL in .env matches host, port, user, and database name.",
      hint,
    );
    console.error(e);
    process.exit(1);
  }

  await upsertConfig();
  await upsertPuzzles();
  await ensureQuestions();
  console.log("Campaign seed done: default config + 5 puzzle levels + minimum question bank");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
