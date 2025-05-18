/*
  Warnings:

  - The values [DISCOUNT_FINANCIAL_INTRARI,DISCOUNT_FINANCIAL_IESIRI] on the enum `ArticleType` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[code,clientCompanyId]` on the table `Management` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ArticleType_new" AS ENUM ('MARFURI', 'MATERII_PRIME', 'PRODUSE_FINITE', 'SEMIFABRICATE', 'SERVICII_VANDUTE', 'MATERIALE_AUXILIARE', 'AMBALAJE', 'TAXA_VERDE', 'OBIECTE_DE_INVENTAR', 'AMENAJARI_PROVIZORII', 'MATERIALE_SPRE_PRELUCRARE', 'MATERIALE_IN_PASTRARE_SAU_CONSIGNATIE', 'DISCOUNT_FINANCIAR_INTRARI', 'DISCOUNT_FINANCIAR_IESIRI', 'COMBUSTIBILI', 'PIESE_DE_SCHIMB', 'PRODUSE_REZIDUALE', 'ALTE_MATERIALE_CONSUMABILE', 'DISCOUNT_COMERCIAL_INTRARI', 'DISCOUNT_COMERCIAL_IESIRI', 'AMBALAJE_SGR');
ALTER TABLE "Article" ALTER COLUMN "type" TYPE "ArticleType_new" USING ("type"::text::"ArticleType_new");
ALTER TYPE "ArticleType" RENAME TO "ArticleType_old";
ALTER TYPE "ArticleType_new" RENAME TO "ArticleType";
DROP TYPE "ArticleType_old";
COMMIT;

-- DropIndex
DROP INDEX "Management_code_key";

-- CreateIndex
CREATE UNIQUE INDEX "Management_code_clientCompanyId_key" ON "Management"("code", "clientCompanyId");
