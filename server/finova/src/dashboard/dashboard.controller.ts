import { Controller, Get, UseGuards} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtGuard } from 'src/auth/guard';

@UseGuards(JwtGuard)
@Controller('dashboard')
export class DashboardController {
    constructor(private dashboardService: DashboardService){}

    @Get(':company')
    getDashboardData()
    {
        this.dashboardService.getDashboardData();
    }
}
