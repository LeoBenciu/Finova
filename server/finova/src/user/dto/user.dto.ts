import { Role } from "@prisma/client"
import { IsEmail, IsNotEmpty, IsPhoneNumber, IsString } from "class-validator"
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

    @IsNotEmpty()
    @IsEmail()
    email: string

    @IsNotEmpty()
    role: Role

    @IsNotEmpty()
    @IsString()
    password: string

    @IsNotEmpty()
    @IsString()
    name: string

    @IsNotEmpty()
    @IsPhoneNumber()
    @IsString()
    phoneNumber: string
}