import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertUser(params: {
  email: string;
  displayName: string;
  password: string;
  role: "ADMIN" | "STUDENT";
}) {
  const passwordHash = await bcrypt.hash(params.password, 10);
  const user = await prisma.user.upsert({
    where: { email: params.email },
    update: {
      displayName: params.displayName,
      passwordHash,
      role: params.role,
    },
    create: {
      email: params.email,
      displayName: params.displayName,
      passwordHash,
      role: params.role,
    },
  });
  return user;
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@ponagar.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@123456";
  const studentEmail = process.env.SEED_STUDENT_EMAIL || "student@ponagar.local";
  const studentPassword = process.env.SEED_STUDENT_PASSWORD || "Student@123456";

  const [admin, student] = await Promise.all([
    upsertUser({
      email: adminEmail,
      displayName: "Ponagar Admin",
      password: adminPassword,
      role: "ADMIN",
    }),
    upsertUser({
      email: studentEmail,
      displayName: "Ponagar Student",
      password: studentPassword,
      role: "STUDENT",
    }),
  ]);

  console.log("Seed users completed:");
  console.log(`- ADMIN: ${admin.email} / ${adminPassword}`);
  console.log(`- STUDENT: ${student.email} / ${studentPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
