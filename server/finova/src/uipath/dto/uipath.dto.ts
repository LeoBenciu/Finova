import { IsString } from "class-validator";

export class ModifyRpaDto {
    @IsString()
    clientInvoiceRk: string;

    @IsString()
    supplierInvoiceRk: string;

    @IsString()
    clientReceiptRk : string;

    @IsString()
    supplierReceiptRk : string;

    @IsString()
    uipathSubfolder : string;
};