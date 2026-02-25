import { defineStore } from 'pinia';
import backendApi from '../services/backend';

export const useAuthStore = defineStore('auth', {
    state: () => ({
        user: null, // { username: string, id: number }
        token: localStorage.getItem('auth_token') || null,
        isAuthenticated: !!localStorage.getItem('auth_token'),
        loading: false,
        error: null,
    }),

    actions: {
        async register(username, password) {
            this.loading = true;
            this.error = null;
            try {
                const response = await backendApi.post('/api/auth/register', { username, password });
                // Automatically login after successful registration (optional, but good UX)
                await this.login(username, password);
                return response.data;
            } catch (err) {
                this.error = err.response?.data?.error || 'Registration failed';
                throw err;
            } finally {
                this.loading = false;
            }
        },

        async login(username, password) {
            this.loading = true;
            this.error = null;
            try {
                const response = await backendApi.post('/api/auth/login', { username, password });

                const { token, username: returnedUsername } = response.data;

                // Save token to localStorage and state
                this.token = token;
                localStorage.setItem('auth_token', token);

                this.user = { username: returnedUsername };
                this.isAuthenticated = true;

                return response.data;
            } catch (err) {
                this.error = err.response?.data?.error || 'Login failed';
                this.logout(); // Clear any potentially bad state
                throw err;
            } finally {
                this.loading = false;
            }
        },

        async fetchUserProfile() {
            if (!this.token) return;

            this.loading = true;
            try {
                const response = await backendApi.get('/api/auth/me');
                this.user = response.data;
                this.isAuthenticated = true;
            } catch (err) {
                console.error('Failed to fetch user profile:', err);
                this.logout(); // Token might be invalid/expired
            } finally {
                this.loading = false;
            }
        },

        logout() {
            this.token = null;
            this.user = null;
            this.isAuthenticated = false;
            localStorage.removeItem('auth_token');
            // Additional cleanup: optionally clear other stores (novels, prompts) here 
            // so data from previous user isn't accessible
        }
    }
});
