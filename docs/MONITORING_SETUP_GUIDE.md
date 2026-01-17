# Monitoring Setup Guide for Itinerary System

## Overview
This guide outlines how to add production monitoring to track errors, performance, and user experience metrics.

## 1. Error Monitoring with Sentry

### Installation
```bash
npm install @sentry/react @sentry/tracing
```

### Setup (in main.tsx)
```typescript
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [
    new BrowserTracing(),
    new Sentry.Replay({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  beforeSend(event, hint) {
    // Filter out known issues
    if (event.exception?.values?.[0]?.value?.includes('ResizeObserver')) {
      return null;
    }
    return event;
  },
});
```

### Error Boundary Integration
The `ItineraryErrorBoundary` component is already set up to log to Sentry when available.

### Custom Error Tracking
```typescript
// In itineraryAPI-simplified.ts
import * as Sentry from "@sentry/react";

async getItinerary(tripId: string): Promise<ItineraryResponse> {
  const transaction = Sentry.startTransaction({
    name: "itinerary.fetch",
    op: "http.client",
  });

  try {
    const response = await api.get(`/api/v1/trips/${tripId}/itinerary`);
    transaction.setStatus("ok");
    return response.data;
  } catch (error) {
    transaction.setStatus("internal_error");
    Sentry.captureException(error, {
      tags: {
        feature: 'itinerary',
        action: 'fetch',
        tripId
      },
      extra: {
        endpoint: `/api/v1/trips/${tripId}/itinerary`,
        errorResponse: error.response?.data
      }
    });
    throw error;
  } finally {
    transaction.finish();
  }
}
```

## 2. Performance Monitoring

### Web Vitals Tracking
```typescript
// In utils/performance.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

export function initPerformanceMonitoring() {
  // Core Web Vitals
  getCLS(metric => sendMetric('CLS', metric));
  getFID(metric => sendMetric('FID', metric));
  getFCP(metric => sendMetric('FCP', metric));
  getLCP(metric => sendMetric('LCP', metric));
  getTTFB(metric => sendMetric('TTFB', metric));

  // Custom itinerary metrics
  measureItineraryLoad();
}

function sendMetric(name: string, metric: any) {
  // Send to analytics
  if (window.gtag) {
    window.gtag('event', 'web_vitals', {
      event_category: 'Performance',
      name,
      value: Math.round(name === 'CLS' ? metric.value * 1000 : metric.value),
      event_label: metric.id,
      non_interaction: true,
    });
  }

  // Send to Sentry
  if (window.Sentry) {
    window.Sentry.addBreadcrumb({
      category: 'performance',
      message: `${name}: ${metric.value}`,
      level: 'info',
      data: metric
    });
  }
}

function measureItineraryLoad() {
  // Measure time to display first activity
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.name.includes('itinerary-first-activity')) {
          sendMetric('itinerary.firstActivity', {
            value: entry.startTime,
            id: entry.name
          });
        }
      });
    });
    observer.observe({ entryTypes: ['measure'] });
  }
}
```

### Component Performance Tracking
```typescript
// In SimplifiedItinerary component
useEffect(() => {
  // Mark when component starts loading
  performance.mark('itinerary-load-start');
  
  return () => {
    // Mark when first activity renders
    if (itinerary?.days?.[0]?.activities?.[0]) {
      performance.mark('itinerary-first-activity');
      performance.measure(
        'itinerary-load-time',
        'itinerary-load-start',
        'itinerary-first-activity'
      );
    }
  };
}, [itinerary]);
```

## 3. User Analytics

