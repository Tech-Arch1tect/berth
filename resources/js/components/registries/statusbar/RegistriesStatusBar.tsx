import type { FC } from 'react';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface RegistriesStatusBarProps {
  credentialCount: number;
}

export const RegistriesStatusBar: FC<RegistriesStatusBarProps> = ({ credentialCount }) => {
  return (
    <div className="flex items-center justify-between">
      <span className={cn('text-sm', theme.text.standard)}>
        {credentialCount === 0
          ? 'No credentials configured'
          : credentialCount === 1
            ? '1 credential configured'
            : `${credentialCount} credentials configured`}
      </span>
    </div>
  );
};
