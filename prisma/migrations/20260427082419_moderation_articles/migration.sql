/*
  Warnings:

  - The `status` column on the `articles` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('VISIBLE', 'HIDDEN', 'UNDER_REVIEW', 'BANNED');

-- AlterTable
ALTER TABLE "_ArticleTags" ADD CONSTRAINT "_ArticleTags_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ArticleTags_AB_unique";

-- AlterTable
ALTER TABLE "articles" DROP COLUMN "status",
ADD COLUMN     "status" "ContentStatus" NOT NULL DEFAULT 'VISIBLE';

-- CreateTable
CREATE TABLE "BannedWord" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "BannedWord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BannedWord_word_tenantId_key" ON "BannedWord"("word", "tenantId");

-- AddForeignKey
ALTER TABLE "BannedWord" ADD CONSTRAINT "BannedWord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
