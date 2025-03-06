import { Body, Controller, Delete, Get, Put, Req, UseGuards } from '@nestjs/common';
import { AccountingCompaniesService } from './accounting-companies.service';
import { User } from '../user/dto/user.dto';
import { Request } from 'express';
import { UpdateCompanyDto } from './dto';
import { JwtGuard } from 'src/auth/guard';


@UseGuards(JwtGuard)
@Controller('accounting-companies')
export class AccountingCompaniesController {
    constructor(private accountingCompaniesService:AccountingCompaniesService){}

    @Put('/my-company')
    updateMyCompany(@Req() req: Request, @Body() dto:UpdateCompanyDto)
    {
        const user = req.user as User;
        return this.accountingCompaniesService.updateMyCompany(user, dto);
    }
    
    @Get('/my-company')
    getMyCompany(@Req() req: Request)
    {
        const user = req.user as User;
        return this.accountingCompaniesService.getMyCompany(user);
    }

    @Delete('/my-company')
    deleteMyCompany(@Req() req: Request)
    {
        const user = req.user as User;
        return this.accountingCompaniesService.deleteMyCompany(user);
    }
}
