import { spawn } from 'node:child_process';
import { BaseLlmProvider } from './base-provider';
import type { ChatMessage, ChatOptions, ProviderType } from './types';
import { LlmError, LlmErrorType } from './types';

export type ClaudeModel = 'opus' | 'sonnet' | 'haiku';

export class ClaudeProvider extends BaseLlmProvider {
  constructor(private readonly model: ClaudeModel = 'haiku') {
    super();
  }

  getType(): ProviderType {
    return 'claude';
  }

  getModelName(): string {
    return this.model;
  }

  protected async _checkAvailability(): Promise<boolean> {
    try {
      await this.execClaude(['--version'], '', 5000);
      return true;
    } catch {
      return false;
    }
  }

  protected async _chat(
    messages: ChatMessage[],
    options: Required<ChatOptions>,
  ): Promise<string> {
    const prompt = this.formatMessages(messages);

    try {
      const stdout = await this.execClaude(
        ['-p', '-', '--model', this.model, '--output-format', 'text'],
        prompt,
        options.timeout,
      );
      return stdout.trim();
    } catch (error) {
      if (error instanceof LlmError) throw error;
      throw new LlmError(
        LlmErrorType.INVALID_RESPONSE,
        `Claude 调用失败: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  private execClaude(args: string[], stdin: string, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      // Strip CLAUDECODE env var so the CLI doesn't reject "nested session"
      const env = { ...process.env };
      delete env.CLAUDECODE;

      const proc = spawn('claude', args, {
        timeout,
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      });

      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on('error', (err: Error) => {
        reject(new LlmError(
          LlmErrorType.PROVIDER_UNAVAILABLE,
          `无法启动 claude CLI: ${err.message}`,
          err,
        ));
      });

      proc.on('close', (code: number | null) => {
        if (code !== 0) {
          reject(new LlmError(
            LlmErrorType.INVALID_RESPONSE,
            `claude CLI 退出码 ${code}: ${stderr}`,
            new Error(stderr),
          ));
          return;
        }
        resolve(stdout);
      });

      if (stdin) {
        proc.stdin.write(stdin);
      }
      proc.stdin.end();
    });
  }
}
