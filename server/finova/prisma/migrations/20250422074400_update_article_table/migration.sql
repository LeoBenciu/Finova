-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ArticleType" ADD VALUE 'PRODUSE_FINITE';
ALTER TYPE "ArticleType" ADD VALUE 'SEMIFABRICATE';
ALTER TYPE "ArticleType" ADD VALUE 'SERVICII_VANDUTE';
ALTER TYPE "ArticleType" ADD VALUE 'TAXA_VERDE';
ALTER TYPE "ArticleType" ADD VALUE 'DISCOUNT_FINANCIAL_IESIRI';
ALTER TYPE "ArticleType" ADD VALUE 'DISCOUNT_COMERCIAL_IESIRI';
