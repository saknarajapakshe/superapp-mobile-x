// Copyright (c) 2025 LSF. (https://lsf.lk).
//
// LSF licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import ballerina/http;
import ballerina/log;
import ballerina/time;

configurable int port = 9091;

// Sample data structure - Replace with your actual data source (database, external API, etc.)
// Events data type matching frontend expectations


listener http:Listener httpListener = new (port);

service / on httpListener {

    function init() returns error? {
        log:printInfo(string `News & Events service started on port ${port}`);
        putCachedNews(getSampleNews()); // FOR TESTING: Pre-populate cache with sample news
    }

    # Get all events
    #
    # + return - Events map or error
    isolated resource function get events() returns map<Event>|http:InternalServerError {
        log:printInfo("Fetching events");
        
        // TODO: Replace with actual data source (database query, external API call, etc.)
        map<Event> events = {};// getSampleEvents();
        
        if events.length() == 0 {
            log:printWarn("No events found");
        }
        
        return events;
    }

    # Get news feed in RSS XML format
    #
    # + return - RSS XML string or error
    resource function get news() returns xml|http:InternalServerError {
        log:printInfo("Fetching news feed");
        
        // Try cache first (in-memory, 1-day TTL). Falls back to sample data on miss.
        NewsItem[]? cached = getCachedNews();
        NewsItem[] newsItems;
        if (cached is NewsItem[]) {
            newsItems = cached;
            log:printInfo("Using cached news items");
        } else {
            // TODO: Replace with actual data source (database query, external API call, etc.)
            newsItems = getSampleNews();
            // populate cache for subsequent requests
            setCachedNews(newsItems);
            log:printInfo("Cached news items (fresh fetch)");
        }

        xml|error rssFeed = generateRSSFeed(newsItems);
        
        if rssFeed is error {
            string customError = "Failed to generate RSS feed";
            log:printError(customError, rssFeed);
            return <http:InternalServerError>{
                body: {message: customError}
            };
        }
        
        return rssFeed;
    }

    # Health check endpoint
    #
    # + return - Health status
    resource function get health() returns json {
        return {
            status: "UP",
            timestamp: time:utcNow(),
            serviceName: "news-events-service"
        };
    }
}