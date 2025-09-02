import { Body, Controller, Post, UseGuards } from '@nestjs/common';
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
      return {
        success: false,
        error: error.message || 'Failed to send email',
        timestamp: new Date().toISOString(),
        details: error.stack
      };
    }
  }
}
