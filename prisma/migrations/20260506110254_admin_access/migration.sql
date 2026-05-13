-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TENANT_ADMIN', 'EDITOR', 'MODERATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_CREATED', 'USER_UPDATED_ROLE', 'USER_DELETED', 'ARTICLE_CREATED', 'ARTICLE_UPDATED', 'ARTICLE_DELETED', 'ARTICLE_STATUS_CHANGED', 'COMMENT_CREATED', 'COMMENT_UPDATED', 'COMMENT_DELETED', 'COMMENT_STATUS_CHANGED', 'REPORT_CREATED', 'REPORT_STATUS_CHANGED', 'BANNED_WORD_CREATED', 'BANNED_WORD_DELETED', 'ROLE_ASSIGNMENT_CHANGED');

-- CreateEnum
CREATE TYPE "AuditResourceType" AS ENUM ('USER', 'ARTICLE', 'COMMENT', 'REPORT', 'BANNED_WORD');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'MEMBER';

-- CreateTable
CREATE TABLE "admin_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "lastPasswordChangeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "isLockedOut" BOOLEAN NOT NULL DEFAULT false,
    "lockedUntil" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userRole" "UserRole" NOT NULL,
    "externalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastAccessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" "UserRole" NOT NULL,
    "action" "AuditAction" NOT NULL,
    "resourceType" "AuditResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "resourceName" TEXT,
    "changesBefore" JSONB,
    "changesAfter" JSONB,
    "changeSummary" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_credentials_userId_key" ON "admin_credentials"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_credentials_email_key" ON "admin_credentials"("email");

-- CreateIndex
CREATE INDEX "admin_credentials_email_idx" ON "admin_credentials"("email");

-- CreateIndex
CREATE INDEX "sessions_id_idx" ON "sessions"("id");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyId_key" ON "api_keys"("keyId");

-- CreateIndex
CREATE INDEX "api_keys_tenantId_idx" ON "api_keys"("tenantId");

-- CreateIndex
CREATE INDEX "api_keys_keyId_idx" ON "api_keys"("keyId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_tenantId_keyId_key" ON "api_keys"("tenantId", "keyId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_timestamp_idx" ON "audit_logs"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_action_idx" ON "audit_logs"("tenantId", "action");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_actorUserId_idx" ON "audit_logs"("tenantId", "actorUserId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_resourceId_idx" ON "audit_logs"("tenantId", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "admin_credentials" ADD CONSTRAINT "admin_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
