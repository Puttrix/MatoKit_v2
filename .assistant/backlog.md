# Backlog
- [x] P-001 Harden secret management for MatoKit deployments
      tags: security,ops  priority: high  est: 0.5d
      deps: ADR-0001
      accepts: Replace placeholder bearer token, document rotation strategy, and ensure env templates reference secure secret storage.
- [ ] P-002 Integrate health endpoint with monitoring
      tags: observability,ops  priority: high  est: 1d
      deps: ADR-0002
      accepts: `/tools/get-health-status` polled by chosen platform with warning/failure thresholds defined and runbook linked in docs.
- [ ] B-001 Fix traffic channel response parsing
      tags: bug,analytics  priority: high  est: 1d
      deps: ADR-0001
      accepts: Month-period traffic channel and most-popular URL requests succeed when Matomo Cloud returns objects instead of arrays (while on-prem works); schema updated or responses normalized; tests cover the regression scenario.
- [x] P-003 Add Matomo rate-limit awareness to SDK
      tags: reliability,sdk  priority: high  est: 1.5d
      deps: ADR-0001
      accepts: Detect limit responses, throttle retries, and surface actionable guidance to API consumers with test coverage.
- [x] P-004 Make tracking retries idempotent
      tags: reliability,api  priority: medium  est: 1d
      deps: ADR-0003
      accepts: Tracking queue deduplicates retried events/goals and documents caller requirements for idempotency keys.
- [ ] P-005 Persist retry queue and cache state
      tags: infrastructure,reliability  priority: medium  est: 2d
      deps: ADR-0003
      accepts: Queue/cache survive restarts via agreed storage (e.g., Redis) with configuration docs and migration notes.
- [ ] P-006 Extend analytics coverage for assistants
      tags: feature,sdk  priority: medium  est: 3d
      deps: ADR-0001
      accepts: Additional helpers (funnels, segments, trend analysis) exposed through API tools with docs/tests updated.
- [ ] P-010 Support multi-site indexing and configuration
      tags: feature,config,multi-tenant  priority: high  est: 2d
      deps: ADR-0001
      accepts: As a deployment operator, I can configure multiple websites within one Matomo instance by defining environment-variable pairs for each siteId and site name (shared base URL) so the containerized app routes events correctly, with docs covering the env schema and limits.
- [ ] P-010A Implement MatoKit multi-site routing with numbered environment variables
      tags: feature,config,multi-tenant  priority: high  est: 2d
      deps: ADR-0001, P-010
      accepts: API/SDK maps site names to Matomo siteIds using numbered env pairs (`MATOKIT_SITE_{N}_NAME`/`MATOKIT_SITE_{N}_ID`), documentation explains how to add/remove sites with sequential numbering and any limits, and verification covers fetching data for at least two configured sites with the new routing.
- [ ] P-007 Publish Opal discovery integration guide
      tags: docs,dx  priority: low  est: 1d
      deps: ADR-0001
      accepts: README/docs include discovery payload reference, onboarding checklist, and sample tool invocations kept in sync with code.
- [ ] P-008 Introduce structured logging pipeline
      tags: ops,observability  priority: low  est: 1d
      deps: ADR-0002
      accepts: Replace console logging with structured logger, route to standard output, and document log levels for production.
- [ ] P-009 Lean build and dependency audit
      tags: maintenance,build  priority: medium  est: 1d
      deps: ADR-0001, ADR-0002, ADR-0003
      accepts: Remove unused code, dependencies, and build artifacts; document any deletions or exemptions to keep the codebase minimal.
