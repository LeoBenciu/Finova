import { Controller, Get, Put, Delete, Post, UseGuards } from '@nestjs/common';
import { FilesService } from './files.service';
import { JwtGuard } from 'src/auth/guard';

@UseGuards(JwtGuard)
@Controller('files')
export class FilesController {
    constructor(private fileMangementService: FilesService){}

    @Get(':company')
    getFiles()
    {
        return this.fileMangementService.getFiles();
    }

    @Post(':company')
    postFile()
    {
        return this.fileMangementService.postFiles();
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
