import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({ baseURL: BASE_URL });

// Inject JWT token into every request
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Handle 401 — redirect to login
api.interceptors.response.use(
    res => res.data,
    err => {
        if (err.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(err.response?.data || err);
    }
);

export const authApi = {
    login: (username, password) => api.post('/auth/login', { username, password }),
    me: () => api.get('/auth/me'),
    changePassword: (current_password, new_password) => api.put('/auth/change-password', { current_password, new_password }),
};

export const productsApi = {
    getAll: (params) => api.get('/products', { params }),
    getById: (id) => api.get(`/products/${id}`),
    create: (data) => {
        const form = new FormData();
        Object.entries(data).forEach(([k, v]) => { if (v !== undefined && v !== null) form.append(k, v); });
        return api.post('/products', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    update: (id, data) => {
        const form = new FormData();
        Object.entries(data).forEach(([k, v]) => { if (v !== undefined && v !== null) form.append(k, v); });
        return api.put(`/products/${id}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    delete: (id) => api.delete(`/products/${id}`),
    bulkImport: (products) => api.post('/products/bulk', { products }),
};

export const categoriesApi = {
    getAll: () => api.get('/categories'),
    create: (data) => api.post('/categories', data),
    update: (id, data) => api.put(`/categories/${id}`, data),
    delete: (id) => api.delete(`/categories/${id}`),
};

export const inventoryApi = {
    getLogs: (params) => api.get('/inventory', { params }),
    import: (data) => api.post('/inventory/import', data),
    adjust: (data) => api.post('/inventory/adjust', data),
    bulkImport: (items) => api.post('/inventory/bulk', { items }),
};

export const ordersApi = {
    getAll: (params) => api.get('/orders', { params }),
    getById: (id) => api.get(`/orders/${id}`),
    create: (data) => api.post('/orders', data),
};

export const reportsApi = {
    getDashboard: () => api.get('/reports/dashboard'),
    getRevenue: (params) => api.get('/reports/revenue', { params }),
    getProfit: (params) => api.get('/reports/profit', { params }),
    getEmployeePerformance: (params) => api.get('/reports/employee-performance', { params }),
    getSalary: (params) => api.get('/reports/salary', { params }),
    getShift: (params) => api.get('/reports/shift', { params }),
};

export const salaryConfigApi = {
    get: () => api.get('/salary-config'),
    upsert: (data) => api.post('/salary-config', data),
};

export const usersApi = {
    getAll: () => api.get('/users'),
    create: (data) => api.post('/users', data),
    update: (id, data) => api.put(`/users/${id}`, data),
    delete: (id) => api.delete(`/users/${id}`),
};

export const storesApi = {
    getAll: () => api.get('/stores'),
    create: (data) => api.post('/stores', data),
    update: (id, data) => api.put(`/stores/${id}`, data),
    delete: (id) => api.delete(`/stores/${id}`),
};

export const branchesApi = {
    getAll: () => api.get('/branches'),
    create: (data) => api.post('/branches', data),
    update: (id, data) => api.put(`/branches/${id}`, data),
    delete: (id) => api.delete(`/branches/${id}`),
};

export const transfersApi = {
    transfer: (data) => api.post('/transfers', data),
    getLogs: (params) => api.get('/transfers', { params }),
    getStores: () => api.get('/transfers/stores'),
};

export const expensesApi = {
    getAll: (params) => api.get('/expenses', { params }),
    getSummary: (params) => api.get('/expenses/summary', { params }),
    create: (data) => api.post('/expenses', data),
    update: (id, data) => api.put(`/expenses/${id}`, data),
    delete: (id) => api.delete(`/expenses/${id}`),
};

export const notificationsApi = {
    getAll: (params) => api.get('/notifications', { params }),
    markRead: (id) => api.patch(`/notifications/${id}/read`),
    markAllRead: () => api.patch('/notifications/read-all'),
};

export default api;
