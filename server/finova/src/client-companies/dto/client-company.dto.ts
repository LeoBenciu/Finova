import { IsBoolean, IsNotEmpty, IsNumber, IsString, Matches } from "class-validator";

export class CreateClientCompanyDto{
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    @Matches(/^\d{2,10}$/, { message: 'Invalid Romanian CIF. It must be 2-10 digits long without the "RO" prefix.' })
    ein: string;

}

export class DeleteClientCompanyDto{
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d{2,10}$/, { message: 'Invalid Romanian CIF. It must be 2-10 digits long without the "RO" prefix.' })
    ein: string;
}

export class NewManagementDto{
    @IsNumber()
    @IsNotEmpty()
    code: number;

    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    type: string;

    @IsString()
    manager: string;

    @IsNotEmpty()
    @IsBoolean()
    isSellingPrice: boolean;

    @IsNotEmpty()
    @IsString()
    vatRate: string;

    @IsNotEmpty()
    @IsString()
    currentClientCompanyEin: string;
}