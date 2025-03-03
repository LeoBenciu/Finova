import { Module } from '@nestjs/common';
import {ConfigModule} from '@nestjs/config'
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { FileManagementModule } from './file-management/file-management.module';
import { DataExtractionModule } from './data-extraction/data-extraction.module';
import { DataEntryModule } from './data-entry/data-entry.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    UserModule,
    FileManagementModule,
    DataExtractionModule,
    DataEntryModule,
    DashboardModule,
    PrismaModule,
   ],
})
export class AppModule {}
