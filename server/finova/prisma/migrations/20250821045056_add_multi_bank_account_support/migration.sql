/*
  Warnings:

  - You are about to drop the column `bankAccount` on the `OutstandingItem` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('CURRENT', 'SAVINGS', 'BUSINESS', 'CREDIT');

-- AlterTable
ALTER TABLE "BankTransaction" ADD COLUMN     "bankAccountId" INTEGER;

-- AlterTable
ALTER TABLE "OutstandingItem" DROP COLUMN "bankAccount",
ADD COLUMN     "bankAccountId" INTEGER,
ADD COLUMN     "bankAccountString" TEXT;

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" SERIAL NOT NULL,
    "iban" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RON',
    "accountType" "BankAccountType" NOT NULL DEFAULT 'CURRENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "accountingClientId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_iban_key" ON "BankAccount"("iban");

-- CreateIndex
CREATE INDEX "BankAccount_accountingClientId_idx" ON "BankAccount"("accountingClientId");

-- CreateIndex
CREATE INDEX "BankAccount_iban_idx" ON "BankAccount"("iban");

-- CreateIndex
CREATE INDEX "BankAccount_isActive_idx" ON "BankAccount"("isActive");

-- CreateIndex
CREATE INDEX "BankTransaction_bankAccountId_idx" ON "BankTransaction"("bankAccountId");

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_accountingClientId_fkey" FOREIGN KEY ("accountingClientId") REFERENCES "AccountingClients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutstandingItem" ADD CONSTRAINT "OutstandingItem_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
