import { Module } from '@nestjs/common';
import { BankService } from './bank.service';
import { BankController } from './bank.controller';
import { DataExtractionModule } from 'src/data-extraction/data-extraction.module';

@Module({
  imports: [DataExtractionModule],
  providers: [BankService],
  controllers: [BankController]
})
export class BankModule {}
