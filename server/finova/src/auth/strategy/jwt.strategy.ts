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

    if (!payload) {
      console.error('No payload found in JWT');
      throw new UnauthorizedException('Invalid token');
    }

    if (!payload.sub) {
      console.error('No user ID (sub) in JWT payload');
      throw new UnauthorizedException('Invalid token structure');
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        }
      });

      if (!user) {
        console.error(`No user found with ID: ${payload.sub}`);
        throw new UnauthorizedException('User not found');
      }

      return user;
    } catch (error) {
      console.error('JWT Validation Error:', error);
      throw new UnauthorizedException('Could not validate token');
    }
  }
}