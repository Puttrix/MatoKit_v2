# Task Log
| 2025-10-01 | codex | Implemented SDK-010E rate limit awareness | done | Captured Matomo rate limit headers, surfaced health warnings, added docs/tests for monitoring |
| 2025-09-30 | putte | Documented SDK-010C health monitoring | done | Updated README with health monitoring section, tool endpoints table, and sample responses with comprehensive examples |
| 2025-09-30 | putte | Implemented SDK-010C service health monitoring | done | Added getHealthStatus() method to MatomoClient with comprehensive health checks for API, cache, and dependencies plus /tools/get-health-status endpoint |
| 2025-09-30 | putte | Updated backlog for BUG-001 completion | done | Moved BUG-001 to Done section; was resolved alongside BUG-002/BUG-003 on 2025-09-27 with comprehensive NaN handling |
| 2025-09-27 | codex | Verified containerization stack | done | Confirmed docker-compose and Portainer deployment running in production environment |
| 2025-09-27 | codex | Expanded SDK data points | done | Added ecommerce overview, event categories, device types helpers + API tools/tests |
| 2025-09-27 | codex | Added cache monitoring | done | Cache stats API + event hooks for reporting helpers, docs updated |
| 2025-09-27 | codex | Added ecommerce revenue totals | done | New SDK helper + API tool and docs for aggregated revenue |
| 2025-09-27 | codex | Added traffic channel breakdown | done | New SDK helper + GetTrafficChannels API tool with docs/tests |
| 2025-09-27 | codex | Added goal conversions tooling | done | New goal conversion helper + API tool with filters/labeled types |

| Date (UTC) | Owner | Task | Status | Notes |
|------------|-------|------|--------|-------|
| 2025-09-26 | codex | Initialized memory files | done | Created backlog, roadmap, and task log skeletons |
| 2025-09-26 | codex | Updated default Matomo base URL | done | Set fallback to https://matomo.surputte.se in API |
| 2025-09-26 | codex | Added Matomo credentials handling | done | Stored `.env` template and wired dotenv/default site ID |
| 2025-09-26 | codex | Added reporting SDK + tools | done | Implemented matomoGet, reporting helpers, Express tools, and passing tests |
| 2025-09-26 | codex | Documented sample tool responses | done | Added curl snippets + payloads under packages/api/docs/sample-responses.md |
| 2025-09-26 | codex | Added API integration tests | done | Mocked Matomo client with node-mocks-http harness, Vitest passing |
| 2025-09-26 | codex | Added lint/type/test CI workflow | done | ESLint config, workspace scripts, and GitHub Actions `ci.yml` |
| 2025-09-26 | codex | Implemented tracking endpoints | done | SDK retry queue + API `/track/*` tools with tests |
| 2025-09-26 | codex | Added events reporting helper | done | SDK `getEvents` schema/service + API tool + tests |
| 2025-09-26 | codex | Added entry pages & campaign reports | done | SDK helpers + API tools for entry pages and campaigns with coverage |
| 2025-09-26 | codex | Added container deployment assets | done | Dockerfile, docker-compose, Portainer stack, and docs |
| 2025-09-26 | codex | Hardened CI workflow | done | npm ci, lint/type/test/build steps in GitHub Actions |
| 2025-09-26 | codex | Fixed CI typecheck for API | done | Added dedicated tsconfig without project references |
| 2025-09-26 | codex | Switched compose to pull remote image | done | docker-compose now references published MATOKIT_IMAGE |
| 2025-09-26 | codex | Pointed artifacts to Puttrix registry | done | docker-compose and Portainer stack use ghcr.io/puttrix/matokit-api |
| 2025-09-26 | codex | Added Docker publish workflow | done | GH Actions builds & pushes image to ghcr.io/puttrix/matokit-api |
| 2025-09-26 | codex | Changed default port to 3000 | done | Updated Dockerfile, compose, Portainer stack, README, and env template |
| 2025-09-26 | codex | Added pageview metrics to key numbers | done | Actions.get merged so tools expose nb_pageviews/nb_uniq_pageviews |
| 2025-09-26 | codex | Added historical key numbers tool | done | SDK series helper + `GetKeyNumbersHistorical` API tool + docs/tests |
| 2025-09-26 | codex | Added in-memory reporting cache | done | ReportsService caches responses with configurable TTL |
| 2025-09-27 | codex | Logged site search backlog item | pending | Added `SDK-016` for internal search keyword reporting via Actions.getSiteSearchKeywords |
| 2025-09-27 | codex | Logged page transitions backlog item | pending | Added `SDK-017` to capture Matomo Transitions reporting for Opal tooling |
| 2025-09-27 | codex | Enhanced Matomo error handling | done | Introduced typed `MatomoApiError` classes with guidance surfaced through Opal responses |
| 2025-09-27 | codex | Fixed key numbers scalar/array bugs | done | Unwrapped scalar/array Matomo responses in `getKeyNumbers` + series with regression coverage |
| 2025-09-27 | codex | Logged key numbers array bug | done | Documented `BUG-003` to track Matomo array payload handling (resolved alongside BUG-002) |
| 2025-09-27 | codex | Logged daily ecommerce conversions task | pending | Added `SDK-018` to surface per-day ecommerce purchases for questions like "vilket datum hade flest köp" |
| 2025-09-27 | codex | Added stack.env for repo deployments | done | Introduced `stack.env` and updated compose/README so Portainer stacks have default configuration |

## Pending Updates
- Fill in concrete dates once work starts on each milestone.
- Record major decisions and links to relevant commits/PRs.
