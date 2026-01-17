# Itinerary Database Schema for NEON

## Overview
This schema represents the complete data structure needed to support the frontend itinerary display page.

## Tables

### 1. `itineraries` (Main Table)
```sql
CREATE TABLE itineraries (
    -- Primary Keys
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    
    -- Trip Summary Data
    destination VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL, -- e.g., "London Adventure - 7 Days"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    travelers INTEGER NOT NULL DEFAULT 1,
    
    -- Cost Summary
    total_cost DECIMAL(10,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Budget Breakdown (stored as JSON for flexibility)
    budget_breakdown JSONB DEFAULT '{
        "accommodations": 0,
        "activities": 0,
        "food": 0,
        "transportation": 0,
        "other": 0,
        "total": 0
    }',
    
    -- Trip Metadata
    highlights TEXT[], -- Array of highlight strings
    local_tips TEXT[], -- Array of tips
    transportation_overview JSONB, -- General transport recommendations
    
    -- Status and Timestamps
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, ready, archived
    generation_status VARCHAR(50) DEFAULT 'not_started', -- not_started, running, ready, failed
    percent_complete INTEGER DEFAULT 0,
    
    -- Raw Data Storage
    raw_openai_response TEXT, -- Original OpenAI response
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_at TIMESTAMPTZ,
    last_modified_by UUID REFERENCES users(id),
    
    -- Indexes
    INDEX idx_itineraries_trip_id (trip_id),
    INDEX idx_itineraries_status (status),
    INDEX idx_itineraries_destination (destination)
);
```

### 2. `itinerary_days` (Day-by-Day Breakdown)
```sql
CREATE TABLE itinerary_days (
    -- Primary Keys
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    itinerary_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
    
    -- Day Information
    day_number INTEGER NOT NULL,
    date DATE NOT NULL,
    title VARCHAR(255), -- e.g., "Day 1: Arrival & City Exploration"
    theme VARCHAR(255), -- e.g., "Historical London"
    description TEXT, -- Day overview
    
    -- Weather Information
    weather_high INTEGER, -- Fahrenheit
    weather_low INTEGER,
    weather_condition VARCHAR(50), -- sunny, cloudy, rainy, snowy
    weather_description TEXT,
    
    -- Activity Summary
    estimated_walking_time VARCHAR(50), -- e.g., "2-3 hours"
    estimated_distance VARCHAR(50), -- e.g., "5-7 miles"
    total_activities INTEGER DEFAULT 0,
    
    -- Cost
    total_cost DECIMAL(10,2) DEFAULT 0,
    
    -- Raw Data
    raw_description TEXT, -- Original unparsed text
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(itinerary_id, day_number),
    
    -- Indexes
    INDEX idx_days_itinerary_id (itinerary_id),
    INDEX idx_days_date (date)
);
```

### 3. `itinerary_activities` (Individual Activities)
```sql
CREATE TABLE itinerary_activities (
    -- Primary Keys
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_id UUID NOT NULL REFERENCES itinerary_days(id) ON DELETE CASCADE,
    
    -- Core Activity Information
    title VARCHAR(255) NOT NULL,
    description TEXT,
    activity_type VARCHAR(50) NOT NULL, -- transport, restaurant, accommodation, attraction, shopping, activity
    
    -- Timing
    time VARCHAR(20), -- Display time "9:00 AM"
    start_time TIME NOT NULL, -- 24-hour format for sorting
    end_time TIME,
    duration INTERVAL, -- Calculated from start/end
    
    -- Location Information
    location_name VARCHAR(255) NOT NULL,
    location_address TEXT,
    location_lat DECIMAL(10,8),
    location_lng DECIMAL(11,8),
    location_place_id VARCHAR(255), -- Google Places ID
    neighborhood VARCHAR(255),
    
    -- Cost Information
    cost DECIMAL(10,2) DEFAULT 0,
    cost_currency VARCHAR(3) DEFAULT 'USD',
    cost_per_person BOOLEAN DEFAULT false,
    price_level INTEGER, -- 1-4 scale ($ to $$$$)
    
    -- Booking Information
    booking_required BOOLEAN DEFAULT false,
    booking_url TEXT,
    booking_phone VARCHAR(50),
    booking_email VARCHAR(255),
    booking_notes TEXT,
    
    -- Transportation (How to get here from previous activity)
    transport_method VARCHAR(50), -- walk, taxi, subway, bus, car
    transport_line VARCHAR(100), -- e.g., "Piccadilly Line"
    transport_station VARCHAR(255), -- e.g., "Russell Square Station"
    transport_duration VARCHAR(50), -- e.g., "15 minutes"
    transport_instructions TEXT,
    transport_cost DECIMAL(10,2),
    
    -- Activity Details
    rating DECIMAL(2,1), -- 0.0 to 5.0
    rating_count INTEGER,
    tags TEXT[], -- Array of tags
    tips TEXT[], -- Array of helpful tips
    
    -- User Interaction
    is_locked BOOLEAN DEFAULT false,
    is_bookmarked BOOLEAN DEFAULT false,
    user_notes TEXT,
    
    -- Matching & Personalization
    match_score INTEGER, -- 0-100
    why_recommended TEXT,
    alternatives UUID[], -- Array of alternative activity IDs
    
    -- Operating Hours (stored as JSON for flexibility)
    operating_hours JSONB, -- {"monday": "9:00-17:00", ...}
    
    -- Additional Metadata
    website_url TEXT,
    image_urls TEXT[],
    accessibility_info JSONB,
    
    -- Parsing Metadata
    parsed_from_line INTEGER, -- Line number in raw text
    parsing_confidence DECIMAL(3,2), -- 0.00 to 1.00
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_activities_day_id (day_id),
    INDEX idx_activities_start_time (start_time),
    INDEX idx_activities_type (activity_type),
    INDEX idx_activities_location_name (location_name)
);
```

