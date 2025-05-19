-- DropForeignKey
ALTER TABLE "ProcessedData" DROP CONSTRAINT "ProcessedData_documentId_fkey";

-- AddForeignKey
ALTER TABLE "ProcessedData" ADD CONSTRAINT "ProcessedData_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
