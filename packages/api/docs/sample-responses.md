# Sample Tool Responses

These examples assume the service is running locally on `http://localhost:4000` with the default bearer token `change-me`.

## GetKeyNumbers

**Request**
```bash
curl -X POST http://localhost:4000/tools/get-key-numbers \
  -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' \
  -d '{"parameters":{"period":"day","date":"today"}}'
```

**Response**
```json
{
  "nb_visits": 0,
  "nb_uniq_visitors": 0,
  "nb_actions": 0,
  "nb_pageviews": 0,
  "nb_uniq_pageviews": 0,
  "nb_users": 0,
  "nb_visits_converted": 0,
  "sum_visit_length": 0,
  "max_actions": 0,
  "bounce_rate": "0%",
  "nb_actions_per_visit": 0,
  "bounce_count": 0,
  "avg_time_on_site": 0
}
```

## GetMostPopularUrls

**Request**
```bash
curl -X POST http://localhost:4000/tools/get-most-popular-urls \
  -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' \
  -d '{"parameters":{"period":"week","date":"today","limit":5}}'
```

**Example Response**
```json
[
  {
    "label": "/",
    "url": "https://example.com/",
    "nb_hits": 42,
    "nb_visits": 37,
    "nb_uniq_visitors": 35,
    "sum_time_spent": 912
  },
  {
    "label": "/blog/hello-world",
    "url": "https://example.com/blog/hello-world",
    "nb_hits": 15,
    "nb_visits": 12,
    "nb_uniq_visitors": 10,
    "sum_time_spent": 301
  }
]
```

## GetTopReferrers

**Request**
```bash
curl -X POST http://localhost:4000/tools/get-top-referrers \
  -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' \
  -d '{"parameters":{"period":"week","date":"today","limit":5}}'
```

**Example Response**
```json
[
  {
    "label": "Search Engines",
    "nb_visits": 21,
    "nb_actions": 54,
    "nb_visits_converted": 2
  },
  {
    "label": "Websites",
    "nb_visits": 9,
    "nb_actions": 17,
    "nb_visits_converted": 1
  }
]
```

## GetEntryPages

**Request**
```bash
curl -X POST http://localhost:4000/tools/get-entry-pages \
  -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' \
  -d '{"parameters":{"period":"day","date":"2025-09-01","limit":5}}'
```

**Example Response**
```json
[
  {
    "label": "/community/events/events-035",
    "url": "https://example.com/community/events/events-035",
    "nb_visits": 99,
    "nb_uniq_visitors": 96,
    "entry_nb_visits": 26,
    "entry_nb_actions": 120,
    "entry_bounce_count": 3,
    "sum_time_spent": 91,
    "avg_time_on_page": 1,
    "bounce_rate": "12%",
    "exit_rate": "21%"
  },
  {
    "label": "/blog/announcements/announcements-010",
    "url": "https://example.com/blog/announcements/announcements-010",
    "nb_visits": 96,
    "nb_uniq_visitors": 88,
    "entry_nb_visits": 21,
    "entry_nb_actions": 98,
    "entry_bounce_count": 3,
    "sum_time_spent": 99,
    "avg_time_on_page": 1,
    "bounce_rate": "14%",
    "exit_rate": "23%"
  }
]
```

## GetCampaigns

**Request**
```bash
curl -X POST http://localhost:4000/tools/get-campaigns \
  -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' \
  -d '{"parameters":{"period":"month","date":"2025-01-01","limit":5}}'
```

**Example Response**
```json
[
  {
    "label": "Winter Sale",
    "nb_visits": 120,
    "nb_actions": 265,
    "nb_visits_converted": 18,
    "revenue": 5400
  },
  {
    "label": "Retargeting",
    "nb_visits": 84,
    "nb_actions": 143,
    "nb_visits_converted": 9,
    "revenue": 2250
  }
]
```

## GetTrafficChannels

**Request**
```bash
curl -X POST http://localhost:4000/tools/get-traffic-channels \
  -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' \
  -d '{"parameters":{"period":"week","date":"today","channelType":"search"}}'
```

**Example Response**
```json
[
  {
    "label": "Search Engines",
    "nb_visits": 480,
    "nb_actions": 1310,
    "nb_visits_converted": 42,
    "sum_visit_length": 86400
  },
  {
    "label": "Direct Entry",
    "nb_visits": 320,
    "nb_actions": 720,
    "nb_visits_converted": 18,
    "sum_visit_length": 54000
  }
]
```

## GetGoalConversions

