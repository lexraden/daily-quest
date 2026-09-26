-- CreateTable
CREATE TABLE "telegram_meal_previews" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "from_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "meal" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_meal_previews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_meal_previews_chat_id_key" ON "telegram_meal_previews"("chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_meal_previews_token_hash_key" ON "telegram_meal_previews"("token_hash");

-- CreateIndex
CREATE INDEX "telegram_meal_previews_user_id_idx" ON "telegram_meal_previews"("user_id");

-- AddForeignKey
ALTER TABLE "telegram_meal_previews" ADD CONSTRAINT "telegram_meal_previews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
