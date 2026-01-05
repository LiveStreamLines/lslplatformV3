/**
 * Camera Model
 * Represents a camera in the system
 */
export interface Camera {
  id: string;
  name: string;
  camera: string; // Camera tag
  cameraDescription?: string;
  project: string; // Project ID
  developer: string; // Developer ID
  projectTag?: string; // Project tag (for S3 paths)
  developerTag?: string; // Developer tag (for S3 paths)
  image?: string | null;
  thumbnail?: string | null;
  status: 'Online' | 'Offline' | 'Stopped' | 'Removed';
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

