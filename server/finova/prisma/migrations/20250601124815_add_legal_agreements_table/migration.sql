-- DropForeignKey
ALTER TABLE "Article" DROP CONSTRAINT "Article_clientCompanyId_fkey";

-- DropForeignKey
ALTER TABLE "Management" DROP CONSTRAINT "Management_clientCompanyId_fkey";

-- CreateTable
CREATE TABLE "LegalAgreement" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "agreementType" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "version" TEXT,

    CONSTRAINT "LegalAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalAgreement_userId_idx" ON "LegalAgreement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LegalAgreement_userId_agreementType_key" ON "LegalAgreement"("userId", "agreementType");

-- AddForeignKey
ALTER TABLE "LegalAgreement" ADD CONSTRAINT "LegalAgreement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "ClientCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Management" ADD CONSTRAINT "Management_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "ClientCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
