import { FlashMessage as FlashMessageType } from '../types';
import { cn } from '../utils/cn';
import { theme } from '../theme';

interface FlashMessageProps {
  flash: FlashMessageType;
  className?: string;
}

const alertVariants = theme.alerts.variants;

export default function FlashMessage({ flash, className }: FlashMessageProps) {
  const variantClass =
    alertVariants[flash.type as keyof typeof alertVariants] ?? alertVariants.default;

  return <div className={cn(theme.alerts.base, variantClass, className)}>{flash.message}</div>;
}
