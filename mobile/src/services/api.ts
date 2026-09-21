import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, API_TIMEOUT } from '../constants/api';

class ApiService {
  private instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - attach token
    this.instance.interceptors.request.use(
      async (config) => {
        // A caller that set its own Authorization (e.g. the short-lived
        // pending-edit token) must win over the stored session token.
        const token = await SecureStore.getItemAsync('accessToken');
        if (token && !config.headers.Authorization) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle token refresh
    this.instance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = await SecureStore.getItemAsync('refreshToken');
            if (!refreshToken) throw new Error('No refresh token');

            const { data } = await axios.post(
              `${API_BASE_URL}/auth/refresh`,
              { refreshToken },
              { timeout: API_TIMEOUT },
            );

            await SecureStore.setItemAsync('accessToken', data.data.accessToken);
            await SecureStore.setItemAsync('refreshToken', data.data.refreshToken);

            originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
            return this.instance(originalRequest);
          } catch {
            await this.clearTokens();
            // Navigate to login — handled in app
          }
        }
        return Promise.reject(error);
      }
    );
  }

  async clearTokens() {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
  }

  async saveTokens(accessToken: string, refreshToken: string) {
    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
  }

  get = (url: string, params?: any) =>
    this.instance.get(url, { params });

  post = (url: string, data?: any, timeoutMs?: number) =>
    this.instance.post(url, data, timeoutMs ? { timeout: timeoutMs } : undefined);

  postForm = (url: string, formData: FormData, timeoutMs = 60000) =>
    this.instance.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: timeoutMs,
    });

  patch = (url: string, data?: any, authToken?: string) =>
    this.instance.patch(url, data,
      authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined);

  put = (url: string, data?: any) =>
    this.instance.put(url, data);

  delete = (url: string) =>
    this.instance.delete(url);
}

const api = new ApiService();
export default api;
