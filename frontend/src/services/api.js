import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => localStorage.removeItem('token'),
};

export const tokenService = {
  getAllTokens: () => api.get('/tokens'),
  injectToken: (tokenData) => api.post('/token/inject', tokenData),
  setPrice: (priceData) => api.post('/token/set-price', priceData),
  burnToken: (burnData) => api.post('/token/burn', burnData),
};

export const transactionService = {
  getTransactions: () => api.get('/transactions'),
};

export default api;