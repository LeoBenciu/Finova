import { Module } from '@nestjs/common';
import { DataExtractionController } from './data-extraction.controller';
import { DataExtractionService } from './data-extraction.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [DataExtractionController],
  providers: [DataExtractionService]
})
export class DataExtractionModule {}
