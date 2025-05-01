import { Controller,Post, Body, Req, HttpException, HttpStatus } from "@nestjs/common";
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

    @Post('/forgot-password')
    forgotPassword(@Req() req: Request, @Body() body:{email:string})
    {
        return this.authService.forgotPassword(body.email);
    }

    @Post('/reset-password')
    async resetPassword(@Body() resetPasswordDto: {token:string, newPassword:string})
    {
        const {token, newPassword}= resetPasswordDto;
        const updatedUser = await this.authService.resetPassword(token,newPassword);
        if(!updatedUser)
        {
            throw new HttpException('Invalid token or token expired', HttpStatus.BAD_REQUEST);
        };
        return{message:'Password changed successfully!'};
    }
}