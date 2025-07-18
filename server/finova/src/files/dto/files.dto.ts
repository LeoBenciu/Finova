import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsPositive, IsString, Matches, Min } from "class-validator"
import { DocumentRelationType, PaymentStatus } from '@prisma/client';


export class PostFileDto{
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d{2,10}$/, { message: 'Invalid Romanian CIF. It must be 2-10 digits long without the "RO" prefix.' })
    clientCompanyEin: string

    @IsString()
    @IsNotEmpty()
    processedData: string
};

export class UpdateFileDto{
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d{2,10}$/, { message: 'Invalid Romanian CIF. It must be 2-10 digits long without the "RO" prefix.' })
    clientCompanyEin: string

    @IsObject()
    @IsNotEmpty()
    processedData: Record<string, any>

    @IsNumber()
    @IsNotEmpty()
    docId: number
}

export class DeleteFileDto{
    @IsNumber()
    @IsNotEmpty()
    docId: number

    @IsString()
    @IsNotEmpty()
    @Matches(/^\d{2,10}$/, { message: 'Invalid Romanian CIF. It must be 2-10 digits long without the "RO" prefix.' })
    clientCompanyEin: string
}

export class CreateDocumentRelationDto {
  @IsNumber()
  parentDocumentId: number;

  @IsNumber()
  childDocumentId: number;

  @IsEnum(DocumentRelationType)
  relationshipType: DocumentRelationType;

  @IsOptional()
  @IsPositive()
  paymentAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDocumentRelationDto {
  @IsOptional()
  @IsEnum(DocumentRelationType)
  relationshipType?: DocumentRelationType;

  @IsOptional()
  @IsPositive()
  paymentAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class DeleteDocumentRelationDto {
  @IsNumber()
  relationId: number;
}

export class GetRelatedDocumentsDto {
  @IsNumber()
  documentId: number;
}

export class UpdatePaymentStatusDto {
  @IsNumber()
  documentId: number;

  @IsOptional()
  @Min(0)
  manualPaidAmount?: number;
}

export class PaymentFilterDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsNumber()
  minRemainingAmount?: number;

  @IsOptional()
  @IsNumber()
  maxRemainingAmount?: number;
}

export interface DocumentWithRelations {
  id: number;
  name: string;
  type: string;
  totalAmount?: number;
  paymentSummary?: {
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    paymentStatus: PaymentStatus;
    lastPaymentDate?: string;
  };
  relatedDocuments: {
    payments: RelatedDocumentInfo[];
    attachments: RelatedDocumentInfo[];
    corrections: RelatedDocumentInfo[];
  };
}

export interface RelatedDocumentInfo {
  id: number;
  name: string;
  type: string;
  relationshipType: DocumentRelationType;
  paymentAmount?: number;
  notes?: string;
  createdAt: string;
  signedUrl?: string;
}

export interface PaymentSummaryInfo {
  totalDocuments: number;
  unpaidDocuments: number;
  partiallyPaidDocuments: number;
  fullyPaidDocuments: number;
  overpaidDocuments: number;
  totalUnpaidAmount: number;
  totalPaidAmount: number;
}