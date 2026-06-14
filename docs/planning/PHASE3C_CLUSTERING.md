# Phase 3c — Marker clustering (deferred)

Marker clustering via `@googlemaps/markerclusterer` was evaluated for low-zoom views with 70+ facilities.

**Decision:** Deferred — 72 pins render acceptably without clustering at country zoom with `fitBounds`. Revisit if users report clutter on mobile or at zoom &lt; 6.
