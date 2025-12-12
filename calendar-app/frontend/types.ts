export interface PublicHoliday {
  date: string; // yyyy-MM-dd
  localName: string;
  name: string;
  description?: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  types: string[];
}

export interface UserEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // yyyy-MM-dd
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  color?: string;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
