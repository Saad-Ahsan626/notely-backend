-- Notely: local MySQL setup
--
-- Creates the databases and a least-privilege application user.
-- Safe to run more than once (IF NOT EXISTS everywhere).
--
-- Run as an admin user:  npm run db:init
--
-- The password below is a LOCAL DEVELOPMENT default only (it matches .env.example).
-- To change it, run ALTER USER in MySQL instead of editing this file,
-- so a real password never gets committed. See docs/local-database-setup.md.

-- Databases -------------------------------------------------------------------
-- utf8mb4 is real UTF-8 (emoji included). Set explicitly instead of relying on server defaults.

-- Development data
CREATE DATABASE IF NOT EXISTS notely_dev
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- End-to-end tests (wiped between test runs, never shares data with development)
CREATE DATABASE IF NOT EXISTS notely_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Prisma shadow database for `prisma migrate dev` (used from Phase 3)
CREATE DATABASE IF NOT EXISTS notely_shadow
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Application user --------------------------------------------------------------
-- The app never connects as root. This user can only access the three Notely databases.

CREATE USER IF NOT EXISTS 'notely'@'localhost' IDENTIFIED BY 'change_me_local_password';

GRANT ALL PRIVILEGES ON notely_dev.* TO 'notely'@'localhost';
GRANT ALL PRIVILEGES ON notely_test.* TO 'notely'@'localhost';
GRANT ALL PRIVILEGES ON notely_shadow.* TO 'notely'@'localhost';
