import { Module } from '@nestjs/common';
import { ClientCompaniesService } from './client-companies.service';
import { ClientCompaniesController } from './client-companies.controller';

@Module({
  providers: [ClientCompaniesService],
  controllers: [ClientCompaniesController]
})
export class ClientCompaniesModule {}
