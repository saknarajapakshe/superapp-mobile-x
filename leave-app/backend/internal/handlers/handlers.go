// internal/handlers/handlers.go
package handlers

import (
	"leave-app/internal/constants"
	"leave-app/internal/db"
	"leave-app/internal/models"
	"leave-app/internal/service"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	DB             *db.Database
	HolidayService *service.HolidayService
}

func New(db *db.Database) *Handler {
	holidayService := service.NewHolidayService(db)
	return &Handler{
		DB:             db,
		HolidayService: holidayService,
	}
}

// GetCurrentUser handles GET /api/me
func (h *Handler) GetCurrentUser(c *gin.Context) {
	user, exists := c.Get(constants.ContextUserKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found in context"})
		return
	}

	c.JSON(http.StatusOK, user.(*models.User))
}

// GetUsers handles GET /api/users
func (h *Handler) GetUsers(c *gin.Context) {
	user, exists := c.Get(constants.ContextUserKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found in context"})
		return
	}

	currentUser := user.(*models.User)
	if currentUser.Role != string(constants.RoleAdmin) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	users, err := h.DB.GetAllUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get users"})
		return
	}

	c.JSON(http.StatusOK, users)
}

// UpdateAllowances handles PUT /api/admin/allowances
func (h *Handler) UpdateAllowances(c *gin.Context) {
	user, exists := c.Get(constants.ContextUserKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found in context"})
		return
	}

	currentUser := user.(*models.User)
	if currentUser.Role != string(constants.RoleAdmin) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	var req models.UpdateAllowancesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.DB.UpdateAllUserAllowances(req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update allowances"})
		return
	}

	c.Status(http.StatusNoContent)
}

// GetLeaves handles GET /api/leaves
func (h *Handler) GetLeaves(c *gin.Context) {
	user, exists := c.Get(constants.ContextUserKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found in context"})
		return
	}
	currentUser := user.(*models.User)

	var leaves []models.Leave
	var err error

	if currentUser.Role == string(constants.RoleAdmin) {
		leaves, err = h.DB.GetAllLeaves()
	} else {
		leaves, err = h.DB.GetLeavesByUserID(currentUser.ID)
	}

	if err != nil {
		log.Printf("Error getting leaves: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get leaves"})
		return
	}

	c.JSON(http.StatusOK, leaves)
}

// CreateLeave handles POST /api/leaves
func (h *Handler) CreateLeave(c *gin.Context) {
	user, exists := c.Get(constants.ContextUserKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found in context"})
		return
	}
	currentUser := user.(*models.User)

	var req models.CreateLeaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Parse dates
	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start date format"})
		return
	}
	endDate, err := time.Parse("2006-01-02", req.EndDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end date format"})
		return
	}

	if startDate.After(endDate) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date range"})
		return
	}

	// Calculate actual leave days (excluding weekends & holidays)
	leaveDates, err := h.HolidayService.GetWorkingDaysBetween(startDate, endDate)
	if err != nil {
		log.Printf("Error calculating working days: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to calculate working days"})
		return
	}

	if len(leaveDates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Selected period contains only weekends and holidays",
		})
		return
	}

	leave := models.Leave{
		UserID:    currentUser.ID,
		Type:      req.Type,
		StartDate: req.StartDate,
		EndDate:   req.EndDate,
		TotalLeaveDays: len(leaveDates),
		Reason:    req.Reason,
		Status:    string(constants.LeaveStatusPending),
		CreatedAt: time.Now(),
	}

	if err := h.DB.CreateLeave(&leave); err != nil {
		log.Printf("Error creating leave: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create leave"})
		return
	}

	// Store actual leave dates
	if err := h.DB.CreateLeaveDays(leave.ID, leaveDates); err != nil {
		log.Printf("Error creating leave days: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store leave days"})
		return
	}

	c.JSON(http.StatusCreated, leave)
}

// UpdateLeave handles PUT /api/leaves/:id
func (h *Handler) UpdateLeave(c *gin.Context) {
	user, exists := c.Get(constants.ContextUserKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found in context"})
		return
	}

	currentUser := user.(*models.User)
	if currentUser.Role != string(constants.RoleAdmin) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	leaveID := c.Param("id")

	var req models.UpdateLeaveStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.DB.UpdateLeaveStatus(leaveID, req.Status, req.Comment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update leave status"})
		return
	}

	updatedLeave, err := h.DB.GetLeaveByID(leaveID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated leave"})
		return
	}

	c.JSON(http.StatusOK, updatedLeave)
}

