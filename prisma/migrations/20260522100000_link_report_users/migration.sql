-- AddForeignKey: link reporterId → users(externalId, tenantId)
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_tenantId_fkey"
  FOREIGN KEY ("reporterId", "tenantId")
  REFERENCES "users"("externalId", "tenantId")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: link moderatorId → users(externalId, tenantId)
ALTER TABLE "reports" ADD CONSTRAINT "reports_moderatorId_tenantId_fkey"
  FOREIGN KEY ("moderatorId", "tenantId")
  REFERENCES "users"("externalId", "tenantId")
  ON DELETE SET NULL ON UPDATE CASCADE;

