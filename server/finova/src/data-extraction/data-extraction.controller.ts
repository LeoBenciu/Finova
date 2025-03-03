import { Controller, UseGuards, Post, UseInterceptors, UploadedFile } from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard';
import { DataExtractionService } from './data-extraction.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express'
import * as fs from "fs";

@UseGuards(JwtGuard)
@Controller('data-extraction')
export class DataExtractionController {
   constructor(private readonly dataExtractionService: DataExtractionService){}

    @Post()
    @UseInterceptors(FileInterceptor('file'))
    async extractData(@UploadedFile() file: Express.Multer.File){

        if(!file){
            return { error: 'No file uploaded' };
        }

        const fileBuffer = file.buffer;
        const fileBase64 = fileBuffer.toString('base64');

        const extractedData = await this.dataExtractionService.extractData(fileBase64);

        return {result: extractedData};
    }
}
