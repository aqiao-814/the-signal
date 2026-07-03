-- AlterTable
ALTER TABLE "user" ADD COLUMN     "creditsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastRefreshedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "credit_pool" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "total" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_pool_pkey" PRIMARY KEY ("id")
);
