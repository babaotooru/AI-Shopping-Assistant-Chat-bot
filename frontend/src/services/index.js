import apiClient from './api';

export const orderService = {
  getAllOrders: async (category = null, skip = 0, limit = 10) => {
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
};

export const healthService = {
  check: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  },
};
