import { IsNotEmpty, IsString, Matches } from "class-validator"

export class PostFileDto{
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d{2,10}$/, { message: 'Invalid Romanian CIF. It must be 2-10 digits long without the "RO" prefix.' })
    clientCompanyEin: string

    @IsString()
    @IsNotEmpty()
    processedData: string
};

export type ProcessedData = {
    
}