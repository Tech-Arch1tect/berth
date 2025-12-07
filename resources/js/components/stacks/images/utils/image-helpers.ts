import { formatDistanceToNow } from 'date-fns';

export const formatImageSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const formatCreatedTime = (timestamp: number | string): string => {
  const date = typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(timestamp);
  return formatDistanceToNow(date, { addSuffix: true });
};

export const parseDockerfileCommand = (createdBy: string): string => {
  const command = createdBy
    .replace(/^\/bin\/sh -c #\(nop\) /, '')
    .replace(/^\/bin\/sh -c /, 'RUN ')
    .replace(/^\/bin\/bash -c /, 'RUN ');

  if (command.startsWith('ADD ') || command.startsWith('COPY ')) {
    return command;
  }

  if (command.includes('CMD') && !command.startsWith('RUN')) {
    return command.replace(/^.*CMD/, 'CMD');
  }

  if (command.includes('ENTRYPOINT') && !command.startsWith('RUN')) {
    return command.replace(/^.*ENTRYPOINT/, 'ENTRYPOINT');
  }

  if (command.includes('EXPOSE') && !command.startsWith('RUN')) {
    return command.replace(/^.*EXPOSE/, 'EXPOSE');
  }

  if (command.includes('ENV') && !command.startsWith('RUN')) {
    return command.replace(/^.*ENV/, 'ENV');
  }

  if (command.includes('WORKDIR') && !command.startsWith('RUN')) {
    return command.replace(/^.*WORKDIR/, 'WORKDIR');
  }

  if (command.includes('USER') && !command.startsWith('RUN')) {
    return command.replace(/^.*USER/, 'USER');
  }

  return command;
};

export const getCommandType = (command: string): string => {
  const cmd = command.trim().toUpperCase();
  if (cmd.startsWith('FROM')) return 'FROM';
  if (cmd.startsWith('RUN')) return 'RUN';
  if (cmd.startsWith('COPY')) return 'COPY';
  if (cmd.startsWith('ADD')) return 'ADD';
  if (cmd.startsWith('CMD')) return 'CMD';
  if (cmd.startsWith('ENTRYPOINT')) return 'ENTRYPOINT';
  if (cmd.startsWith('EXPOSE')) return 'EXPOSE';
  if (cmd.startsWith('ENV')) return 'ENV';
  if (cmd.startsWith('WORKDIR')) return 'WORKDIR';
  if (cmd.startsWith('USER')) return 'USER';
  if (cmd.startsWith('VOLUME')) return 'VOLUME';
  if (cmd.startsWith('LABEL')) return 'LABEL';
  if (cmd.startsWith('ARG')) return 'ARG';
  return 'UNKNOWN';
};

export const getCommandColor = (commandType: string): string => {
  switch (commandType) {
    case 'FROM':
      return 'text-blue-600 dark:text-blue-400';
    case 'RUN':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'COPY':
    case 'ADD':
      return 'text-amber-600 dark:text-amber-400';
    case 'CMD':
    case 'ENTRYPOINT':
      return 'text-purple-600 dark:text-purple-400';
    case 'EXPOSE':
      return 'text-pink-600 dark:text-pink-400';
    case 'ENV':
    case 'ARG':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'WORKDIR':
    case 'USER':
      return 'text-blue-600 dark:text-blue-400';
    default:
      return 'text-slate-600 dark:text-slate-400';
  }
};
