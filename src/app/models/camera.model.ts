/**
 * Camera Model
 * Represents a camera in the system
 */
export interface Camera {
  id: string;
  name: string;
  camera: string;
  cameraDescription?: string;
  project: string;
  developer: string;
  image?: string;
  thumbnail?: string;
  status: 'Active' | 'Error' | 'Maintenance';
  installedDate: string;
  lastPhotoDate?: string;
  lastPhotoTime?: string;
  lat?: number;
  lng?: number;
  serverFolder?: string;
  country?: string;
  server?: string;
  isActive?: string;
  createdDate?: string;
  maintenanceStatus?: {
    lowImages?: boolean;
    shutterExpiry?: boolean;
    shutterExpiryRemovedBy?: string;
    shutterExpiryRemovedAt?: string;
  };
  internalAttachments?: CameraAttachment[];
}

/**
 * Raw API response structure for cameras
 */
export interface CameraApiResponse {
  _id: string;
  camera: string;
  developer: string;
  project: string;
  cameraDescription?: string;
  lat?: number;
  lng?: number;
  serverFolder?: string;
  createdDate?: string;
  cindex?: string;
  isActive?: string;
  country?: string;
  server?: string;
  maintenanceStatus?: {
    lowImages?: boolean;
    shutterExpiry?: boolean;
    shutterExpiryRemovedBy?: string;
    shutterExpiryRemovedAt?: string;
  };
  internalDescription?: string;
  internalAttachments?: CameraAttachment[];
}

/**
 * Camera attachment structure
 */
export interface CameraAttachment {
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

