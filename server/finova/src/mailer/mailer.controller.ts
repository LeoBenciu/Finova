import { Body, Controller, Post, UseGuards, Get } from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { GetUser } from 'src/auth/decorator';
import { User } from '@prisma/client';
import { MailerService } from './mailer.service';

interface SendEmailDto {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: string;
    contentType?: string;
  }>;
}

@UseGuards(JwtGuard)
@Controller('mailer')
export class MailerController {
  constructor(private readonly mailerService: MailerService) {}

  @Post('send')
  async sendEmail(
    @GetUser() user: User,
    @Body() emailData: SendEmailDto,
  ) {
    try {
      console.log('Mailer controller received email request:', {
        user: user.email,
        emailData: {
          to: emailData.to,
          subject: emailData.subject,
          hasText: !!emailData.text,
          hasHtml: !!emailData.html,
          hasCc: !!emailData.cc,
          hasBcc: !!emailData.bcc
        }
      });

      // Log SMTP configuration (without exposing sensitive data)
      console.log('SMTP Configuration:', {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER ? '***configured***' : 'NOT_SET',
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        hasPass: !!process.env.SMTP_PASS
      });

      await this.mailerService.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        ...emailData,
      });
      
      console.log('Email sent successfully for user:', user.email);
      
      return {
        success: true,
        message: 'Email sent successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Mailer controller error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      return {
        success: false,
        error: error.message || 'Failed to send email',
        timestamp: new Date().toISOString(),
        details: error.stack
      };
    }
  }

  @Get('health')
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      smtp: {
        host: process.env.SMTP_HOST ? 'configured' : 'not_configured',
        port: process.env.SMTP_PORT ? 'configured' : 'not_configured',
        user: process.env.SMTP_USER ? 'configured' : 'not_configured',
        hasPass: !!process.env.SMTP_PASS
      }
    };
  }
}
