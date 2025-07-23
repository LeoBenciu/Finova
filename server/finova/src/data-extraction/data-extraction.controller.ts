import { Controller, UseGuards, Post, UseInterceptors, UploadedFile, UploadedFiles, Body, BadRequestException } from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard';
import { DataExtractionService } from './data-extraction.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Express } from 'express'

@UseGuards(JwtGuard)
@Controller('data-extraction')
export class DataExtractionController {
   constructor(private readonly dataExtractionService: DataExtractionService){}

    @Post()
    @UseInterceptors(FileInterceptor('file'))
    async extractData(@UploadedFile() file: Express.Multer.File, @Body() body: { ein: string }){
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }
        if (!body.ein) {
            throw new BadRequestException('EIN is required');
        }
        const fileBuffer = file.buffer;
        const fileBase64 = fileBuffer.toString('base64');
        const extractedData = await this.dataExtractionService.extractData(fileBase64, body.ein);
        return { result: extractedData };
    }

    /**
     * Batch processing endpoint. Accepts multiple files and an EIN.
     * Files field name: `files` (array of multipart file uploads)
     */
    @Post('batch')
    @UseInterceptors(FilesInterceptor('files'))
    async processBatch(
        @UploadedFiles() files: Array<Express.Multer.File>,
        @Body() body: { ein: string },
    ) {
        if (!files || files.length === 0) {
            throw new BadRequestException('No files uploaded');
        }
        if (!body.ein) {
            throw new BadRequestException('EIN is required');
        }
        const base64Files = files.map(f => f.buffer.toString('base64'));
        const result = await this.dataExtractionService.processBatch(base64Files, body.ein);
        return result;
    }
}