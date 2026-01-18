import React, { useState } from 'react';
import { PlusIcon, TrashIcon, ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { Modal } from '../../common/Modal';
import { LoadingSpinner } from '../../common/LoadingSpinner';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { NewServiceConfig, PortMappingChange } from '../../../types/compose';

interface AddServiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, config: NewServiceConfig) => Promise<void>;
  existingServices: string[];
}

type Step = 'name' | 'image' | 'ports' | 'environment' | 'review';

const STEPS: Step[] = ['name', 'image', 'ports', 'environment', 'review'];

const STEP_LABELS: Record<Step, string> = {
  name: 'Service Name',
  image: 'Image',
  ports: 'Ports',
  environment: 'Environment',
  review: 'Review',
};

const RESTART_POLICIES = [
  { value: '', label: 'None' },
  { value: 'no', label: 'No' },
  { value: 'always', label: 'Always' },
  { value: 'on-failure', label: 'On Failure' },
  { value: 'unless-stopped', label: 'Unless Stopped' },
];

export const AddServiceDialog: React.FC<AddServiceDialogProps> = ({
  isOpen,
  onClose,
  onAdd,
  existingServices,
}) => {
  const [currentStep, setCurrentStep] = useState<Step>('name');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [serviceName, setServiceName] = useState('');
  const [image, setImage] = useState('');
  const [restart, setRestart] = useState('');
  const [ports, setPorts] = useState<PortMappingChange[]>([]);
  const [environment, setEnvironment] = useState<Record<string, string>>({});

  const currentStepIndex = STEPS.indexOf(currentStep);

  const resetForm = () => {
    setCurrentStep('name');
    setServiceName('');
    setImage('');
    setRestart('');
    setPorts([]);
    setEnvironment({});
    setError(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateStep = (): boolean => {
    setError(null);
    switch (currentStep) {
      case 'name':
        if (!serviceName.trim()) {
          setError('Service name is required');
          return false;
        }
        if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(serviceName)) {
          setError(
            'Service name must start with a letter and contain only letters, numbers, hyphens, and underscores'
          );
          return false;
        }
        if (existingServices.includes(serviceName)) {
          setError('A service with this name already exists');
          return false;
        }
        return true;
      case 'image':
        if (!image.trim()) {
          setError('Image is required');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep()) return;
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  };

  const handlePrevious = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    const config: NewServiceConfig = {
      image: image.trim(),
      restart: restart || undefined,
      ports: ports.length > 0 ? ports : undefined,
      environment: Object.keys(environment).length > 0 ? environment : undefined,
    };

    setIsSubmitting(true);
    setError(null);

    try {
      await onAdd(serviceName.trim(), config);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add service');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPort = () => {
    setPorts([...ports, { target: '80', published: '80' }]);
  };

  const handleUpdatePort = (index: number, updates: Partial<PortMappingChange>) => {
    const updated = [...ports];
    updated[index] = { ...updated[index], ...updates };
    setPorts(updated);
  };

  const handleRemovePort = (index: number) => {
    setPorts(ports.filter((_, i) => i !== index));
  };

  const handleAddEnvVar = () => {
    let key = 'VAR';
    let i = 1;
    while (Object.prototype.hasOwnProperty.call(environment, key)) {
      key = `VAR_${i++}`;
    }
    setEnvironment({ ...environment, [key]: '' });
  };

  const handleUpdateEnvVar = (oldKey: string, newKey: string, value: string) => {
    const updated: Record<string, string> = {};
    for (const [k, v] of Object.entries(environment)) {
      if (k === oldKey) {
        updated[newKey] = value;
      } else {
        updated[k] = v;
      }
    }
    setEnvironment(updated);
  };

  const handleRemoveEnvVar = (key: string) => {
    const { [key]: _, ...rest } = environment;
    setEnvironment(rest);
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((step, index) => (
        <React.Fragment key={step}>
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
              index < currentStepIndex
                ? 'bg-teal-600 text-white'
                : index === currentStepIndex
                  ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-400 ring-2 ring-teal-600'
                  : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
            )}
          >
            {index + 1}
          </div>
          {index < STEPS.length - 1 && (
            <div
              className={cn(
                'w-8 h-0.5',
                index < currentStepIndex ? 'bg-teal-600' : 'bg-zinc-200 dark:bg-zinc-700'
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderNameStep = () => (
    <div className="space-y-4">
      <div>
        <label className={cn('block text-sm font-medium mb-2', theme.text.standard)}>
          Service Name
        </label>
        <input
          type="text"
          value={serviceName}
          onChange={(e) => setServiceName(e.target.value)}
          placeholder="my-service"
          autoFocus
          className={cn(
            'w-full px-3 py-2 text-sm rounded-lg border font-mono',
            'bg-white text-zinc-900 placeholder:text-zinc-400',
            'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
            'border-zinc-200 dark:border-zinc-700',
            'focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
          )}
        />
        <p className={cn('text-xs mt-1', theme.text.subtle)}>
          Must start with a letter. Can contain letters, numbers, hyphens, and underscores.
        </p>
      </div>
    </div>
  );

  const renderImageStep = () => (
    <div className="space-y-4">
      <div>
        <label className={cn('block text-sm font-medium mb-2', theme.text.standard)}>
          Docker Image
        </label>
        <input
          type="text"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          placeholder="nginx:latest"
          autoFocus
          className={cn(
            'w-full px-3 py-2 text-sm rounded-lg border font-mono',
            'bg-white text-zinc-900 placeholder:text-zinc-400',
            'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
            'border-zinc-200 dark:border-zinc-700',
            'focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
          )}
        />
        <p className={cn('text-xs mt-1', theme.text.subtle)}>
          e.g., nginx:latest, postgres:16, ghcr.io/owner/repo:tag
        </p>
      </div>

      <div>
        <label className={cn('block text-sm font-medium mb-2', theme.text.standard)}>
          Restart Policy
        </label>
        <select
          value={restart}
          onChange={(e) => setRestart(e.target.value)}
          className={cn(
            'w-full px-3 py-2 text-sm rounded-lg border',
            'bg-white text-zinc-900',
            'dark:bg-zinc-900 dark:text-white',
            'border-zinc-200 dark:border-zinc-700',
            'focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
          )}
        >
          {RESTART_POLICIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  const renderPortsStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className={cn('text-sm font-medium', theme.text.standard)}>Port Mappings</label>
        <button
          type="button"
          onClick={handleAddPort}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
            'bg-teal-100 text-teal-700 hover:bg-teal-200',
            'dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50'
          )}
        >
          <PlusIcon className="w-3 h-3" />
          Add Port
        </button>
      </div>

      {ports.length === 0 ? (
        <p className={cn('text-sm italic py-4', theme.text.muted)}>
          No ports configured. Click "Add Port" to expose a port.
        </p>
      ) : (
        <div className="space-y-2">
          {ports.map((port, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={port.published || ''}
                onChange={(e) => handleUpdatePort(index, { published: e.target.value })}
                placeholder="Host"
                className={cn(
                  'w-24 px-2 py-1.5 text-sm rounded border font-mono',
                  'bg-white text-zinc-900 placeholder:text-zinc-400',
                  'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
                  'border-zinc-200 dark:border-zinc-700',
                  'focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
                )}
              />
              <span className={theme.text.muted}>:</span>
              <input
                type="text"
                value={port.target}
                onChange={(e) => handleUpdatePort(index, { target: e.target.value })}
                placeholder="Container"
                className={cn(
                  'w-24 px-2 py-1.5 text-sm rounded border font-mono',
                  'bg-white text-zinc-900 placeholder:text-zinc-400',
                  'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
                  'border-zinc-200 dark:border-zinc-700',
                  'focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
                )}
              />
              <select
                value={port.protocol || 'tcp'}
                onChange={(e) => handleUpdatePort(index, { protocol: e.target.value })}
                className={cn(
                  'w-20 px-2 py-1.5 text-sm rounded border',
                  'bg-white text-zinc-900',
                  'dark:bg-zinc-900 dark:text-white',
                  'border-zinc-200 dark:border-zinc-700',
                  'focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
                )}
              >
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
              </select>
              <button
                type="button"
                onClick={() => handleRemovePort(index)}
                className={cn(
                  'p-1.5 rounded',
                  'text-zinc-400 hover:text-rose-500 hover:bg-rose-50',
                  'dark:hover:bg-rose-900/20'
                )}
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderEnvironmentStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className={cn('text-sm font-medium', theme.text.standard)}>
          Environment Variables
        </label>
        <button
          type="button"
          onClick={handleAddEnvVar}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
            'bg-teal-100 text-teal-700 hover:bg-teal-200',
            'dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50'
          )}
        >
          <PlusIcon className="w-3 h-3" />
          Add Variable
        </button>
      </div>

      {Object.keys(environment).length === 0 ? (
        <p className={cn('text-sm italic py-4', theme.text.muted)}>
          No environment variables. Click "Add Variable" to add one.
        </p>
      ) : (
        <div className="space-y-2">
          {Object.entries(environment).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <input
                type="text"
                value={key}
                onChange={(e) => handleUpdateEnvVar(key, e.target.value, value)}
                placeholder="KEY"
                className={cn(
                  'w-1/3 px-2 py-1.5 text-sm rounded border font-mono',
                  'bg-white text-zinc-900 placeholder:text-zinc-400',
                  'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
                  'border-zinc-200 dark:border-zinc-700',
                  'focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
                )}
              />
              <span className={theme.text.muted}>=</span>
              <input
                type="text"
                value={value}
                onChange={(e) => handleUpdateEnvVar(key, key, e.target.value)}
                placeholder="value"
                className={cn(
                  'flex-1 px-2 py-1.5 text-sm rounded border font-mono',
                  'bg-white text-zinc-900 placeholder:text-zinc-400',
                  'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
                  'border-zinc-200 dark:border-zinc-700',
                  'focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
                )}
              />
              <button
                type="button"
                onClick={() => handleRemoveEnvVar(key)}
                className={cn(
                  'p-1.5 rounded',
                  'text-zinc-400 hover:text-rose-500 hover:bg-rose-50',
                  'dark:hover:bg-rose-900/20'
                )}
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-4">
      <h4 className={cn('text-sm font-medium', theme.text.strong)}>Review New Service</h4>

      <div className="space-y-3 text-sm">
        <div className="flex">
          <span className={cn('w-32', theme.text.muted)}>Name:</span>
          <span className={cn('font-mono', theme.text.standard)}>{serviceName}</span>
        </div>
        <div className="flex">
          <span className={cn('w-32', theme.text.muted)}>Image:</span>
          <span className={cn('font-mono', theme.text.standard)}>{image}</span>
        </div>
        {restart && (
          <div className="flex">
            <span className={cn('w-32', theme.text.muted)}>Restart:</span>
            <span className={theme.text.standard}>{restart}</span>
          </div>
        )}
        {ports.length > 0 && (
          <div className="flex">
            <span className={cn('w-32', theme.text.muted)}>Ports:</span>
            <span className={cn('font-mono', theme.text.standard)}>
              {ports
                .map((p) => `${p.published || p.target}:${p.target}/${p.protocol || 'tcp'}`)
                .join(', ')}
            </span>
          </div>
        )}
        {Object.keys(environment).length > 0 && (
          <div>
            <span className={cn('block mb-1', theme.text.muted)}>Environment:</span>
            <div className={cn('ml-4 font-mono text-xs', theme.text.standard)}>
              {Object.entries(environment).map(([k, v]) => (
                <div key={k}>
                  {k}={v || '(empty)'}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'name':
        return renderNameStep();
      case 'image':
        return renderImageStep();
      case 'ports':
        return renderPortsStep();
      case 'environment':
        return renderEnvironmentStep();
      case 'review':
        return renderReviewStep();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add New Service" size="md">
      <div className="space-y-4">
        {renderStepIndicator()}

        <div className="text-center mb-4">
          <span className={cn('text-sm font-medium', theme.text.muted)}>
            Step {currentStepIndex + 1}: {STEP_LABELS[currentStep]}
          </span>
        </div>

        {renderCurrentStep()}

        {error && (
          <div
            className={cn(
              'text-sm p-3 rounded-lg',
              'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'
            )}
          >
            {error}
          </div>
        )}

        <div className="flex justify-between pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={currentStepIndex === 0 ? handleClose : handlePrevious}
            disabled={isSubmitting}
            className={cn(
              theme.buttons.secondary,
              'inline-flex items-center gap-1',
              isSubmitting && 'opacity-50 cursor-not-allowed'
            )}
          >
            <ArrowLeftIcon className="w-4 h-4" />
            {currentStepIndex === 0 ? 'Cancel' : 'Back'}
          </button>

          {currentStep === 'review' ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={cn(
                theme.buttons.primary,
                'inline-flex items-center gap-1',
                isSubmitting && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="sm" />
                  Adding...
                </>
              ) : (
                <>
                  <PlusIcon className="w-4 h-4" />
                  Add Service
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className={cn(theme.buttons.primary, 'inline-flex items-center gap-1')}
            >
              Next
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
