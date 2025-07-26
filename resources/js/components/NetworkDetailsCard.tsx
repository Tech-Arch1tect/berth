import ServiceStatusBadge from '@/components/ServiceStatusBadge';
import { Badge } from '@/components/ui/badge';
import type { NetworkRuntimeInfo, Service, ServiceStatus, StackLike } from '@/types/entities';
import { getServiceDisplayState } from '@/utils/stack-utils';
import { useMemo } from 'react';

interface ServiceConnectionInfo {
    name: string;
    ip_address: string | null;
    gateway: string | null;
    state?: string;
    config?: Service;
}

interface NetworkDetailsCardProps {
    runtimeInfo: NetworkRuntimeInfo;
    networkName: string;
    serviceStatus?: ServiceStatus;
    services: Record<string, Service>;
    stackName?: string;
}

export default function NetworkDetailsCard({ runtimeInfo, networkName, serviceStatus, services, stackName }: NetworkDetailsCardProps) {
    const ipamConfig = useMemo(() => runtimeInfo.ipam?.Config?.[0] || {}, [runtimeInfo.ipam]);

    const connectedServices = useMemo((): ServiceConnectionInfo[] => {
        const results: ServiceConnectionInfo[] = [];
        const matchedRuntimeNames = new Set<string>();

        Object.entries(services).forEach(([serviceName, config]) => {
            const stackLike: StackLike = {
                name: stackName || '',
                service_status: serviceStatus,
                services,
            };
            const { displayState, serviceStatus: runtimeService } = getServiceDisplayState(stackLike, serviceName);

            if (runtimeService?.networks) {
                const networkConnection = runtimeService.networks.find((net) => {
                    const exactMatch = net.name === networkName;
                    const stackPrefixMatch = net.name === `${stackName}_${networkName}` || net.name === `${stackName}-${networkName}`;
                    return exactMatch || stackPrefixMatch;
                });

                if (networkConnection) {
                    matchedRuntimeNames.add(runtimeService.name);
                    results.push({
                        name: serviceName,
                        ip_address: networkConnection.ip_address,
                        gateway: networkConnection.gateway,
                        state: displayState,
                        config,
                    });
                }
            }
        });

        serviceStatus?.services?.forEach((runtimeService) => {
            if (matchedRuntimeNames.has(runtimeService.name)) return;

            const networkConnection = runtimeService.networks?.find((net) => {
                const exactMatch = net.name === networkName;
                const stackPrefixMatch = net.name === `${stackName}_${networkName}` || net.name === `${stackName}-${networkName}`;
                return exactMatch || stackPrefixMatch;
            });
            if (networkConnection) {
                results.push({
                    name: runtimeService.name,
                    ip_address: networkConnection.ip_address,
                    gateway: networkConnection.gateway,
                    state: runtimeService.state,
                });
            }
        });

        return results;
    }, [services, serviceStatus, networkName, stackName]);

    const networkDetails = useMemo(
        () =>
            [
                { label: 'Driver', value: String(runtimeInfo.driver || '') },
                { label: 'Network ID', value: runtimeInfo.id ? String(runtimeInfo.id).substring(0, 12) + '...' : '' },
                { label: 'Subnet', value: String(ipamConfig.Subnet || '') },
                { label: 'Gateway', value: String(ipamConfig.Gateway || '') },
                { label: 'IP Range', value: String(ipamConfig.ip_range || '') },
                { label: 'Internal', value: runtimeInfo.internal === true ? 'Internal network' : '' },
            ].filter((detail) => detail.value),
        [runtimeInfo, ipamConfig],
    );

    if (!runtimeInfo) return null;

    return (
        <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="mb-4">
                <h3 className="text-lg font-semibold text-foreground">{networkName}</h3>
                <p className="text-sm text-muted-foreground">Network configuration and runtime information</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {networkDetails.map(({ label, value }) => (
                    <div
                        key={label}
                        className="rounded-lg border border-border bg-card p-4 shadow-sm transition-all hover:border-border/80 hover:shadow-md"
                    >
                        <div className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</div>
                        <code className="font-mono text-sm font-semibold break-all text-foreground">{value}</code>
                    </div>
                ))}
            </div>
            {connectedServices.length > 0 && (
                <div className="mt-6">
                    <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                        {connectedServices.length} connected service{connectedServices.length !== 1 ? 's' : ''}:
                    </h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {connectedServices.map((service, idx) => {
                            const isRunning = service.state === 'running';
                            const image = service.config?.image || 'Unknown';
                            const restart = service.config?.restart || 'N/A';

                            return (
                                <div
                                    key={`${service.name}-${idx}`}
                                    className="rounded-lg border border-border bg-card transition-all hover:shadow-md"
                                >
                                    <div className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`h-3 w-3 rounded-full transition-all duration-300 ${
                                                    isRunning ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500'
                                                }`}
                                            />
                                            <h3 className="text-lg font-semibold">{service.name}</h3>
                                            <ServiceStatusBadge status={service.state || null} size="sm" />
                                            <Badge variant="outline" className="text-xs">
                                                {restart}
                                            </Badge>
                                        </div>
                                        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                            <span className="font-mono text-xs">{image}</span>
                                            {service.ip_address && (
                                                <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                                    {service.ip_address}
                                                </span>
                                            )}
                                            {service.gateway && (
                                                <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                                                    {service.gateway}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
