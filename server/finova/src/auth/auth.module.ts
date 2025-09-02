import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import {JwtModule} from '@nestjs/jwt';
import { JwtStrategy } from "./strategy";
import { AnafModule } from "src/anaf/anaf.module";
import { MailerModule } from "src/mailer/mailer.module";

@Module({
    imports: [JwtModule.register({}), AnafModule, MailerModule],
    controllers:[AuthController],
    providers:[AuthService, JwtStrategy]
})
export class AuthModule{

}