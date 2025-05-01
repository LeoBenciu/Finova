import { Module } from '@nestjs/common';
import { UipathService } from './uipath.service';
import { UipathController } from './uipath.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    PrismaModule,
    ConfigModule
  ],
  providers: [UipathService],
  controllers: [UipathController],
  exports: [UipathService]
})
export class UipathModule {}
