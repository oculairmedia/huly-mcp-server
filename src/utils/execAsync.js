import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function execAsync(command, options = {}) {
  const timeoutMs =
    options.timeout || parseInt(process.env.HULY_GIT_TIMEOUT_MS || '5000', 10);
  const cwd = options.cwd || process.cwd();
  const encoding = options.encoding || 'utf8';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { stdout, stderr } = await execPromise(command, {
      cwd,
      encoding,
      signal: controller.signal,
      maxBuffer: options.maxBuffer || 1024 * 1024,
    });

    clearTimeout(timeoutId);
    return { stdout, stderr, error: null };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError' || error.code === 'ABORT_ERR') {
      const timeoutError = new Error(`Command timed out after ${timeoutMs}ms: ${command}`);
      timeoutError.code = 'ETIMEDOUT';
      timeoutError.command = command;
      throw timeoutError;
    }

    throw error;
  }
}
