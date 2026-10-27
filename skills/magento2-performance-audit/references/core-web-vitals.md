# Core Web Vitals Audit

Full detail for Workflow step 7.

## Scoring path: `perf-audit.mjs cwv` (default)

```bash
node <skills>/magento2-performance-audit/scripts/perf-audit.mjs cwv perf-audit.config.json --run <run-dir> [--scope quick]
```

The stage drives the Lighthouse CLI (`--preset=desktop --throttling-method=devtools --save-assets --output=json`), so the observed server time is part of every number instead of a simulated one. It resolves the CLI from `LIGHTHOUSE_CLI`, then `lighthouse` on `PATH`, then the copy bundled in a global `@lhci/cli` (`npm install -g @lhci/cli`).

## Warm protocol

CWV is measured **warm only**, served from the full page cache. Backend work is measured separately by the uncached server render pair (queries, profiler root time, TTFB) captured in step 3, which is where a query reduction shows up.

- Each page is primed with one request, then measured with a median of 3 Lighthouse runs on deep (1 run on quick). The report shows the median and the spread (max minus min) of score and LCP.
- Every run proves its own HIT from the document response headers in its saved devtools log: `X-Magento-Cache-Debug` (built-in FPC, developer mode), then Varnish `X-Cache`, then `Age`.
- A run that is not HIT, or has no document response at all, is discarded and retried once; never report its score.
- When a page cannot be measured, use exactly one of these closed reasons, never a free-form variant:
  - `Skipped: no FPC HIT` (two misses in a row)
  - `Skipped: no HIT signal (production mode, built-in FPC)` (no cache header on any run; rerun in developer mode to measure)
  - `Skipped: page cache disabled` (`full_page` disabled in `cache:status`)
  - `Skipped: Lighthouse CLI not found`
  - `Skipped: quick` (spread column on quick scope)

## Chrome DevTools MCP: LCP phase breakdown only

When a Chrome DevTools MCP server is connected, `performance_start_trace` (with `reload: true`, `autoStop: true`) gives the LCP phase breakdown (TTFB, load delay, load duration, render delay) and named insights (LCPDiscovery, Cache, ThirdParties, RenderBlocking, ImageDelivery). Use it to explain an LCP, not to score it: the trace carries no performance score, and the MCP `lighthouse_audit` tool excludes the performance category, so neither can fill the matrix.

## Core Web Vitals Thresholds

| Metric | Target | Warning | Critical |
|--------|--------|---------|---------|
| LCP (Largest Contentful Paint) | < 2.5s | 2.5-4s | > 4s |
| INP (Interaction to Next Paint) | < 200ms | 200-500ms | > 500ms |
| CLS (Cumulative Layout Shift) | < 0.1 | 0.1-0.25 | > 0.25 |
| FCP (First Contentful Paint) | < 1.8s | 1.8-3s | > 3s |
| TTFB (Time to First Byte) | < 800ms | 800-1800ms | > 1800ms |

## Reading an LCP breakdown when render delay dominates

The phase breakdown (TTFB / load delay / load duration / render delay) tells you *where* LCP time actually goes, not just the total. If **render delay is the overwhelming majority** of LCP, the image/resource itself loads fast, but the browser doesn't paint it until long after, the fix isn't in the network or image pipeline, it's client-side JS gating visibility. This is common on JS-driven themes (Hyvä + Alpine.js, PWA/React storefronts):

- Check whether the LCP element (or its container) starts hidden behind a reactive class/directive, Alpine's `x-cloak`, a `:class` binding that includes `opacity-0`/`hidden`/`invisible`, or an equivalent framework pattern, and only becomes visible once the framework finishes hydrating. That decouples "resource ready" from "actually painted" by however long hydration takes across the whole page, not just this element.
- Cross-check against the `DOMSize` insight: a large/deep DOM (more elements for the framework to walk and bind reactivity to) makes this worse, hydration time scales with page complexity, not just the LCP element's own markup.
- Fix: render the LCP candidate visible by default in the server-rendered HTML (plain CSS/HTML, no JS-gated class) and let the framework take over only for *subsequent* state changes (slide switching, tab changes, etc.), not the initial paint.

This is typically page-type-specific, not global, compare the LCP breakdown across all 3 page types (see `references/per-page-type-audit.md`), since the component causing it (a gallery, a carousel) often lives on only one page type, which is exactly the kind of thing a homepage-only spot check would miss.

## Manual Testing

Open Chrome DevTools > Lighthouse:
1. Select "Navigation" mode
2. Select "Mobile" and "Desktop"
3. Check all categories
4. Review opportunities
