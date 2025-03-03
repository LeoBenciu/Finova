import { Controller, Get, Put, Delete, Post, UseGuards } from '@nestjs/common';
import { FileManagementService } from './file-management.service';
import { JwtGuard } from 'src/auth/guard';

@UseGuards(JwtGuard)
@Controller('file-management')
export class FileManagementController {
    constructor(private fileMangementService: FileManagementService){}

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
