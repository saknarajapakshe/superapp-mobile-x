package booking

import (
	"slices"
	"time"

	perm "resource-app/internal/permission"
	usr "resource-app/internal/user"

	"github.com/google/uuid"
)

type Service struct {
	repo          Repository
	permissionSvc *perm.Service
}

func NewService(repo Repository, permissionSvc *perm.Service) *Service {
	return &Service{
		repo:          repo,
		permissionSvc: permissionSvc,
	}
}

func (s *Service) GetBookings(filter BookingFilter) ([]Booking, error) {
	var userID *string
	var resourceIDs []string

	// Apply generic resource filter first so it works even when scope is omitted.
	if filter.ResourceID != "" {
		resourceIDs = []string{filter.ResourceID}
	}

	switch filter.Scope {
	// "me" scope: only return bookings made by the current user.
	case BookingScopeMe:
		userID = &filter.CurrentUserID

	// "approvable" scope: return bookings for resources the user has APPROVE permission on.
	case BookingScopeApprovable:
		approvableResourceIDs, err := s.permissionSvc.GetApprovableResourceIDs(filter.CurrentUserID)
		if err != nil {
			return nil, err
		}

		if len(approvableResourceIDs) == 0 {
			return []Booking{}, nil
		}

		if filter.ResourceID != "" {
			// If a specific resource is requested, it must be approvable by this user.
			if !slices.Contains(approvableResourceIDs, filter.ResourceID) {
				return nil, ErrBookingViewPermissionDenied
			}
		} else {
			// No specific resource requested: return bookings from all approvable resources.
			resourceIDs = approvableResourceIDs
		}
	}

	return s.repo.GetBookings(userID, filter.Statuses, resourceIDs)
}

func (s *Service) CreateBooking(booking *Booking, userID string, userRole usr.Role) error {
	// Validate booking times: start and end must be in the future, and start < end
	now := time.Now()
	if !booking.Start.After(now) || !booking.End.After(now) || !booking.Start.Before(booking.End) {
		return ErrInvalidTimeRange
	}

	// For non-admin users, enforce REQUEST permission check
	if userRole != usr.RoleAdmin {
		hasPermission, err := s.permissionSvc.HasRequestPermission(userID, booking.ResourceID)
		if err != nil {
			return err
		}
		if !hasPermission {
			return ErrBookingPermissionDenied
		}
	}

	booking.ID = uuid.New().String()
	booking.UserID = userID
	booking.CreatedAt = now

	if userRole == usr.RoleAdmin {
		booking.Status = StatusConfirmed
	} else {
		booking.Status = StatusPending
	}

	return s.repo.CreateBooking(booking)
}

func (s *Service) UpdateBooking(id, userID string, userRole usr.Role, payload UpdateBookingRequestPayload) (*Booking, error) {
	booking, err := s.repo.GetBookingByID(id)
	if err != nil {
		return nil, err
	}

	if !canTransition(booking.Status, payload.Status) {
		return nil, ErrInvalidTransition
	}

	switch payload.Status {
	case StatusConfirmed:
		return s.approveBooking(booking, userID, userRole, payload)
	case StatusRejected:
		return s.rejectBooking(booking, userID, userRole, payload)
	case StatusCancelled:
		return s.cancelBooking(booking, userID, userRole)
	case StatusCheckedIn:
		return s.checkInBooking(booking, userID, userRole)
	case StatusCompleted:
		return s.completeBooking(booking, userID, userRole)
	case StatusProposed:
		return s.proposeBooking(booking, userID, userRole, payload)
	default:
		return nil, ErrInvalidTransition
	}
}

// approveBooking allows approvers to confirm a pending booking request, changing its status to "confirmed"
func (s *Service) approveBooking(booking *Booking, userID string, userRole usr.Role, payload UpdateBookingRequestPayload) (*Booking, error) {
	if userRole != usr.RoleAdmin {
		hasPermission, err := s.permissionSvc.HasApprovePermission(userID, booking.ResourceID)
		if err != nil {
			return nil, err
		}
		if !hasPermission {
			return nil, ErrForbidden
		}
	}
	if payload.Reason != nil {
		return nil, ErrInvalidPayload
	}

	return s.repo.UpdateBooking(booking.ID, UpdateBookingRequestPayload{Status: StatusConfirmed})
}

// rejectBooking allows approvers to reject a booking with an optional reason or propose new time slots instead of approving outright
func (s *Service) rejectBooking(booking *Booking, userID string, userRole usr.Role, payload UpdateBookingRequestPayload) (*Booking, error) {
	if userRole != usr.RoleAdmin {
		hasPermission, err := s.permissionSvc.HasApprovePermission(userID, booking.ResourceID)
		if err != nil {
			return nil, err
		}
		if !hasPermission {
			return nil, ErrForbidden
		}
	}
	if payload.Reason == nil || *payload.Reason == "" {
		return nil, ErrRejectionReasonRequired
	}

	return s.repo.UpdateBooking(booking.ID, UpdateBookingRequestPayload{
		Status: StatusRejected,
		Reason: payload.Reason,
	})
}

