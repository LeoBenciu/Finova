import { Controller,Post } from "@nestjs/common";
import { AuthService } from "./auth.service";

@Controller('auth')
export class AuthController{
    constructor(private authService: AuthService ){}

    @Post('signup')
    signup():{msg:string}{
        return this.authService.signup();
    }

    @Post('login')
    login():{msg:string}{
        return this.authService.login();
    }
}