/*
  Warnings:

  - A unique constraint covering the columns `[ein]` on the table `AccountingCompany` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ein]` on the table `ClientCompany` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `ein` to the `AccountingCompany` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ein` to the `ClientCompany` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AccountingCompany" ADD COLUMN     "ein" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ClientCompany" ADD COLUMN     "ein" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AccountingCompany_ein_key" ON "AccountingCompany"("ein");

-- CreateIndex
CREATE UNIQUE INDEX "ClientCompany_ein_key" ON "ClientCompany"("ein");
