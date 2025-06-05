import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorator';
import { JwtGuard } from '../auth/guard';
import { uiPathData, UipathService } from './uipath.service';
import { User } from '@prisma/client';


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
}
