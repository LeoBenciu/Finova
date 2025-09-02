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
      await this.mailerService.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        ...emailData,
      });
      
      return {
        success: true,
        message: 'Email sent successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to send email',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
