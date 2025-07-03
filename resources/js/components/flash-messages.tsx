import { useEffect, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

interface FlashMessages {
    success?: string;
    error?: string;
    warning?: string;
    info?: string;
}

export default function FlashMessages() {
    const { flash } = usePage().props as { flash?: FlashMessages };
    const [visible, setVisible] = useState<Record<string, boolean>>({});

    useEffect(() => {
        // If no flash messages, don't do anything
        if (!flash) return;
        // Show any new flash messages
        const newVisible: Record<string, boolean> = {};
        Object.entries(flash).forEach(([type, message]) => {
            if (message) {
                newVisible[type] = true;
                // Auto-hide success messages after 4 seconds
                if (type === 'success') {
                    setTimeout(() => {
                        setVisible(prev => ({ ...prev, [type]: false }));
                    }, 4000);
                }
                // Auto-hide info messages after 5 seconds
                if (type === 'info') {
                    setTimeout(() => {
                        setVisible(prev => ({ ...prev, [type]: false }));
                    }, 5000);
                }
            }
        });
        setVisible(newVisible);
    }, [flash]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'success':
                return <CheckCircle className="h-4 w-4" />;
            case 'error':
                return <AlertCircle className="h-4 w-4" />;
            case 'warning':
                return <AlertTriangle className="h-4 w-4" />;
            case 'info':
                return <Info className="h-4 w-4" />;
            default:
                return null;
        }
    };

    const getAlertClass = (type: string) => {
        switch (type) {
            case 'success':
                return 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200';
            case 'error':
                return 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200';
            case 'warning':
                return 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200';
            case 'info':
                return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200';
            default:
                return '';
        }
    };

    // If no flash messages, don't render anything
    if (!flash) return null;

    return (
        <div className="space-y-2">
            {Object.entries(flash).map(([type, message]) => 
                message && visible[type] ? (
                    <Alert key={type} className={`${getAlertClass(type)} transition-all duration-300`}>
                        {getIcon(type)}
                        <AlertDescription className="flex items-start justify-between w-full">
                            <span className="flex-1">{message}</span>
                            <button
                                onClick={() => setVisible(prev => ({ ...prev, [type]: false }))}
                                className="flex-shrink-0 text-current opacity-70 hover:opacity-100 transition-opacity ml-4"
                            >
                                ×
                            </button>
                        </AlertDescription>
                    </Alert>
                ) : null
            )}
        </div>
    );
}