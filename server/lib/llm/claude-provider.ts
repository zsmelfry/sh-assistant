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

  protected async *_chatStream(
    messages: ChatMessage[],
    options: Required<ChatOptions>,
  ): AsyncIterable<string> {
    const prompt = this.formatMessages(messages);
    const env = this.cleanEnv();

    const proc = spawn('claude',
      ['-p', '-', '--model', this.model, '--output-format', 'text'],
      { timeout: options.timeout, stdio: ['pipe', 'pipe', 'pipe'], env },
    );

    let stderr = '';
    let spawnError: Error | null = null;
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on('error', (err: Error) => { spawnError = err; });

    proc.stdin.write(prompt);
    proc.stdin.end();

    for await (const chunk of proc.stdout) {
      yield (chunk as Buffer).toString();
    }

    const { code, signal } = await new Promise<{ code: number | null; signal: string | null }>((resolve) => {
      proc.on('close', (c, s) => resolve({ code: c, signal: s }));
    });

    if (spawnError) {
      throw new LlmError(LlmErrorType.PROVIDER_UNAVAILABLE, `无法启动 claude CLI: ${spawnError.message}`, spawnError);
    }

    if (code !== 0) {
      const detail = signal ? `信号 ${signal}` : `退出码 ${code}`;
      throw new LlmError(LlmErrorType.INVALID_RESPONSE, `claude CLI ${detail}: ${stderr || '(无错误输出)'}`, new Error(stderr || signal || `exit ${code}`));
    }
  }

  private execClaude(args: string[], stdin: string, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      const env = this.cleanEnv();

      const proc = spawn('claude', args, {
        timeout,
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      });

      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on('error', (err: Error) => {
        reject(new LlmError(LlmErrorType.PROVIDER_UNAVAILABLE, `无法启动 claude CLI: ${err.message}`, err));
      });

      proc.on('close', (code: number | null, signal: string | null) => {
        if (code !== 0) {
          const detail = signal ? `信号 ${signal}` : `退出码 ${code}`;
          reject(new LlmError(LlmErrorType.INVALID_RESPONSE, `claude CLI ${detail}: ${stderr || '(无错误输出)'}`, new Error(stderr || signal || `exit ${code}`)));
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

  /** Strip env vars that interfere with the spawned CLI */
  private cleanEnv(): Record<string, string | undefined> {
    const env = { ...process.env };
    // Prevent nested session / stale SSE port detection
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE_SSE_PORT;
    delete env.CLAUDE_CODE_ENTRYPOINT;
    delete env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
    // NOTE: keep http_proxy/https_proxy — needed for VPN/proxy access to API
    return env;
  }
}
