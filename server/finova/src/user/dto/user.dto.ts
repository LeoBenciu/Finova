import { Role } from "@prisma/client"
import { IsEmail, IsNotEmpty, IsPhoneNumber, IsString, Matches, IsIn, IsBoolean } from "class-validator"
export class User {
    id: 1
    createdAt: Date
    updatedAt: Date
    email:string
    role: Role
    name: string
    phoneNumber: number
    accountingCompanyId: number
}

export class UpdateUserDto{

    @IsNotEmpty({ message: 'Email is required' })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    email: string

    @IsNotEmpty({ message: 'Role is required' })
    role: Role

    @IsNotEmpty({ message: 'Name is required' })
    @IsString({ message: 'Name must be a string' })
    name: string

    @IsNotEmpty({ message: 'Phone number is required' })
    @IsPhoneNumber(undefined, { message: 'Please provide a valid phone number' })
    @IsString({ message: 'Phone number must be a string' })
    phoneNumber: string
}

export class UpdateConsentDto {
    @IsString()
    @IsIn(['terms', 'privacy', 'dpa', 'cookies', 'marketing'])
    agreementType: string;

    @IsBoolean()
    accepted: boolean;
}
