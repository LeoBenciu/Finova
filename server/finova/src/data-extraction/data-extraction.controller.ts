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
        @Body() body: { ein: string; phase?: string }
    ) {
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }
        if (!body.ein) {
            throw new BadRequestException('EIN is required');
        }
        
        const fileBuffer = file.buffer;
        const fileBase64 = fileBuffer.toString('base64');
        const phase = body.phase ? parseInt(body.phase) : undefined;
        
        const extractedData = await this.dataExtractionService.extractData(
            fileBase64, 
            body.ein, 
            phase
        );
        
        return { result: extractedData };
    }

    @Post('batch')
    @UseInterceptors(FilesInterceptor('files', 50))
    async processBatch(
        @UploadedFiles() files: Array<Express.Multer.File>,
        @Body() body: { ein: string }
    ) {
        if (!files || files.length === 0) {
            throw new BadRequestException('No files uploaded');
        }
        if (!body.ein) {
            throw new BadRequestException('EIN is required');
        }

        console.log(`[BATCH] Starting batch processing for ${files.length} files`);
        
        try {
            const filesWithMetadata = files.map((file, index) => ({
                base64: file.buffer.toString('base64'),
                originalName: file.originalname,
                index
            }));
            
            console.log(`[BATCH] Files prepared: ${filesWithMetadata.map(f => f.originalName).join(', ')}`);
            
            const result = await this.dataExtractionService.processBatchPhased(
                filesWithMetadata,
                body.ein
            );
            
            console.log(`[BATCH] Processing complete. Stats:`, result.processingStats);
            
            return result;
        } catch (error) {
            console.error(`[BATCH] Error during batch processing:`, error);
            
            return {
                categorizedResults: [],
                incomingInvoices: [],
                outgoingInvoices: [],
                otherDocuments: [],
                processingStats: {
                    total: files.length,
                    categorized: 0,
                    incomingProcessed: 0,
                    outgoingProcessed: 0,
                    othersProcessed: 0,
                    errors: files.length
                },
                error: error.message || 'Batch processing failed'
            };
        }
    }

    @Post('batch/categorize')
    @UseInterceptors(FilesInterceptor('files', 50))
    async categorizeBatch(
        @UploadedFiles() files: Array<Express.Multer.File>,
        @Body() body: { ein: string }
    ) {
        if (!files || files.length === 0) {
            throw new BadRequestException('No files uploaded');
        }
        if (!body.ein) {
            throw new BadRequestException('EIN is required');
        }

        console.log(`[CATEGORIZE] Starting batch categorization for ${files.length} files`);

        const results = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                console.log(`[CATEGORIZE] Processing file ${i + 1}/${files.length}: ${file.originalname}`);

                const fileBase64 = file.buffer.toString('base64');

                const categorization = await this.dataExtractionService.extractData(
                    fileBase64, 
                    body.ein, 
                    0
                );

                results.push({
                    index: i,
                    filename: file.originalname,
                    documentType: categorization.document_type,
                    direction: categorization.direction,
                    success: true
                });

                console.log(`[CATEGORIZE] ✓ ${file.originalname} -> ${categorization.document_type} ${categorization.direction || ''}`);
            } catch (error) {
                console.error(`[CATEGORIZE] ✗ Failed to categorize ${file.originalname}:`, error.message);
                results.push({
                    index: i,
                    filename: file.originalname,
                    error: error.message,
                    success: false
                });
            }
        }

        const stats = {
            total: files.length,
            success: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
        };

        console.log(`[CATEGORIZE] Complete. Stats:`, stats);

        return {
            results,
            stats
        };
    }

}