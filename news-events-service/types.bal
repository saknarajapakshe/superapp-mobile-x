type Event record {|
    string 'type;
    string date; // ISO 8601 format: "2025-01-15"
    string end_date; // ISO 8601 format: "2025-01-16"
    string title;
    string teaser;
    string url;
    string location;
    string image;
|};

// News item data type (for RSS feed)
type NewsItem record {|
    string title;
    string link?;
    string description;
    string pubDate; // RFC 822 format: "Wed, 15 Jan 2025 10:00:00 +0000"
    string guid;
|};