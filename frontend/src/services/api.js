import axios from 'axios';

const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim();
const isConfiguredLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(configuredApiUrl);

export const API_BASE_URL = !import.meta.env.DEV && isConfiguredLocalhost
  ? '/api/v1'
  : (configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:8000/api/v1' : '/api/v1'));

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