### 4. `itinerary_parse_logs` (Parsing Audit Trail)
```sql
CREATE TABLE itinerary_parse_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    itinerary_id UUID REFERENCES itineraries(id) ON DELETE CASCADE,
    
    -- Parse Information
    parse_timestamp TIMESTAMPTZ DEFAULT NOW(),
    parse_version VARCHAR(20), -- Parser version
    
    -- Results
    days_parsed INTEGER,
    activities_parsed INTEGER,
    parse_errors JSONB, -- Array of error objects
    parse_warnings JSONB, -- Array of warning objects
    
    -- Performance
    parse_duration_ms INTEGER,
    
    -- Raw Data Snapshot
    raw_input TEXT, -- What was parsed
    parsed_output JSONB, -- Result before DB insertion
    
    INDEX idx_parse_logs_itinerary_id (itinerary_id),
    INDEX idx_parse_logs_timestamp (parse_timestamp)
);
```

## Supporting Views

### 1. `v_itinerary_summary` (For Dashboard/List Views)
```sql
CREATE VIEW v_itinerary_summary AS
SELECT 
    i.id,
    i.trip_id,
    i.destination,
    i.title,
    i.start_date,
    i.end_date,
    i.travelers,
    i.total_cost,
    i.currency,
    i.status,
    COUNT(DISTINCT d.id) as total_days,
    COUNT(DISTINCT a.id) as total_activities,
    ARRAY_AGG(DISTINCT a.activity_type) as activity_types,
    i.created_at,
    i.updated_at
FROM itineraries i
LEFT JOIN itinerary_days d ON d.itinerary_id = i.id
LEFT JOIN itinerary_activities a ON a.day_id = d.id
GROUP BY i.id;
```

### 2. `v_daily_summary` (For Day Cards)
```sql
CREATE VIEW v_daily_summary AS
SELECT 
    d.*,
    COUNT(a.id) as activity_count,
    MIN(a.start_time) as first_activity_time,
    MAX(a.end_time) as last_activity_time,
    SUM(a.cost) as calculated_total_cost,
    ARRAY_AGG(a.activity_type) as activity_types
FROM itinerary_days d
LEFT JOIN itinerary_activities a ON a.day_id = d.id
GROUP BY d.id;
```

## Key Design Decisions

1. **Separate Tables**: Activities are in their own table for easier querying and updating
2. **JSONB for Flexible Data**: Operating hours, accessibility info, parse errors use JSONB
3. **Arrays for Lists**: Tags, tips, highlights use PostgreSQL arrays
4. **Audit Trail**: Parse logs track what was extracted and any issues
5. **Soft References**: Alternative activities use UUID array instead of junction table
6. **Denormalized Costs**: Total costs stored at each level for performance
7. **Raw Data Retention**: Keep original OpenAI response for re-parsing
8. **Time Storage**: Both display time ("9:00 AM") and sortable time (09:00:00)

## Indexing Strategy

- Foreign keys for joins
- Status fields for filtering
- Dates and times for sorting
- Location names for search
- Activity types for categorization

## Migration Notes

1. **From Current System**: 
   - Parse `description` field from existing days table
   - Populate new tables with parsed data
   - Keep raw response for future re-parsing

2. **Backward Compatibility**:
   - Keep existing tables during transition
   - Use views to maintain current API contracts
   - Gradually migrate frontend to use new structure