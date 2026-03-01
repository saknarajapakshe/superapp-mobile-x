package handlers

import (
	"database/sql"
	"leave-app/internal/constants"
	"leave-app/internal/db"
	"leave-app/internal/models"
	"leave-app/internal/service"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
    DB *db.Database
    UserService *service.UserService
    LeaveService *service.LeaveService
    HolidayService *service.HolidayService
}

func NewHandler(database *db.Database) *Handler {
    return &Handler{
        DB: database,
        UserService: service.NewUserService(database),
        LeaveService: service.NewLeaveService(database),
        HolidayService: service.NewHolidayService(database),
    }
}

// GetCurrentUser returns the authenticated user's information
func (h *Handler) GetCurrentUser(c *gin.Context) {
    email, exists := c.Get(constants.ContextUserEmailKey)
    if !exists {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
        return
    }

    user, err := h.UserService.GetUserByEmail(email.(string))
    if err != nil {
        if err == sql.ErrNoRows {
            // Create new user if not found
            user, err = h.UserService.CreateUser(email.(string))
            if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
                return
            }
        } else {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
            return
        }
    }

    c.JSON(http.StatusOK, user)
}

// GetAllUsers returns all users (Admin only)
func (h *Handler) GetAllUsers(c *gin.Context) {
    role, _ := c.Get(constants.ContextUserRoleKey)
    if role != models.UserRoleAdmin {
        c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
        return
    }

    users, err := h.UserService.GetAllUsers()
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get users"})
        return
    }

    c.JSON(http.StatusOK, users)
}

// UpdateUserRole updates a user's role (Admin only)
func (h *Handler) UpdateUserRole(c *gin.Context) {
    role, _ := c.Get(constants.ContextUserRoleKey)
    if role != models.UserRoleAdmin {
        c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
        return
    }

    userID := c.Param("id")

    var req models.UpdateUserRoleRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
        return
    }

    if req.Role != models.UserRoleUser && req.Role != models.UserRoleAdmin {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
        return
    }

    if err := h.UserService.UpdateUserRole(userID, req.Role); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user role"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "User role updated successfully"})
}

// UpdateDefaultAllowances updates default allowances for all users (Admin only)
func (h *Handler) UpdateDefaultAllowances(c *gin.Context) {
    role, _ := c.Get(constants.ContextUserRoleKey)
    if role != models.UserRoleAdmin {
        c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
        return
    }

    var req models.UpdateAllowancesRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
        return
    }

    if err := h.UserService.UpdateAllUserAllowances(req); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update allowances"})
        return
    }

    c.Status(http.StatusNoContent)
}

// GetLeaves returns leave requests based on user role
func (h *Handler) GetLeaves(c *gin.Context) {
    email, _ := c.Get(constants.ContextUserEmailKey)
    role, _ := c.Get(constants.ContextUserRoleKey)

    var leaves []models.Leave
    var err error

    if role == models.UserRoleAdmin {
        leaves, err = h.LeaveService.GetAllLeaves()
    } else {
        user, err := h.UserService.GetUserByEmail(email.(string))
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
            return
        }
        leaves, err = h.LeaveService.GetLeavesByUserID(user.ID)
    }

    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get leaves"})
        return
    }

    c.JSON(http.StatusOK, leaves)
}

// CreateLeave creates a new leave request
func (h *Handler) CreateLeave(c *gin.Context) {
    email, _ := c.Get(constants.ContextUserEmailKey)

    var req models.CreateLeaveRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
        return
    }

    // Validate leave type
    if req.Type != models.LeaveTypeSick && req.Type != models.LeaveTypeAnnual && req.Type != models.LeaveTypeCasual {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid leave type"})
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

    // Validate date range
    if endDate.Before(startDate) {
        c.JSON(http.StatusBadRequest, gin.H{"error": "End date cannot be before start date"})
        return
    }

    // Check if this is a single-day leave
    isSingleDay := startDate.Equal(endDate)

    // Validate half-day parameters
    isHalfDay := false
    var halfDayPeriod *models.HalfDayPeriod

    if req.IsHalfDay != nil && *req.IsHalfDay {
        if !isSingleDay {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Half-day leaves can only be used for single-day leaves"})
            return
        }

        if req.HalfDayPeriod == nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Half-day period is required when isHalfDay is true"})
            return
        }

        if *req.HalfDayPeriod != models.HalfDayPeriodMorning && *req.HalfDayPeriod != models.HalfDayPeriodEvening {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Half-day period must be 'morning' or 'evening'"})
            return
        }

        isHalfDay = true
        halfDayPeriod = req.HalfDayPeriod
    }

    // Get holidays from database within the date range
    holidays, err := h.HolidayService.GetHolidaysInRange(startDate, endDate)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get holidays"})
        return
    }

    // Calculate working days excluding weekends and holidays
    workingDays := h.HolidayService.CalculateWorkingDays(startDate, endDate, holidays)

    if len(workingDays) == 0 {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Selected period contains only weekends and holidays"})
        return
    }

    // Calculate total leave days (0.5 for half-day, otherwise count of working days)
    totalLeaveDays := float64(len(workingDays))
    if isHalfDay {
        totalLeaveDays = 0.5
    }

    // Get user
    user, err := h.UserService.GetUserByEmail(email.(string))
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
        return
    }

    // Create leave with days in a single transaction
    leave := &models.Leave{
        UserID:         user.ID,
        Type:           req.Type,
        StartDate:      req.StartDate,
        EndDate:        req.EndDate,
        TotalLeaveDays: totalLeaveDays,
        Reason:         req.Reason,
        Status:         models.LeaveStatusPending,
        CreatedAt:      time.Now(),
    }

    if err := h.LeaveService.CreateLeaveWithTransaction(leave, workingDays, isHalfDay, halfDayPeriod); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create leave"})
        return
    }

    // Get the created leave with days
    createdLeave, err := h.LeaveService.GetLeaveByID(leave.ID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get created leave"})
        return
    }

    c.JSON(http.StatusCreated, createdLeave)
}

