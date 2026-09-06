---
name: feedback_address_verification
description: Standardized procedure for verifying lat/lng coordinates of properties in the mont-kiara-dashboard project — includes rate-limit handling and source reliability tiers
type: feedback
project_scope: mont-kiara-dashboard
---

When verifying or adding property coordinates for the dashboard, always follow this multi-source methodology in order. Never rely on a single source or guess coordinates.

## Phase 0: Pre-investigation

Before dispatching agents, note these operational constraints:
- **Nominatim rate limits**: If many agents hit Nominatim simultaneously, some will get 429 errors. Stagger requests or assign different primary sources to different batches.
- **iProperty / PropertyGuru**: Return 403 — do NOT rely on these as a source. Skip them.
- **EdgeProp.my**: Usually accessible — include it as a primary source in agent instructions.

## Verification procedure (in priority order)

### Tier 1: High-precision sources (prefer these)

1. **OpenStreetMap Nominatim — building name search** (fastest when available)
   - `https://nominatim.openstreetmap.org/search?q={building_name}+Kuala+Lumpur&format=json&limit=1`
   - If exact name fails, try variations (e.g. "Publika" instead of "Publika (Solaris Dutamas)")
   - Building-level polygons give the most accurate centroids
   - **Rate limit**: Max ~1 request/second. If 429 error, fall through to Tier 1 alternatives.

2. **EdgeProp.my embedded JSON** (high precision)
   - Fetch `https://www.edgeprop.my/condo/{slug}` or `/project/{slug}` and extract `lat_d`/`lon_d` fields
   - Very reliable when the property page exists
   - **Discovered to be one of the most reliable sources in the 2026-04 audit**

3. **Mapcarta / OpenStreetMap Overpass API** (building-level)
   - Search `https://mapcarta.com` for the property name
   - Cross-reference with OSM way/node IDs for precise building footprints
   - Good fallback when Nominatim is rate-limited

### Tier 2: Good secondary sources

4. **Official website Waze/Google Maps links** (high confidence)
   - Fetch the property's homepage and look for embedded Waze links or Google Maps iframes
   - Extract coordinates from URL parameters
   - Particularly effective for newer developments

5. **WebSearch for "{property name} latitude longitude coordinates"**
   - Cross-reference results from poskod.com, latitude.to, findlatitudeandlongitude.com, pagenation.com
   - Use at least 2 independent sources to confirm

### PROHIBITED: Street-level / poskod.com searches

**DO NOT USE street-name Nominatim searches, poskod.com, or any street-midpoint-based source to fix coordinates.** These return the midpoint of a street, NOT the building location. In hilly areas (e.g. Mont Kiara's Changkat roads), the street midpoint can be hundreds of meters from the actual property.

**Pavilion Hilltop incident:** An agent used poskod.com's "Jalan Kiara" midpoint to "fix" coordinates, moving them ~440m west of the actual building on Changkat Duta Kiara. The original CSV value was correct. This type of error is undetectable without Tier 1 re-verification.

**If no Tier 1 or Tier 2 source can verify coordinates, leave the CSV value unchanged** rather than applying a street-level "fix".

## Mismatch threshold

- Flag any property where CSV coordinates differ from verified coordinates by **>0.003 degrees (~300m)** in either lat or lng
- Properties with 200-300m discrepancy are "borderline" — note but don't necessarily fix
- For properties in the same development (e.g. Pavilion DH mall + Crown Residences), verify they are at distinct but nearby coordinates, not accidentally swapped

## Parallelization

- Split properties into batches of 8-11 per agent
- Run all agents in parallel for maximum throughput
- **Assign different primary sources to different batches** to avoid Nominatim rate limits:
  - Odd batches: Start with Nominatim, fall back to EdgeProp
  - Even batches: Start with EdgeProp/Mapcarta, fall back to Nominatim
- Each agent must follow the same procedure and try multiple sources

## Post-verification cross-check

After all agents report, before applying fixes:
- **Sort all coordinates by lat** and check for obvious outliers (property in wrong city/state)
- **Check nearby property clusters** — e.g. all KLGCC Resort properties should be within ~500m of each other
- **Verify suggested fixes make geographic sense** — a "fix" that moves a property to a different neighborhood is likely wrong

**Why:** In the 2026-04-05 audit, 27 out of 112 properties (~24%) had coordinate errors exceeding 300m, some as large as 3.4km. Nominatim rate-limiting was a practical issue — agents that hit 429 errors had to fall back to less reliable secondary sources. EdgeProp.my was discovered mid-audit as highly reliable and should be prioritized.

**How to apply:** Any time properties are added, moved, or audited in the mont-kiara-dashboard project, use this exact procedure. Never accept coordinates without verification against at least one Tier 1 source.
