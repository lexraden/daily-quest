-- CreateTable
CREATE TABLE "telegram_meal_edits" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "from_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "meal_id" TEXT NOT NULL,
    "message_id" INTEGER NOT NULL,
    "field" TEXT,
    "pending_until" TIMESTAMP(3),
    "changed" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_meal_edits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_meal_edits_chat_id_key" ON "telegram_meal_edits"("chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_meal_edits_token_hash_key" ON "telegram_meal_edits"("token_hash");

-- CreateIndex
CREATE INDEX "telegram_meal_edits_user_id_idx" ON "telegram_meal_edits"("user_id");

-- AddForeignKey
ALTER TABLE "telegram_meal_edits" ADD CONSTRAINT "telegram_meal_edits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
