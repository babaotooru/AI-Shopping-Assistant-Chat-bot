import axios from 'axios';

const isProduction = !import.meta.env.DEV;

export const API_BASE_URL = isProduction
  ? '/api/v1'
  : (import.meta.env.VITE_API_URL?.trim() || 'http://localhost:8000/api/v1');

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
