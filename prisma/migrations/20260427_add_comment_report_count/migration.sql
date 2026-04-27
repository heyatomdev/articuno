-- AddColumn reportCount to comments
ALTER TABLE "comments" ADD COLUMN "reportCount" INTEGER NOT NULL DEFAULT 0;

