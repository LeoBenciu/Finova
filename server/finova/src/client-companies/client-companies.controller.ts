import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import {Request} from 'express';
import { JwtGuard } from 'src/auth/guard';
import { ClientCompaniesService } from './client-companies.service';
import { User } from '@prisma/client';
import { DeleteClientCompanyDto, NewManagementDto } from './dto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { FilesInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import {GetUser} from '../auth/decorator';

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
    @UseInterceptors(
      FileFieldsInterceptor(
        [
          { name: "articles", maxCount: 1 },
          { name: "management", maxCount: 1 },
        ],
        {
          storage: diskStorage({
            destination: './uploads',
            filename: (req, file, callback) => {
              const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
              const ext = extname(file.originalname);
              callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
            },
          }),
        }
      )
    )
    createClientCompany(@UploadedFiles() files: {articles?: Express.Multer.File[]; management?: Express.Multer.File[]},
    @Body() ein:{ein:string}, @Req() req: Request)
    {
        const articlesFile = files.articles?.[0];
        const managementFile = files.management?.[0];
        console.log('Articles file:', articlesFile);
        console.log('Management file:', managementFile);
        
        if (!articlesFile?.path || !managementFile?.path) {
            console.error('File path is missing!');
            throw new BadRequestException('File upload failed: missing path');
        }
        
        const user = req.user as User;
        return this.clientCompaniesService.createClientCompany(ein, user, articlesFile, managementFile);
    }

    @Delete('')
    deleteClientCompany(@Body() dto:DeleteClientCompanyDto,@Req() req:Request)
    {
        const user = req.user as User;
        return this.clientCompaniesService.deleteClientCompany(dto, user);
    }
    
    @Post('data')
    getCompanyData(@Body() body:{currentCompanyEin:string, year:string}, @Req() req:Request)
    {
      const user = req.user as User;
      return this.clientCompaniesService.getCompanyData(body.currentCompanyEin, user, body.year);
    }

    @Delete('delete-management')
    @UseGuards(JwtGuard)
    async deleteManagement(
        @Body() dto: { managementId: number },
        @GetUser() user: User 
    ) {
        return this.clientCompaniesService.deleteManagement(dto.managementId, user);
    }

    @Delete('delete-article')  
    @UseGuards(JwtGuard)
    async deleteArticle(
        @Body() dto: { articleId: number },
        @GetUser() user: User 
    ) {
        return this.clientCompaniesService.deleteArticle(dto.articleId, user);
    }

    @Post('management')
    @UseGuards(JwtGuard)
    async saveNewManagement(
        @Body() dto: NewManagementDto,
        @GetUser() user: User
    ) {
        return this.clientCompaniesService.saveNewManagement(dto, user);
}
}
