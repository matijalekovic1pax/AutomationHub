
import { AutomationRequest } from '../types';
import { apiClient } from './apiClient';

export const getRequests = async (): Promise<AutomationRequest[]> => {
  return await apiClient.get('/requests');
};

export const createRequest = async (request: AutomationRequest): Promise<void> => {
  await apiClient.post('/requests', request);
};

export const saveRequest = async (request: AutomationRequest): Promise<void> => {
    // In a real REST API, this is usually a PUT to /requests/:id
    await apiClient.put(`/requests/${request.id}`, request);
};

export const deleteRequest = async (id: string): Promise<void> => {
  await apiClient.delete(`/requests/${id}`);
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};
