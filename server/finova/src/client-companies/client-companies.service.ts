import { ForbiddenException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AccountingCompany, ClientCompany, User } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateClientCompanyDto, DeleteClientCompanyDto } from './dto';
import { NODATA } from 'dns';

@Injectable()
export class ClientCompaniesService {

    constructor(private prisma:PrismaService){}

    async getClientCompany(clientId: number, reqUser: User)
    {
        try
        {
            const user = await this.prisma.user.findUnique({
                where:{
                    id: reqUser.id
                }
            });
            if(!user) throw new NotFoundException('User not found in the database!');

            const clientCompany = await this.prisma.clientCompany.findUnique({
                where:{
                    id: clientId,
                    accountingClients:{
                        some:{
                            accountingCompanyId: user.accountingCompanyId,
                        }
                    }
                }
            });

            if(!clientCompany) throw new NotFoundException("Client company not found!")

            return clientCompany;
        }
        catch(e)
        {
            if (e instanceof NotFoundException) throw e;
            throw new InternalServerErrorException("Failed to fetch client company");
        }
    }

    async getClientCompanies(reqUser:User)
    {
       try
        { 
        const user = await this.prisma.user.findUnique({
            where:{
                id: reqUser.id
            }
        });
        if(!user) throw new NotFoundException("User not found in the database!");

        const accountingClients = await this.prisma.accountingClients.findMany({
            where:{
                accountingCompanyId: user.accountingCompanyId
            }
        });

        if(accountingClients.length===0) throw new NotFoundException("There are no clients created for this accounting company!");

        const clientCompaniesIds = accountingClients.map(client=>client.clientCompanyId);

        const clientCompanies = await this.prisma.clientCompany.findMany({
            where:{
                id: {
                    in: clientCompaniesIds
                }
            }
        });

        return clientCompanies;
        }
        catch(e){
            if (e instanceof NotFoundException) throw e;
            throw new InternalServerErrorException("Failed to fetch client companies");
        }
    }


    async createClientCompany(dto: CreateClientCompanyDto, reqUser: User)
    {
        try
        {
            const user = await this.prisma.user.findUnique({
                where:{id: reqUser.id}
            });

            if(!user) throw new NotFoundException('User not found in the database!');
            
            let newCompany = await this.prisma.clientCompany.upsert({
                where: { ein: dto.ein },
                update: {},
                create: { name: dto.name, ein: dto.ein }
            });

            const existingLink = await this.prisma.accountingClients.findFirst({
                where: {
                    accountingCompanyId: user.accountingCompanyId,
                    clientCompanyId: newCompany.id
                }
            });

            
            if(!existingLink){
            const newLink = await this.prisma.accountingClients.create({
                data:{
                    accountingCompanyId: user.accountingCompanyId,
                    clientCompanyId: newCompany.id
                }
            })
            return {
                company: newCompany,
                link: newLink
            }
        }

            return{company: newCompany, message: "Company already linked!"};
        }
        catch(e)
        {
            console.error('Error creating client company',e)
            return e;
        }
    }

    async deleteClientCompany(dto:DeleteClientCompanyDto,reqUser: User)
    {
        try{
            const user = await this.prisma.user.findUnique({
                where:{
                    id: reqUser.id
                }
            });

            const clientCompany = await this.prisma.clientCompany.findUnique({
                where:{
                    ein: dto.ein
                }
            });
            if(!clientCompany) throw new NotFoundException(`We could't find the company with ${dto.ein} in the database`);
    
            const deletedLink  = await this.prisma.accountingClients.deleteMany({
                where:{
                    accountingCompanyId: user.accountingCompanyId,
                    clientCompanyId: clientCompany.id
                }
            })
            if(deletedLink.count ===1) 
            {
                return clientCompany
            }else{
                throw new NotFoundException("No client with this ein is linked to the company!")
            };
            
        }
        catch(e)
        {
            console.error('error:',e);
            return e;
        }
    }
}
