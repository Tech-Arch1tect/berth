import type { DockerOperationRequest } from '../types';

export type OptionValueSpec =
  | { kind: 'none' }
  | { kind: 'enum'; choices: string[]; defaultValue: string }
  | { kind: 'number'; defaultValue: string; min: number; max?: number }
  | { kind: 'scale'; defaultValue: string };

export interface CommandOptionSpec {
  flag: string;
  description: string;
  value: OptionValueSpec;
}

const dryRun = (): CommandOptionSpec => ({
  flag: '--dry-run',
  description: 'Preview the command without changing anything',
  value: { kind: 'none' },
});

const shutdownTimeout = (max = 300): CommandOptionSpec => ({
  flag: '--timeout',
  description: 'Shutdown timeout in seconds',
  value: { kind: 'number', defaultValue: '30', min: 1, max },
});

export const commandOptionCatalog: Record<DockerOperationRequest['command'], CommandOptionSpec[]> =
  {
    up: [
      {
        flag: '--always-recreate-deps',
        description: 'Recreate dependent containers',
        value: { kind: 'none' },
      },
      {
        flag: '--build',
        description: 'Build images before starting containers',
        value: { kind: 'none' },
      },
      dryRun(),
      {
        flag: '--force-recreate',
        description: 'Recreate containers even if unchanged',
        value: { kind: 'none' },
      },
      {
        flag: '--no-build',
        description: "Don't build images, even when the compose file builds them",
        value: { kind: 'none' },
      },
      { flag: '--no-deps', description: "Don't start linked services", value: { kind: 'none' } },
      {
        flag: '--no-recreate',
        description: 'Keep existing containers, do not recreate them',
        value: { kind: 'none' },
      },
      {
        flag: '--no-start',
        description: 'Create the services without starting them',
        value: { kind: 'none' },
      },
      {
        flag: '--pull',
        description: 'Pull images before starting',
        value: { kind: 'enum', choices: ['always', 'missing', 'never'], defaultValue: 'missing' },
      },
      { flag: '--quiet-build', description: 'Suppress the build output', value: { kind: 'none' } },
      {
        flag: '--quiet-pull',
        description: 'Pull without printing progress information',
        value: { kind: 'none' },
      },
      {
        flag: '--remove-orphans',
        description: 'Remove containers not in the compose file',
        value: { kind: 'none' },
      },
      {
        flag: '--renew-anon-volumes',
        description: 'Recreate anonymous volumes instead of reusing them',
        value: { kind: 'none' },
      },
      {
        flag: '--scale',
        description: 'Scale a service to N instances (service=2)',
        value: { kind: 'scale', defaultValue: '' },
      },
      shutdownTimeout(),
      {
        flag: '--wait',
        description: 'Wait for services to be running or healthy',
        value: { kind: 'none' },
      },
      {
        flag: '--wait-timeout',
        description: 'Maximum seconds to wait for services to be running or healthy',
        value: { kind: 'number', defaultValue: '60', min: 1 },
      },
      {
        flag: '--yes',
        description: 'Assume yes for every prompt and run non-interactively',
        value: { kind: 'none' },
      },
    ],
    down: [
      dryRun(),
      {
        flag: '--remove-orphans',
        description: 'Remove containers not in the compose file',
        value: { kind: 'none' },
      },
      {
        flag: '--rmi',
        description: 'Remove images used by the services',
        value: { kind: 'enum', choices: ['local', 'all'], defaultValue: 'local' },
      },
      shutdownTimeout(),
      {
        flag: '--volumes',
        description: 'Remove named and anonymous volumes',
        value: { kind: 'none' },
      },
    ],
    start: [
      dryRun(),
      {
        flag: '--wait',
        description: 'Wait for services to be running or healthy',
        value: { kind: 'none' },
      },
      {
        flag: '--wait-timeout',
        description: 'Maximum seconds to wait for services to be running or healthy',
        value: { kind: 'number', defaultValue: '60', min: 1 },
      },
    ],
    stop: [dryRun(), shutdownTimeout()],
    restart: [
      dryRun(),
      {
        flag: '--no-deps',
        description: "Don't restart dependent services",
        value: { kind: 'none' },
      },
      shutdownTimeout(),
    ],
    pull: [
      dryRun(),
      {
        flag: '--ignore-buildable',
        description: 'Skip images that can be built',
        value: { kind: 'none' },
      },
      {
        flag: '--ignore-pull-failures',
        description: 'Continue despite pull failures',
        value: { kind: 'none' },
      },
      {
        flag: '--include-deps',
        description: 'Also pull services declared as dependencies',
        value: { kind: 'none' },
      },
      {
        flag: '--policy',
        description: 'Pull images always or only when missing',
        value: { kind: 'enum', choices: ['missing', 'always'], defaultValue: 'missing' },
      },
      {
        flag: '--quiet',
        description: 'Pull without progress information',
        value: { kind: 'none' },
      },
    ],
  };

export const scaleValuePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*=\d+$/;

export function optionValueIsValid(spec: CommandOptionSpec, value: string): boolean {
  switch (spec.value.kind) {
    case 'none':
      return true;
    case 'enum':
      return spec.value.choices.includes(value);
    case 'number':
      return (
        /^\d+$/.test(value) &&
        Number(value) >= spec.value.min &&
        (spec.value.max === undefined || Number(value) <= spec.value.max)
      );
    case 'scale':
      return scaleValuePattern.test(value);
  }
}

export function buildOptionsPayload(
  command: DockerOperationRequest['command'],
  selectedFlags: string[],
  values: Record<string, string>
): string[] {
  const options: string[] = [];
  for (const flag of selectedFlags) {
    const spec = commandOptionCatalog[command].find((candidate) => candidate.flag === flag);
    if (!spec) {
      continue;
    }
    if (spec.value.kind === 'none') {
      options.push(flag);
      continue;
    }
    const value = values[flag];
    if (value && optionValueIsValid(spec, value)) {
      options.push(flag, value);
    }
  }
  return options;
}
