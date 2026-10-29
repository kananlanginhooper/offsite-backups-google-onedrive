-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('gdrive', 'gphotos', 'onedrive');

-- CreateEnum
CREATE TYPE "JobKind" AS ENUM ('push', 'restore', 'verify', 'space');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "job_run" (
    "id" SERIAL NOT NULL,
    "provider" "Provider" NOT NULL,
    "kind" "JobKind" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "files_total" INTEGER,
    "files_done" INTEGER NOT NULL DEFAULT 0,
    "bytes_total" BIGINT,
    "bytes_done" BIGINT NOT NULL DEFAULT 0,
    "message" TEXT,

    CONSTRAINT "job_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restore_request" (
    "id" SERIAL NOT NULL,
    "provider" "Provider" NOT NULL,
    "hash" CHAR(64),
    "remote_path" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "bytes" BIGINT,
    "error" TEXT,
    "job_run_id" INTEGER,

    CONSTRAINT "restore_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_snapshot" (
    "id" SERIAL NOT NULL,
    "provider" "Provider" NOT NULL,
    "taken_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_bytes" BIGINT,
    "used_bytes" BIGINT,
    "free_bytes" BIGINT,
    "trashed_bytes" BIGINT,

    CONSTRAINT "space_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_run_provider_started_at_idx" ON "job_run"("provider", "started_at");

-- CreateIndex
CREATE INDEX "restore_request_hash_idx" ON "restore_request"("hash");

-- CreateIndex
CREATE INDEX "space_snapshot_provider_taken_at_idx" ON "space_snapshot"("provider", "taken_at");

-- AddForeignKey
ALTER TABLE "restore_request" ADD CONSTRAINT "restore_request_job_run_id_fkey" FOREIGN KEY ("job_run_id") REFERENCES "job_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;
