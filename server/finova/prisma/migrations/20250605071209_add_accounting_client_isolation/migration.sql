/*
  Warnings:

  - A unique constraint covering the columns `[code,accountingClientId]` on the table `Article` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code,accountingClientId]` on the table `Management` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `accountingClientId` to the `Article` table without a default value. This is not possible if the table is not empty.
  - Added the required column `accountingClientId` to the `Management` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Management_code_clientCompanyId_key";

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "accountingClientId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Management" ADD COLUMN     "accountingClientId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Article_accountingClientId_idx" ON "Article"("accountingClientId");

-- CreateIndex
CREATE UNIQUE INDEX "Article_code_accountingClientId_key" ON "Article"("code", "accountingClientId");

-- CreateIndex
CREATE INDEX "Management_accountingClientId_idx" ON "Management"("accountingClientId");

-- CreateIndex
CREATE UNIQUE INDEX "Management_code_accountingClientId_key" ON "Management"("code", "accountingClientId");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_accountingClientId_fkey" FOREIGN KEY ("accountingClientId") REFERENCES "AccountingClients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Management" ADD CONSTRAINT "Management_accountingClientId_fkey" FOREIGN KEY ("accountingClientId") REFERENCES "AccountingClients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
