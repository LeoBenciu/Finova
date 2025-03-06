import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { User } from 'src/user/dto';
import { UpdateCompanyDto } from './dto';

@Injectable()
export class AccountingCompaniesService {

    constructor(private prisma: PrismaService){}

    async getMyCompany(reqUser: User){
        try{
            const user = await this.prisma.user.findUnique({
                where:{
                    id: reqUser.id
                }
            });
            if(!user) throw new NotFoundException('User not found in the database!');
            
            const company = await this.prisma.accountingCompany.findUnique({
                where:{
                    id: user.accountingCompanyId
                }
            });
            if(!company) throw new NotFoundException('Company not found in the database!');
            return company;
        }
        catch(e)
        {
            if( e instanceof NotFoundException) throw e;
            throw new InternalServerErrorException("Failed to fetch company details!");
        }
    }

    async updateMyCompany(user: User, dto: UpdateCompanyDto)
    {
        try
        {
            const currentUser = await this.prisma.user.findUnique({
                where:{
                    id: user.id
                }
            });

            if(!currentUser) throw new NotFoundException('User not found in the database!');

            const updatedCompany = await this.prisma.accountingCompany.update({
                where:{
                    id: currentUser.accountingCompanyId
                },
                data:{
                    name: dto.name,
                    ein: dto.ein
                }
            });

            if(!updatedCompany)throw new NotFoundException('Company not found in the database!');
            return updatedCompany;
        }
        catch(e)
        {
            if (e.code === 'P2002') {
                throw new ConflictException('A company with this EIN already exists');
            }
            
            if (e.code === 'P2025') {
                throw new NotFoundException('Company not found in the database!');
            }
            
            if (e instanceof NotFoundException) throw e;
            throw new InternalServerErrorException('Failed to update company details');
        }
    }

    async deleteMyCompany(user: User)
    {
        try 
        {
            const currentUser = await this.prisma.user.findUnique({
                where:{
                    id: user.id
                }
            });

            if(!currentUser) throw new NotFoundException('User not found in the database!');

            const deletedUsers = await this.prisma.user.deleteMany({
                where:{
                    accountingCompanyId: currentUser.accountingCompanyId
                }
            });

            const deletedAccountingClients = await this.prisma.accountingClients.deleteMany({
                where:{
                    accountingCompanyId: currentUser.accountingCompanyId
                }
            });

            const deletedAccountingCompany = await this.prisma.accountingCompany.delete({
                where:{
                    id: currentUser.accountingCompanyId
                }
            });

            if(!deletedAccountingCompany) throw new NotFoundException('Company not found in the database!');
            
            return {
                company:deletedAccountingCompany,
                clientsDeleted: deletedAccountingClients.count,
                usersDeleted: deletedUsers.count
            };
        } 
        catch (e) 
        {
            if(e instanceof NotFoundException) throw e;
            console.error(e);
            throw new InternalServerErrorException('Failed to delete Company!')
        }
    }
}
