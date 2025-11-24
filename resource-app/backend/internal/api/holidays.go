package api

import (
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
	"github.com/gin-gonic/gin"
)

const (
	ICS_URL           = "https://www.officeholidays.com/ics-clean/sri-lanka"
	CACHE_DURATION    = 24 * time.Hour // Cache for 24 hours
)

type PublicHoliday struct {
	Date        string   `json:"date"`
	LocalName   string   `json:"localName"`
	Name        string   `json:"name"`
	Description string   `json:"description,omitempty"`
	CountryCode string   `json:"countryCode"`
	Fixed       bool     `json:"fixed"`
	Global      bool     `json:"global"`
	Types       []string `json:"types"`
}

var (
	cachedHolidays []PublicHoliday
	cacheTime      time.Time
	cacheMutex     sync.RWMutex
)

// HandleGetHolidays fetches and parses ICS file, returns as JSON
func HandleGetHolidays() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check cache with read lock
		cacheMutex.RLock()
		if time.Since(cacheTime) < CACHE_DURATION && len(cachedHolidays) > 0 {
			data := cachedHolidays
			cacheMutex.RUnlock()
			c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
			return
		}
		cacheMutex.RUnlock()

		// Acquire write lock for fetching and updating cache
		cacheMutex.Lock()
		defer cacheMutex.Unlock()

		// Double-check cache after acquiring write lock (another goroutine might have updated it)
		if time.Since(cacheTime) < CACHE_DURATION && len(cachedHolidays) > 0 {
			c.JSON(http.StatusOK, gin.H{"success": true, "data": cachedHolidays})
			return
		}

		// Fetch ICS file
		resp, err := http.Get(ICS_URL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch holidays"})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch holidays"})
			return
		}

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read holidays"})
			return
		}

		// Parse ICS (simple parsing)
		holidays := parseICS(string(body))

		// Update cache
		cachedHolidays = holidays
		cacheTime = time.Now()

		c.JSON(http.StatusOK, gin.H{"success": true, "data": holidays})
	}
}

// Simple ICS parser - extracts DTSTART, SUMMARY, and DESCRIPTION
func parseICS(icsContent string) []PublicHoliday {
	var holidays []PublicHoliday
	lines := strings.Split(icsContent, "\n")

	var currentDate, currentSummary, currentDescription string

	for _, line := range lines {
		line = strings.TrimSpace(line)

		if strings.HasPrefix(line, "DTSTART;VALUE=DATE:") {
			dateStr := strings.TrimPrefix(line, "DTSTART;VALUE=DATE:")
			// Convert YYYYMMDD to YYYY-MM-DD
			if len(dateStr) >= 8 {
				currentDate = dateStr[0:4] + "-" + dateStr[4:6] + "-" + dateStr[6:8]
			}
		}

		if strings.HasPrefix(line, "SUMMARY;LANGUAGE=en-us:") {
			currentSummary = strings.TrimPrefix(line, "SUMMARY;LANGUAGE=en-us:")
		}

		if strings.HasPrefix(line, "DESCRIPTION:") {
			desc := strings.TrimPrefix(line, "DESCRIPTION:")
			// Clean up description - remove the "Information provided by..." footer
			desc = strings.ReplaceAll(desc, "\\n", " ")
			desc = strings.TrimSpace(desc)
			// Remove the footer text
			if idx := strings.Index(desc, "Information provided by"); idx != -1 {
				desc = desc[:idx]
			}
			currentDescription = strings.TrimSpace(desc)
		}

		if line == "END:VEVENT" && currentDate != "" && currentSummary != "" {
			holidays = append(holidays, PublicHoliday{
				Date:        currentDate,
				LocalName:   currentSummary,
				Name:        currentSummary,
				Description: currentDescription,
				CountryCode: "LK",
				Fixed:       false,
				Global:      true,
				Types:       []string{"Public"},
			})
			currentDate = ""
			currentSummary = ""
			currentDescription = ""
		}
	}
	return holidays
}
