-- CreateEnum
CREATE TYPE "TodoStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "TodoPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "LedgerSourceType" AS ENUM ('INVOICE_IN', 'INVOICE_OUT', 'RECEIPT', 'PAYMENT_ORDER', 'RECONCILIATION', 'TRANSFER', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('DAILY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateTable
CREATE TABLE "BankTransactionSplit" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bankTransactionId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "chartOfAccountId" INTEGER NOT NULL,

    CONSTRAINT "BankTransactionSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccountAnalytic" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountingClientId" INTEGER NOT NULL,
    "iban" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "syntheticCode" TEXT NOT NULL,
    "analyticSuffix" TEXT NOT NULL,
    "fullCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountAlias" TEXT,

    CONSTRAINT "BankAccountAnalytic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferReconciliation" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceTransactionId" TEXT NOT NULL,
    "destinationTransactionId" TEXT NOT NULL,
    "sourceAccountCode" TEXT NOT NULL,
    "destinationAccountCode" TEXT NOT NULL,
    "fxRate" DECIMAL(12,6),
    "notes" TEXT,
    "createdByUserId" INTEGER NOT NULL,

    CONSTRAINT "TransferReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoItem" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TodoStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "TodoPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "tags" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "accountingClientId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "relatedDocumentId" INTEGER,
    "relatedTransactionId" TEXT,

    CONSTRAINT "TodoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoAssignee" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "todoId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "TodoAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneralLedgerEntry" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountingClientId" INTEGER NOT NULL,
    "postingDate" TIMESTAMP(3) NOT NULL,
    "accountCode" TEXT NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL,
    "credit" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RON',
    "sourceType" "LedgerSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "postingKey" TEXT NOT NULL,
    "documentId" INTEGER,
    "bankTransactionId" TEXT,
    "reconciliationId" INTEGER,

    CONSTRAINT "GeneralLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountBalanceDaily" (
    "id" SERIAL NOT NULL,
    "accountingClientId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "accountCode" TEXT NOT NULL,
    "endingBalance" DECIMAL(16,2) NOT NULL,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountBalanceDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountBalanceMonthly" (
    "id" SERIAL NOT NULL,
    "accountingClientId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "accountCode" TEXT NOT NULL,
    "endingBalance" DECIMAL(16,2) NOT NULL,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountBalanceMonthly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentLineItem" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "accountingClientId" INTEGER NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL,
    "vatAmount" DECIMAL(10,2) NOT NULL,
    "itemType" TEXT,
    "accountCode" TEXT NOT NULL,
    "aiSuggestion" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialMetrics" (
    "id" SERIAL NOT NULL,
    "accountingClientId" INTEGER NOT NULL,
    "periodType" "PeriodType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalRevenue" DECIMAL(14,2) NOT NULL,
    "totalExpenses" DECIMAL(14,2) NOT NULL,
    "grossProfit" DECIMAL(14,2) NOT NULL,
    "netIncome" DECIMAL(14,2) NOT NULL,
    "totalAssets" DECIMAL(14,2) NOT NULL,
    "totalLiabilities" DECIMAL(14,2) NOT NULL,
    "totalEquity" DECIMAL(14,2) NOT NULL,
    "operatingCashFlow" DECIMAL(14,2) NOT NULL,
    "investingCashFlow" DECIMAL(14,2) NOT NULL,
    "financingCashFlow" DECIMAL(14,2) NOT NULL,
    "netCashFlow" DECIMAL(14,2) NOT NULL,
    "grossProfitMargin" DECIMAL(5,4) NOT NULL,
    "netProfitMargin" DECIMAL(5,4) NOT NULL,
    "currentRatio" DECIMAL(8,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountCategoryMetrics" (
    "id" SERIAL NOT NULL,
    "accountingClientId" INTEGER NOT NULL,
    "periodType" "PeriodType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "categoryName" TEXT NOT NULL,
    "totalDebit" DECIMAL(14,2) NOT NULL,
    "totalCredit" DECIMAL(14,2) NOT NULL,
    "netAmount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountCategoryMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankTransactionSplit_bankTransactionId_idx" ON "BankTransactionSplit"("bankTransactionId");

-- CreateIndex
CREATE INDEX "BankTransactionSplit_chartOfAccountId_idx" ON "BankTransactionSplit"("chartOfAccountId");

-- CreateIndex
CREATE INDEX "BankAccountAnalytic_accountingClientId_iban_idx" ON "BankAccountAnalytic"("accountingClientId", "iban");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccountAnalytic_accountingClientId_fullCode_key" ON "BankAccountAnalytic"("accountingClientId", "fullCode");

-- CreateIndex
CREATE UNIQUE INDEX "TransferReconciliation_sourceTransactionId_destinationTrans_key" ON "TransferReconciliation"("sourceTransactionId", "destinationTransactionId");

-- CreateIndex
CREATE INDEX "TodoItem_accountingClientId_idx" ON "TodoItem"("accountingClientId");

-- CreateIndex
CREATE INDEX "TodoItem_status_idx" ON "TodoItem"("status");

-- CreateIndex
CREATE INDEX "TodoItem_priority_idx" ON "TodoItem"("priority");

-- CreateIndex
CREATE INDEX "TodoItem_dueDate_idx" ON "TodoItem"("dueDate");

-- CreateIndex
CREATE INDEX "TodoItem_sortOrder_idx" ON "TodoItem"("sortOrder");

-- CreateIndex
CREATE INDEX "TodoAssignee_userId_idx" ON "TodoAssignee"("userId");

-- CreateIndex
CREATE INDEX "TodoAssignee_todoId_idx" ON "TodoAssignee"("todoId");

-- CreateIndex
CREATE UNIQUE INDEX "TodoAssignee_todoId_userId_key" ON "TodoAssignee"("todoId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneralLedgerEntry_postingKey_key" ON "GeneralLedgerEntry"("postingKey");

-- CreateIndex
CREATE INDEX "GeneralLedgerEntry_accountingClientId_postingDate_idx" ON "GeneralLedgerEntry"("accountingClientId", "postingDate");

-- CreateIndex
CREATE INDEX "GeneralLedgerEntry_accountingClientId_accountCode_idx" ON "GeneralLedgerEntry"("accountingClientId", "accountCode");

-- CreateIndex
CREATE INDEX "GeneralLedgerEntry_sourceType_idx" ON "GeneralLedgerEntry"("sourceType");

-- CreateIndex
CREATE INDEX "AccountBalanceDaily_accountingClientId_date_idx" ON "AccountBalanceDaily"("accountingClientId", "date");

-- CreateIndex
CREATE INDEX "AccountBalanceDaily_accountCode_idx" ON "AccountBalanceDaily"("accountCode");

-- CreateIndex
CREATE UNIQUE INDEX "AccountBalanceDaily_accountingClientId_accountCode_date_key" ON "AccountBalanceDaily"("accountingClientId", "accountCode", "date");

-- CreateIndex
CREATE INDEX "AccountBalanceMonthly_accountingClientId_year_month_idx" ON "AccountBalanceMonthly"("accountingClientId", "year", "month");

-- CreateIndex
CREATE INDEX "AccountBalanceMonthly_accountCode_idx" ON "AccountBalanceMonthly"("accountCode");

-- CreateIndex
CREATE UNIQUE INDEX "AccountBalanceMonthly_accountingClientId_accountCode_year_m_key" ON "AccountBalanceMonthly"("accountingClientId", "accountCode", "year", "month");

-- CreateIndex
CREATE INDEX "DocumentLineItem_documentId_idx" ON "DocumentLineItem"("documentId");

-- CreateIndex
CREATE INDEX "DocumentLineItem_accountingClientId_idx" ON "DocumentLineItem"("accountingClientId");

-- CreateIndex
CREATE INDEX "DocumentLineItem_itemType_idx" ON "DocumentLineItem"("itemType");

-- CreateIndex
CREATE INDEX "DocumentLineItem_accountCode_idx" ON "DocumentLineItem"("accountCode");

-- CreateIndex
CREATE INDEX "FinancialMetrics_accountingClientId_periodType_idx" ON "FinancialMetrics"("accountingClientId", "periodType");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialMetrics_accountingClientId_periodType_periodStart_key" ON "FinancialMetrics"("accountingClientId", "periodType", "periodStart");

-- CreateIndex
CREATE INDEX "AccountCategoryMetrics_accountingClientId_periodType_idx" ON "AccountCategoryMetrics"("accountingClientId", "periodType");

-- CreateIndex
CREATE UNIQUE INDEX "AccountCategoryMetrics_accountingClientId_periodType_period_key" ON "AccountCategoryMetrics"("accountingClientId", "periodType", "periodStart", "accountType", "categoryName");

-- AddForeignKey
ALTER TABLE "BankTransactionSplit" ADD CONSTRAINT "BankTransactionSplit_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransactionSplit" ADD CONSTRAINT "BankTransactionSplit_chartOfAccountId_fkey" FOREIGN KEY ("chartOfAccountId") REFERENCES "ChartOfAccounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccountAnalytic" ADD CONSTRAINT "BankAccountAnalytic_accountingClientId_fkey" FOREIGN KEY ("accountingClientId") REFERENCES "AccountingClients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferReconciliation" ADD CONSTRAINT "TransferReconciliation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferReconciliation" ADD CONSTRAINT "TransferReconciliation_sourceTransactionId_fkey" FOREIGN KEY ("sourceTransactionId") REFERENCES "BankTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferReconciliation" ADD CONSTRAINT "TransferReconciliation_destinationTransactionId_fkey" FOREIGN KEY ("destinationTransactionId") REFERENCES "BankTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_accountingClientId_fkey" FOREIGN KEY ("accountingClientId") REFERENCES "AccountingClients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_relatedDocumentId_fkey" FOREIGN KEY ("relatedDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_relatedTransactionId_fkey" FOREIGN KEY ("relatedTransactionId") REFERENCES "BankTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoAssignee" ADD CONSTRAINT "TodoAssignee_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "TodoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoAssignee" ADD CONSTRAINT "TodoAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneralLedgerEntry" ADD CONSTRAINT "GeneralLedgerEntry_accountingClientId_fkey" FOREIGN KEY ("accountingClientId") REFERENCES "AccountingClients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneralLedgerEntry" ADD CONSTRAINT "GeneralLedgerEntry_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneralLedgerEntry" ADD CONSTRAINT "GeneralLedgerEntry_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneralLedgerEntry" ADD CONSTRAINT "GeneralLedgerEntry_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "ReconciliationRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountBalanceDaily" ADD CONSTRAINT "AccountBalanceDaily_accountingClientId_fkey" FOREIGN KEY ("accountingClientId") REFERENCES "AccountingClients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountBalanceMonthly" ADD CONSTRAINT "AccountBalanceMonthly_accountingClientId_fkey" FOREIGN KEY ("accountingClientId") REFERENCES "AccountingClients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLineItem" ADD CONSTRAINT "DocumentLineItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLineItem" ADD CONSTRAINT "DocumentLineItem_accountingClientId_fkey" FOREIGN KEY ("accountingClientId") REFERENCES "AccountingClients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialMetrics" ADD CONSTRAINT "FinancialMetrics_accountingClientId_fkey" FOREIGN KEY ("accountingClientId") REFERENCES "AccountingClients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountCategoryMetrics" ADD CONSTRAINT "AccountCategoryMetrics_accountingClientId_fkey" FOREIGN KEY ("accountingClientId") REFERENCES "AccountingClients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
