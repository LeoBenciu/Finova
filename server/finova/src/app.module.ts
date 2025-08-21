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
import { UipathModule } from './uipath/uipath.module';
// import {ScheduleModule} from '@nestjs/schedule';
import { BankModule } from './bank/bank.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // ScheduleModule.forRoot(),
    AuthModule,
    UserModule,
    FilesModule,
    DataExtractionModule,
    DataEntryModule,
    PrismaModule,
    ClientCompaniesModule,
    AccountingCompaniesModule,
    AnafModule,
    UipathModule,
    BankModule,
   ],
})
export class AppModule {}
