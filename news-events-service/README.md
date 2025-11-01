# News & Events Service

A Ballerina-based microservice that provides news and events data for the LSF SuperApp mobile application.

## Features

- **Events API**: Returns events in JSON format with timestamps
- **News Feed**: Provides news in RSS XML format
- **CORS Support**: Configurable CORS settings for cross-origin requests
- **Health Check**: Built-in health check endpoint

## Endpoints

### 1. Get Events
```
GET /events
```

Returns a map of events keyed by Unix timestamp (milliseconds).

**Response Format:**
```json
{
  "1737849600000": {
    "type": "Conference",
    "date": "2025-01-26",
    "end_date": "2025-01-28",
    "title": "Digital Transformation Summit 2025",
    "teaser": "Join us for three days of insights...",
    "url": "https://example.com/events/digital-summit-2025",
    "location": "Colombo, Sri Lanka",
    "image": "https://via.placeholder.com/272x153"
  }
}
```

### 2. Get News Feed
```
GET /news
```

Returns news in RSS 2.0 XML format.

**Response Format:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>LSF News Feed</title>
    <link>https://lsf.lk</link>
    <description>Latest news and updates from LSF</description>
    <language>en-us</language>
    <item>
      <title>New Mobile App Platform Launched</title>
      <link>https://example.com/news/mobile-platform-launch</link>
      <description><![CDATA[<p>LSF has announced...</p>]]></description>
      <pubDate>Wed, 22 Jan 2025 10:00:00 +0000</pubDate>
      <guid>news-001-2025-01-22</guid>
    </item>
  </channel>
</rss>
```

### 3. Health Check
```
GET /health
```

Returns service health status.

## Configuration

Edit the configuration values in `service.bal`:

```ballerina
configurable int port = 9091;
configurable string[] allowedOrigins = ["*"];
configurable boolean corsAllowCredentials = false;
```

Or create a `Config.toml` file:

```toml
port = 9091
allowedOrigins = ["http://localhost:8081", "https://yourdomain.com"]
corsAllowCredentials = false
```

## Running the Service

### Prerequisites
- Ballerina 2201.10.2 or later

### Start the service
```bash
bal run
```

The service will start on port `9091` by default.

### Test the endpoints

**Test Events:**
```bash
curl http://localhost:9091/events
```

**Test News:**
```bash
curl http://localhost:9091/news
```

**Test Health:**
```bash
curl http://localhost:9091/health
```

## Integration with SuperApp Frontend

Update the frontend `.env` file with the service URLs:

```properties
EXPO_PUBLIC_EVENTS_URL=http://localhost:9091/events
EXPO_PUBLIC_NEWS_URL=http://localhost:9091/news
```

For production:
```properties
EXPO_PUBLIC_EVENTS_URL=https://api.yourdomain.com/events
EXPO_PUBLIC_NEWS_URL=https://api.yourdomain.com/news
```

## Data Integration

### Replace Sample Data with Real Data Sources

The service currently uses sample data. To integrate with real data sources:

#### Option 1: Database Integration

1. Add MySQL/PostgreSQL dependency to `Ballerina.toml`:
```toml
[[dependency]]
org = "ballerinax"
name = "mysql"
version = "1.11.1"
```

2. Implement database queries in a separate module

#### Option 2: External API Integration

1. Add HTTP client to fetch from external APIs
2. Implement caching for better performance

#### Option 3: File-based Data

1. Read from JSON/XML files
2. Implement file watchers for automatic updates

### Example: Database Integration

```ballerina
import ballerinax/mysql;

configurable string dbHost = "localhost";
configurable string dbUser = "root";
configurable string dbPassword = "password";
configurable string dbName = "news_events_db";

mysql:Client dbClient = check new (
    host = dbHost,
    user = dbUser,
    password = dbPassword,
    database = dbName,
    port = 3306
);

function getEventsFromDatabase() returns map<Event>|error {
    stream<Event, error?> eventStream = dbClient->query(
        `SELECT * FROM events WHERE end_date >= CURDATE() ORDER BY date ASC`
    );
    
    map<Event> events = {};
    check from Event event in eventStream
        do {
            // Use event timestamp as key
            events[event.date] = event;
        };
    
    return events;
}
```

## Deployment

### Docker
```dockerfile
FROM ballerina/ballerina:2201.10.2

WORKDIR /app
COPY . .

RUN bal build

EXPOSE 9091

CMD ["bal", "run"]
```

### Build and run:
```bash
docker build -t news-events-service .
docker run -p 9091:9091 news-events-service
```

## Development

### Project Structure
```
news-events-service/
├── Ballerina.toml      # Project configuration
├── Dependencies.toml   # Auto-generated dependencies
├── service.bal         # Main service implementation
├── Config.toml         # Runtime configuration (optional)
└── README.md          # This file
```

### Adding New Features

1. **Add more endpoints**: Define new resource functions
2. **Add authentication**: Implement JWT validation
3. **Add pagination**: Implement limit/offset for large datasets
4. **Add filtering**: Add query parameters for filtering events/news

## License

Copyright (c) 2025 LSF. Licensed under the Apache License 2.0.
