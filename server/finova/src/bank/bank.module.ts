import { Module } from '@nestjs/common';
import { BankService } from './bank.service';
import { BankController } from './bank.controller';
import { DataExtractionModule } from 'src/data-extraction/data-extraction.module';
import { PostingModule } from 'src/accounting/posting.module';

@Module({
  imports: [DataExtractionModule, PostingModule],
  providers: [BankService],
  controllers: [BankController]
})
export class BankModule {}
