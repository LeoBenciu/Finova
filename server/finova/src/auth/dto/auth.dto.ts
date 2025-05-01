import { IsEmail, IsNotEmpty, IsPhoneNumber, IsString, Matches } from 'class-validator'

export class SignupDto{
    @IsEmail()
    @IsNotEmpty()
    email: string

    @IsNotEmpty()
    @IsString()
    password: string

    @IsString()
    @IsNotEmpty()
    username: string
    
    @IsString()
    @IsPhoneNumber()
    @IsNotEmpty()
    phoneNumber: string

    @IsNotEmpty()
    @Matches(/^\d{2,10}$/, { message: 'Invalid Romanian CIF. It must be 2-10 digits long without the "RO" prefix.' })
    ein: string
}

export class LoginDto{

    @IsEmail()
    @IsNotEmpty()
    email: string

    @IsString()
    @IsNotEmpty()
    password: string

}