-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('queued', 'generating_numbers', 'rendering_images', 'building_pdf', 'building_zip', 'complete', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "background_image_url" TEXT NOT NULL,
    "zones" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "template_id" TEXT,
    "user_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'queued',
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "pdf_url" TEXT,
    "zip_url" TEXT,
    "error_reason" TEXT,
    "inline_template" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "ticket_index" INTEGER NOT NULL,
    "numbers" JSONB NOT NULL,
    "qr_signature" TEXT NOT NULL,
    "image_url" TEXT,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "templates_user_id_idx" ON "templates"("user_id");

-- CreateIndex
CREATE INDEX "batches_user_id_idx" ON "batches"("user_id");

-- CreateIndex
CREATE INDEX "batches_status_idx" ON "batches"("status");

-- CreateIndex
CREATE INDEX "batches_expires_at_idx" ON "batches"("expires_at");

-- CreateIndex
CREATE INDEX "tickets_batch_id_idx" ON "tickets"("batch_id");

-- CreateIndex
CREATE INDEX "tickets_qr_signature_idx" ON "tickets"("qr_signature");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_batch_id_ticket_index_key" ON "tickets"("batch_id", "ticket_index");

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
