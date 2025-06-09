/*
  Warnings:

  - You are about to drop the column `uipathSubfolder` on the `ClientCompany` table. All the data in the column will be lost.
  - Added the required column `uipathSubfolder` to the `AccountingCompany` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AccountingCompany" ADD COLUMN     "uipathSubfolder" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ClientCompany" DROP COLUMN "uipathSubfolder";
