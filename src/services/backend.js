import axios from 'axios';

// Create a custom axios instance for our Node.js backend
const backendApi = axios.create({
    // Use the same origin in production, localhost:3001 in development
    baseURL: import.meta.env.MODE === 'production' ? '' : 'http://localhost:3001',
    timeout: 10000,
});

// Request interceptor to attach the JWT token
backendApi.interceptors.request.use(
    (config) => {
        // Get token from localStorage (managed by Pinia auth store)
        const token = localStorage.getItem('auth_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle token expiration or unauthorized access
backendApi.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            // Token is invalid or expired. Clear it and potentially redirect to login.
            localStorage.removeItem('auth_token');
            // In a real app, you might want to trigger a router push to /login here,
            // but it's often cleaner to handle the redirect via the store or route guards.
            console.warn('Unauthorized access - token is invalid or missing.');
        }
        return Promise.reject(error);
    }
);

export default backendApi;
