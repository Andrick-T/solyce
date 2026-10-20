-- AlterTable
ALTER TABLE `cohort_lessons` ADD COLUMN `meetingProvider` ENUM('GOOGLE_MEET', 'ZOOM', 'WHATSAPP') NULL,
    ADD COLUMN `meetingUrl` VARCHAR(2048) NULL;

-- CreateTable
CREATE TABLE `attendance_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `enrollmentId` INTEGER NOT NULL,
    `cohortLessonId` INTEGER NOT NULL,
    `status` ENUM('PRESENT', 'ABSENT', 'LATE', 'EXCUSED') NOT NULL DEFAULT 'PRESENT',
    `note` VARCHAR(500) NULL,
    `markedById` INTEGER NULL,
    `markedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `attendance_records_cohortLessonId_status_idx`(`cohortLessonId`, `status`),
    INDEX `attendance_records_markedById_idx`(`markedById`),
    UNIQUE INDEX `attendance_records_enrollmentId_cohortLessonId_key`(`enrollmentId`, `cohortLessonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `enrollments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_cohortLessonId_fkey` FOREIGN KEY (`cohortLessonId`) REFERENCES `cohort_lessons`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_markedById_fkey` FOREIGN KEY (`markedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
