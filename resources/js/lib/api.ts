import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

let csrfToken: string | undefined;

export function setCsrfToken(token: string | undefined) {
  csrfToken = token;
}

export function getCsrfToken(): string | undefined {
  return csrfToken;
}

const axiosInstance = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

axiosInstance.interceptors.request.use((config) => {
  const token = getCsrfToken();
  if (token) {
    config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

export const apiClient = <T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
  return axiosInstance.request<T>(config);
};
