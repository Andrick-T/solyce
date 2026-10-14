-- AlterTable
ALTER TABLE `enrollments` ADD COLUMN `guestEmail` VARCHAR(191) NULL,
    ADD COLUMN `guestFullName` VARCHAR(150) NULL,
    ADD COLUMN `guestPhone` VARCHAR(40) NULL,
    MODIFY `userId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `enrollments_guestEmail_cohortId_idx` ON `enrollments`(`guestEmail`, `cohortId`);
