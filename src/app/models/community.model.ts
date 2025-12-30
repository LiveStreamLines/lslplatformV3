/**
 * API Response Interface (raw from backend)
 */
export interface DeveloperApiResponse {
  _id: string;
  developerTag: string;
  developerName: string;
  description: string;
  logo: string;
  createdDate: string;
  isActive: string;
  email: string;
  phone: string;
  website: string;
  vatNumber: string;
  taxId: string;
  businessLicense: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  contactPerson: {
    name: string;
    position: string;
    email: string;
    phone: string;
  };
  bankDetails: {
    bankName: string;
    accountNumber: string;
    iban: string;
    swiftCode: string;
  };
  internalDescription: string;
  contacts: any[];
  internalAttachments: Array<{
    _id: string;
    name: string;
    originalName: string;
    size: number;
    type: string;
    url: string;
    s3Key: string;
    uploadedAt: string;
    uploadedBy: string;
  }>;
}

/**
 * Community Interface (mapped for UI)
 */
export interface Community {
  id: string; // mapped from _id
  name: string; // mapped from developerName
  projectCount: number; // may need to be fetched separately or defaulted
  image: string; // mapped from logo or internalAttachments
  gradient?: string;
  // Additional fields from API
  description?: string;
  logo?: string;
}