// DeleteLeave handles DELETE /api/leaves/:id
func (h *Handler) DeleteLeave(c *gin.Context) {
	user, exists := c.Get(constants.ContextUserKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found in context"})
		return
	}
	currentUser := user.(*models.User)

	leaveID := c.Param("id")

	leave, err := h.DB.GetLeaveByID(leaveID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Leave not found"})
		return
	}

	if leave.UserID != currentUser.ID || leave.Status != string(constants.LeaveStatusPending) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	if err := h.DB.DeleteLeave(leaveID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete leave"})
		return
	}

	c.Status(http.StatusNoContent)
}

// ApproveLeave handles POST /api/leaves/:id/approve
func (h *Handler) ApproveLeave(c *gin.Context) {
	user, exists := c.Get(constants.ContextUserKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found in context"})
		return
	}

	currentUser := user.(*models.User)
	if currentUser.Role != string(constants.RoleAdmin) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	leaveID := c.Param("id")

	var req models.UpdateLeaveStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// We can ignore the error if the body is empty, comment is optional
	}

	if err := h.DB.UpdateLeaveStatus(leaveID, string(constants.LeaveStatusApproved), req.Comment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to approve leave"})
		return
	}

	updatedLeave, err := h.DB.GetLeaveByID(leaveID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated leave"})
		return
	}

	c.JSON(http.StatusOK, updatedLeave)
}

// RejectLeave handles POST /api/leaves/:id/reject
func (h *Handler) RejectLeave(c *gin.Context) {
	user, exists := c.Get(constants.ContextUserKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found in context"})
		return
	}

	currentUser := user.(*models.User)
	if currentUser.Role != string(constants.RoleAdmin) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	leaveID := c.Param("id")

	var req models.UpdateLeaveStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// We can ignore the error if the body is empty, comment is optional
	}

	if err := h.DB.UpdateLeaveStatus(leaveID, string(constants.LeaveStatusRejected), req.Comment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reject leave"})
		return
	}

	updatedLeave, err := h.DB.GetLeaveByID(leaveID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated leave"})
		return
	}

	c.JSON(http.StatusOK, updatedLeave)
}

// UpdateUserRole handles PUT /api/users/:id/role
func (h *Handler) UpdateUserRole(c *gin.Context) {
	user, exists := c.Get(constants.ContextUserKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found in context"})
		return
	}

	currentUser := user.(*models.User)
	if currentUser.Role != string(constants.RoleAdmin) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	userID := c.Param("id")

	var req models.UpdateUserRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.DB.UpdateUserRole(userID, req.Role); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user role"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User role updated successfully"})
}

// GetLeaveDays handles GET /api/leaves/:id/days
func (h *Handler) GetLeaveDays(c *gin.Context) {
    leaveID := c.Param("id")
    
    // Get current user from context
    user, exists := c.Get(constants.ContextUserKey)
    if !exists {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found in context"})
        return
    }
    currentUser := user.(*models.User)

    // First, get the leave to check if user has access
    leave, err := h.DB.GetLeaveByID(leaveID)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "Leave not found"})
        return
    }

    // Check if user has permission (must be owner or admin)
    if currentUser.Role != string(constants.RoleAdmin) && leave.UserID != currentUser.ID {
        c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
        return
    }

    // Get leave days
    leaveDays, err := h.DB.GetLeaveDays(leaveID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get leave days"})
        return
    }

    c.JSON(http.StatusOK, leaveDays)
}

// GetLeaveByIDHandler handles GET /api/leaves/:id
func (h *Handler) GetLeaveByIDHandler(c *gin.Context) {
	leaveID := c.Param("id")

	// Get current user from context
	user, exists := c.Get(constants.ContextUserKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found in context"})
		return
	}
	currentUser := user.(*models.User)

	// Get the leave
	leave, err := h.DB.GetLeaveByID(leaveID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Leave not found"})
		return
	}

	// Check permission (must be owner or admin)
	if currentUser.Role != string(constants.RoleAdmin) && leave.UserID != currentUser.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	c.JSON(http.StatusOK, leave)
}

