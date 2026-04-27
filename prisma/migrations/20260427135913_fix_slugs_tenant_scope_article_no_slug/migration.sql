/*
  Warnings:

  - You are about to drop the column `slug` on the `articles` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "articles_slug_key";

-- AlterTable
ALTER TABLE "articles" DROP COLUMN "slug";

-- AddForeignKey
ALTER TABLE "article_translations" ADD CONSTRAINT "article_translations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
