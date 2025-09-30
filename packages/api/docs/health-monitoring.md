# Health Monitoring (SDK-010C)

## Overview

The health monitoring feature provides comprehensive status checks for Matomo API connectivity, cache performance, and service dependencies. This enables proactive monitoring and troubleshooting of the MatoKit service.

## API Endpoint

### `GET /tools/get-health-status`

Returns real-time health status with individual component checks.

**Parameters:**
- `siteId` (optional): Override site ID for site-specific checks
- `includeDetails` (optional): Include detailed site access verification

**Response:**
```json
{
  "status": "healthy|degraded|unhealthy",
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

## Health Checks

### 1. Matomo API Connectivity
- **Check**: Calls `API.getVersion` to verify Matomo reachability
- **Metrics**: Response time in milliseconds
- **Status**: 
  - `pass`: API responds successfully
  - `fail`: Network error or API unreachable

### 2. Reports Cache Performance
- **Check**: Analyzes cache hit/miss ratios from reporting service
- **Metrics**: Hit rate percentage
- **Status**:
  - `pass`: Hit rate > 20% (with sufficient requests)
  - `warn`: Hit rate 5-20% (with sufficient requests)
  - `fail`: Hit rate < 5% (with sufficient requests)

### 3. Rate Limit Capacity
- **Check**: Evaluates remaining Matomo API allowance from response headers
- **Metrics**: Remaining requests, reset timestamp/seconds, retry-after hints
- **Status**:
  - `pass`: Remaining > 10% of limit
  - `warn`: Remaining ≤10% or headers missing
  - `fail`: Remaining exhausted (0)

### 4. Tracking Queue Status
- **Check**: Monitors tracking queue health
- **Metrics**: Pending operations count
- **Status**: `pass` when queue is processing normally

### 5. Site Access (Optional)
- **Check**: Verifies access to specific Matomo site (when `includeDetails=true`)
- **Requirement**: Requires valid `siteId` (from parameter or default)
- **Status**:
  - `pass`: Site accessible and permissions valid
  - `fail`: Site not found or permission denied

## Overall Status Logic

- **healthy**: All checks pass
- **degraded**: Some checks have warnings but no failures
- **unhealthy**: One or more checks fail

## SDK Usage

```typescript
import { createMatomoClient } from '@matokit/sdk';

const client = createMatomoClient({
  baseUrl: 'https://matomo.example.com',
  tokenAuth: 'your-token',
  defaultSiteId: 1
});

// Basic health check
const health = await client.getHealthStatus();
console.log(`Status: ${health.status}`);

// Detailed health check with site verification
const detailedHealth = await client.getHealthStatus({ 
  includeDetails: true,
  siteId: 5 
});
```

## Monitoring Integration

The health status endpoint follows standard health check patterns and can be integrated with:

- **Load Balancers**: Use for upstream health checks
- **Monitoring Systems**: Parse JSON response for alerting
- **Dashboards**: Display real-time service health
- **CI/CD**: Verify deployment health

## Example cURL

```bash
# Basic health check
curl -H "Authorization: Bearer your-token" \
  "http://localhost:3000/tools/get-health-status"

# Detailed health check
curl -H "Authorization: Bearer your-token" \
  "http://localhost:3000/tools/get-health-status" \
  -d '{"parameters": {"includeDetails": true, "siteId": 1}}'
```