### Event Tracking
```typescript
// utils/analytics.ts
export const ItineraryAnalytics = {
  // Track page view
  viewItinerary(tripId: string, source: string) {
    if (window.gtag) {
      window.gtag('event', 'view_itinerary', {
        trip_id: tripId,
        source: source, // 'dashboard', 'direct_link', 'email'
      });
    }
  },

  // Track generation
  startGeneration(tripId: string) {
    if (window.gtag) {
      window.gtag('event', 'generate_itinerary_start', {
        trip_id: tripId,
      });
    }
  },

  completeGeneration(tripId: string, duration: number, dayCount: number) {
    if (window.gtag) {
      window.gtag('event', 'generate_itinerary_complete', {
        trip_id: tripId,
        duration_seconds: duration,
        day_count: dayCount,
      });
    }
  },

  // Track errors
  generationFailed(tripId: string, error: string) {
    if (window.gtag) {
      window.gtag('event', 'generate_itinerary_failed', {
        trip_id: tripId,
        error_message: error,
      });
    }
  },

  // Track user actions
  lockActivity(activityId: string) {
    if (window.gtag) {
      window.gtag('event', 'lock_activity', {
        activity_id: activityId,
      });
    }
  },

  viewAlternatives(activityId: string) {
    if (window.gtag) {
      window.gtag('event', 'view_alternatives', {
        activity_id: activityId,
      });
    }
  },
};
```

## 4. Real User Monitoring (RUM)

### Session Recording
```typescript
// Already included in Sentry setup with Replay integration
// Captures user sessions when errors occur
```

### Custom Metrics Dashboard
Track these KPIs:
1. **Itinerary Load Success Rate**: % of successful loads
2. **Generation Success Rate**: % of successful generations
3. **Time to First Activity**: How long until user sees content
4. **Error Rate by Type**: Network vs validation vs render errors
5. **User Actions**: Locks, alternatives viewed, edits made

## 5. Alerting Setup

### Sentry Alerts
1. **Error Spike Alert**: >10 errors in 5 minutes
2. **New Error Alert**: First occurrence of new error type
3. **Performance Alert**: Page load >5 seconds

### Custom Alerts
```typescript
// utils/monitoring.ts
export function checkHealthMetrics() {
  const metrics = {
    errorRate: getErrorRate(),
    loadTime: getAverageLoadTime(),
    successRate: getSuccessRate(),
  };

  if (metrics.errorRate > 0.05) { // >5% error rate
    alertOncall('High error rate detected', metrics);
  }

  if (metrics.loadTime > 3000) { // >3s load time
    alertOncall('Slow page load detected', metrics);
  }

  if (metrics.successRate < 0.95) { // <95% success
    alertOncall('Low success rate detected', metrics);
  }
}
```

## 6. Implementation Checklist

### Phase 1: Basic Monitoring (Day 1)
- [ ] Install Sentry
- [ ] Add Sentry initialization
- [ ] Verify error boundary integration works
- [ ] Test error capture in production

### Phase 2: Performance (Day 2)
- [ ] Add Web Vitals tracking
- [ ] Implement custom performance marks
- [ ] Set up performance alerts
- [ ] Create performance dashboard

### Phase 3: Analytics (Day 3)
- [ ] Implement event tracking
- [ ] Add user action tracking
- [ ] Set up conversion funnels
- [ ] Create analytics dashboard

### Phase 4: Optimization (Week 2)
- [ ] Analyze collected data
- [ ] Identify top errors
- [ ] Fix performance bottlenecks
- [ ] Improve based on user behavior

## 7. Dashboard Queries

### Success Rate
```sql
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  COUNT(CASE WHEN status = 'success' THEN 1 END)::float / COUNT(*) as success_rate
FROM itinerary_loads
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
```

### Error Distribution
```sql
SELECT 
  error_type,
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as affected_users
FROM itinerary_errors
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY error_type
ORDER BY count DESC;
```

### Performance P95
```sql
SELECT 
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY load_time) as p95_load_time,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY load_time) as median_load_time
FROM itinerary_performance
WHERE timestamp > NOW() - INTERVAL '24 hours';
```

## 8. Success Metrics

Target metrics after implementation:
- **Error Rate**: <1% (from current ~15%)
- **Load Time P95**: <3s (from current ~5s)
- **Generation Success**: >95% (from current ~85%)
- **User Satisfaction**: >4.5/5 stars