
import { Router } from 'express';
import { controller } from './controller';

const router = Router();

// Users
router.get('/users', controller.getUsers);
router.patch('/users/:id/role', controller.updateUserRole);

// Resources
router.get('/resources', controller.getResources);
router.post('/resources', controller.addResource);
router.put('/resources/:id', controller.updateResource);
router.delete('/resources/:id', controller.deleteResource);

// Bookings
router.get('/bookings', controller.getBookings);
router.post('/bookings', controller.createBooking);
router.post('/bookings/:id/process', controller.processBooking);
router.post('/bookings/:id/reschedule', controller.rescheduleBooking);
router.delete('/bookings/:id', controller.cancelBooking);

// Stats
router.get('/stats', controller.getStats);

export default router;
