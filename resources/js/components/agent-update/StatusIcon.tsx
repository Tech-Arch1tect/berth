import {
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  MinusCircleIcon,
} from '@heroicons/react/24/outline';
import { UpdateStatus } from '../../types/agent-update';

interface StatusIconProps {
  status: UpdateStatus;
}

export function StatusIcon({ status }: StatusIconProps) {
  switch (status) {
    case 'success':
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    case 'failed':
      return <XCircleIcon className="h-5 w-5 text-red-500" />;
    case 'skipped':
      return <MinusCircleIcon className="h-5 w-5 text-gray-400" />;
    case 'pending':
      return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    default:
      return <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />;
  }
}

export function getStatusLabel(status: UpdateStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'updating_image':
      return 'Updating image tags...';
    case 'pulling':
      return 'Pulling images...';
    case 'restarting':
      return 'Restarting agent...';
    case 'health_check':
      return 'Health check...';
    case 'success':
      return 'Success';
    case 'failed':
      return 'Failed';
    case 'skipped':
      return 'Skipped';
    default:
      return status;
  }
}
