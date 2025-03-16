import { Module } from '@nestjs/common';
import { ClientCompaniesService } from './client-companies.service';
import { ClientCompaniesController } from './client-companies.controller';
import { AnafModule } from 'src/anaf/anaf.module';

@Module({
  imports:[AnafModule],
  providers: [ClientCompaniesService],
  controllers: [ClientCompaniesController]
})
export class ClientCompaniesModule {}
