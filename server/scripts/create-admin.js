import "../src/config/env.js";

import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../src/db/prisma.js";

const inputSchema = z.object({
  email: z.string().trim().email().max(191),
  fullName: z.string().trim().min(2).max(150),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[0-9]/, "Password must include a number.")
    .regex(/[^A-Za-z0-9]/, "Password must include a symbol."),
});
c;
async function main() {
  const parsed = inputSchema.safeParse({
    email: process.env.ADMIN_EMAIL,
    fullName: process.env.ADMIN_FULL_NAME,
    password: process.env.ADMIN_PASSWORD,
  });

  if (!parsed.success) {
    throw new Error(
      "Invalid admin input. Check the email, full name, and password requirements.",
    );
  }

  const { email, fullName, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    throw new Error(
      "This email already exists. No account or password was changed.",
    );
  }

  const passwordHash = await argon2.hash(password);

  await prisma.user.create({
    data: {
      email: normalizedEmail,
      fullName,
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log(`Administrator created successfully: ${normalizedEmail}`);
}

try {
  await main();
} catch (error) {
  console.error("Administrator creation failed:", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
