-- AlterTable
ALTER TABLE `sessions` ADD COLUMN `previous_refresh_token_hash` CHAR(64) NULL;
