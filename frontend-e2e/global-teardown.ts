import { rmSync, existsSync } from 'node:fs';

export default async function globalTeardown() {
  const tempRoot = process.env.BERTH_E2E_TEMP_ROOT;
  if (tempRoot && existsSync(tempRoot)) {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}
