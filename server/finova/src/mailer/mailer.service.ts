import { Injectable, InternalServerErrorException } from "@nestjs/common";
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
    private transporter: nodemailer.Transporter | null = null;

    private createTransporter(): nodemailer.Transporter {
        const host = process.env.SMTP_HOST;
        const port = parseInt(process.env.SMTP_PORT, 10);
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;

        if (!host || !port || !user || !pass) {
            throw new Error(`SMTP configuration incomplete. Required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS. Current: host=${host}, port=${port}, user=${user ? 'set' : 'missing'}, pass=${pass ? 'set' : 'missing'}`);
        }

        return nodemailer.createTransport({
            host,
            port,
            secure: false,
            auth: { user, pass },
        });
    }

    async sendMail(options: nodemailer.SendMailOptions): Promise<void>{
        try {
            // Create transporter on-demand to ensure environment variables are loaded
            if (!this.transporter) {
                this.transporter = this.createTransporter();
            }

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