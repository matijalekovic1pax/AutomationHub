import { AutomationRequest } from '../types';
import { apiClient } from './apiClient';

export const getRequests = async (): Promise<AutomationRequest[]> => {
  return await apiClient.get('/requests');
};

export const createRequest = async (request: AutomationRequest): Promise<void> => {
    // API generates ID and timestamps, so we strip them if strictly following REST,
    // but here we just pass the DTO. The backend endpoint expects RequestCreate schema.
    await apiClient.post('/requests', {
        title: request.title,
        description: request.description,
        priority: request.priority,
        projectName: request.projectName,
        revitVersion: request.revitVersion,
        dueDate: request.dueDate,
        attachments: request.attachments
    });
};

export const saveRequest = async (request: AutomationRequest): Promise<void> => {
    // This is typically an UPDATE operation
    await apiClient.put(`/requests/${request.id}`, {
        status: request.status,
        developerNotes: request.developerNotes,
        resultScript: request.resultScript,
        aiAnalysis: request.aiAnalysis
    });
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