// GetHolidays handles GET /api/holidays
func (h *Handler) GetHolidays(c *gin.Context) {
	holidays, err := h.DB.GetAllHolidays()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get holidays"})
		return
	}

	c.JSON(http.StatusOK, holidays)
}

// UpdateLeaveDay handles PUT /api/leaves/:id/days/:dayId
func (h *Handler) UpdateLeaveDay(c *gin.Context) {
    leaveID := c.Param("id")
    dayID := c.Param("dayId")

    // Get current user from context
    user, exists := c.Get(constants.ContextUserKey)
    if !exists {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found in context"})
        return
    }
    currentUser := user.(*models.User)

    // Get the parent leave to check permissions and status
    leave, err := h.DB.GetLeaveByID(leaveID)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "Leave not found"})
        return
    }

    // Check if user has permission (must be owner or admin)
    if currentUser.Role != string(constants.RoleAdmin) && leave.UserID != currentUser.ID {
        c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
        return
    }

    // Check if leave is still pending
    if leave.Status != string(constants.LeaveStatusPending) {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Can only edit pending leaves"})
        return
    }

	// Only allow editing leave days for single-day leaves for simplicity
	 if leave.TotalLeaveDays != 1 {
        c.JSON(http.StatusBadRequest, gin.H{"error": "leave-day updates allowed only for single-day leaves"})
        return
    }

	// verify DB actually has exactly one LeaveDay for this leave
	days, err := h.DB.GetLeaveDays(leaveID)
	if err != nil || len(days) != 1 {
    c.JSON(http.StatusBadRequest, gin.H{"error": "leave-day record mismatch"})
    return
	}

    // Get the leave day to verify it belongs to this leave
    leaveDay, err := h.DB.GetLeaveDayByID(dayID)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "Leave day not found"})
        return
    }

    // Verify the day belongs to the specified leave
    if leaveDay.LeaveID != leaveID {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Leave day does not belong to this leave"})
        return
    }

    // Parse request body
    var req models.UpdateLeaveDayRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // Validate: if not half day, isMorning should be null
    if !req.IsHalfDay && req.IsMorning != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "isMorning can only be set when isHalfDay is true"})
        return
    }

    // Update the leave day
    if err := h.DB.UpdateLeaveDay(dayID, req.IsHalfDay, req.IsMorning); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update leave day"})
        return
    }

    // Get updated leave day
    updatedDay, err := h.DB.GetLeaveDayByID(dayID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated leave day"})
        return
    }

    c.JSON(http.StatusOK, updatedDay)
}

// UpdateLeaveDates handles PUT /api/leaves/:id/dates
func (h *Handler) UpdateLeaveDates(c *gin.Context) {
    user, ok := c.Get(constants.ContextUserKey)
    if !ok {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "user not found"})
        return
    }
    currentUser := user.(*models.User)

    leaveID := c.Param("id")
    var req models.UpdateLeaveDatesRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    leave, err := h.DB.GetLeaveByID(leaveID)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "leave not found"})
        return
    }

    if currentUser.Role != string(constants.RoleAdmin) && leave.UserID != currentUser.ID {
        c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
        return
    }

    if leave.Status != "pending" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "only pending leaves can be edited"})
        return
    }

    // resolve new dates (use existing when omitted)
    startStr := leave.StartDate
    endStr := leave.EndDate
    if req.StartDate != nil {
        startStr = *req.StartDate
    }
    if req.EndDate != nil {
        endStr = *req.EndDate
    }

    start, err := time.Parse("2006-01-02", startStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid startDate"})
        return
    }
    end, err := time.Parse("2006-01-02", endStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid endDate"})
        return
    }
    if end.Before(start) {
        c.JSON(http.StatusBadRequest, gin.H{"error": "endDate must be >= startDate"})
        return
    }

    days, err := h.HolidayService.GetWorkingDaysBetween(start, end)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute leave days"})
        return
    }
    if len(days) == 0 {
        c.JSON(http.StatusBadRequest, gin.H{"error": "resulting range contains no working days"})
        return
    }

    if err := h.DB.ReplaceLeaveDaysAndUpdateLeave(leaveID, startStr, endStr, len(days), days); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update leave"})
        return
    }

    updated, err := h.DB.GetLeaveByID(leaveID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch leave"})
        return
    }
    c.JSON(http.StatusOK, updated)
}
