/*
  Warnings:

  - The primary key for the `AccountingClients` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createAt` on the `AccountingCompany` table. All the data in the column will be lost.
  - You are about to drop the column `extractedText` on the `ProcessedData` table. All the data in the column will be lost.
  - You are about to drop the column `fileId` on the `ProcessedData` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `ProcessedData` table. All the data in the column will be lost.
  - You are about to drop the `Documents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RpaActions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Users` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[accountingCompanyId,clientCompanyId]` on the table `AccountingClients` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[documentId]` on the table `ProcessedData` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `documentId` to the `ProcessedData` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Documents" DROP CONSTRAINT "Documents_clientcompanyId_fkey";

-- DropForeignKey
ALTER TABLE "ProcessedData" DROP CONSTRAINT "ProcessedData_fileId_fkey";

-- DropForeignKey
ALTER TABLE "RpaActions" DROP CONSTRAINT "RpaActions_clientCompanyId_fkey";

-- DropForeignKey
ALTER TABLE "RpaActions" DROP CONSTRAINT "RpaActions_documentId_fkey";

-- DropForeignKey
ALTER TABLE "Users" DROP CONSTRAINT "Users_accountingCompanyId_fkey";

-- DropIndex
DROP INDEX "ProcessedData_fileId_key";

-- AlterTable
ALTER TABLE "AccountingClients" DROP CONSTRAINT "AccountingClients_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "AccountingClients_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "AccountingCompany" DROP COLUMN "createAt",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ProcessedData" DROP COLUMN "extractedText",
DROP COLUMN "fileId",
DROP COLUMN "status",
ADD COLUMN     "documentId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "Documents";

-- DropTable
DROP TABLE "RpaActions";

-- DropTable
DROP TABLE "Users";

-- DropEnum
DROP TYPE "DocumentStatus";

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "hashPassword" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "accountingCompanyId" INTEGER NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "accountingClientId" INTEGER NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpaAction" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "documentId" INTEGER NOT NULL,
    "accountingClientId" INTEGER NOT NULL,
    "actionType" "RpaActionType" NOT NULL,
    "status" "RpaActionStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "triggeredById" INTEGER,

    CONSTRAINT "RpaAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingClients_accountingCompanyId_clientCompanyId_key" ON "AccountingClients"("accountingCompanyId", "clientCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedData_documentId_key" ON "ProcessedData"("documentId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accountingCompanyId_fkey" FOREIGN KEY ("accountingCompanyId") REFERENCES "AccountingCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_accountingClientId_fkey" FOREIGN KEY ("accountingClientId") REFERENCES "AccountingClients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedData" ADD CONSTRAINT "ProcessedData_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpaAction" ADD CONSTRAINT "RpaAction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpaAction" ADD CONSTRAINT "RpaAction_accountingClientId_fkey" FOREIGN KEY ("accountingClientId") REFERENCES "AccountingClients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpaAction" ADD CONSTRAINT "RpaAction_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
