-- CreateEnum
CREATE TYPE "DocumentRelationType" AS ENUM ('PAYMENT', 'CORRECTION', 'ATTACHMENT', 'CONTRACT_INVOICE', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'FULLY_PAID', 'OVERPAID');

-- CreateEnum
CREATE TYPE "DuplicateType" AS ENUM ('EXACT_MATCH', 'CONTENT_MATCH', 'SIMILAR_CONTENT');

-- CreateEnum
CREATE TYPE "DuplicateStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('COMPLIANT', 'NON_COMPLIANT', 'WARNING', 'PENDING');

-- CreateEnum
CREATE TYPE "CorrectionType" AS ENUM ('DOCUMENT_TYPE', 'INVOICE_DIRECTION', 'VENDOR_INFORMATION', 'BUYER_INFORMATION', 'AMOUNTS', 'LINE_ITEMS', 'DATES', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('UNRECONCILED', 'MATCHED', 'IGNORED');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('AUTOMATIC', 'MANUAL', 'SUGGESTED');

-- CreateEnum
CREATE TYPE "ReconciliationRecordStatus" AS ENUM ('ACTIVE', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReferenceStatus" AS ENUM ('PENDING', 'RESOLVED', 'INVALID');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSETS', 'LIABILITIES', 'INCOME', 'EXPENSE', 'EQUITY');

-- CreateEnum
CREATE TYPE "OutstandingItemType" AS ENUM ('OUTSTANDING_CHECK', 'DEPOSIT_IN_TRANSIT', 'PENDING_TRANSFER');

-- CreateEnum
CREATE TYPE "OutstandingItemStatus" AS ENUM ('OUTSTANDING', 'CLEARED', 'STALE', 'VOIDED');

-- AlterTable
ALTER TABLE "Article" ALTER COLUMN "code" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "documentHash" TEXT,
ADD COLUMN     "lastPaymentDate" TIMESTAMP(3),
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "reconciliationStatus" "ReconciliationStatus" NOT NULL DEFAULT 'UNRECONCILED',
ADD COLUMN     "references" INTEGER[],
ADD COLUMN     "totalPaidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Management" ALTER COLUMN "code" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "DocumentDuplicateCheck" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originalDocumentId" INTEGER NOT NULL,
    "duplicateDocumentId" INTEGER NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "matchingFields" JSONB NOT NULL,
    "duplicateType" "DuplicateType" NOT NULL,
    "status" "DuplicateStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "DocumentDuplicateCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceValidation" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentId" INTEGER NOT NULL,
    "overallStatus" "ComplianceStatus" NOT NULL,
    "overallScore" DOUBLE PRECISION,
    "validationRules" JSONB NOT NULL,
    "errors" JSONB,
    "warnings" JSONB,
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCorrection" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "correctionType" "CorrectionType" NOT NULL,
    "originalValue" JSONB NOT NULL,
    "correctedValue" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "applied" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRelationship" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parentDocumentId" INTEGER NOT NULL,
    "childDocumentId" INTEGER NOT NULL,
    "relationshipType" "DocumentRelationType" NOT NULL,
    "paymentAmount" DOUBLE PRECISION,
    "notes" TEXT,
    "createdById" INTEGER,

    CONSTRAINT "DocumentRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSummary" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingAmount" DOUBLE PRECISION NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "lastPaymentDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "bankStatementDocumentId" INTEGER NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "transactionType" "TransactionType" NOT NULL,
    "referenceNumber" TEXT,
    "balanceAfter" DECIMAL(12,2),
    "reconciliationStatus" "ReconciliationStatus" NOT NULL DEFAULT 'UNRECONCILED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "chartOfAccountId" INTEGER,
    "isStandalone" BOOLEAN NOT NULL DEFAULT false,
    "accountingNotes" TEXT,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationRecord" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "bankTransactionId" TEXT NOT NULL,
    "matchType" "MatchType" NOT NULL,
    "confidenceScore" DECIMAL(3,2),
    "reconciledById" INTEGER,
    "reconciledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "status" "ReconciliationRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationSuggestion" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER,
    "bankTransactionId" TEXT NOT NULL,
    "chartOfAccountId" INTEGER,
    "confidenceScore" DECIMAL(4,3) NOT NULL,
    "matchingCriteria" JSONB NOT NULL,
    "reasons" TEXT[],
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PotentialReference" (
    "id" SERIAL NOT NULL,
    "sourceDocumentId" INTEGER NOT NULL,
    "referencedDocumentNumber" TEXT NOT NULL,
    "targetDocumentId" INTEGER,
    "confidence" DECIMAL(3,2),
    "status" "ReferenceStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PotentialReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartOfAccounts" (
    "id" SERIAL NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "parentAccountId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChartOfAccounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutstandingItem" (
    "id" SERIAL NOT NULL,
    "accountingClientId" INTEGER NOT NULL,
    "type" "OutstandingItemType" NOT NULL,
    "status" "OutstandingItemStatus" NOT NULL DEFAULT 'OUTSTANDING',
    "referenceNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expectedClearDate" TIMESTAMP(3),
    "actualClearDate" TIMESTAMP(3),
    "daysOutstanding" INTEGER NOT NULL DEFAULT 0,
    "payeeBeneficiary" TEXT,
    "bankAccount" TEXT,
    "notes" TEXT,
    "relatedDocumentId" INTEGER,
    "relatedTransactionId" TEXT,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutstandingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentDuplicateCheck_originalDocumentId_idx" ON "DocumentDuplicateCheck"("originalDocumentId");

-- CreateIndex
CREATE INDEX "DocumentDuplicateCheck_duplicateDocumentId_idx" ON "DocumentDuplicateCheck"("duplicateDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentDuplicateCheck_originalDocumentId_duplicateDocument_key" ON "DocumentDuplicateCheck"("originalDocumentId", "duplicateDocumentId");

-- CreateIndex
CREATE INDEX "ComplianceValidation_documentId_idx" ON "ComplianceValidation"("documentId");

-- CreateIndex
CREATE INDEX "ComplianceValidation_overallStatus_idx" ON "ComplianceValidation"("overallStatus");

-- CreateIndex
CREATE INDEX "UserCorrection_documentId_idx" ON "UserCorrection"("documentId");

-- CreateIndex
CREATE INDEX "UserCorrection_userId_idx" ON "UserCorrection"("userId");

-- CreateIndex
CREATE INDEX "UserCorrection_correctionType_idx" ON "UserCorrection"("correctionType");

-- CreateIndex
CREATE INDEX "UserCorrection_applied_idx" ON "UserCorrection"("applied");

-- CreateIndex
CREATE INDEX "DocumentRelationship_parentDocumentId_idx" ON "DocumentRelationship"("parentDocumentId");

-- CreateIndex
CREATE INDEX "DocumentRelationship_childDocumentId_idx" ON "DocumentRelationship"("childDocumentId");

-- CreateIndex
CREATE INDEX "DocumentRelationship_relationshipType_idx" ON "DocumentRelationship"("relationshipType");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRelationship_parentDocumentId_childDocumentId_key" ON "DocumentRelationship"("parentDocumentId", "childDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSummary_documentId_key" ON "PaymentSummary"("documentId");

-- CreateIndex
CREATE INDEX "PaymentSummary_paymentStatus_idx" ON "PaymentSummary"("paymentStatus");

-- CreateIndex
CREATE INDEX "PaymentSummary_documentId_idx" ON "PaymentSummary"("documentId");

-- CreateIndex
CREATE INDEX "BankTransaction_bankStatementDocumentId_idx" ON "BankTransaction"("bankStatementDocumentId");

-- CreateIndex
CREATE INDEX "BankTransaction_transactionDate_idx" ON "BankTransaction"("transactionDate");

-- CreateIndex
CREATE INDEX "BankTransaction_reconciliationStatus_idx" ON "BankTransaction"("reconciliationStatus");

-- CreateIndex
CREATE INDEX "BankTransaction_chartOfAccountId_idx" ON "BankTransaction"("chartOfAccountId");

-- CreateIndex
CREATE INDEX "BankTransaction_isStandalone_idx" ON "BankTransaction"("isStandalone");

-- CreateIndex
CREATE INDEX "ReconciliationRecord_documentId_idx" ON "ReconciliationRecord"("documentId");

-- CreateIndex
CREATE INDEX "ReconciliationRecord_bankTransactionId_idx" ON "ReconciliationRecord"("bankTransactionId");

-- CreateIndex
CREATE INDEX "ReconciliationRecord_status_idx" ON "ReconciliationRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationRecord_documentId_bankTransactionId_key" ON "ReconciliationRecord"("documentId", "bankTransactionId");

-- CreateIndex
CREATE INDEX "ReconciliationSuggestion_status_idx" ON "ReconciliationSuggestion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationSuggestion_documentId_bankTransactionId_key" ON "ReconciliationSuggestion"("documentId", "bankTransactionId");

-- CreateIndex
CREATE INDEX "PotentialReference_status_referencedDocumentNumber_idx" ON "PotentialReference"("status", "referencedDocumentNumber");

-- CreateIndex
CREATE INDEX "PotentialReference_sourceDocumentId_idx" ON "PotentialReference"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "PotentialReference_targetDocumentId_idx" ON "PotentialReference"("targetDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "ChartOfAccounts_accountCode_key" ON "ChartOfAccounts"("accountCode");

-- CreateIndex
CREATE INDEX "ChartOfAccounts_accountCode_idx" ON "ChartOfAccounts"("accountCode");

-- CreateIndex
CREATE INDEX "ChartOfAccounts_accountType_idx" ON "ChartOfAccounts"("accountType");

-- CreateIndex
CREATE INDEX "ChartOfAccounts_isActive_idx" ON "ChartOfAccounts"("isActive");

-- CreateIndex
CREATE INDEX "OutstandingItem_accountingClientId_idx" ON "OutstandingItem"("accountingClientId");

-- CreateIndex
CREATE INDEX "OutstandingItem_type_idx" ON "OutstandingItem"("type");

-- CreateIndex
CREATE INDEX "OutstandingItem_status_idx" ON "OutstandingItem"("status");

-- CreateIndex
CREATE INDEX "OutstandingItem_issueDate_idx" ON "OutstandingItem"("issueDate");

-- CreateIndex
CREATE INDEX "OutstandingItem_daysOutstanding_idx" ON "OutstandingItem"("daysOutstanding");

-- CreateIndex
CREATE INDEX "OutstandingItem_referenceNumber_idx" ON "OutstandingItem"("referenceNumber");

-- CreateIndex
CREATE INDEX "Document_documentHash_idx" ON "Document"("documentHash");

-- CreateIndex
CREATE INDEX "Document_accountingClientId_idx" ON "Document"("accountingClientId");

-- CreateIndex
CREATE INDEX "Document_reconciliationStatus_idx" ON "Document"("reconciliationStatus");

-- CreateIndex
CREATE INDEX "Document_paymentStatus_idx" ON "Document"("paymentStatus");

-- AddForeignKey
ALTER TABLE "DocumentDuplicateCheck" ADD CONSTRAINT "DocumentDuplicateCheck_originalDocumentId_fkey" FOREIGN KEY ("originalDocumentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentDuplicateCheck" ADD CONSTRAINT "DocumentDuplicateCheck_duplicateDocumentId_fkey" FOREIGN KEY ("duplicateDocumentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceValidation" ADD CONSTRAINT "ComplianceValidation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCorrection" ADD CONSTRAINT "UserCorrection_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCorrection" ADD CONSTRAINT "UserCorrection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRelationship" ADD CONSTRAINT "DocumentRelationship_parentDocumentId_fkey" FOREIGN KEY ("parentDocumentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRelationship" ADD CONSTRAINT "DocumentRelationship_childDocumentId_fkey" FOREIGN KEY ("childDocumentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRelationship" ADD CONSTRAINT "DocumentRelationship_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSummary" ADD CONSTRAINT "PaymentSummary_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_bankStatementDocumentId_fkey" FOREIGN KEY ("bankStatementDocumentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_chartOfAccountId_fkey" FOREIGN KEY ("chartOfAccountId") REFERENCES "ChartOfAccounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRecord" ADD CONSTRAINT "ReconciliationRecord_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRecord" ADD CONSTRAINT "ReconciliationRecord_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRecord" ADD CONSTRAINT "ReconciliationRecord_reconciledById_fkey" FOREIGN KEY ("reconciledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationSuggestion" ADD CONSTRAINT "ReconciliationSuggestion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationSuggestion" ADD CONSTRAINT "ReconciliationSuggestion_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationSuggestion" ADD CONSTRAINT "ReconciliationSuggestion_chartOfAccountId_fkey" FOREIGN KEY ("chartOfAccountId") REFERENCES "ChartOfAccounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PotentialReference" ADD CONSTRAINT "PotentialReference_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PotentialReference" ADD CONSTRAINT "PotentialReference_targetDocumentId_fkey" FOREIGN KEY ("targetDocumentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartOfAccounts" ADD CONSTRAINT "ChartOfAccounts_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "ChartOfAccounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutstandingItem" ADD CONSTRAINT "OutstandingItem_accountingClientId_fkey" FOREIGN KEY ("accountingClientId") REFERENCES "AccountingClients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutstandingItem" ADD CONSTRAINT "OutstandingItem_relatedDocumentId_fkey" FOREIGN KEY ("relatedDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutstandingItem" ADD CONSTRAINT "OutstandingItem_relatedTransactionId_fkey" FOREIGN KEY ("relatedTransactionId") REFERENCES "BankTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutstandingItem" ADD CONSTRAINT "OutstandingItem_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
