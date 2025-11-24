
import { User, Resource, Booking, UserRole, BookingStatus, ApiResponse, ResourceUsageStats, ResourceType } from '../types';
import { APP_CONFIG } from '../config';

// --- SEED DATA ---
const SEED_USERS: User[] = [
  { id: 'u1', email: 'alex@lsf.com', role: UserRole.USER, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex', department: 'Design' },
  { id: 'u2', email: 'jordan@lsf.com', role: UserRole.ADMIN, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan', department: 'IT' },
  { id: 'u3', email: 'casey@lsf.com', role: UserRole.USER, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Casey', department: 'Logistics' },
];

const SEED_RESOURCES: Resource[] = [
  {
    id: 'r1',
    name: 'Grand Horizon',
    type: 'Conference Hall',
    description: 'Premium panoramic views.',
    isActive: true,
    minLeadTimeHours: 4,
    icon: 'MEETING_ROOM',
    color: 'violet',
    specs: { 'Capacity': '50 Pax', 'Floor': '10th', 'AV': '4K Projector' },
    formFields: [
      { id: 'title', label: 'Meeting Topic', type: 'text', required: true },
      { id: 'attendees', label: 'Headcount', type: 'number', required: true }
    ]
  },
  {
    id: 'v1',
    name: 'Tesla Model 3',
    type: 'Vehicle',
    description: 'Electric sedan for city travel.',
    isActive: true,
    minLeadTimeHours: 2,
    icon: 'CAR',
    color: 'blue',
    specs: { 'Seats': '4', 'Fuel': 'Electric', 'Range': '300km' },
    formFields: [
      { id: 'destination', label: 'Destination', type: 'text', required: true },
      { id: 'purpose', label: 'Purpose', type: 'select', options: ['Client Visit', 'Site Inspection'], required: true },
      { id: 'mileage', label: 'Current Mileage', type: 'number', required: true }
    ]
  },
  {
    id: 'd1',
    name: 'MacBook Pro M3',
    type: 'Device',
    description: 'High performance laptop for rendering.',
    isActive: true,
    minLeadTimeHours: 0,
    icon: 'LAPTOP',
    color: 'emerald',
    specs: { 'RAM': '32GB', 'Chip': 'M3 Max', 'Storage': '1TB' },
    formFields: [
      { id: 'project', label: 'Project Code', type: 'text', required: true }
    ]
  }
];

const SEED_BOOKINGS: Booking[] = [
    {
      id: 'b1',
      resourceId: 'r1',
      userId: 'u2',
      start: new Date(new Date().setHours(9,0,0,0)).toISOString(),
      end: new Date(new Date().setHours(11,30,0,0)).toISOString(),
      status: BookingStatus.CONFIRMED,
      createdAt: new Date().toISOString(),
      details: { title: 'Quarterly Review', attendees: 40 }
    }
];

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Helper for LocalStorage Persistence
const load = (key: string, def: any) => {
    try {
        const s = localStorage.getItem(key);
        return s ? JSON.parse(s) : def;
    } catch {
        return def;
    }
};
const save = (key: string, data: any) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn("LocalStorage failed", e);
    }
};

export class MockApiService {
  private users: User[];
  private resources: Resource[];
  private bookings: Booking[];

  constructor() {
    this.users = load('lsf_users', SEED_USERS);
    this.resources = load('lsf_resources', SEED_RESOURCES);
    this.bookings = load('lsf_bookings', SEED_BOOKINGS);
  }

  // Simulate network delay
  private async delay<T>(data: T): Promise<ApiResponse<T>> {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ success: true, data });
      }, APP_CONFIG.API_LATENCY);
    });
  }

  private async fail(error: string): Promise<ApiResponse<any>> {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ success: false, error });
      }, APP_CONFIG.API_LATENCY);
    });
  }

  // --- Users ---
  async getUsers(): Promise<ApiResponse<User[]>> {
    return this.delay([...this.users]);
  }

  async updateUserRole(userId: string, newRole: UserRole): Promise<ApiResponse<User>> {
    const user = this.users.find(u => u.id === userId);
    if (!user) return this.fail('User not found');
    
    user.role = newRole;
    save('lsf_users', this.users);
    return this.delay(user);
  }

  // --- Resources ---
  async getResources(): Promise<ApiResponse<Resource[]>> {
    return this.delay([...this.resources]);
  }

  async addResource(resource: Omit<Resource, 'id' | 'isActive'>): Promise<ApiResponse<Resource>> {
    const newResource: Resource = {
      ...resource,
      id: generateId(),
      isActive: true
    };
    this.resources.push(newResource);
    save('lsf_resources', this.resources);
    return this.delay(newResource);
  }

  async updateResource(resource: Resource): Promise<ApiResponse<Resource>> {
    const idx = this.resources.findIndex(r => r.id === resource.id);
    if (idx === -1) return this.fail('Resource not found');
    
    this.resources[idx] = resource;
    save('lsf_resources', this.resources);
    return this.delay(resource);
  }

  async deleteResource(id: string): Promise<ApiResponse<boolean>> {
    this.resources = this.resources.filter(r => r.id !== id);
    save('lsf_resources', this.resources);
    return this.delay(true);
  }

  // --- Bookings ---
  async getBookings(): Promise<ApiResponse<Booking[]>> {
    return this.delay([...this.bookings]);
  }

  async createBooking(bookingData: Omit<Booking, 'id' | 'status' | 'createdAt'>): Promise<ApiResponse<Booking>> {
    const { resourceId, start, end, userId } = bookingData;
    
    // 1. Conflict Check
    const reqStart = new Date(start).getTime();
    const reqEnd = new Date(end).getTime();

    const hasConflict = this.bookings.some(b => {
      if (b.resourceId !== resourceId || b.status === BookingStatus.CANCELLED || b.status === BookingStatus.REJECTED) return false;
      const bStart = new Date(b.start).getTime();
      const bEnd = new Date(b.end).getTime();
      return (reqStart < bEnd && reqEnd > bStart);
    });

    if (hasConflict) return this.fail('Conflict detected: This slot is already booked.');

    // 2. Determine Status
    const user = this.users.find(u => u.id === userId);
    const status = user?.role === UserRole.ADMIN ? BookingStatus.CONFIRMED : BookingStatus.PENDING;

    const newBooking: Booking = {
      ...bookingData,
      id: generateId(),
      status,
      createdAt: new Date().toISOString()
    };

    this.bookings.push(newBooking);
    save('lsf_bookings', this.bookings);
    return this.delay(newBooking);
  }

  async processBooking(id: string, status: BookingStatus, rejectionReason?: string): Promise<ApiResponse<Booking>> {
    const booking = this.bookings.find(b => b.id === id);
    if (!booking) return this.fail('Booking not found');

    booking.status = status;
    if (rejectionReason) booking.rejectionReason = rejectionReason;
    
    save('lsf_bookings', this.bookings);
    return this.delay(booking);
  }

  async rescheduleBooking(id: string, start: string, end: string): Promise<ApiResponse<Booking>> {
    const booking = this.bookings.find(b => b.id === id);
    if (!booking) return this.fail('Booking not found');

    // Conflict check excluding self
    const reqStart = new Date(start).getTime();
    const reqEnd = new Date(end).getTime();
    
    const hasConflict = this.bookings.some(b => {
        if (b.id === id || b.resourceId !== booking.resourceId || b.status === BookingStatus.CANCELLED || b.status === BookingStatus.REJECTED) return false;
        const bStart = new Date(b.start).getTime();
        const bEnd = new Date(b.end).getTime();
        return (reqStart < bEnd && reqEnd > bStart);
    });

    if (hasConflict) return this.fail('Conflict detected in new time slot');

    booking.start = start;
    booking.end = end;
    booking.status = BookingStatus.PROPOSED; // Require user approval for new time
    
    save('lsf_bookings', this.bookings);
    return this.delay(booking);
  }

  async cancelBooking(id: string): Promise<ApiResponse<boolean>> {
    const booking = this.bookings.find(b => b.id === id);
    if (!booking) return this.fail('Booking not found');
    
    booking.status = BookingStatus.CANCELLED;
    save('lsf_bookings', this.bookings);
    return this.delay(true);
  }

  // --- Stats ---
  async getUtilizationStats(): Promise<ApiResponse<ResourceUsageStats[]>> {
    const stats: ResourceUsageStats[] = this.resources.map(res => {
      const resBookings = this.bookings.filter(b => b.resourceId === res.id && b.status === BookingStatus.CONFIRMED);
      const totalMs = resBookings.reduce((acc, b) => acc + (new Date(b.end).getTime() - new Date(b.start).getTime()), 0);
      const totalHours = Math.round(totalMs / (1000 * 60 * 60));
      
      return {
        resourceId: res.id,
        resourceName: res.name,
        resourceType: res.type,
        bookingCount: resBookings.length,
        totalHours,
        utilizationRate: Math.min(100, Math.round((totalHours / 160) * 100)) // Assumes 160h monthly capacity
      };
    });

    return this.delay(stats);
  }
}

export const mockApi = new MockApiService();