// UpdateLeave updates leave with role-based access control
// Regular users can update dates/half-day for their own pending leaves
// Admins can update status/comment for any leave
func (h *Handler) UpdateLeave(c *gin.Context) {
    leaveID := c.Param("id")
    email, _ := c.Get(constants.ContextUserEmailKey)
    role, _ := c.Get(constants.ContextUserRoleKey)

    // Get the leave
    leave, err := h.LeaveService.GetLeaveByID(leaveID)
    if err != nil {
        if err == sql.ErrNoRows {
            c.JSON(http.StatusNotFound, gin.H{"error": "Leave not found"})
            return
        }
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get leave"})
        return
    }

    // Parse request
    var req models.UpdateLeaveRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
        return
    }

    // Check if this is a status update (admin only)
    if req.Status != nil {
        if role != models.UserRoleAdmin {
            c.JSON(http.StatusForbidden, gin.H{"error": "Only admins can update leave status"})
            return
        }

        // Validate status
        if *req.Status != models.LeaveStatusPending && *req.Status != models.LeaveStatusApproved && *req.Status != models.LeaveStatusRejected {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
            return
        }

        // Update status
        if err := h.LeaveService.UpdateLeaveStatus(leaveID, *req.Status, req.Comment); err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update leave status"})
            return
        }

        // Get and return updated leave
        updatedLeave, err := h.LeaveService.GetLeaveByID(leaveID)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated leave"})
            return
        }

        c.JSON(http.StatusOK, updatedLeave)
        return
    }

    // Date/half-day update (user for their own leaves, or admin for any)
    user, err := h.UserService.GetUserByEmail(email.(string))
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
        return
    }

    // Check authorization
    if leave.UserID != user.ID && role != models.UserRoleAdmin {
        c.JSON(http.StatusForbidden, gin.H{"error": "You can only edit your own leaves"})
        return
    }

    // Only pending leaves can have dates modified
    if leave.Status != models.LeaveStatusPending {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Only pending leaves can have dates modified"})
        return
    }

    // Determine if this is a single-day or multi-day update
    hasHalfDayFields := req.IsHalfDay != nil || req.HalfDayPeriod != nil

    if hasHalfDayFields {
        // Single-day leave update with half-day parameters
        if req.StartDate == nil || req.EndDate == nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "StartDate and EndDate are required for half-day updates"})
            return
        }

        // Verify dates are equal (single-day)
        if *req.StartDate != *req.EndDate {
            c.JSON(http.StatusConflict, gin.H{"error": "Half-day parameters can only be used for single-day leaves"})
            return
        }

        // Parse the date
        startDate, err := time.Parse("2006-01-02", *req.StartDate)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format"})
            return
        }

        endDate, err := time.Parse("2006-01-02", *req.EndDate)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format"})
            return
        }

        // Validate half-day parameters
        isHalfDay := false
        var halfDayPeriod *models.HalfDayPeriod

        if req.IsHalfDay != nil && *req.IsHalfDay {
            if req.HalfDayPeriod == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Half-day period is required when isHalfDay is true"})
                return
            }

            if *req.HalfDayPeriod != models.HalfDayPeriodMorning && *req.HalfDayPeriod != models.HalfDayPeriodEvening {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Half-day period must be 'morning' or 'evening'"})
                return
            }

            isHalfDay = true
            halfDayPeriod = req.HalfDayPeriod
        }

        // If dates changed, regenerate leave days with single-day half-day settings in one transaction
        if *req.StartDate != leave.StartDate || *req.EndDate != leave.EndDate {
            holidays, err := h.HolidayService.GetHolidaysInRange(startDate, endDate)
            if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get holidays"})
                return
            }

            workingDays := h.HolidayService.CalculateWorkingDays(startDate, endDate, holidays)
            if len(workingDays) == 0 {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Selected date is a weekend or holiday"})
                return
            }

            totalDays := 1.0
            if isHalfDay {
                totalDays = 0.5
            }

            if err := h.LeaveService.UpdateSingleDayLeaveWithTransaction(leaveID, *req.StartDate, *req.EndDate, totalDays, workingDays, isHalfDay, halfDayPeriod); err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update leave"})
                return
            }
        } else {
            // Only half-day status changed, no date change
            if err := h.LeaveService.UpdateSingleDayLeaveHalfDay(leaveID, isHalfDay, halfDayPeriod); err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update half-day status"})
                return
            }
        }

    } else {
        // Multi-day leave update (date range only)
        // Use existing dates if not provided
        newStartDate := leave.StartDate
        newEndDate := leave.EndDate

        if req.StartDate != nil {
            newStartDate = *req.StartDate
        }
        if req.EndDate != nil {
            newEndDate = *req.EndDate
        }

        // Parse dates
        startDate, err := time.Parse("2006-01-02", newStartDate)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start date format"})
            return
        }

        endDate, err := time.Parse("2006-01-02", newEndDate)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end date format"})
            return
        }

        if endDate.Before(startDate) {
            c.JSON(http.StatusBadRequest, gin.H{"error": "End date cannot be before start date"})
            return
        }

        // Get holidays within the date range
        holidays, err := h.HolidayService.GetHolidaysInRange(startDate, endDate)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get holidays"})
            return
        }

        // Calculate new working days
        workingDays := h.HolidayService.CalculateWorkingDays(startDate, endDate, holidays)
        if len(workingDays) == 0 {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Selected period contains only weekends and holidays"})
            return
        }

        totalDays := float64(len(workingDays))

        // Replace leave days
        if err := h.LeaveService.ReplaceLeaveDaysAndUpdateLeave(leaveID, newStartDate, newEndDate, totalDays, workingDays); err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update leave"})
            return
        }
    }

    // Get and return updated leave
    updatedLeave, err := h.LeaveService.GetLeaveByID(leaveID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated leave"})
        return
    }

    c.JSON(http.StatusOK, updatedLeave)
}

