
// API base: prefer Vite env var, fallback to deployed backend; strip trailing slashes to avoid double-slash redirects
const RAW_API_URL = (import.meta as any).env?.VITE_API_URL ?? "https://automation-hub-backend.vercel.app";
const API_URL = RAW_API_URL.replace(/\/+$/, "");

type ApiError = Error & { status?: number };

const buildError = async (res: Response): Promise<ApiError> => {
  try {
    const data = await res.json();
    const detail = (data as any)?.detail || (data as any)?.message;
    const err: ApiError = detail ? new Error(detail) : new Error(JSON.stringify(data));
    err.status = res.status;
    return err;
  } catch {
    const text = await res.text();
    const err: ApiError = new Error(text || res.statusText);
    err.status = res.status;
    return err;
  }
};

const getToken = () => {
  return localStorage.getItem('rah_access_token') || sessionStorage.getItem('rah_access_token');
};

const getHeaders = () => {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const addCacheBuster = (url: string) => {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_=${Date.now()}`;
};

export const apiClient = {
  get: async (endpoint: string) => {
    const url = addCacheBuster(`${API_URL}${endpoint}`);
    const res = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store',
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
