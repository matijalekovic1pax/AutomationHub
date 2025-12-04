
// Check for Vite environment variable first, fall back to localhost for local dev
const API_URL = (import.meta as any).env?.VITE_API_URL || 'https://automationhubbackend.onrender.com';

const getHeaders = () => {
  const token = sessionStorage.getItem('rah_access_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const apiClient = {
  get: async (endpoint: string) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  post: async (endpoint: string, body?: any) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  
  postForm: async (endpoint: string, formData: FormData) => {
      // Don't set Content-Type header manually for FormData, browser does it with boundary
      const token = sessionStorage.getItem('rah_access_token');
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`${API_URL}${endpoint}`, {
          method: 'POST',
          headers,
          body: formData
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
  },

  put: async (endpoint: string, body: any) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  delete: async (endpoint: string) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};