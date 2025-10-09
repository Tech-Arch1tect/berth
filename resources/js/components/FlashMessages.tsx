import { usePage } from '@inertiajs/react';
import { FlashMessage as FlashMessageType } from '../types';
import FlashMessage from './FlashMessage';
import { cn } from '../utils/cn';

interface FlashMessagesProps {
  className?: string;
}

export default function FlashMessages({ className }: FlashMessagesProps) {
  const { props } = usePage();
  const flashMessages = props.flashMessages as FlashMessageType[] | undefined;

  if (!flashMessages || flashMessages.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      {flashMessages.map((message, index) => (
        <FlashMessage
          key={`${message.type}-${index}-${message.message.substring(0, 20)}`}
          flash={message}
        />
      ))}
    </div>
  );
}
