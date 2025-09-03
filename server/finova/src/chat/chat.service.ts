import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

interface SendMessageParams {
  clientEin: string;
  user: User;
  message: string;
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  authorization?: string;
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
    if (configuredCwd) {
      this.pythonCwd = configuredCwd;
      this.logger.log(`Chat assistant CWD (from env): ${this.pythonCwd}`);
    } else {
      // Try both possible layouts:
      // - Current Nest build layout: dist/... (two levels up to reach repo root)
      // - Older layout: dist/src/... (three levels up)
      const candidateA = path.resolve(__dirname, '../../agents/first_crew_finova/src');
      const candidateB = path.resolve(__dirname, '../../../agents/first_crew_finova/src');
      const chosen = fs.existsSync(candidateA)
        ? candidateA
        : fs.existsSync(candidateB)
        ? candidateB
        : candidateA; // default to A if neither exists
      this.pythonCwd = chosen;
      this.logger.log(
        `Chat assistant CWD (auto-detected). A: ${candidateA} B: ${candidateB} -> using: ${this.pythonCwd}`,
      );
      if (!fs.existsSync(this.pythonCwd)) {
        this.logger.warn(
          `Chat assistant CWD does not exist: ${this.pythonCwd}. Set CHAT_ASSISTANT_CWD to override.`,
        );
      }
    }
  }

  async sendMessage({ clientEin, user, message, history, authorization }: SendMessageParams): Promise<string> {
    const pythonCmd = this.pythonBin;

    this.logger.log(`Spawning Python assistant for EIN ${clientEin} by user ${user.id}`);
    if (!process.env.OPENAI_API_KEY) {
      this.logger.warn('OPENAI_API_KEY is not set in environment; Chat assistant may fail to run.');
    }

    return new Promise<string>((resolve, reject) => {
      // Build args for Python module execution
      const args = ['-m', 'chat_assistant_crew.main', '--client-ein', clientEin];

      // If we have chat history, write it to a temp JSON file and pass the path via --chat-history
      let tempHistoryPath: string | null = null;
      try {
        if (history && history.length > 0) {
          tempHistoryPath = path.join(
            os.tmpdir(),
            `finova_chat_history_${Date.now()}_${process.pid}.json`,
          );
          fs.writeFileSync(tempHistoryPath, JSON.stringify(history.slice(-50), null, 2), 'utf-8');
          args.push('--chat-history', tempHistoryPath);
        }
      } catch (e) {
        this.logger.warn(`Failed to prepare chat history file: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Run as a module to keep package imports working: python3 -m chat_assistant_crew.main
      // Prepare env for Python process, including backend access for tools
      const envVars: NodeJS.ProcessEnv = { ...process.env };
      // Forward JWT for backend access by tools
      if (authorization) {
        const token = authorization.startsWith('Bearer ')
          ? authorization.slice('Bearer '.length)
          : authorization;
        envVars['BACKEND_JWT'] = token;
        envVars['BANK_API_TOKEN'] = token; // alt name used by some tools
      }
      // Base API URL for backend HTTP tools (robust fallbacks for Render/local)
      // Priority: explicit env vars > Render external URL > localhost fallback
      const backendUrl = process.env.BACKEND_API_URL || 
                        process.env.BANK_BACKEND_URL || 
                        process.env.RENDER_EXTERNAL_URL || 
                        `http://localhost:${process.env.PORT || 3000}`;
      
      envVars['BACKEND_API_URL'] = backendUrl;
      envVars['BANK_BACKEND_URL'] = backendUrl;
      // Provide client EIN context directly
      envVars['CLIENT_EIN'] = clientEin;

      // Log the configuration for debugging
      this.logger.debug(`Python process environment: BACKEND_API_URL=${envVars['BACKEND_API_URL']}, CLIENT_EIN=${envVars['CLIENT_EIN']}`);
      
      // Log all relevant environment variables being passed to Python
      const relevantEnvVars = {
        BACKEND_API_URL: envVars['BACKEND_API_URL'],
        BANK_BACKEND_URL: envVars['BANK_BACKEND_URL'],
        BACKEND_JWT: envVars['BACKEND_JWT'] ? '***SET***' : 'NOT_SET',
        BANK_API_TOKEN: envVars['BANK_API_TOKEN'] ? '***SET***' : 'NOT_SET',
        CLIENT_EIN: envVars['CLIENT_EIN'],
        SMTP_HOST: envVars['SMTP_HOST'],
        SMTP_PORT: envVars['SMTP_PORT'],
        SMTP_USER: envVars['SMTP_USER'] ? '***SET***' : 'NOT_SET',
        SMTP_PASS: envVars['SMTP_PASS'] ? '***SET***' : 'NOT_SET',
        SMTP_FROM: envVars['SMTP_FROM']
      };
      this.logger.debug(`Python process environment variables: ${JSON.stringify(relevantEnvVars, null, 2)}`);
      
      // Log the Python command being executed
      this.logger.debug(`Executing Python command: ${pythonCmd} ${args.join(' ')}`);
      this.logger.debug(`Python working directory: ${this.pythonCwd}`);

      const child = spawn(pythonCmd, args, {
        cwd: this.pythonCwd,
        env: envVars,
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
        // Mirror Python stdout to Nest logger at debug level for observability
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) this.logger.debug(`[PY][out] ${line}`);
        }
      });

      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        // Mirror Python stderr to Nest logger at warn level
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) this.logger.warn(`[PY][err] ${line}`);
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeoutHandle);
        this.logger.error(`Failed to start Python assistant: ${err.message}`);
        reject(err);
      });

      child.on('close', async (code) => {
        clearTimeout(timeoutHandle);
        this.logger.debug(`Python assistant exited with code ${code}`);
        if (code !== 0 && stderr) {
          this.logger.error(stderr);
        }
        // Cleanup temp history file if created
        if (tempHistoryPath) {
          try { fs.unlinkSync(tempHistoryPath); } catch {}
        }
        // Parse the assistant reply from stdout
        // Capture the entire block after the last line that starts with "Assistant:"
        const rawLines = stdout.split(/\r?\n/);
        let reply = '';
        for (let i = rawLines.length - 1; i >= 0; i--) {
          const line = rawLines[i].trim();
          if (line.toLowerCase().startsWith('assistant:')) {
            // Join from this line to the end, while stripping the label only on the first line
            const block = rawLines.slice(i).join('\n');
            reply = block.replace(/^[ \t]*assistant:\s*/i, '');
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
        // Additional fallback: if reply is still empty or looks like an initialization banner, call LLM directly
        const isOnlyInit = !reply && /initializing\s+chat\s+assistant/i.test(stdout);
        const looksLikeInitReply = reply && /initializing\s+chat\s+assistant/i.test(reply);
        try {
          if (!reply || isOnlyInit || looksLikeInitReply) {
            this.logger.warn('Assistant reply not found or only initialization text. Falling back to direct LLM call.');
            const llmReply = await this.fallbackLLMReply({ user, message, history });
            resolve(llmReply);
            return;
          }
        } catch (e) {
          this.logger.error(`Fallback LLM call failed: ${e instanceof Error ? e.message : String(e)}`);
          // proceed to final raw stdout fallback
        }

        if (!reply) {
          this.logger.warn('Could not parse assistant reply, returning raw output');
          reply = stdout.trim() || 'No response';
        }
        resolve(reply);
      });

      // Compose stdin: send only the raw user message so the Python agent treats it as a single turn
      const inputPayload = `${message}\n`;
      child.stdin.write(inputPayload);
      child.stdin.end();
    });
  }

  private async fallbackLLMReply({
    user,
    message,
    history,
  }: {
    user: User;
    message: string;
    history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  }): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      this.logger.error('OPENAI_API_KEY is not set; cannot perform fallback LLM call.');
      return 'Assistant is not configured. Please set OPENAI_API_KEY on the server.';
    }

    // Build chat messages: include recent history and the new user message
    const messages = [] as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    messages.push({ role: 'system', content: 'You are a helpful assistant for the Finova application. Answer succinctly.' });
    for (const h of history.slice(-10)) {
      messages.push({ role: h.role === 'system' ? 'system' : h.role, content: h.content });
    }
    const userLabel = user.email || user.name || String(user.id);
    messages.push({ role: 'user', content: `User (${userLabel}) says: ${message}` });

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      this.logger.error(`OpenAI API error: ${res.status} ${res.statusText} ${errText}`);
      return 'Assistant is temporarily unavailable.';
    }

    const data = (await res.json()) as any;
    const content = data?.choices?.[0]?.message?.content?.trim();
    return content || 'No response';
  }
}
