CREATE TABLE IF NOT EXISTS `solyce_sessions` (
  `session_id` VARCHAR(128)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` INT UNSIGNED NOT NULL,
  `data` MEDIUMTEXT
    CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
);