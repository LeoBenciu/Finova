import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
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
        return req.user;
    }

    @Put('/me')
    updateMyAccount(@Req() req: Request, @Body() dto:UpdateUserDto)
    { 
        const user = req.user as User;
        return this.userService.updateMyAccount(user, dto);
    }

    @Get('/company')
    getMyCompany(@Req() req: Request)
    {
        const user = req.user as User;
        return this.userService.getMyCompany(user);
    }
}
