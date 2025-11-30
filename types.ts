
export enum RequestStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED'
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum UserRole {
  ARCHITECT = 'ARCHITECT',
  DEVELOPER = 'DEVELOPER'
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Added for auth logic
  role: UserRole;
  avatar?: string;
}

export interface Attachment {
  name: string;
  type: string;
  data: string; // Base64 data
}

export interface AIAnalysis {
  complexityScore: number; // 1-10
  suggestedNamespaces: string[];
  implementationStrategy: string;
  pseudoCode: string;
}

export interface AutomationRequest {
  id: string;
  title: string;
  requesterName: string;
  requesterId: string; // New: Link to user
  
  // New Metadata Fields
  projectName: string;
  revitVersion: string; // e.g., "2024", "2025"
  dueDate?: string;
  
  description: string;
  priority: Priority;
  status: RequestStatus;
  createdAt: number; 
  updatedAt: number;
  attachments: Attachment[];
  
  // Developer fields
  developerNotes?: string;
  resultScript?: string;
  resultFileName?: string; // New field for uploaded file name
  aiAnalysis?: AIAnalysis;
}

export type ViewState = 'DASHBOARD' | 'LIST' | 'BOARD' | 'NEW' | 'DETAIL';
