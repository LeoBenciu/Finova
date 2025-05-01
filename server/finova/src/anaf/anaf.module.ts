import { Module } from '@nestjs/common';
import { AnafService } from './anaf.service';

@Module({providers: [AnafService],
    exports: [AnafService]})
export class AnafModule {}