// cancelBooking allows users to cancel their own bookings and admins to cancel any booking
func (s *Service) cancelBooking(booking *Booking, userID string, userRole usr.Role) (*Booking, error) {
	if booking.UserID != userID && userRole != usr.RoleAdmin {
		return nil, ErrForbidden
	}

	return s.repo.UpdateBooking(booking.ID, UpdateBookingRequestPayload{Status: StatusCancelled})
}

// checkInBooking can be called by the user or an admin to mark the booking as checked in when the user arrives at the resource
func (s *Service) checkInBooking(booking *Booking, userID string, userRole usr.Role) (*Booking, error) {
	if booking.UserID != userID && userRole != usr.RoleAdmin {
		return nil, ErrForbidden
	}

	now := time.Now()
	if now.Before(booking.Start) {
		return nil, ErrCheckInTooEarly
	}

	return s.repo.UpdateBooking(booking.ID, UpdateBookingRequestPayload{Status: StatusCheckedIn})
}

// completeBooking can be called by the user or an admin to mark the booking as completed after the reservation time has passed
func (s *Service) completeBooking(booking *Booking, userID string, userRole usr.Role) (*Booking, error) {
	if booking.UserID != userID && userRole != usr.RoleAdmin {
		return nil, ErrForbidden
	}

	now := time.Now()
	if !now.After(booking.End) {
		return nil, ErrCompleteBeforeEnd
	}

	return s.repo.UpdateBooking(booking.ID, UpdateBookingRequestPayload{Status: StatusCompleted})
}

// proposeBooking allows approvers to propose new time slots for a booking instead of approving or rejecting it outright
func (s *Service) proposeBooking(booking *Booking, userID string, userRole usr.Role, payload UpdateBookingRequestPayload) (*Booking, error) {
	if userRole != usr.RoleAdmin {
		hasPermission, err := s.permissionSvc.HasApprovePermission(userID, booking.ResourceID)
		if err != nil {
			return nil, err
		}
		if !hasPermission {
			return nil, ErrForbidden
		}
	}
	if payload.Reason == nil || *payload.Reason == "" || payload.ProposedStartTime == nil || payload.ProposedEndTime == nil {
		return nil, ErrInvalidPayload
	}
	if !payload.ProposedStartTime.Before(*payload.ProposedEndTime) {
		return nil, ErrInvalidTimeRange
	}
	now := time.Now()
	if !payload.ProposedStartTime.After(now) || !payload.ProposedEndTime.After(now) {
		return nil, ErrInvalidTimeRange
	}

	// Fetch only active bookings for this resource within the proposed time window
	activeBookings, err := s.repo.GetBookings(
		nil, // No user filter
		[]BookingStatus{StatusPending, StatusConfirmed, StatusCheckedIn, StatusCompleted, StatusProposed},
		[]string{booking.ResourceID},
	)
	if err != nil {
		return nil, err
	}

	for _, existingBooking := range activeBookings {
		if existingBooking.ID == booking.ID {
			continue
		}
		// Overlap check excluding shared boundary (adjacent bookings are allowed)
		if payload.ProposedStartTime.Before(existingBooking.End) &&
			payload.ProposedEndTime.After(existingBooking.Start) &&
			!payload.ProposedStartTime.Equal(existingBooking.End) &&
			!payload.ProposedEndTime.Equal(existingBooking.Start) {
			return nil, ErrBookingConflict
		}
	}

	return s.repo.UpdateBooking(booking.ID, UpdateBookingRequestPayload{
		Status:            StatusProposed,
		Reason:            payload.Reason,
		ProposedStartTime: payload.ProposedStartTime,
		ProposedEndTime:   payload.ProposedEndTime,
	})
}

func (s *Service) RescheduleBooking(id, userID string, userRole usr.Role, newStart, newEnd time.Time) (*Booking, error) {
	booking, err := s.repo.GetBookingByID(id)
	if err != nil {
		return nil, err
	}

	if booking.Status == StatusCancelled || booking.Status == StatusCompleted || booking.Status == StatusRejected {
		return nil, ErrInvalidTransition
	}

	now := time.Now()
	if !newStart.After(now) || !newEnd.After(now) || !newStart.Before(newEnd) {
		return nil, ErrInvalidTimeRange
	}

	if userRole != usr.RoleAdmin {
		hasPermission, permErr := s.permissionSvc.HasApprovePermission(userID, booking.ResourceID)
		if permErr != nil {
			return nil, permErr
		}
		if !hasPermission {
			return nil, ErrForbidden
		}
	}

	return s.repo.RescheduleBooking(id, newStart, newEnd)
}

func (s *Service) CancelBooking(id, userID string, userRole usr.Role) error {
	booking, err := s.repo.GetBookingByID(id)
	if err != nil {
		return err
	}

	if booking.UserID != userID && userRole != usr.RoleAdmin {
		return ErrForbidden
	}

	if booking.Status == StatusCancelled {
		return nil
	}
	if booking.Status == StatusCompleted || booking.Status == StatusRejected {
		return ErrInvalidTransition
	}

	return s.repo.CancelBooking(id)
}

func (s *Service) GetUtilizationStats() ([]ResourceUsageStats, error) {
	return s.repo.GetUtilizationStats()
}
