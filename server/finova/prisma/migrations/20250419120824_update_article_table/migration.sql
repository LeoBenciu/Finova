-- CreateEnum
CREATE TYPE "ManagementType" AS ENUM ('CANTITATIV_VALORIC', 'GLOBAL_VALORIC');

-- CreateTable
CREATE TABLE "Management" (
    "id" SERIAL NOT NULL,
    "clientCompanyId" INTEGER NOT NULL,
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ManagementType" NOT NULL,
    "manager" TEXT,
    "isSellingPrice" BOOLEAN NOT NULL,
    "analitic371" TEXT,
    "analitic378" TEXT,
    "analitic4428" TEXT,
    "analitic607" TEXT,
    "analitic707" TEXT,
    "vatRate" "VatRate" NOT NULL,

    CONSTRAINT "Management_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Management_code_key" ON "Management"("code");

-- CreateIndex
CREATE INDEX "Management_clientCompanyId_idx" ON "Management"("clientCompanyId");

-- AddForeignKey
ALTER TABLE "Management" ADD CONSTRAINT "Management_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "ClientCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
