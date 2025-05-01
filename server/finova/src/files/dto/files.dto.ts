import { IsNotEmpty, IsNumber, IsString, Matches } from "class-validator"

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

    @IsString()
    @IsNotEmpty()
    processedData: string

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