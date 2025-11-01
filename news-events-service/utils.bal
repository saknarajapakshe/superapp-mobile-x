import ballerina/time;

// Simple in-memory cache with per-item timestamps and 1-day TTL
type CacheEntry record {|
    NewsItem item;
    int cachedAt; // epoch millis when this entry was stored
|};

CacheEntry[]? cachedNews = ();

const int ONE_DAY_MS = 86400000; // 24 * 60 * 60 * 1000

// Return cached news if present and not expired, otherwise return ()
function getCachedNews() returns NewsItem[]? {
    if (cachedNews is CacheEntry[]) {
        // compute now in ms
        var nowTuple = time:utcNow();
        int nowMs = <int>nowTuple[0] * 1000 + <int>(nowTuple[1] / 1000000);

        // Collect fresh entries and drop expired ones
        CacheEntry[] entries = <CacheEntry[]> cachedNews;
        CacheEntry[] fresh = [];
        foreach CacheEntry e in entries {
            if (nowMs - e.cachedAt < ONE_DAY_MS) {
                fresh.push(e);
            }
        }

        if (fresh.length() > 0) {
            // update cache to only keep fresh entries
            cachedNews = fresh;
            NewsItem[] result = [];
            foreach CacheEntry e in fresh {
                result.push(e.item);
            }
            return result;
        }

        // all expired
        cachedNews = ();
        return ();
    }
    return ();
}

function setCachedNews(NewsItem[] news) {
    var nowTuple = time:utcNow();
    int nowMs = <int>nowTuple[0] * 1000 + <int>(nowTuple[1] / 1000000);
    CacheEntry[] entries = [];
    foreach NewsItem n in news {
        entries.push({ item: n, cachedAt: nowMs });
    }
    cachedNews = entries;
}

// Put-style API: append the provided news items to the cache (preserve existing entries).
// Does not return previous value — it simply adds entries with current timestamp.
function putCachedNews(NewsItem[] news) {
    var nowTuple = time:utcNow();
    int nowMs = <int>nowTuple[0] * 1000 + <int>(nowTuple[1] / 1000000);
    CacheEntry[] entriesToAdd = [];
    foreach NewsItem n in news {
        entriesToAdd.push({ item: n, cachedAt: nowMs });
    }

    if (cachedNews is CacheEntry[]) {
        CacheEntry[] entries = <CacheEntry[]> cachedNews;
        // append
        foreach CacheEntry e in entriesToAdd {
            entries.push(e);
        }
        cachedNews = entries;
    } else {
        cachedNews = entriesToAdd;
    }
}

// Helper function to generate RSS feed XML
function generateRSSFeed(NewsItem[] items) returns xml|error {
    xml rssItems = xml ``;
    
    foreach NewsItem item in items {
        // Include <link> only when item.link is present
        xml linkXml = xml ``;
        if (item.link is string) {
            // cast to string to satisfy xml interpolation typing
            linkXml = xml `<link>${<string>item.link}</link>`;
        }

        xml itemXml = xml `<item>
            <title>${item.title}</title>
            ${linkXml}
            <description><![CDATA[${item.description}]]></description>
            <pubDate>${item.pubDate}</pubDate>
            <guid>${item.guid}</guid>
        </item>`;
        
        rssItems = rssItems + itemXml;
    }
    
    xml rssFeed = xml `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
        <channel>
            <title>LSF News Feed</title>
            <link>https://opensource.lk</link>
            <description>Latest news and updates from LSF</description>
            <language>en-us</language>
            ${rssItems}
        </channel>
    </rss>`;
    
    return rssFeed;
}

// Sample data functions - Replace these with your actual data sources
function getSampleEvents() returns map<Event> {
    // Events are keyed by timestamp as expected by frontend
    map<Event> events = {
        "1737849600000": {
            'type: "Conference",
            date: "2025-01-26",
            end_date: "2025-01-28",
            title: "Digital Transformation Summit 2025",
            teaser: "Join us for three days of insights into the future of digital transformation. Leading experts will share their experiences and best practices.",
            url: "https://example.com/events/digital-summit-2025",
            location: "Colombo, Sri Lanka",
            image: "https://via.placeholder.com/272x153"
        },
        "1738454400000": {
            'type: "Workshop",
            date: "2025-02-02",
            end_date: "2025-02-02",
            title: "Cloud Architecture Masterclass",
            teaser: "Learn how to design and implement scalable cloud architectures. Hands-on workshop with real-world scenarios.",
            url: "https://example.com/events/cloud-masterclass",
            location: "Online",
            image: "https://via.placeholder.com/272x153"
        },
        "1739059200000": {
            'type: "Webinar",
            date: "2025-02-09",
            end_date: "2025-02-09",
            title: "AI and Machine Learning in Practice",
            teaser: "Discover practical applications of AI and ML in modern software development. Interactive Q&A session included.",
            url: "https://example.com/events/ai-ml-webinar",
            location: "Virtual Event",
            image: "https://via.placeholder.com/272x153"
        }
    };
    
    return events;
}

function getSampleNews() returns NewsItem[] {
    NewsItem[] news = [
        {
            title: "LSF Super App v0.1 Launched",
            description: "<p>Lanka Software Foundation has announced the launch of the initial version of the Open Super App — a framework for building modular super apps.</p>",
            pubDate: "Mon, 1 Nov 2025 10:00:00 +0000",
            guid: "news-001-2025-11-01"
        }
    ];
    
    return news;
}
