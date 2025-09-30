# Backlog

## Done
| ID | Title | Notes |
|----|-------|-------|
| SDK-001 | SDK core `matomoGet()` helper | Fetch wrapper + query builder + zod parsing |
| SDK-002 | `getKeyNumbers` implementation | Types + unit tests |
| SDK-003 | `getMostPopularUrls` implementation | Include `flat=1` handling + tests |
| SDK-004 | `getTopReferrers` implementation | Add pagination helpers + tests |
| API-001 | Tool service skeleton | Express app with Opal Tools SDK wiring |
| API-002 | Tool discovery generation | `/discovery` via ToolsService + tool registration |
| TRK-001 | `trackPageview` queue + retry | In-memory retry queue with pv_id continuity |
| TRK-002 | `trackEvent` and `trackGoal` | Shared tracking service + API tools |
| INF-002 | Containerization support | Dockerfile, docker-compose, and Portainer stack setup verified in Portainer environment |
| SDK-005 | Expand Matomo data points | Ecommerce metrics, expanded events, additional reporting helpers |
| INF-003 | Production cache monitoring | Cache stats + event hooks expose hit/miss metrics; ready for observability wiring |
| INF-001 | CI workflow (lint/test/build) | GitHub Actions workflow with lint/type/test |
| DOC-001 | README + examples | Root README + curl samples in docs |
| SDK-006 | Aggregate e-commerce revenue reporting | Added revenue totals helper + API tool with optional per-period breakdown |
| SDK-007 | Goal-specific conversion handling | Goal conversions tool + filters with labeled ecommerce/manual types |
| SDK-008 | Traffic channel flexibility | Added traffic channel helper + API tool with filtering + docs/tests |
| SDK-010A | Matomo error diagnostics | SDK `runDiagnostics` helper + `/tools/diagnose-matomo` Opal endpoint |
| SDK-010B | Enhanced API error handling | Classified Matomo errors with guidance-rich `MatomoApiError` subclasses |
| SDK-010C | Service health monitoring | Added `getHealthStatus()` method with proactive health checks for Matomo/externals and `/tools/get-health-status` endpoint |
| SDK-010E | Rate limit awareness | Track Matomo rate limit headers, surface warnings, and document health guidance |
| BUG-002 | Key numbers scalar parsing | Coerce scalar Matomo responses into key-number objects to avoid Zod failures |
| BUG-003 | Key numbers array parsing | Ensure array-wrapped Matomo responses (single & series) are unwrapped before Zod validation |
| BUG-001 | Handle NaN key metrics | `getKeyNumbers` NaN handling implemented alongside BUG-002/BUG-003 with `toFiniteNumber()` guards and series fallbacks |

## Todo
| ID | Title | Notes |
|----|-------|-------|
| SDK-010D | Contextual error guidance | Map common Matomo errors to actionable remediation tips within responses |
| SDK-010F | Idempotent request support | Ensure repeatable write operations avoid duplicate effects during retries |
| INF-004 | Structured logging | Replace console with Pino/Winston in production and restrict stdout to warn/error levels |
| SDK-011 | Analyze historical key numbers | Derive peak values across key metrics from GetKeyNumbersHistorical data and present results |
| SDK-012A | Clarify ambiguous analytics requests | Add follow-up prompts/default periods when time range is missing |
| SDK-012B | Long-running request feedback | Surface progress indicators for expensive Matomo data fetches |
| SDK-012C | Interactive analytics follow-ups | Offer next-step suggestions (e.g., top 5 days, comparisons) after results |
| SDK-012D | Personalized reporting defaults | Learn per-user period preferences and apply automatically |
| SDK-013A | Trend analysis insights | Detect week-over-week changes and seasonal patterns in historical metrics |
| SDK-013B | Anomaly detection | Flag significant spikes/dips in metrics relative to typical ranges |
| SDK-013C | Comparative analytics | Support cross-period/segment/site comparisons within Matomo reports |
| SDK-013D | Predictive forecasting | Offer simple forward-looking projections based on historical trends |
| SDK-014A | Cross-tool data correlation | Combine Matomo analytics with external campaign data to explain traffic spikes |
| SDK-014B | Automated reporting schedules | Allow recurring summary delivery (e.g., weekly top pages reports) |
| SDK-014C | Export analytics results | Provide CSV/PDF export options for Matomo insights |
| SDK-015 | Funnel analytics support | Wrap Matomo Funnels API (or goal/event composition) into an Opal tool for step-wise drop-off summaries |
| SDK-016 | Site search keyword insights | Add `getInternalSearchKeywords` helper wrapping `Actions.getSiteSearchKeywords` with optional filters and expose via Opal tool |
| SDK-017 | Page transitions reporting | Wrap `Transitions.getTransitionsForPage` into a structured Opal tool highlighting previous/next pages, exits, and loops |
| SDK-018 | Daily ecommerce conversions | Add helper/tool to fetch per-day ecommerce conversion metrics (e.g., via `Goals.getItems` or `Ecommerce.getEcommerceConversions`) |

## Parking Lot
- Potential Redis cache layer for reporting responses.
- Optional Docusaurus docs site post-MVP.
## Notes
- Current baseline is stable; tag or record this commit before major changes so you can revert if new work regresses behaviour.
- Process reminder: update this backlog immediately whenever a task is completed so Done/Todo stay accurate.
- | SDK-009A | Test ideas tool signature | todo | Add goal/change-size/customer-data params to the ideation endpoint + update types |
- | SDK-009B | Context-aware prioritisation | todo | Weight OXS heuristics using new params + map goals/change size to suggestions |
- | SDK-009C | LLM prompt & instructions | todo | Refresh tool descriptions and guidance so channel/test goal queries route correctly |
- | SDK-009D | Docs & samples for CRO inputs | todo | Document the new knobs in README + sample requests |
