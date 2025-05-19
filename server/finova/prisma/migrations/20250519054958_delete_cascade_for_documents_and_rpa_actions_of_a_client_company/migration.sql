-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_accountingClientId_fkey";

-- DropForeignKey
ALTER TABLE "RpaAction" DROP CONSTRAINT "RpaAction_accountingClientId_fkey";

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_accountingClientId_fkey" FOREIGN KEY ("accountingClientId") REFERENCES "AccountingClients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpaAction" ADD CONSTRAINT "RpaAction_accountingClientId_fkey" FOREIGN KEY ("accountingClientId") REFERENCES "AccountingClients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
