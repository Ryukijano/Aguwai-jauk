// Simple auth context without hooks initially
export interface User {
  id: number;
  username: string;
  name: string;
  email: string;
}

// Global auth state without React hooks
let globalAuthState: {
  user: User | null;
  isLoading: boolean;
} = {
  user: null,
  isLoading: false
};

// Simple auth functions
export const simpleAuth = {
  getUser: () => globalAuthState.user,
  isLoading: () => globalAuthState.isLoading,
  
  async checkAuth(): Promise<User | null> {
    globalAuthState.isLoading = true;
    try {
      const response = await fetch('/api/auth/user');
      if (response.ok) {
        const user = await response.json();
        globalAuthState.user = user;
        return user;
      }
    } catch (error) {
      console.warn('Auth check failed:', error);
    }
    globalAuthState.isLoading = false;
    globalAuthState.user = null;
    return null;
  },

  async login(credentials: { username: string; password: string }): Promise<User | null> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      if (response.ok) {
        const user = await response.json();
        globalAuthState.user = user;
        return user;
      }
    } catch (error) {
      console.warn('Login failed:', error);
    }
    return null;
  },

  async logout(): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        globalAuthState.user = null;
        return true;
      }
    } catch (error) {
      console.warn('Logout failed:', error);
    }
    return false;
  }
};

// Initialize auth check
if (typeof window !== 'undefined') {
  simpleAuth.checkAuth();
}