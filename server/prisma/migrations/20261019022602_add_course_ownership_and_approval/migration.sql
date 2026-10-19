-- AlterTable
ALTER TABLE `courses` ADD COLUMN `approvalStatus` ENUM('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
    ADD COLUMN `createdById` INTEGER NULL;

-- CreateIndex
CREATE INDEX `courses_createdById_approvalStatus_idx` ON `courses`(`createdById`, `approvalStatus`);

-- AddForeignKey
ALTER TABLE `courses` ADD CONSTRAINT `courses_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
