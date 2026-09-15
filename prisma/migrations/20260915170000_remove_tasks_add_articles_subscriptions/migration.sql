-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('Draft', 'Published');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('Pending', 'Active', 'Cancelled', 'Expired');

-- DropTable (Tasks CRUD removed — 6 test rows discarded per plan)
DROP TABLE "tasks";

-- CreateTable articles
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cover_image_url" TEXT,
    "status" "ArticleStatus" NOT NULL DEFAULT 'Draft',
    "author_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable subscriptions (single-tier, one active sub per user)
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "flw_plan_id" INTEGER NOT NULL DEFAULT 243392,
    "flw_subscription_id" INTEGER,
    "tx_ref" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'Pending',
    "current_period_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable payment_events (audit log for checkout/verify/webhook)
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "tx_ref" TEXT,
    "flw_tx_id" TEXT,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");

-- CreateIndex
CREATE INDEX "articles_status_created_at_idx" ON "articles"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_tx_ref_key" ON "subscriptions"("tx_ref");

-- CreateIndex
CREATE INDEX "payment_events_tx_ref_idx" ON "payment_events"("tx_ref");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
