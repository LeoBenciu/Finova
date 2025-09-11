import { Module } from '@nestjs/common';
import { AccountingController } from 'src/accounting/accounting.controller';
import { AccountingService } from 'src/accounting/accounting.service';
import { PostingService } from 'src/accounting/posting.service';
import { FinancialMetricsService } from 'src/accounting/financial-metrics.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AccountingController],
  providers: [
    AccountingService,
    PostingService,
    FinancialMetricsService
  ],
  exports: [
    AccountingService,
    PostingService,
    FinancialMetricsService
  ],
})
export class AccountingModule {}
