/**
 * Get CSRF token from meta tag
 */
export function getCSRFToken(): string {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
}

/**
 * API response interface
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    status: number;
}

/**
 * Create headers with CSRF token
 */
function createHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': getCSRFToken(),
        ...additionalHeaders,
    };
}

/**
 * Generic API request helper
 */
async function apiRequest<T = unknown>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
        const response = await fetch(url, {
            headers: createHeaders(),
            ...options,
        });

        const isJson = response.headers.get('content-type')?.includes('application/json');
        const data = isJson ? await response.json() : await response.text();

        if (response.ok) {
            return {
                success: true,
                data,
                status: response.status,
            };
        } else {
            return {
                success: false,
                error: data?.error || data?.message || `HTTP ${response.status}: ${response.statusText}`,
                status: response.status,
            };
        }
    } catch (error) {
        return {
            success: false,
            error: `Network error: ${error instanceof Error ? error.message : String(error)}`,
            status: 0,
        };
    }
}

/**
 * POST request with JSON body
 */
export async function apiPost<T = unknown>(url: string, data?: unknown, options: Omit<RequestInit, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return apiRequest<T>(url, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
        ...options,
    });
}

/**
 * GET request
 */
export async function apiGet<T = unknown>(url: string, options: Omit<RequestInit, 'method'> = {}): Promise<ApiResponse<T>> {
    return apiRequest<T>(url, {
        method: 'GET',
        ...options,
    });
}

/**
 * PUT request with JSON body
 */
export async function apiPut<T = unknown>(url: string, data?: unknown, options: Omit<RequestInit, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return apiRequest<T>(url, {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
        ...options,
    });
}

/**
 * DELETE request
 */
export async function apiDelete<T = unknown>(url: string, options: Omit<RequestInit, 'method'> = {}): Promise<ApiResponse<T>> {
    return apiRequest<T>(url, {
        method: 'DELETE',
        ...options,
    });
}
