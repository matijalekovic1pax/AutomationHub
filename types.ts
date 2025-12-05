
export enum RequestStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  RETURNED = 'RETURNED'
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export const DEVELOPER_ROLE = 'DEVELOPER';
export type UserRole = string;

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Added for auth logic
  role: UserRole;
  avatar?: string;
}

export interface Attachment {
  id?: number;
  name: string;
  type: string;
  data: string; // Base64 data
}

export interface Comment {
  id: number;
  requestId: number;
  userId?: number;
  authorName: string;
  content: string;
  createdAt: number;
}

export interface SubmissionEvent {
  id: number;
  requestId: number;
  eventType: 'SUBMISSION' | 'RESUBMISSION';
  createdAt: number;
  addedFiles: number;
}

export interface AIAnalysis {
  complexityScore: number; // 1-10
  suggestedNamespaces: string[];
  implementationStrategy: string;
  pseudoCode: string;
}

export interface AutomationRequest {
  id: string | number;
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
  resultFiles?: Attachment[];
  aiAnalysis?: AIAnalysis;
  submissionCount?: number; // Tracks how many times the request was submitted/resubmitted
  submissionEvents?: SubmissionEvent[];
  comments?: Comment[];
}

export type ViewState = 'DASHBOARD' | 'LIST' | 'BOARD' | 'NEW' | 'DETAIL';
