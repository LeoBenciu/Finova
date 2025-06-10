import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorator';
import { JwtGuard } from '../auth/guard';
import { uiPathData, UipathService } from './uipath.service';
import { User } from '@prisma/client';
import { ModifyRpaDto } from './dto';


@UseGuards(JwtGuard)
@Controller('uipath')
export class UipathController {
    constructor(private readonly UipathService: UipathService){}

    @Post(':id')
    postClientInvoice(@Param('id') id:string, @Req() req:Request &{user: User},@Body() body: {currentClientCompanyEin:string})
    {
        const documentId:number = Number(id.slice(1));
        const userId:number = req.user.id;
        return this.UipathService.postClientInvoice(documentId, userId, body.currentClientCompanyEin);
    }
    @Get('/status/:id')
    getJobStatus(@Param('id') id:string){
        const documentId:number = Number(id.slice(1));
        return this.UipathService.getJobStatus(documentId);
    }

    @Get('/management/:ein')
    getManagement(
        @Param('ein') ein: string,
        @GetUser() user: User
    ) {
        return this.UipathService.getManagement(ein, user);
    }

    @Get('/articles/:ein')
    getArticles(
        @Param('ein') ein: string,
        @GetUser() user: User 
    ) {
        return this.UipathService.getArticles(ein, user);
    }

    @Get('/data')
    getRpaData(@GetUser() user: User)
    {
        const User = user;
        return this.UipathService.getRpaData(User);
    }

    @Put('/data')
    modifyRpaData(@GetUser() user: User, @Body() dto:ModifyRpaDto)
    {
      return this.UipathService.modifyRpaData(user, dto);
    }
}
