import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { FileManagementModule } from './file-management/file-management.module';
import { DataExtractionModule } from './data-extraction/data-extraction.module';
import { DataEntryModule } from './data-entry/data-entry.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [AuthModule, UserModule, FileManagementModule, DataExtractionModule, DataEntryModule, DashboardModule, ],
})
export class AppModule {}
