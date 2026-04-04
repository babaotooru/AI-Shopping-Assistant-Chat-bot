import apiClient, { API_BASE_URL } from './api';

export const orderService = {
  getAllOrders: async (category = null, skip = 0, limit = 100) => {
    const response = await apiClient.get('/orders', {
      params: { category, skip, limit }
    });
    return response.data;
  },

  getOrder: async (productId) => {
    const response = await apiClient.get(`/orders/${productId}`);
    return response.data;
  },

  createOrder: async (order) => {
    const response = await apiClient.post('/orders', order);
    return response.data;
  },

  updateOrder: async (productId, order) => {
    const response = await apiClient.put(`/orders/${productId}`, order);
    return response.data;
  },

  deleteOrder: async (productId) => {
    const response = await apiClient.delete(`/orders/${productId}`);
    return response.data;
  },

  getCategories: async () => {
    const response = await apiClient.get('/orders/categories/list');
    return response.data;
  },

  getProductSuggestions: async (query = '', limit = 8) => {
    const response = await apiClient.get('/orders/search/suggestions', {
      params: { q: query, limit },
    });
    return response.data;
  },
};

export const chatService = {
  queryOrders: async (question, context = null) => {
    const response = await apiClient.post('/chat/query', {
      question,
      context,
    });
    return response.data;
  },

  getRecommendations: async (productName, count = 5) => {
    const response = await apiClient.post('/chat/recommend', {
      product_name: productName,
      count,
    });
    return response.data;
  },

  compareProducts: async (product1, product2) => {
    const response = await apiClient.post('/chat/compare', {
      product1,
      product2,
    });
    return response.data;
  },

  processOrders: async () => {
    const response = await apiClient.post('/chat/process-orders');
    return response.data;
  },

  getDashboard: async (selectedUserId = null) => {
    const response = await apiClient.get('/chat/dashboard', {
      params: { selected_user_id: selectedUserId || undefined },
    });
    return response.data;
  },

  askChatbot: async (question, userId = null, context = null) => {
    const response = await apiClient.post('/chat/ask', {
      question,
      user_id: userId || undefined,
      context,
    });
    return response.data;
  },

  askChatbotStream: async (question, userId = null, context = null, onChunk = null, signal = null) => {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${API_BASE_URL}/chat/ask-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        question,
        user_id: userId || undefined,
        context,
      }),
      signal: signal || undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || response.statusText || 'Unable to stream chatbot response');
    }

    if (!response.body) {
      const fallbackText = await response.text();
      if (onChunk) {
        onChunk(fallbackText);
      }
      return fallbackText;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      if (onChunk) {
        onChunk(fullText);
      }
    }

    if (onChunk) {
      onChunk(fullText);
    }

    return fullText;
  },
};

export const healthService = {
  check: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  },
};

export const authService = {
  createEmailAccount: async (email, password, username) => {
    const response = await apiClient.post('/auth/create-email-account', {
      email,
      password,
      username,
    });
    return response.data;
  },
  emailLogin: async (email, password) => {
    const response = await apiClient.post('/auth/email-login', {
      email,
      password,
    });
    return response.data;
  },
  syncGoogleSession: async (supabaseAccessToken) => {
    const response = await apiClient.post('/auth/sync-google-session', {
      access_token: supabaseAccessToken,
    });
    return response.data;
  },
  resolveIdentifier: async (identifier) => {
    const response = await apiClient.post('/auth/resolve-identifier', {
      identifier,
    });
    return response.data;
  },
  me: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
  getProfile: async () => {
    const response = await apiClient.get('/auth/profile');
    return response.data;
  },
  updateProfile: async (profile) => {
    const response = await apiClient.put('/auth/profile', profile);
    return response.data;
  },
};
