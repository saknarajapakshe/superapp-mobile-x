
import { ApiResponse, Booking, BookingStatus, Resource, ResourceUsageStats, User, UserRole } from '../types';
import { APP_CONFIG } from '../config';

class HttpApiService {
  private baseUrl = APP_CONFIG.API_BASE_URL;

  private async request<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      
      if (!res.ok) {
        const errData = await res.json();
        return { success: false, error: errData.error || `HTTP Error ${res.status}` };
      }
      
      const data = await res.json();
      return data;
    } catch (e: any) {
      console.error(`API Request failed: ${endpoint}`, e);
      return { success: false, error: e.message || 'Network request failed' };
    }
  }

  // --- Users ---
  async getUsers() {
    return this.request<User[]>('/users');
  }

  async updateUserRole(userId: string, role: UserRole) {
    return this.request<User>(`/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role })
    });
  }

  // --- Resources ---
  async getResources() {
    return this.request<Resource[]>('/resources');
  }

  async addResource(resource: any) {
    return this.request<Resource>('/resources', {
      method: 'POST',
      body: JSON.stringify(resource)
    });
  }

  async updateResource(resource: Resource) {
    return this.request<Resource>(`/resources/${resource.id}`, {
      method: 'PUT',
      body: JSON.stringify(resource)
    });
  }

  async deleteResource(id: string) {
    return this.request<boolean>(`/resources/${id}`, { method: 'DELETE' });
  }

  // --- Bookings ---
  async getBookings() {
    return this.request<Booking[]>('/bookings');
  }

  async createBooking(data: any) {
    return this.request<Booking>('/bookings', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async processBooking(id: string, status: BookingStatus, rejectionReason?: string) {
    return this.request<Booking>(`/bookings/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ status, rejectionReason })
    });
  }

  async rescheduleBooking(id: string, start: string, end: string) {
    return this.request<Booking>(`/bookings/${id}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ start, end })
    });
  }

  async cancelBooking(id: string) {
    return this.request<boolean>(`/bookings/${id}`, { method: 'DELETE' });
  }

  // --- Stats ---
  async getUtilizationStats() {
    return this.request<ResourceUsageStats[]>('/stats');
  }
}

export const httpApi = new HttpApiService();
