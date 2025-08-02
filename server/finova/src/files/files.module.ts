import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { DataExtractionModule } from '../data-extraction/data-extraction.module';
import { BankService } from '../bank/bank.service';

@Module({
  imports: [DataExtractionModule],
  controllers: [FilesController],
  providers: [FilesService, BankService],
  exports: [FilesService]
})
export class FilesModule {}
