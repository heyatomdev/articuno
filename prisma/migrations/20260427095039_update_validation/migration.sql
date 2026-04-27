/*
  Warnings:

  - The values [UNDER_REVIEW] on the enum `ContentStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `viewsCount` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `read` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `resourceId` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `resourceType` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `sendedToClient` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `reports` table. All the data in the column will be lost.
  - You are about to drop the column `allowComments` on the `tenants` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `BannedWord` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BANNED', 'SHADOW_BANNED');

-- AlterEnum
BEGIN;
CREATE TYPE "ContentStatus_new" AS ENUM ('PUBLISHED', 'DRAFT', 'HIDDEN', 'BANNED', 'VISIBLE');
ALTER TABLE "public"."articles" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "articles" ALTER COLUMN "status" TYPE "ContentStatus_new" USING ("status"::text::"ContentStatus_new");
ALTER TYPE "ContentStatus" RENAME TO "ContentStatus_old";
ALTER TYPE "ContentStatus_new" RENAME TO "ContentStatus";
DROP TYPE "public"."ContentStatus_old";
ALTER TABLE "articles" ALTER COLUMN "status" SET DEFAULT 'VISIBLE';
COMMIT;

-- DropForeignKey
ALTER TABLE "BannedWord" DROP CONSTRAINT "BannedWord_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- AlterTable
ALTER TABLE "articles" DROP COLUMN "viewsCount",
ADD COLUMN     "commentsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "status" "ContentStatus" NOT NULL DEFAULT 'VISIBLE';

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "read",
DROP COLUMN "resourceId",
DROP COLUMN "resourceType",
DROP COLUMN "sendedToClient",
DROP COLUMN "updatedAt",
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "sentToClient" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "reports" DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "tenants" DROP COLUMN "allowComments",
ADD COLUMN     "webhookSecret" TEXT,
ADD COLUMN     "webhookUrl" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "updatedAt",
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- DropTable
DROP TABLE "BannedWord";

-- CreateTable
CREATE TABLE "banned_words" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "banned_words_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "banned_words_word_tenantId_key" ON "banned_words"("word", "tenantId");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banned_words" ADD CONSTRAINT "banned_words_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
