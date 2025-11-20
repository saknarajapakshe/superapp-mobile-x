// internal/handlers/handlers.go
package handlers

import (
	"lsf-leave-backend/internal/constants"
	"lsf-leave-backend/internal/db"
	"lsf-leave-backend/internal/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	DB *db.Database
}

func New(db *db.Database) *Handler {
	return &Handler{DB: db}
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

	leave := models.Leave{
		UserID:    currentUser.ID,
		Type:      req.Type,
		StartDate: req.StartDate,
		EndDate:   req.EndDate,
		Reason:    req.Reason,
		Status:    string(constants.LeaveStatusPending),
		CreatedAt: time.Now(),
	}

	if err := h.DB.CreateLeave(&leave); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create leave"})
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
