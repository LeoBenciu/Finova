import { Controller, UseGuards } from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard';
import { BankService } from './bank.service';

@UseGuards(JwtGuard)
@Controller('bank')
export class BankController {
    constructor(private readonly bankService: BankService){}

    
}
