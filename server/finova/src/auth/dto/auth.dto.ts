import { IsBoolean, IsEmail, IsNotEmpty, IsPhoneNumber, IsString, Matches, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'


export class LegalAgreementsDto {
    @IsBoolean()
    @IsNotEmpty()
    terms: boolean;
  
    @IsBoolean()
    @IsNotEmpty()
    privacy: boolean;
  
    @IsBoolean()
    @IsNotEmpty()
    dpa: boolean;
  
    @IsBoolean()
    @IsNotEmpty()
    cookies: boolean;
  
    @IsBoolean()
    marketing: boolean;
  }

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

    @ValidateNested()
    @Type(() => LegalAgreementsDto)
    @IsNotEmpty()
    agreements: LegalAgreementsDto;
    
}

export class LoginDto{

    @IsEmail()
    @IsNotEmpty()
    email: string

    @IsString()
    @IsNotEmpty()
    password: string

}