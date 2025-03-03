import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateUserDto, User } from './dto';
import * as argon from 'argon2';

@Injectable()
export class UserService {
    constructor(private prisma: PrismaService){}

    async getMyCompany(user: User){
        try{
            const company = await this.prisma.accountingCompany.findUnique({
                where: {
                    id: user.accountingCompanyId
                }
            });
            return company;
        }
        catch(e)
        {
            return e;
        }
    }

    async updateMyAccount(user: User, dto: UpdateUserDto)
    {
        try{
            const hashPassword = await argon.hash(dto.password);
            const newUser = await this.prisma.user.update({
                where: {
                    id: user.id
                },
                data: {
                    name: dto.name,
                    email: dto.email,
                    role: dto.role,
                    hashPassword: hashPassword,
                    phoneNumber: dto.phoneNumber,
                }
            })
            delete newUser.hashPassword;
            return newUser;
        }
        catch(e)
        {
            return e;
        }
    }
}
