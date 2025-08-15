import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: { sub: number; email: string }) {
    console.log('🔐 JWT VALIDATION START:', {
      hasPayload: !!payload,
      payloadKeys: payload ? Object.keys(payload) : [],
      userId: payload?.sub,
      email: payload?.email
    });

    if (!payload) {
      console.error('❌ No payload found in JWT');
      throw new UnauthorizedException('Invalid token');
    }

    if (!payload.sub) {
      console.error('❌ No user ID (sub) in JWT payload:', payload);
      throw new UnauthorizedException('Invalid token structure');
    }

    try {
      console.log('🔍 Looking up user with ID:', payload.sub);
      
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          accountingCompanyId: true
        }
      });

      console.log('👤 User lookup result:', {
        found: !!user,
        userId: user?.id,
        email: user?.email,
        role: user?.role
      });

      if (!user) {
        console.error(`❌ No user found with ID: ${payload.sub}`);
        throw new UnauthorizedException('User not found');
      }

      console.log('✅ JWT validation successful for user:', user.id);
      
      // TEMPORARY FIX: Ensure user has accountingCompanyId
      if (!user.accountingCompanyId) {
        console.warn('⚠️ User missing accountingCompanyId, setting to 1');
        const updatedUser = await this.prisma.user.update({
          where: { id: user.id },
          data: { accountingCompanyId: 1 },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            accountingCompanyId: true
          }
        });
        console.log('✅ Updated user with accountingCompanyId:', updatedUser.accountingCompanyId);
        return updatedUser;
      }
      
      return user;
    } catch (error) {
      console.error('❌ JWT Validation Error:', {
        error: error.message,
        stack: error.stack,
        payload: payload
      });
      throw new UnauthorizedException('Could not validate token');
    }
  }
}