**Request**
```bash
curl -X POST http://localhost:4000/tools/get-goal-conversions \
  -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' \
  -d '{"parameters":{"period":"month","date":"2025-01","goalType":"ecommerce"}}'
```

**Example Response**
```json
[
  {
    "id": "ecommerceOrder",
    "label": "Orders",
    "type": "ecommerce",
    "nb_conversions": 48,
    "nb_visits_converted": 32,
    "revenue": 16420
  },
  {
    "id": "2",
    "label": "Newsletter Signup",
    "type": "manual",
    "nb_conversions": 18,
    "nb_visits_converted": 18
  }
]
```

## GetEcommerceOverview

**Request**
```bash
curl -X POST http://localhost:4000/tools/get-ecommerce-overview \
  -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' \
  -d '{"parameters":{"period":"day","date":"yesterday"}}'
```

**Example Response**
```json
{
  "nb_conversions": 7,
  "nb_visits_converted": 5,
  "revenue": 1349.75,
  "revenue_per_conversion": 192.8214,
  "avg_order_revenue": 192.8214,
  "items": 21,
  "revenue_subtotal": 1299.75,
  "revenue_tax": 30,
  "revenue_shipping": 40,
  "revenue_discount": 20
}
```

## GetEcommerceRevenue

**Request**
```bash
curl -X POST http://localhost:4000/tools/get-ecommerce-revenue \
  -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' \
  -d '{"parameters":{"period":"day","date":"last7","includeSeries":true}}'
```

**Example Response**
```json
{
  "totals": {
    "nb_conversions": 32,
    "revenue": 4820,
    "avg_order_revenue": 150.625,
    "items": 96
  },
  "series": [
    {
      "label": "2025-09-20",
      "nb_conversions": 4,
      "revenue": 600,
      "avg_order_revenue": 150,
      "items": 12
    },
    {
      "label": "2025-09-21",
      "nb_conversions": 6,
      "revenue": 930,
      "avg_order_revenue": 155,
      "items": 18
    }
  ]
}
```

## GetEventCategories

**Request**
```bash
curl -X POST http://localhost:4000/tools/get-event-categories \
  -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' \
  -d '{"parameters":{"period":"week","date":"today","limit":5}}'
```

**Example Response**
```json
[
  {
    "label": "CTA",
    "nb_events": 58,
    "nb_visits": 42,
    "sum_event_value": 110,
    "avg_event_value": 1.9
  },
  {
    "label": "Navigation",
    "nb_events": 33,
    "nb_visits": 27,
    "sum_event_value": 0
  }
]
```

## GetDeviceTypes

**Request**
```bash
curl -X POST http://localhost:4000/tools/get-device-types \
  -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' \
  -d '{"parameters":{"period":"month","date":"2025-01","limit":5}}'
```

**Example Response**
```json
[
  {
    "label": "Desktop",
    "nb_visits": 980,
    "nb_actions": 4123,
    "sum_visit_length": 128400,
    "bounce_rate": "32%"
  },
  {
    "label": "Smartphone",
    "nb_visits": 645,
    "nb_actions": 1984,
    "sum_visit_length": 58320,
    "bounce_rate": "48%"
  }
]
```

## TrackPageview

**Request**
```bash
curl -X POST http://localhost:4000/track/pageview \
  -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' \
  -d '{"parameters":{"url":"https://example.com/","actionName":"Homepage"}}'
```

**Response**
```json
{
  "ok": true,
  "status": 204,
  "pvId": "abcdef1234567890"
}
```

## TrackEvent

**Request**
```bash
curl -X POST http://localhost:4000/track/event \
  -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' \
  -d '{"parameters":{"category":"CTA","action":"click","value":1}}'
```

**Response**
```json
{
  "ok": true,
  "status": 204
}
```

## TrackGoal

**Request**
```bash
curl -X POST http://localhost:4000/track/goal \
  -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' \
  -d '{"parameters":{"goalId":5,"revenue":10.5}}'
```

**Response**
```json
{
  "ok": true,
  "status": 204
}
```

> Tip: Use segments or different date/period combinations to explore other datasets while testing.

## GetKeyNumbersHistorical

**Request**
```bash
curl -X POST http://localhost:4000/tools/get-key-numbers-historical \
  -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' \
  -d '{"parameters":{"period":"day","date":"last7"}}'
```

