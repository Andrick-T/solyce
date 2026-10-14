import "../src/config/env.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const draftCourses = [
  {
    slug: "tcf-preparation",
    title: "TCF Preparation Program",
    description:
      "A structured French-language preparation program designed to develop the language skills required for the Test de connaissance du français (TCF). The final syllabus should be aligned with the learner's target TCF version and objectives.",
    language: "FRENCH",
    examType: "TCF",
    durationWeeks: 12,
    curriculum: [
      "Initial diagnostic assessment and individual objectives",
      "Listening comprehension strategies",
      "Reading comprehension and vocabulary development",
      "Grammar and language accuracy",
      "Written expression, where relevant to the target exam",
      "Oral expression and structured speaking practice",
      "Timed practice and mock assessments",
      "Final progress assessment and exam strategy",
    ].join("\n"),
    priceXaf: 150000,
  },
  {
    slug: "ielts-preparation",
    title: "IELTS Preparation Program",
    description:
      "A structured English-language preparation program designed to build the skills and test-taking strategies required for IELTS. The final syllabus should reflect whether learners are preparing for IELTS Academic or IELTS General Training.",
    language: "ENGLISH",
    examType: "IELTS",
    durationWeeks: 10,
    curriculum: [
      "Initial diagnostic assessment and target-score planning",
      "Listening comprehension and question strategies",
      "Reading comprehension and time management",
      "Writing Task 1 practice appropriate to the selected IELTS version",
      "Writing Task 2: argument development and coherence",
      "Speaking practice across the IELTS test parts",
      "Timed practice and mock assessments",
      "Final progress assessment and exam strategy",
    ].join("\n"),
    priceXaf: 180000,
  },
];

async function main() {
  for (const course of draftCourses) {
    await prisma.course.upsert({
      where: { slug: course.slug },
      create: {
        ...course,
        isPublished: false,
      },
      update: course,
    });

    console.log(`Draft course seeded: ${course.slug}`);
  }

  console.log("Solyce draft course seeding completed.");
}

main()
  .catch((error) => {
    console.error("Solyce course seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
