// internal/service/holiday_service.go
package service

import (
	"leave-app/internal/db"
	"time"
)

type HolidayService struct {
	DB *db.Database
}

func NewHolidayService(db *db.Database) *HolidayService {
	return &HolidayService{DB: db}
}

// GetHolidayMap retrieves all holidays as a map for fast lookup
func (s *HolidayService) GetHolidayMap() (map[string]bool, error) {
	return s.DB.GetHolidays()
}

// IsHoliday checks if a given date is a holiday
func (s *HolidayService) IsHoliday(date time.Time) (bool, error) {
	holidays, err := s.GetHolidayMap()
	if err != nil {
		return false, err
	}
	dateStr := date.Format("2006-01-02")
	return holidays[dateStr], nil
}

// GetWorkingDaysBetween returns only working days (excluding weekends and holidays)
func (s *HolidayService) GetWorkingDaysBetween(start, end time.Time) ([]time.Time, error) {
	start = time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, start.Location())
	end = time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, end.Location())

	holidays, err := s.GetHolidayMap()
	if err != nil {
		return nil, err
	}

	var days []time.Time

	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		// Skip weekends
		if d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
			continue
		}
		
		// Skip holidays
		dateStr := d.Format("2006-01-02")
		if holidays[dateStr] {
			continue
		}
		
		days = append(days, d)
	}

	return days, nil
}
