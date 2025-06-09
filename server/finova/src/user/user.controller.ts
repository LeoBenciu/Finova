import { Body, Controller, Delete, Get, Put, Req,Post, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import {Request} from 'express';
import { JwtGuard } from 'src/auth/guard';
import { UpdateUserDto, User } from './dto';

@UseGuards(JwtGuard)
@Controller('users')
export class UserController {

    constructor(private userService: UserService){}

    @Get('/me')
    getMe(@Req() req: Request){
        const user = req.user as User;
        return this.userService.getMyDetails(user);
    }

    @Put('/me')
    updateMyAccount(@Req() req: Request, @Body() dto:UpdateUserDto)
    { 
        const user = req.user as User;
        return this.userService.updateMyDetails(user, dto);
    }

    @Put('/me/password')
    updateAccountPassword(@Req() req: Request, @Body() body:{password:string})
    {
        const {password} = body;
        const user = req.user as User;
        return this.userService.updateAccountPassword(password, user);
    }

    @Delete('/me')
    deleteMyAccount(@Req() req: Request)
    {
        const user = req.user as User;
        return this.userService.deleteMyAccount(user, req);
    }

    @Get('/me/agreements')
    getUserAgreements(@Req() req: Request) {
        const user = req.user as User;
        return this.userService.getUserAgreements(user);
    }

    @Put('/me/consent')
    updateUserConsent(
        @Req() req: Request, 
        @Body() body: { agreementType: string; accepted: boolean }
    ) {
        const user = req.user as User;
        const { agreementType, accepted } = body;
        return this.userService.updateUserConsent(user, agreementType, accepted, req);
    }

    @Put('/me/uipath-subfolder')
    updateUipathSubfolder(@Req() req: Request, @Body() body: { subfolderName: string })
    {
        const user = req.user as User;
        return this.userService.updateUipathSubfolder(user,body.subfolderName);
    }

}
