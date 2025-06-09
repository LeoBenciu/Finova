/*
  Warnings:

  - Added the required column `uipathSubfolder` to the `ClientCompany` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ClientCompany" ADD COLUMN     "uipathSubfolder" TEXT NOT NULL;
