import { Module } from '@nestjs/common';
import { AccountingCompaniesController } from './accounting-companies.controller';
import { AccountingCompaniesService } from './accounting-companies.service';

@Module({
  controllers: [AccountingCompaniesController],
  providers: [AccountingCompaniesService]
})
export class AccountingCompaniesModule {}
