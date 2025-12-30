/**
 * Project Model
 * Represents a project in the system
 */
export interface Project {
  id: string;
  name: string;
  projectTag: string;
  description?: string;
  developer: string;
  logo?: string;
  image?: string;
  status?: string;
  daysCompleted?: number;
  totalDays?: number;
  timeLapsActive?: boolean;
  createdDate?: string;
  isActive?: string;
  blocked?: boolean;
  lat?: string;
  lng?: string;
  internalDescription?: string;
  internalAttachments?: ProjectAttachment[];
}

/**
 * Raw API response structure for projects
 */
export interface ProjectApiResponse {
  _id: string;
  projectTag: string;
  projectName: string;
  description?: string;
  developer: string;
  logo?: string;
  createdDate?: string;
  index?: string;
  isActive?: string;
  status?: string;
  blocked?: boolean;
  lat?: string;
  lng?: string;
  internalDescription?: string;
  internalAttachments?: ProjectAttachment[];
}

/**
 * Project attachment structure
 */
export interface ProjectAttachment {
  _id: string;
  name: string;
  originalName: string;
  size: number;
  type: string;
  url: string;
  s3Key?: string;
  uploadedAt?: string;
  uploadedBy?: string;
}

