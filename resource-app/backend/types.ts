
// Backend Types mirroring frontend types for simplicity
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  CHECKED_IN = 'checked_in',
  PROPOSED = 'proposed'
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  avatar?: string;
  department?: string;
}

export interface Resource {
  id: string;
  name: string;
  type: string;
  description: string;
  isActive: boolean;
  minLeadTimeHours: number;
  icon: string;
  color?: string;
  specs: Record<string, string>;
  formFields: any[];
}

export interface Booking {
  id: string;
  resourceId: string;
  userId: string;
  start: string;
  end: string;
  status: BookingStatus;
  createdAt: string;
  rejectionReason?: string;
  details: Record<string, any>;
}
