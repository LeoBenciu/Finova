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
            // Set default from address if not provided
            if (!options.from) {
                options.from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@finova.com';
            }
            
            console.log('Attempting to send email with options:', {
                to: options.to,
                subject: options.subject,
                from: options.from,
                hasText: !!options.text,
                hasHtml: !!options.html,
                hasCc: !!options.cc,
                hasBcc: !!options.bcc
            });
            
            await this.transporter.sendMail(options);
            console.log('Email sent successfully');
        } catch (error) {
            console.error('Error sending email:', error);
            console.error('Email options that failed:', options);
            throw new InternalServerErrorException(`Error sending email: ${error.message}`);
        }
    }
}