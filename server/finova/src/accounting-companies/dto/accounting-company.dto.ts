import { IsString, Matches } from "class-validator"

export class UpdateCompanyDto{
    @IsString()
    name: string

    @Matches(/^\d{2,10}$/, { message: 'Invalid Romanian CIF. It must be 2-10 digits long without the "RO" prefix.' })
    ein:string
}