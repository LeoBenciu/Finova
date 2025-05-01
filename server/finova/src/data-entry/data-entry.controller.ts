import { Controller, UseGuards } from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard';
import { DataEntryService } from './data-entry.service';

@UseGuards(JwtGuard)
@Controller('data-entry')
export class DataEntryController {
    constructor(dataEntryService: DataEntryService){}

    
}
