import { Injectable, InternalServerErrorException } from "@nestjs/common";
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
    private transporter: nodemailer.Transporter;

    constructor(){
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'ex',
            port: parseInt(process.env.SMTP_PORT, 10) || 587,
            secure: false,
            auth:{
                user: process.env.SMTP_USER || 'ex',
                pass: process.env.SMTP_PASS || 'pas',
            },
        });
    }

    async sendMail(options: nodemailer.SendMailOptions): Promise<void>{
        try {
            await this.transporter.sendMail(options);
        } catch (error) {
            console.error('Error sending email:', error);
            throw new InternalServerErrorException('Error sending email');
        }
    }
}