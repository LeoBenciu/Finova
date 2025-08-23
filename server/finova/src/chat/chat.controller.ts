import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { GetUser } from 'src/auth/decorator';
import { User } from '@prisma/client';
import { ChatService } from './chat.service';

@UseGuards(JwtGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post(':clientEin/message')
  async sendMessage(
    @Param('clientEin') clientEin: string,
    @GetUser() user: User,
    @Body()
    body: {
      message: string;
      history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    },
  ) {
    const { message, history } = body;
    const reply = await this.chatService.sendMessage({
      clientEin,
      user,
      message,
      history: history || [],
    });
    return { reply };
  }
}
