import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios'

@Injectable()
export class AnafService {
    private readonly API_URL = 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva';

    async getCompanyDetails(cui:any){
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await axios.post(this.API_URL,[
                {cui: parseInt(cui, 10), data: today}
            ]);

            if(response.data && response.data.found && response.data.found.length>0){
                return response.data.found[0];
            }else{
                throw new InternalServerErrorException('Company not found in ANAF database');
            }
            
        } catch (e) {
            console.error('Error details:', e.response || e.message || e);
             throw new InternalServerErrorException('Failed to fetch company details from ANAF');
        }
    }
}
