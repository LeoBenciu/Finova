import { Controller, UseGuards, Post, UseInterceptors, UploadedFile, UploadedFiles, Body, BadRequestException, Get, Query } from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard';
import { DataExtractionService } from './data-extraction.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Express } from 'express'

@UseGuards(JwtGuard)
@Controller('data-extraction')
export class DataExtractionController {
    constructor(private readonly dataExtractionService: DataExtractionService) {}

    @Post()
    @UseInterceptors(FileInterceptor('file'))
    async extractData(
        @UploadedFile() file: Express.Multer.File, 
        @Body() body: { ein: string; phase?: string; phase0Data?: string }
    ) {
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }
        if (!body.ein) {
            throw new BadRequestException('EIN is required');
        }
        
        const fileBuffer = file.buffer;
        const fileBase64 = fileBuffer.toString('base64');
        const phase = body.phase ? parseInt(body.phase) : 0;
        
        let phase0Data = undefined;
        if (body.phase0Data) {
            try {
                phase0Data = JSON.parse(body.phase0Data);
            } catch (e) {
                console.error('Failed to parse phase0Data:', e);
            }
        }
        
        const extractedData = await this.dataExtractionService.extractData(
            fileBase64, 
            body.ein, 
            phase,
            phase0Data
        );
        
        return { result: extractedData };
    }
}