// GetLeaveByID returns a specific leave by ID
func (h *Handler) GetLeaveByID(c *gin.Context) {
    leaveID := c.Param("id")
    email, _ := c.Get(constants.ContextUserEmailKey)
    role, _ := c.Get(constants.ContextUserRoleKey)

    leave, err := h.LeaveService.GetLeaveByID(leaveID)
    if err != nil {
        if err == sql.ErrNoRows {
            c.JSON(http.StatusNotFound, gin.H{"error": "Leave not found"})
            return
        }
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get leave"})
        return
    }

    // Check authorization
    user, err := h.UserService.GetUserByEmail(email.(string))
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
        return
    }

    if leave.UserID != user.ID && role != models.UserRoleAdmin {
        c.JSON(http.StatusForbidden, gin.H{"error": "You can only view your own leaves"})
        return
    }

    c.JSON(http.StatusOK, leave)
}

// DeleteLeave deletes a leave request
func (h *Handler) DeleteLeave(c *gin.Context) {
    leaveID := c.Param("id")
    email, _ := c.Get(constants.ContextUserEmailKey)

    leave, err := h.LeaveService.GetLeaveByID(leaveID)
    if err != nil {
        if err == sql.ErrNoRows {
            c.JSON(http.StatusNotFound, gin.H{"error": "Leave not found"})
            return
        }
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get leave"})
        return
    }

    // Check if it's the user's leave
    user, err := h.UserService.GetUserByEmail(email.(string))
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
        return
    }

    if leave.UserID != user.ID {
        c.JSON(http.StatusForbidden, gin.H{"error": "You can only delete your own leaves"})
        return
    }

    // Only allow deletion of pending leaves
    if leave.Status != models.LeaveStatusPending {
        c.JSON(http.StatusForbidden, gin.H{"error": "Only pending leaves can be deleted"})
        return
    }

    if err := h.LeaveService.DeleteLeave(leaveID); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete leave"})
        return
    }

    c.Status(http.StatusNoContent)
}

// GetHolidays returns all public holidays
func (h *Handler) GetHolidays(c *gin.Context) {
    holidays, err := h.HolidayService.GetAllHolidays()
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get holidays"})
        return
    }

    c.JSON(http.StatusOK, holidays)
}