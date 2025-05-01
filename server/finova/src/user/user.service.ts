import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateUserDto, User } from './dto';
import * as argon from 'argon2';

@Injectable()
export class UserService {
    constructor(private prisma: PrismaService){}

    async getMyDetails(user:User){
        try{
            const userDetails = await this.prisma.user.findUnique({
                where:{
                    id: user.id
                }
            })
    
            if(!userDetails) throw new NotFoundException('User not found in the database!');
    
            delete userDetails.hashPassword;
            return userDetails;
        }catch(e)
        {
            if( e instanceof NotFoundException) throw e;
            throw new InternalServerErrorException("Failed to fetch user details!");
        }
    };

    async updateMyDetails(user: User, dto: UpdateUserDto)
    {
        try{
            const newUser = await this.prisma.user.update({
                where: {
                    id: user.id
                },
                data: {
                    name: dto.name,
                    email: dto.email,
                    role: dto.role,
                    phoneNumber: dto.phoneNumber,
                }
            })
            delete newUser.hashPassword;
            return newUser;
        }
        catch(e)
        {
            if (e.code === 'P2002') {
                throw new ConflictException('Email already exists');
              }
              
              console.error('User update failed:', e);
              
              throw new InternalServerErrorException('Failed to update user details');
            
        }
    }

    async updateAccountPassword(password:string, user:User)
    {
        try {
            const hashedPassword = await argon.hash(password);
            const newUser = await this.prisma.user.update({
                where:{
                    id: user.id
                }, 
                data: {
                    hashPassword: hashedPassword
                }
            })

            delete newUser.hashPassword;
            return newUser;
        } catch (e) {
            console.error('Password update failed:', e)
            throw new InternalServerErrorException('Failed to update user password');
        }
    }

    async deleteMyAccount(user: User)
    {
        try 
        {
            const deletedUser = await this.prisma.user.delete({
                where:{
                    id: user.id 
                }
            });

            if(!deletedUser) throw new NotFoundException('User doesn\'t exists');

            delete deletedUser.hashPassword;
            return deletedUser;
        } 
        catch (e) 
        {
            if(e instanceof NotFoundException) throw e;
            throw new InternalServerErrorException("Failed to delete user account!");
        }
    }
}
