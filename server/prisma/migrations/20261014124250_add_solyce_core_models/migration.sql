-- AlterTable
ALTER TABLE `users` MODIFY `role` ENUM('STUDENT', 'INSTRUCTOR', 'ADMIN') NOT NULL DEFAULT 'STUDENT';

-- CreateTable
CREATE TABLE `courses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `language` ENUM('ENGLISH', 'FRENCH') NOT NULL,
    `examType` VARCHAR(50) NOT NULL,
    `durationWeeks` INTEGER NOT NULL,
    `curriculum` TEXT NULL,
    `priceXaf` INTEGER NOT NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `courses_slug_key`(`slug`),
    INDEX `courses_isPublished_language_idx`(`isPublished`, `language`),
    INDEX `courses_examType_idx`(`examType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cohorts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `courseId` INTEGER NOT NULL,
    `instructorId` INTEGER NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `enrollmentDeadline` DATETIME(3) NULL,
    `scheduleDescription` VARCHAR(255) NOT NULL,
    `timezone` VARCHAR(50) NOT NULL DEFAULT 'Africa/Douala',
    `capacity` INTEGER NOT NULL DEFAULT 8,
    `minimumStudents` INTEGER NOT NULL DEFAULT 6,
    `priceXaf` INTEGER NULL,
    `status` ENUM('DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `cohorts_courseId_status_idx`(`courseId`, `status`),
    INDEX `cohorts_startDate_status_idx`(`startDate`, `status`),
    INDEX `cohorts_instructorId_idx`(`instructorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enrollments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `cohortId` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'AWAITING_PAYMENT', 'PAYMENT_UNDER_REVIEW', 'CONFIRMED', 'CANCELLED', 'WAITLISTED') NOT NULL DEFAULT 'PENDING',
    `agreedPriceXaf` INTEGER NOT NULL,
    `enrolledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confirmedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `enrollments_cohortId_status_idx`(`cohortId`, `status`),
    INDEX `enrollments_userId_status_idx`(`userId`, `status`),
    UNIQUE INDEX `enrollments_userId_cohortId_key`(`userId`, `cohortId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `enrollmentId` INTEGER NOT NULL,
    `expectedAmountXaf` INTEGER NOT NULL,
    `receivedAmountXaf` INTEGER NOT NULL DEFAULT 0,
    `method` ENUM('MTN_MOMO', 'ORANGE_MONEY', 'BANK_TRANSFER', 'CASH', 'OTHER') NOT NULL,
    `status` ENUM('PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `transactionReference` VARCHAR(191) NULL,
    `verificationNote` TEXT NULL,
    `verifiedById` INTEGER NULL,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payments_enrollmentId_status_idx`(`enrollmentId`, `status`),
    INDEX `payments_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `payments_verifiedById_idx`(`verifiedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `users_role_isActive_idx` ON `users`(`role`, `isActive`);

-- AddForeignKey
ALTER TABLE `cohorts` ADD CONSTRAINT `cohorts_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cohorts` ADD CONSTRAINT `cohorts_instructorId_fkey` FOREIGN KEY (`instructorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `cohorts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `enrollments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_verifiedById_fkey` FOREIGN KEY (`verifiedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
