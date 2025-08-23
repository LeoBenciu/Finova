import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { spawn } from 'child_process';
import * as path from 'path';

interface SendMessageParams {
  clientEin: string;
  user: User;
  message: string;
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly pythonBin: string;
  private readonly timeoutMs: number;
  private readonly pythonCwd: string;

  constructor(private readonly config: ConfigService) {
    this.pythonBin = this.config.get<string>('PYTHON_BIN') || 'python3';
    this.timeoutMs = Number(this.config.get<string>('CHAT_ASSISTANT_TIMEOUT_MS') || 60000);
    // Resolve to agents folder even when compiled to dist; allow override
    const configuredCwd = this.config.get<string>('CHAT_ASSISTANT_CWD');
    this.pythonCwd = configuredCwd || path.resolve(__dirname, '../../../agents/first_crew_finova/src');
  }

  async sendMessage({ clientEin, user, message, history }: SendMessageParams): Promise<string> {
    const pythonCmd = this.pythonBin;

    this.logger.log(`Spawning Python assistant for EIN ${clientEin} by user ${user.id}`);
    if (!process.env.OPENAI_API_KEY) {
      this.logger.warn('OPENAI_API_KEY is not set in environment; Chat assistant may fail to run.');
    }

    return new Promise<string>((resolve, reject) => {
      // Run as a module to keep package imports working: python3 -m chat_assistant_crew.main
      const child = spawn(pythonCmd, ['-m', 'chat_assistant_crew.main', '--client-ein', clientEin], {
        cwd: this.pythonCwd,
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';

      const timeoutMs = this.timeoutMs;
      const timeoutHandle = setTimeout(() => {
        this.logger.error('Python assistant timed out');
        try { child.kill('SIGKILL'); } catch {}
        reject(new Error('Chat assistant timed out'));
      }, timeoutMs);

      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;
      });

      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
      });

      child.on('error', (err) => {
        clearTimeout(timeoutHandle);
        this.logger.error(`Failed to start Python assistant: ${err.message}`);
        reject(err);
      });

      child.on('close', (code) => {
        clearTimeout(timeoutHandle);
        this.logger.debug(`Python assistant exited with code ${code}`);
        if (code !== 0 && stderr) {
          this.logger.error(stderr);
        }
        // Parse the assistant reply from stdout
        // Look for the last line that starts with "Assistant: "
        const lines = stdout.split(/\r?\n/).map((l) => l.trim());
        let reply = '';
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i];
          if (line.toLowerCase().startsWith('assistant:')) {
            reply = line.replace(/^assistant:\s*/i, '');
            break;
          }
        }
        if (!reply) {
          // Fallback: try to extract chunk after the last "Assistant:" occurrence in whole stdout
          const idx = stdout.toLowerCase().lastIndexOf('assistant:');
          if (idx >= 0) {
            reply = stdout.slice(idx + 'assistant:'.length).trim();
          }
        }
        if (!reply) {
          this.logger.warn('Could not parse assistant reply, returning raw output');
          reply = stdout.trim() || 'No response';
        }
        resolve(reply);
      });

      // Compose single-turn input: include minimal context header, then history snapshot and the message
      const contextHeader = `User: ${user.email || user.name || user.id}`;
      const historySummary = history
        .slice(-10)
        .map((h) => `${h.role}: ${h.content}`)
        .join('\n');

      const inputPayload = `${contextHeader}\n${historySummary ? historySummary + '\n' : ''}${message}\n\n`;
      child.stdin.write(inputPayload);
      child.stdin.end();
    });
  }
}
