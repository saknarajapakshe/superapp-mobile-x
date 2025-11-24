
import { User, Resource, Booking, UserRole, BookingStatus } from './types';

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

export class Repository {
    private users: User[] = [...SEED_USERS];
    private resources: Resource[] = [...SEED_RESOURCES];
    private bookings: Booking[] = [...SEED_BOOKINGS];

    // Users
    getAllUsers() { return this.users; }
    getUserById(id: string) { return this.users.find(u => u.id === id); }
    updateUser(user: User) {
        const idx = this.users.findIndex(u => u.id === user.id);
        if (idx > -1) this.users[idx] = user;
        return user;
    }

    // Resources
    getAllResources() { return this.resources; }
    getResourceById(id: string) { return this.resources.find(r => r.id === id); }
    addResource(res: Resource) { this.resources.push(res); return res; }
    updateResource(res: Resource) {
        const idx = this.resources.findIndex(r => r.id === res.id);
        if (idx > -1) this.resources[idx] = res;
        return res;
    }
    deleteResource(id: string) { 
        this.resources = this.resources.filter(r => r.id !== id);
        return true;
    }

    // Bookings
    getAllBookings() { return this.bookings; }
    getBookingById(id: string) { return this.bookings.find(b => b.id === id); }
    addBooking(booking: Booking) { this.bookings.push(booking); return booking; }
    updateBooking(booking: Booking) {
        const idx = this.bookings.findIndex(b => b.id === booking.id);
        if (idx > -1) this.bookings[idx] = booking;
        return booking;
    }
}
export const repository = new Repository();
