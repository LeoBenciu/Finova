import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import {Request} from 'express';
import { JwtGuard } from 'src/auth/guard';
import { ClientCompaniesService } from './client-companies.service';
import { User } from '@prisma/client';
import { DeleteClientCompanyDto } from './dto';

@UseGuards(JwtGuard)
@Controller('client-companies')
export class ClientCompaniesController {

    constructor(private readonly clientCompaniesService: ClientCompaniesService){}

    @Get(':id')
    getClientCompany(@Req() req:Request,@Param('id') id: string)
    {
        const companyId = parseInt(id, 10);
        const user = req.user as User;
        return this.clientCompaniesService.getClientCompany(companyId, user);
    }

    @Get('')
    getClientCompanies(@Req() req: Request)
    {   
        const user = req.user as User;
        return this.clientCompaniesService.getClientCompanies(user);
    }


    @Post('')
    createClientCompany(@Body() ein:{ein:string}, @Req() req: Request)
    {
        const user = req.user as User;
        return this.clientCompaniesService.createClientCompany(ein, user);
    }

    @Delete('')
    deleteClientCompany(@Body() dto:DeleteClientCompanyDto,@Req() req:Request)
    {
        const user = req.user as User;
        return this.clientCompaniesService.deleteClientCompany(dto, user);
    }
    
}