**Example Response**
```json
  {
    "date": "2024-02-01",
    "nb_visits": 120,
    "nb_actions": 430,
    "nb_pageviews": 310,
    "nb_uniq_pageviews": 290
  },
  {
    "date": "2024-02-02",
    "nb_visits": 98,
    "nb_actions": 360,
    "nb_pageviews": 270,
    "nb_uniq_pageviews": 250
  }
]
```

## GetHealthStatus

**Request**
```bash
curl -X POST http://localhost:3000/tools/get-health-status \
  -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' \
  -d '{"parameters":{}}'
```

**Response (Healthy)**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-30T15:30:00.000Z",
  "checks": [
    {
      "name": "matomo-api",
      "status": "pass",
      "componentType": "service",
      "observedValue": 145,
      "observedUnit": "ms",
      "time": "2025-09-30T15:30:00.000Z",
      "output": "API responded in 145ms"
    },
    {
      "name": "reports-cache",
      "status": "pass",
      "componentType": "cache",
      "observedValue": 85.5,
      "observedUnit": "%",
      "time": "2025-09-30T15:30:00.000Z",
      "output": "Hit rate: 85.5% (342/400 requests)"
    },
    {
      "name": "tracking-queue",
      "status": "pass",
      "componentType": "queue",
      "observedValue": 0,
      "observedUnit": "pending",
      "time": "2025-09-30T15:30:00.000Z",
      "output": "Queue processing normally"
    },
    {
      "name": "rate-limit",
      "status": "pass",
      "componentType": "service",
      "observedValue": 90,
      "observedUnit": "requests",
      "time": "2025-09-30T15:30:00.000Z",
      "output": "Limit 120 • Remaining 90 • Resets at 2025-09-30T15:35:00.000Z"
    }
  ]
}
```

**Request with Details**
```bash
curl -X POST http://localhost:3000/tools/get-health-status \
  -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' \
  -d '{"parameters":{"includeDetails":true,"siteId":1}}'
```

**Response (with Site Check)**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-30T15:30:00.000Z",
  "checks": [
    {
      "name": "matomo-api",
      "status": "pass",
      "componentType": "service",
      "observedValue": 145,
      "observedUnit": "ms",
      "time": "2025-09-30T15:30:00.000Z",
      "output": "API responded in 145ms"
    },
    {
      "name": "reports-cache",
      "status": "pass",
      "componentType": "cache",
      "observedValue": 85.5,
      "observedUnit": "%",
      "time": "2025-09-30T15:30:00.000Z",
      "output": "Hit rate: 85.5% (342/400 requests)"
    },
    {
      "name": "tracking-queue",
      "status": "pass",
      "componentType": "queue",
      "observedValue": 0,
      "observedUnit": "pending",
      "time": "2025-09-30T15:30:00.000Z",
      "output": "Queue processing normally"
    },
    {
      "name": "rate-limit",
      "status": "pass",
      "componentType": "service",
      "observedValue": 90,
      "observedUnit": "requests",
      "time": "2025-09-30T15:30:00.000Z",
      "output": "Limit 120 • Remaining 90 • Resets at 2025-09-30T15:35:00.000Z"
    },
    {
      "name": "site-access",
      "status": "pass",
      "componentType": "service",
      "time": "2025-09-30T15:30:00.000Z",
      "output": "Site ID 1 accessible"
    }
  ]
}
```

**Response (Degraded)**
```json
{
  "status": "degraded",
  "timestamp": "2025-09-30T15:30:00.000Z",
  "checks": [
    {
      "name": "matomo-api",
      "status": "pass",
      "componentType": "service",
      "observedValue": 145,
      "observedUnit": "ms",
      "time": "2025-09-30T15:30:00.000Z",
      "output": "API responded in 145ms"
    },
    {
      "name": "reports-cache",
      "status": "warn",
      "componentType": "cache",
      "observedValue": 15.2,
      "observedUnit": "%",
      "time": "2025-09-30T15:30:00.000Z",
      "output": "Hit rate: 15.2% (76/500 requests)"
    },
    {
      "name": "tracking-queue",
      "status": "pass",
      "componentType": "queue",
      "observedValue": 0,
      "observedUnit": "pending",
      "time": "2025-09-30T15:30:00.000Z",
      "output": "Queue processing normally"
    },
    {
      "name": "rate-limit",
      "status": "warn",
      "componentType": "service",
      "observedValue": 4,
      "observedUnit": "requests",
      "time": "2025-09-30T15:30:00.000Z",
      "output": "Limit 120 • Remaining 4 • Resets at 2025-09-30T15:35:00.000Z"
    }
  ]
}
```

````
```
