import { rmSync, existsSync } from 'node:fs';

export default async function globalTeardown() {
  const handle = global.__berthE2E;
  if (!handle) return;

  const { proc, tempDir } = handle;
  global.__berthE2E = undefined;

  if (proc.exitCode === null && proc.signalCode === null) {
    proc.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        proc.kill('SIGKILL');
        resolve();
      }, 3000);
      proc.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
