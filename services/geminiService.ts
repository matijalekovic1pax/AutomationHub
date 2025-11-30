import { AIAnalysis, AutomationRequest } from "../types";
import { apiClient } from "./apiClient";

export const analyzeRequestWithGemini = async (request: AutomationRequest): Promise<AIAnalysis> => {
  // Call the backend to perform the analysis securely
  return await apiClient.post(`/requests/${request.id}/analyze`);
};