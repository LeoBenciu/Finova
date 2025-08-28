import { Module } from '@nestjs/common';
import { AccountingController } from 'src/accounting/accounting.controller';
import { AccountingService } from 'src/accounting/accounting.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AccountingController],
  providers: [AccountingService],
  exports: [AccountingService],
})
export class AccountingModule {}
