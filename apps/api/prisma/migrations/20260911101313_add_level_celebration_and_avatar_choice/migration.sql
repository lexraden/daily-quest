-- AlterTable
ALTER TABLE "quest_data" ADD COLUMN     "celebrated_level" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_choice" TEXT;
