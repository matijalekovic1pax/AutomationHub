
import { User, UserRole } from '../types';
import { apiClient } from './apiClient';

export const login = async (email: string, password?: string): Promise<User> => {
  // Conforms to OAuth2 standard or custom login endpoint defined in backend spec
  const response = await apiClient.post('/auth/login', { username: email, password });
  
  if (response.access_token) {
      sessionStorage.setItem('rah_access_token', response.access_token);
      // We assume the login response also returns the user profile, 
      // or we fetch it immediately after.
      return response.user;
  }
  throw new Error('Login failed: No access token received');
};

export const getCurrentUser = async (): Promise<User | null> => {
  const token = sessionStorage.getItem('rah_access_token');
  if (!token) return null;
  
  try {
    return await apiClient.get('/users/me');
  } catch (e) {
    // Token might be expired
    logout();
    return null;
  }
};

export const logout = () => {
  sessionStorage.removeItem('rah_access_token');
  window.location.reload();
};

// --- User Management for Developers ---

export const getAllUsers = async (): Promise<User[]> => {
  return await apiClient.get('/users');
};

export const createUser = async (name: string, email: string, password: string, role: UserRole, companyTitle?: string): Promise<User> => {
  return await apiClient.post('/users', { name, email, password, role, companyTitle });
};

export const deleteUser = async (id: string): Promise<void> => {
  await apiClient.delete(`/users/${id}`);
};

export const updateUser = async (id: string | number, payload: Partial<Pick<User, 'role' | 'companyTitle'>>): Promise<User> => {
  return await apiClient.put(`/users/${id}`, payload);
};
