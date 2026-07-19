package booking

import (
	"errors"
	"net/http"
	"resource-app/internal/auth"
	"time"

	"github.com/gin-gonic/gin"
)

func HandleGetBookings(svc *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := auth.GetUserFromContext(c)
		if user == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
			return
		}

		filter := BookingFilter{
			CurrentUserID: user.ID,
			ResourceID:    c.Query("resourceId"),
		}

		scope := c.Query("scope")
		if scope != "" {
			bookingScope := BookingScope(scope)
			if bookingScope != BookingScopeMe && bookingScope != BookingScopeApprovable {
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid scope. allowed values: me, approvable"})
				return
			}
			filter.Scope = bookingScope
		}

		statusQueries := c.QueryArray("status")
		if len(statusQueries) > 0 {
			filter.Statuses = make([]BookingStatus, 0, len(statusQueries))
			for _, statusQuery := range statusQueries {
				status := BookingStatus(statusQuery)
				switch status {
				case StatusPending, StatusConfirmed, StatusRejected, StatusCancelled, StatusCompleted, StatusCheckedIn, StatusProposed:
					filter.Statuses = append(filter.Statuses, status)
				default:
					c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid status"})
					return
				}
			}
		}

		bookings, err := svc.GetBookings(filter)
		if err != nil {
			switch {
			case errors.Is(err, ErrBookingViewPermissionDenied):
				c.JSON(http.StatusForbidden, gin.H{"success": false, "error": ErrBookingViewPermissionDenied.Error()})
			default:
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to fetch bookings"})
			}
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": bookings})
	}
}

func HandleCreateBooking(svc *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req Booking
		err := c.ShouldBindJSON(&req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
			return
		}

		// Get current user
		user := auth.GetUserFromContext(c)
		if user == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
			return
		}

		err = svc.CreateBooking(&req, user.ID, user.Role)
		if err != nil {
			switch {
			case errors.Is(err, ErrBookingPermissionDenied):
				c.JSON(http.StatusForbidden, gin.H{"success": false, "error": ErrBookingPermissionDenied.Error()})
			case errors.Is(err, ErrResourceNotFound):
				c.JSON(http.StatusNotFound, gin.H{"success": false, "error": ErrResourceNotFound.Error()})
			case errors.Is(err, ErrInvalidTimeRange):
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": ErrInvalidTimeRange.Error()})
			case errors.Is(err, ErrBookingConflict):
				c.JSON(http.StatusConflict, gin.H{"success": false, "error": err.Error()})
			default:
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to create booking"})
			}
			return
		}

		c.JSON(http.StatusCreated, gin.H{"success": true, "data": req})
	}
}

func HandleUpdateBooking(svc *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		user := auth.GetUserFromContext(c)
		if user == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
			return
		}

		var req UpdateBookingRequestPayload
		err := c.ShouldBindJSON(&req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
			return
		}

		updated, err := svc.UpdateBooking(id, user.ID, user.Role, req)
		if err != nil {
			switch {
			case errors.Is(err, ErrBookingNotFound):
				c.JSON(http.StatusNotFound, gin.H{"success": false, "error": ErrBookingNotFound.Error()})
			case errors.Is(err, ErrBookingConflict):
				c.JSON(http.StatusConflict, gin.H{"success": false, "error": ErrBookingConflict.Error()})
			case errors.Is(err, ErrForbidden):
				c.JSON(http.StatusForbidden, gin.H{"success": false, "error": ErrForbidden.Error()})
			case errors.Is(err, ErrInvalidTransition):
				c.JSON(http.StatusUnprocessableEntity, gin.H{"success": false, "error": ErrInvalidTransition.Error()})
			case errors.Is(err, ErrRejectionReasonRequired):
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": ErrRejectionReasonRequired.Error()})
			case errors.Is(err, ErrInvalidPayload):
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": ErrInvalidPayload.Error()})
			case errors.Is(err, ErrInvalidTimeRange):
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": ErrInvalidTimeRange.Error()})
			case errors.Is(err, ErrCheckInTooEarly):
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": ErrCheckInTooEarly.Error()})
			case errors.Is(err, ErrCompleteBeforeEnd):
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": ErrCompleteBeforeEnd.Error()})
			default:
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to update booking status"})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": updated})
	}
}

func HandleRescheduleBooking(svc *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		user := auth.GetUserFromContext(c)
		if user == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
			return
		}

		var req struct {
			Start time.Time `json:"start" binding:"required"`
			End   time.Time `json:"end" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
			return
		}

		updated, err := svc.RescheduleBooking(id, user.ID, user.Role, req.Start, req.End)
		if err != nil {
			switch {
			case errors.Is(err, ErrBookingNotFound):
				c.JSON(http.StatusNotFound, gin.H{"success": false, "error": ErrBookingNotFound.Error()})
			case errors.Is(err, ErrRescheduleSlotConflict):
				c.JSON(http.StatusConflict, gin.H{"success": false, "error": err.Error()})
			case errors.Is(err, ErrForbidden):
				c.JSON(http.StatusForbidden, gin.H{"success": false, "error": ErrForbidden.Error()})
			case errors.Is(err, ErrInvalidTransition):
				c.JSON(http.StatusUnprocessableEntity, gin.H{"success": false, "error": ErrInvalidTransition.Error()})
			case errors.Is(err, ErrInvalidTimeRange):
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": ErrInvalidTimeRange.Error()})
			default:
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to reschedule booking"})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": updated})
	}
}

func HandleCancelBooking(svc *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		user := auth.GetUserFromContext(c)
		if user == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
			return
		}

		err := svc.CancelBooking(id, user.ID, user.Role)
		if err != nil {
			switch {
			case errors.Is(err, ErrBookingNotFound):
				c.JSON(http.StatusNotFound, gin.H{"success": false, "error": ErrBookingNotFound.Error()})
			case errors.Is(err, ErrForbidden):
				c.JSON(http.StatusForbidden, gin.H{"success": false, "error": ErrForbidden.Error()})
			case errors.Is(err, ErrInvalidTransition):
				c.JSON(http.StatusUnprocessableEntity, gin.H{"success": false, "error": ErrInvalidTransition.Error()})
			default:
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to cancel booking"})
			}
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": true})
	}
}

func HandleGetStats(svc *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		stats, err := svc.GetUtilizationStats()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to calculate stats"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": stats})
	}
}

