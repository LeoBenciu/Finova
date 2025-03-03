import { Module } from '@nestjs/common';
import { FileManagementController } from './file-management.controller';
import { FileManagementService } from './file-management.service';

@Module({
  controllers: [FileManagementController],
  providers: [FileManagementService]
})
export class FileManagementModule {}
