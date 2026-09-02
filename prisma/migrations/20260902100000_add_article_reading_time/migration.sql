-- AlterTable
ALTER TABLE "article_translations" ADD COLUMN     "readingTime" INTEGER NOT NULL DEFAULT 0;

-- Backfill: the regex tag-strip below is cruder than the runtime's
-- sanitize-html-based computation and may differ by about a minute on
-- historical rows.
UPDATE "article_translations"
SET "readingTime" = GREATEST(1, CEIL(
  COALESCE(array_length(
    regexp_split_to_array(btrim(regexp_replace("content", '<[^>]*>', ' ', 'g')), '\s+'), 1
  ), 0) / 200.0
));
