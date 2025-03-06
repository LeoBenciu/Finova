/*
  Warnings:

  - You are about to drop the `Transactions` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "RpaActionType" AS ENUM ('DATA_ENTRY', 'VALIDATION', 'CORRECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "RpaActionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELED');

-- DropForeignKey
ALTER TABLE "Transactions" DROP CONSTRAINT "Transactions_clientCompanyId_fkey";

-- DropForeignKey
ALTER TABLE "Transactions" DROP CONSTRAINT "Transactions_documentId_fkey";

-- DropTable
DROP TABLE "Transactions";

-- DropEnum
DROP TYPE "TransactionStatus";

-- CreateTable
CREATE TABLE "RpaActions" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "documentId" INTEGER NOT NULL,
    "clientCompanyId" INTEGER NOT NULL,
    "actionType" "RpaActionType" NOT NULL,
    "status" "RpaActionStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "triggeredBy" INTEGER,

    CONSTRAINT "RpaActions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RpaActions" ADD CONSTRAINT "RpaActions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpaActions" ADD CONSTRAINT "RpaActions_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "ClientCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
