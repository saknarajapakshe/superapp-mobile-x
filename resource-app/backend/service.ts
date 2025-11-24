
import { repository } from './repository';
import { Booking, BookingStatus, Resource, UserRole } from './types';
import { v4 as uuidv4 } from 'uuid';

export class Service {
    // --- Users ---
    getUsers() { return repository.getAllUsers(); }
    
    updateUserRole(userId: string, role: UserRole) {
        const user = repository.getUserById(userId);
        if (!user) throw new Error('User not found');
        user.role = role;
        return repository.updateUser(user);
    }

    // --- Resources ---
    getResources() { return repository.getAllResources(); }
    
    addResource(data: Omit<Resource, 'id' | 'isActive'>) {
        const newResource: Resource = {
            id: uuidv4(),
            isActive: true,
            ...data
        };
        return repository.addResource(newResource);
    }

    updateResource(id: string, data: Resource) {
        const exists = repository.getResourceById(id);
        if (!exists) throw new Error('Resource not found');
        return repository.updateResource(data);
    }

    deleteResource(id: string) { return repository.deleteResource(id); }

    // --- Bookings ---
    getBookings() { return repository.getAllBookings(); }

    createBooking(data: any) {
        const { resourceId, userId, start, end, details } = data;
        
        const reqStart = new Date(start).getTime();
        const reqEnd = new Date(end).getTime();

        if (reqStart >= reqEnd) throw new Error('End time must be after start time');

        // Conflict Check
        const allBookings = repository.getAllBookings();
        const hasConflict = allBookings.some(b => {
            if (b.resourceId !== resourceId || b.status === BookingStatus.CANCELLED || b.status === BookingStatus.REJECTED) return false;
            const bStart = new Date(b.start).getTime();
            const bEnd = new Date(b.end).getTime();
            return (reqStart < bEnd && reqEnd > bStart);
        });

        if (hasConflict) throw new Error('Conflict detected');

        const user = repository.getUserById(userId);
        // Admin bookings confirm immediately
        const status = user?.role === UserRole.ADMIN ? BookingStatus.CONFIRMED : BookingStatus.PENDING;

        const newBooking: Booking = {
            id: uuidv4(),
            resourceId,
            userId,
            start,
            end,
            status,
            createdAt: new Date().toISOString(),
            details
        };

        return repository.addBooking(newBooking);
    }

    processBooking(id: string, status: BookingStatus, reason?: string) {
        const booking = repository.getBookingById(id);
        if (!booking) throw new Error('Booking not found');
        
        booking.status = status;
        if (reason) booking.rejectionReason = reason;
        
        return repository.updateBooking(booking);
    }

    rescheduleBooking(id: string, start: string, end: string) {
        const booking = repository.getBookingById(id);
        if (!booking) throw new Error('Booking not found');

        // Conflict check excluding self
        const reqStart = new Date(start).getTime();
        const reqEnd = new Date(end).getTime();
        const allBookings = repository.getAllBookings();
        
        const hasConflict = allBookings.some(b => {
            if (b.id === id || b.resourceId !== booking.resourceId || b.status === BookingStatus.CANCELLED || b.status === BookingStatus.REJECTED) return false;
            const bStart = new Date(b.start).getTime();
            const bEnd = new Date(b.end).getTime();
            return (reqStart < bEnd && reqEnd > bStart);
        });

        if (hasConflict) throw new Error('Conflict detected');

        booking.start = start;
        booking.end = end;
        booking.status = BookingStatus.PROPOSED; // Change: Wait for user acceptance
        return repository.updateBooking(booking);
    }

    cancelBooking(id: string) {
        const booking = repository.getBookingById(id);
        if (!booking) throw new Error('Booking not found');
        booking.status = BookingStatus.CANCELLED;
        return repository.updateBooking(booking);
    }

    getStats() {
        const bookings = repository.getAllBookings();
        const resources = repository.getAllResources();

        return resources.map(res => {
            const resBookings = bookings.filter(b => b.resourceId === res.id && b.status === BookingStatus.CONFIRMED);
            const totalMs = resBookings.reduce((acc, b) => acc + (new Date(b.end).getTime() - new Date(b.start).getTime()), 0);
            const totalHours = Math.round(totalMs / (1000 * 60 * 60));
            return {
                resourceId: res.id,
                resourceName: res.name,
                resourceType: res.type,
                bookingCount: resBookings.length,
                totalHours,
                utilizationRate: Math.min(100, Math.round((totalHours / 160) * 100)) // 160h assumed monthly cap
            };
        });
    }
}
export const service = new Service();
