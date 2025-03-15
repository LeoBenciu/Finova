import { Controller, Get, Put, Delete, Post, UseGuards, Param, Body, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import { FilesService } from './files.service';
import { JwtGuard } from 'src/auth/guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { PostFileDto } from './dto';
import { User } from '@prisma/client';
import { Request } from 'express';

@UseGuards(JwtGuard)
@Controller('files')
export class FilesController {
    constructor(private fileMangementService: FilesService){}

    @Get(':company')
    getFiles()
    {
        return this.fileMangementService.getFiles();
    }
    @Post('')
    @UseInterceptors(FileInterceptor('file'))
    postFile(@UploadedFile() file: Express.Multer.File, @Body() dto: PostFileDto,
    @Req() req: Request & { user: User }) {
      const processedData = JSON.parse(dto.processedData);
      const user = req.user as User;
      return this.fileMangementService.postFile(dto.clientCompanyEin, processedData, file,user);
    }

    @Put(':company')
    updateFiles()
    {
        return this.fileMangementService.updateFiles();
    }

    @Delete(':company')
    deleteFile()
    {
        return this.fileMangementService.deleteFiles();
    }
}
