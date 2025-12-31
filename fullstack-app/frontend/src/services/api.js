import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Authentication Service
export const authService = {
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
    }
    return response.data;
  },
  
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },
  
  logout: () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  },
  
  getCurrentUser: async () => {
    const response = await api.get('/users/me');
    return response.data;
  }
};

// Target Service
export const targetService = {
  getAll: async () => {
    const response = await api.get('/targets');
    return response.data;
  },
  
  getById: async (id) => {
    const response = await api.get(`/targets/${id}`);
    return response.data;
  },
  
  create: async (targetData) => {
    const response = await api.post('/targets', targetData);
    return response.data;
  },
  
  update: async (id, targetData) => {
    const response = await api.put(`/targets/${id}`, targetData);
    return response.data;
  },
  
  delete: async (id) => {
    const response = await api.delete(`/targets/${id}`);
    return response.data;
  },
  
  scan: async (targetData) => {
    const response = await api.post('/scan', targetData);
    return response.data;
  }
};

// Attack Service
export const attackService = {
  getAll: async (filters = {}) => {
    const response = await api.get('/attacks', { params: filters });
    return response.data;
  },
  
  getById: async (id) => {
    const response = await api.get(`/attacks/${id}`);
    return response.data;
  },
  
  create: async (attackData) => {
    const response = await api.post('/attacks', attackData);
    return response.data;
  },
  
  cancel: async (id) => {
    const response = await api.post(`/attacks/${id}/cancel`);
    return response.data;
  },
  
  getStats: async () => {
    const response = await api.get('/dashboard/stats');
    return response.data;
  }
};

// Webhook Service
export const webhookService = {
  getAll: async () => {
    const response = await api.get('/webhooks');
    return response.data;
  },
  
  getById: async (id) => {
    const response = await api.get(`/webhooks/${id}`);
    return response.data;
  },
  
  create: async (webhookData) => {
    const response = await api.post('/webhooks', webhookData);
    return response.data;
  },
  
  update: async (id, webhookData) => {
    const response = await api.put(`/webhooks/${id}`, webhookData);
    return response.data;
  },
  
  delete: async (id) => {
    const response = await api.delete(`/webhooks/${id}`);
    return response.data;
  },
  
  test: async (id) => {
    const response = await api.post(`/webhooks/${id}/test`);
    return response.data;
  },
  
  getLogs: async (id, params = {}) => {
    const response = await api.get(`/webhooks/${id}/logs`, { params });
    return response.data;
  }
};

// Result Service
export const resultService = {
  getAll: async (filters = {}) => {
    const response = await api.get('/results', { params: filters });
    return response.data;
  },
  
  getById: async (id) => {
    const response = await api.get(`/results/${id}`);
    return response.data;
  },
  
  export: async (format = 'json', filters = {}) => {
    const response = await api.get('/results/export', { 
      params: { ...filters, format },
      responseType: 'blob'
    });
    return response.data;
  },
  
  verify: async (id) => {
    const response = await api.post(`/results/${id}/verify`);
    return response.data;
  }
};

// Wordlist Service
export const wordlistService = {
  getAll: async () => {
    const response = await api.get('/wordlists');
    return response.data;
  },
  
  getById: async (id) => {
    const response = await api.get(`/wordlists/${id}`);
    return response.data;
  },
  
  upload: async (file, metadata) => {
    const formData = new FormData();
    formData.append('file', file);
    Object.keys(metadata).forEach(key => {
      formData.append(key, metadata[key]);
    });
    
    const response = await api.post('/wordlists/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  delete: async (id) => {
    const response = await api.delete(`/wordlists/${id}`);
    return response.data;
  }
};

// Log Service
export const logService = {
  getAll: async (filters = {}) => {
    const response = await api.get('/logs', { params: filters });
    return response.data;
  },
  
  getByAttack: async (attackId) => {
    const response = await api.get(`/logs?attack_id=${attackId}`);
    return response.data;
  }
};

// Dashboard Service
export const dashboardService = {
  getStats: async () => {
    const response = await api.get('/dashboard/stats');
    return response.data;
  },
  
  getRecentActivity: async (limit = 10) => {
    const response = await api.get(`/dashboard/recent?limit=${limit}`);
    return response.data;
  },
  
  getProtocolStats: async () => {
    const response = await api.get('/dashboard/protocols');
    return response.data;
  },
  
  getChartData: async (timeRange = '7d') => {
    const response = await api.get(`/dashboard/charts?range=${timeRange}`);
    return response.data;
  }
};

// Notification Service
export const notificationService = {
  getPreferences: async () => {
    const response = await api.get('/users/me/notifications');
    return response.data;
  },
  
  updatePreferences: async (preferences) => {
    const response = await api.put('/users/me/notifications', preferences);
    return response.data;
  },
  
  testNotification: async (type) => {
    const response = await api.post('/users/me/notifications/test', { type });
    return response.data;
  }
};

// System Service
export const systemService = {
  getHealth: async () => {
    const response = await api.get('/system/health');
    return response.data;
  },
  
  getVersion: async () => {
    const response = await api.get('/system/version');
    return response.data;
  },
  
  getDiagnostics: async () => {
    const response = await api.get('/system/diagnostics');
    return response.data;
  }
};

export default api;
