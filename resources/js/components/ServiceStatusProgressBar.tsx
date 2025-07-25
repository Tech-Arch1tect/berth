import { useEffect, useState } from 'react';

interface ProgressBarsProps {
    runningPercentage: number;
    stoppedPercentage: number;
    hasStoppedServices: boolean;
}

function ProgressBars({ runningPercentage, stoppedPercentage, hasStoppedServices }: ProgressBarsProps) {
    const [animate, setAnimate] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setAnimate(true), 50);
        return () => clearTimeout(timer);
    }, []);

    return (
        <>
            <div
                className="absolute left-0 h-full bg-green-500 transition-all duration-700 ease-out"
                style={{
                    width: animate ? `${runningPercentage}%` : '0%',
                }}
            />
            {hasStoppedServices && (
                <div
                    className="absolute right-0 h-full bg-red-500 transition-all duration-700 ease-out"
                    style={{
                        width: animate ? `${stoppedPercentage}%` : '0%',
                    }}
                />
            )}
        </>
    );
}

interface ServiceStatusProgressBarProps {
    serviceStatusSummary?: {
        running: number;
        total: number;
    };
    isLoading: boolean;
}

export default function ServiceStatusProgressBar({ serviceStatusSummary, isLoading }: ServiceStatusProgressBarProps) {
    if (!serviceStatusSummary) return null;

    const runningPercentage = (serviceStatusSummary.running / serviceStatusSummary.total) * 100;
    const stoppedPercentage = ((serviceStatusSummary.total - serviceStatusSummary.running) / serviceStatusSummary.total) * 100;
    const hasStoppedServices = serviceStatusSummary.running < serviceStatusSummary.total;

    return (
        <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>Service Status</span>
                <span>
                    {serviceStatusSummary.running}/{serviceStatusSummary.total} running
                </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                {!isLoading ? (
                    <ProgressBars
                        runningPercentage={runningPercentage}
                        stoppedPercentage={stoppedPercentage}
                        hasStoppedServices={hasStoppedServices}
                    />
                ) : (
                    <div className="h-full animate-pulse bg-gradient-to-r from-secondary via-muted to-secondary bg-[length:200%_100%]" />
                )}
            </div>
        </div>
    );
}
