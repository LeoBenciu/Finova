/*
  Warnings:

  - Added the required column `clientInvoiceRk` to the `AccountingCompany` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clientReceiptRk` to the `AccountingCompany` table without a default value. This is not possible if the table is not empty.
  - Added the required column `supplierInvoiceRk` to the `AccountingCompany` table without a default value. This is not possible if the table is not empty.
  - Added the required column `supplierReceiptRk` to the `AccountingCompany` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AccountingCompany" ADD COLUMN     "clientInvoiceRk" TEXT NOT NULL,
ADD COLUMN     "clientReceiptRk" TEXT NOT NULL,
ADD COLUMN     "supplierInvoiceRk" TEXT NOT NULL,
ADD COLUMN     "supplierReceiptRk" TEXT NOT NULL;
