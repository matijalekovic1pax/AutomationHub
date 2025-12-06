
// API base: prefer Vite env var, fallback to the deployed backend, trim trailing slash
const DEFAULT_API_URL = "https://automation-hub-backend.vercel.app";
const rawBaseUrl = (import.meta as any).env?.VITE_API_URL as string | undefined;
export const API_URL = (rawBaseUrl && rawBaseUrl.trim().length > 0 ? rawBaseUrl : DEFAULT_API_URL).replace(/\/$/, "");

const buildError = async (res: Response) => {
  if (res.status === 401 || res.status === 403) {
    // Clear stale auth and force a clean login to avoid endless 401 loops
    sessionStorage.removeItem('rah_access_token');
    sessionStorage.removeItem('rah_current_user_id');
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
    return new Error('Session expired. Please sign in again.');
  }
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

  patch: async (endpoint: string, body: any) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(body),
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
