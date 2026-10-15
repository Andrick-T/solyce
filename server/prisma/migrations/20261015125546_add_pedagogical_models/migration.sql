-- CreateTable
CREATE TABLE `course_modules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `courseId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `position` INTEGER NOT NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `course_modules_courseId_isPublished_idx`(`courseId`, `isPublished`),
    UNIQUE INDEX `course_modules_courseId_position_key`(`courseId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lessons` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `moduleId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `objectives` TEXT NULL,
    `preparationContent` TEXT NULL,
    `content` TEXT NULL,
    `estimatedMinutes` INTEGER NULL,
    `position` INTEGER NOT NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `lessons_moduleId_isPublished_idx`(`moduleId`, `isPublished`),
    UNIQUE INDEX `lessons_moduleId_position_key`(`moduleId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `learning_resources` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lessonId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `resourceType` ENUM('PDF', 'DOCUMENT', 'VIDEO', 'AUDIO', 'LINK', 'IMAGE', 'OTHER') NOT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `releasePhase` ENUM('PREPARATION', 'AFTER_SESSION') NOT NULL DEFAULT 'AFTER_SESSION',
    `position` INTEGER NOT NULL DEFAULT 0,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `learning_resources_lessonId_releasePhase_isPublished_idx`(`lessonId`, `releasePhase`, `isPublished`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assessments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lessonId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `assessmentType` ENUM('HOMEWORK', 'QUIZ', 'PRACTICE', 'MOCK_EXAM') NOT NULL,
    `releasePhase` ENUM('PREPARATION', 'AFTER_SESSION') NOT NULL DEFAULT 'AFTER_SESSION',
    `instructions` TEXT NULL,
    `maxScore` INTEGER NULL,
    `passingScore` INTEGER NULL,
    `timeLimitMinutes` INTEGER NULL,
    `dueAt` DATETIME(3) NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `assessments_lessonId_releasePhase_isPublished_idx`(`lessonId`, `releasePhase`, `isPublished`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assessment_questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assessmentId` INTEGER NOT NULL,
    `questionType` ENUM('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'LONG_ANSWER') NOT NULL,
    `prompt` TEXT NOT NULL,
    `options` JSON NULL,
    `correctAnswer` JSON NULL,
    `explanation` TEXT NULL,
    `points` INTEGER NOT NULL DEFAULT 1,
    `position` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `assessment_questions_assessmentId_idx`(`assessmentId`),
    UNIQUE INDEX `assessment_questions_assessmentId_position_key`(`assessmentId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cohort_lessons` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohortId` INTEGER NOT NULL,
    `lessonId` INTEGER NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `scheduledEndAt` DATETIME(3) NOT NULL,
    `preparationLeadMinutes` INTEGER NOT NULL DEFAULT 30,
    `status` ENUM('SCHEDULED', 'RESCHEDULED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `instructorNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `cohort_lessons_cohortId_scheduledAt_status_idx`(`cohortId`, `scheduledAt`, `status`),
    INDEX `cohort_lessons_lessonId_scheduledAt_idx`(`lessonId`, `scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lesson_progress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `enrollmentId` INTEGER NOT NULL,
    `cohortLessonId` INTEGER NOT NULL,
    `status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'NOT_STARTED',
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `lastAccessedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `lesson_progress_cohortLessonId_status_idx`(`cohortLessonId`, `status`),
    INDEX `lesson_progress_enrollmentId_status_idx`(`enrollmentId`, `status`),
    UNIQUE INDEX `lesson_progress_enrollmentId_cohortLessonId_key`(`enrollmentId`, `cohortLessonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assessment_attempts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `enrollmentId` INTEGER NOT NULL,
    `assessmentId` INTEGER NOT NULL,
    `attemptNumber` INTEGER NOT NULL DEFAULT 1,
    `answers` JSON NULL,
    `score` DECIMAL(8, 2) NULL,
    `feedback` TEXT NULL,
    `status` ENUM('IN_PROGRESS', 'SUBMITTED', 'GRADED') NOT NULL DEFAULT 'IN_PROGRESS',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `submittedAt` DATETIME(3) NULL,
    `gradedAt` DATETIME(3) NULL,
    `gradedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `assessment_attempts_enrollmentId_status_idx`(`enrollmentId`, `status`),
    INDEX `assessment_attempts_assessmentId_status_idx`(`assessmentId`, `status`),
    INDEX `assessment_attempts_gradedById_idx`(`gradedById`),
    UNIQUE INDEX `assessment_attempts_enrollmentId_assessmentId_attemptNumber_key`(`enrollmentId`, `assessmentId`, `attemptNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `course_modules` ADD CONSTRAINT `course_modules_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lessons` ADD CONSTRAINT `lessons_moduleId_fkey` FOREIGN KEY (`moduleId`) REFERENCES `course_modules`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `learning_resources` ADD CONSTRAINT `learning_resources_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `lessons`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `lessons`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessment_questions` ADD CONSTRAINT `assessment_questions_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `assessments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cohort_lessons` ADD CONSTRAINT `cohort_lessons_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `cohorts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cohort_lessons` ADD CONSTRAINT `cohort_lessons_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `lessons`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lesson_progress` ADD CONSTRAINT `lesson_progress_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `enrollments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lesson_progress` ADD CONSTRAINT `lesson_progress_cohortLessonId_fkey` FOREIGN KEY (`cohortLessonId`) REFERENCES `cohort_lessons`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessment_attempts` ADD CONSTRAINT `assessment_attempts_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `enrollments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessment_attempts` ADD CONSTRAINT `assessment_attempts_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `assessments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessment_attempts` ADD CONSTRAINT `assessment_attempts_gradedById_fkey` FOREIGN KEY (`gradedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
