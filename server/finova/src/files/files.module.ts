import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { DataExtractionModule } from '../data-extraction/data-extraction.module';
import { PostingModule } from '../accounting/posting.module';
import { BankModule } from '../bank/bank.module';

@Module({
  imports: [DataExtractionModule, BankModule, PostingModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService]
})
export class FilesModule {}
