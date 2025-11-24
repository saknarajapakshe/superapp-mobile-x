
import { service } from './service';

const handle = (res: any, fn: () => any) => {
    try {
        const data = fn();
        res.json({ success: true, data });
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
};

export const controller = {
    getUsers: (req: any, res: any) => handle(res, () => service.getUsers()),
    
    updateUserRole: (req: any, res: any) => handle(res, () => 
        service.updateUserRole(req.params.id, req.body.role)
    ),

    getResources: (req: any, res: any) => handle(res, () => service.getResources()),
    
    addResource: (req: any, res: any) => handle(res, () => 
        service.addResource(req.body)
    ),
    
    updateResource: (req: any, res: any) => handle(res, () => 
        service.updateResource(req.params.id, req.body)
    ),
    
    deleteResource: (req: any, res: any) => handle(res, () => 
        service.deleteResource(req.params.id)
    ),

    getBookings: (req: any, res: any) => handle(res, () => service.getBookings()),
    
    createBooking: (req: any, res: any) => handle(res, () => 
        service.createBooking(req.body)
    ),
    
    processBooking: (req: any, res: any) => handle(res, () => 
        service.processBooking(req.params.id, req.body.status, req.body.rejectionReason)
    ),
    
    rescheduleBooking: (req: any, res: any) => handle(res, () => 
        service.rescheduleBooking(req.params.id, req.body.start, req.body.end)
    ),
    
    cancelBooking: (req: any, res: any) => handle(res, () => 
        service.cancelBooking(req.params.id)
    ),

    getStats: (req: any, res: any) => handle(res, () => service.getStats())
};
