export interface Server {
    id: number;
    display_name: string;
    hostname: string;
    port: number;
    https: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface Service {
    command: string | null;
    entrypoint: string | null;
    image: string;
    networks: Record<string, unknown>;
    ports?: Array<{
        mode: string;
        target: number;
        published: string;
        protocol: string;
    }>;
    restart: string;
    volumes?: Array<{
        type: string;
        source: string;
        target: string;
        read_only: boolean;
    }>;
}

export interface Stack {
    name: string;
    path: string;
    services: Record<string, Service>;
    networks: Record<string, unknown>;
    parsed_successfully: boolean;
    service_count: number;
    service_names: string[];
    port_mappings: Array<{
        service: string;
        published: string | null;
        target: number | null;
        protocol: string;
    }>;
    volume_mappings: Array<{
        service: string;
        source: string | null;
        target: string | null;
        type: string;
        read_only: boolean;
    }>;
    service_status?: {
        stack: string;
        services: Array<{
            name: string;
            command: string;
            state: string;
            ports: string;
        }> | null;
    };
    running_services_count?: number;
    total_services_count?: number;
    service_status_summary?: {
        running: number;
        stopped: number;
        total: number;
    };
    overall_status?: 'running' | 'stopped' | 'partial' | 'unknown';
}

export interface UserPermissions {
    access: boolean;
    filemanager_access: boolean;
    filemanager_write: boolean;
    'start-stop': boolean;
    exec: boolean;
}

export interface HealthStatus {
    status: 'success' | 'error';
    health_status: 'healthy' | 'unhealthy' | 'unreachable' | 'unknown';
    service?: string;
    docker_compose?: {
        available: boolean;
        version: string;
    };
    response_time?: number;
    message?: string;
    checked_at: string;
}

export interface LogsResponse {
    stack: string;
    service?: string;
    lines: number;
    logs: string;
}