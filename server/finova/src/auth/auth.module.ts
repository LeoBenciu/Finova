import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import {JwtModule} from '@nestjs/jwt';
import { JwtStrategy } from "./strategy";
import { AnafModule } from "src/anaf/anaf.module";
import { MailerService } from "src/mailer/mailer.service";

@Module({
    imports: [JwtModule.register({}), AnafModule],
    controllers:[AuthController],
    providers:[AuthService, JwtStrategy,MailerService]
})
export class AuthModule{

}