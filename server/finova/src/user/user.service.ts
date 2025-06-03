import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateUserDto, User } from './dto';
import * as argon from 'argon2';
import { Request } from 'express';

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

    async getUserAgreements(user: User) {
        try {
            const agreements = await this.prisma.legalAgreement.findMany({
                where: { userId: user.id },
                orderBy: { acceptedAt: 'desc' }
            });
    
            // Transform data pentru frontend
            const agreementMap = agreements.reduce((acc, agreement) => {
                acc[agreement.agreementType] = {
                    accepted: agreement.accepted,
                    acceptedAt: agreement.acceptedAt,
                    version: agreement.version
                };
                return acc;
            }, {});
    
            // Ensure all agreement types are present
            const allAgreements = {
                terms: agreementMap['terms'] || { accepted: false, acceptedAt: null, version: null },
                privacy: agreementMap['privacy'] || { accepted: false, acceptedAt: null, version: null },
                dpa: agreementMap['dpa'] || { accepted: false, acceptedAt: null, version: null },
                cookies: agreementMap['cookies'] || { accepted: false, acceptedAt: null, version: null },
                marketing: agreementMap['marketing'] || { accepted: false, acceptedAt: null, version: null }
            };
    
            return allAgreements;
        } catch (e) {
            console.error('Failed to fetch user agreements:', e);
            throw new InternalServerErrorException('Failed to fetch legal agreements');
        }
    }
    
    async updateUserConsent(user: User, agreementType: string, accepted: boolean, req?: Request) {
        try {
            const ipAddress = req?.ip || req?.connection?.remoteAddress || null;
            const userAgent = req?.headers['user-agent'] || null;
    
            const agreement = await this.prisma.legalAgreement.upsert({
                where: {
                    userId_agreementType: {
                        userId: user.id,
                        agreementType: agreementType
                    }
                },
                update: {
                    accepted: accepted,
                    acceptedAt: new Date(),
                    ipAddress,
                    userAgent
                },
                create: {
                    userId: user.id,
                    agreementType: agreementType,
                    accepted: accepted,
                    ipAddress,
                    userAgent,
                    version: '1.0'
                }
            });
    
            return {
                success: true,
                agreement,
                message: `${agreementType} consent updated successfully`
            };
        } catch (e) {
            console.error('Failed to update consent:', e);
            throw new InternalServerErrorException('Failed to update consent');
        }
    }
    
}
