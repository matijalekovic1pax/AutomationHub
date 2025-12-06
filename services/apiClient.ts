
<<<<<<< HEAD
// Prefer Vite env; fall back to production backend; final fallback is localhost for dev
const API_URL =
  (import.meta as any).env?.VITE_API_URL ||
  'https://automationhubbackend.onrender.com' ||
  'http://localhost:8000';
=======
// Check for Vite environment variable first, fall back to localhost for local dev
const API_URL = (import.meta as any).env?.VITE_API_URL || 'https://automationhubbackend.onrender.com';
>>>>>>> c8f1dfeaf6e57a6b310856466a79de5b85d2d242

const buildError = async (res: Response) => {
  try {
    const data = await res.json();
    const detail = (data as any)?.detail || (data as any)?.message;
    if (detail) return new Error(detail);
    return new Error(JSON.stringify(data));
  } catch {
    const text = await res.text();
    return new Error(text || res.statusText);
  }
};

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
    if (!res.ok) throw await buildError(res);
    return res.json();
  },

  post: async (endpoint: string, body?: any) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw await buildError(res);
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
      if (!res.ok) throw await buildError(res);
      return res.json();
  },

  put: async (endpoint: string, body: any) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await buildError(res);
    return res.json();
  },

  delete: async (endpoint: string) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw await buildError(res);
    if (res.status === 204) return null;
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
};
