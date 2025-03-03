import { Controller,Post, Body } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { SignupDto, LoginDto } from "./dto";
import { User } from "@prisma/client";

@Controller('auth')
export class AuthController{
    constructor(private authService: AuthService ){}

    @Post('signup')
    signup(@Body() dto:SignupDto):any{
        return this.authService.signup(dto);
    }

    @Post('login')
    login(@Body() dto:LoginDto):any{
        return this.authService.login(dto);
    }
}