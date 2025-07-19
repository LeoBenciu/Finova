import { Controller, Get, Put, Delete, Post, Patch, UseGuards, Param, Body, UseInterceptors, UploadedFile, Req, ParseIntPipe } from '@nestjs/common';
import { FilesService } from './files.service';
import { JwtGuard } from 'src/auth/guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { DeleteFileDto, PostFileDto, UpdateFileDto } from './dto';
import { User, DuplicateStatus } from '@prisma/client';
import { Request } from 'express';

@UseGuards(JwtGuard)
@Controller('files')
export class FilesController {

    constructor(private fileMangementService: FilesService){}

    @Post('some-files')
    async getSomeFiles(
        @Body('docIds') docIds: number[],
        @Body('clientEin') clientEin: string,
        @Req() req: Request & { user: User }
    ) {

        /*
        const user = req.user as User;
        return this.fileMangementService.getSomeFiles(docIds, user, clientEin);
        */
        return 'Not implemented';
    }

    @Patch(':docId/references')
    async updateReferences(
        @Param('docId') docId: string,
        @Body('references') references: number[],
        @Req() req: Request & { user: User }
    ) {
        const user = req.user as User;
        return this.fileMangementService.updateReferences(Number(docId), references, user);
    }

    @Get(':company')
    getFiles(@Param('company') company:string, @Req() req:Request)
    {
        const ein = company;
        const user = req.user as User;
        return this.fileMangementService.getFiles(ein, user);
    }
    
    @Post('')
    @UseInterceptors(FileInterceptor('file'))
    postFile(@UploadedFile() file: Express.Multer.File, @Body() dto: PostFileDto,
    @Req() req: Request & { user: User }) {
      const processedData = JSON.parse(dto.processedData);
      const user = req.user as User;
      return this.fileMangementService.postFile(dto.clientCompanyEin, processedData, file,user);
    }

    @Put('')
    updateFiles(@Body() dto:UpdateFileDto, @Req() req:Request & {user:User})
    {
        const user = req.user as User;
        return this.fileMangementService.updateFiles(dto.processedData, dto.clientCompanyEin, user, dto.docId);
    }

    @Delete('')
    deleteFile(@Body() dto:DeleteFileDto, @Req() req:Request &{ user: User})
    {
        const user = req.user as User;
        return this.fileMangementService.deleteFiles(dto.clientCompanyEin, dto.docId, user);
    }

    @Get(':company/duplicate-alerts')
    getDuplicateAlerts(
        @Param('company') clientCompanyEin: string,
        @Req() req: Request & { user: User }
    ) {
        const user = req.user as User;
        return this.fileMangementService.getDuplicateAlerts(clientCompanyEin, user);
    }

    @Get(':company/compliance-alerts')
    getComplianceAlerts(
        @Param('company') clientCompanyEin: string,
        @Req() req: Request & { user: User }
    ) {
        const user = req.user as User;
        return this.fileMangementService.getComplianceAlerts(clientCompanyEin, user);
    }

    @Put('duplicate-status/:duplicateCheckId')
    updateDuplicateStatus(
        @Param('duplicateCheckId') duplicateCheckId: string,
        @Body('status') status: DuplicateStatus,
        @Req() req: Request & { user: User }
    ) {
        const user = req.user as User;
        return this.fileMangementService.updateDuplicateStatus(parseInt(duplicateCheckId), status, user);
    }

    @Get('service/health')
    getServiceHealth(): any {
        return this.fileMangementService.getServiceHealth();
    }

    @Get(':docId/related')
    async getRelatedDocuments(
        @Param('docId', ParseIntPipe) docId: number,
        @Param('clientEin') clientEin: string,
        @Req() req: Request & { user: User }
    ) {
        const user = req.user as User;
        return this.fileMangementService.getRelatedDocuments(docId, user, clientEin);
    }

}