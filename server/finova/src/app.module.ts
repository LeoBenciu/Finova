import { Module } from '@nestjs/common';
import {ConfigModule} from '@nestjs/config'
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { FilesModule } from './files/files.module';
import { DataExtractionModule } from './data-extraction/data-extraction.module';
import { DataEntryModule } from './data-entry/data-entry.module';
import { PrismaModule } from './prisma/prisma.module';
import { ClientCompaniesModule } from './client-companies/client-companies.module';
import { AccountingCompaniesModule } from './accounting-companies/accounting-companies.module';
import { AnafModule } from './anaf/anaf.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    UserModule,
    FilesModule,
    DataExtractionModule,
    DataEntryModule,
    PrismaModule,
    ClientCompaniesModule,
    AccountingCompaniesModule,
    AnafModule,
   ],
})
export class AppModule {}
