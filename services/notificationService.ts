
import { apiClient } from './apiClient';

interface EmailPayload {
  subject: string;
  body: string;
  to?: string; // Optional: Backend will use default if not provided
}

export const sendEmailNotification = async (payload: EmailPayload): Promise<void> => {
  try {
    // We send this to the backend, which handles the actual SMTP logic
    // to a default preset email address as requested.
    await apiClient.post('/notifications/email', payload);
  } catch (error) {
    console.error("Failed to send email notification:", error);
    // We don't block the UI flow if email fails, just log it
  }
};
