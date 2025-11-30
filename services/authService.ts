import { User } from '../types';
import { apiClient } from './apiClient';

export const login = async (email: string): Promise<User> => {
  // We use a simplified flow where password matches the role logic from the mockup
  // ARCHITECT -> 'revit'
  // DEVELOPER -> 'python'
  let password = 'password';
  if (email === 'arch@design.com') password = 'revit';
  if (email === 'dev@code.com') password = 'python';

  // OAuth2 Password Flow expects form data
  const formData = new FormData();
  formData.append('username', email);
  formData.append('password', password);

  try {
      const data = await apiClient.postForm('/token', formData);
      if (data.access_token) {
          sessionStorage.setItem('rah_access_token', data.access_token);
          return data.user;
      }
      throw new Error("No token returned");
  } catch (error) {
      console.error(error);
      throw new Error('Login failed. Ensure Backend is running.');
  }
};

export const getCurrentUser = async (): Promise<User | null> => {
  const token = sessionStorage.getItem('rah_access_token');
  if (!token) return null;
  
  try {
      return await apiClient.get('/users/me');
  } catch (e) {
      sessionStorage.removeItem('rah_access_token');
      return null;
  }
};

export const logout = () => {
  sessionStorage.removeItem('rah_access_token');
};