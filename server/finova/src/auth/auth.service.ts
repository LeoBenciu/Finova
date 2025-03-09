import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { LoginDto, SignupDto } from "./dto";
import * as argon from 'argon2';
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { AccountingCompany, User } from "@prisma/client";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AuthService{

    constructor(
        private prisma: PrismaService,
        private jwt: JwtService,
        private config: ConfigService){}

    async login(dto: LoginDto){
        const user:User = await this.prisma.user.findUnique({
            where:{
                email: dto.email
            }
        });

        if(!user) throw new NotFoundException(`User with email: ${dto.email} not found!`);

        const isPasswordCorrect = await argon.verify(user.hashPassword, dto.password);

        if(!isPasswordCorrect) throw new UnauthorizedException("Incorrect password!");

        return this.signToken(user.id, user.email);
    }

    async signup(dto: SignupDto){
        //generate hashed password
        const hash = await argon.hash(dto.password);

        //add user & Company in db
        try{
            //existingCompany OR null
            let company: AccountingCompany|null = await this.prisma.accountingCompany.findUnique({
                where: {
                    ein: dto.ein
                }
            });

            if(!company) {
                company = await this.prisma.accountingCompany.create({
                    data:{
                        name: dto.company,
                        ein: dto.ein
                    }
                });
            };

            const user = await this.prisma.user.create({
               data:{ 
                email: dto.email,
                hashPassword: hash,
                name: dto.name,
                phoneNumber: dto.phoneNumber,
                accountingCompany: {
                    connect: {
                        ein: company.ein
                    }
                }
            }
            });
            delete user.hashPassword;

            return {user, company};
        } 
        catch(err){
            if(err instanceof PrismaClientKnownRequestError){
                if(err.code === 'P2002'){
                    throw new ForbiddenException('Account already created with this email!');
                }
            }
            throw err;
        };
    }

    async signToken(userId:number, email:string):Promise<{access_token:string}>{
        const payload = {
            sub: userId,
            email
        };

        const token = await this.jwt.signAsync(payload,{
            expiresIn: '120m',
            secret: this.config.get('JWT_SECRET')
        })

        return {
            access_token: token
        }
    }
}