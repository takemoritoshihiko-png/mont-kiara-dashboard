---
name: feedback_commercial_data_verification
description: Standardized procedure for verifying all commercial property parameters (year, tenants, NLA, developer, homepage, anchor tenants, name_ja) in the mont-kiara-dashboard project — includes pre-investigation phase and known-error checklists
type: feedback
project_scope: mont-kiara-dashboard
---

When verifying or adding commercial property data for the dashboard, follow this methodology. Address/coordinate verification is covered by a separate procedure.

## Phase 0: Pre-investigation (MANDATORY before dispatching agents)

Before launching parallel agents, perform a single centralized research pass to collect **shared intelligence** that all agents will need. This prevents each agent from independently rediscovering the same industry-wide facts.

### 0a. Compile KL known tenant closures list
Search for "{brand} Malaysia closed" for these known-closure brands and build a date+location list:
- **Parkson** — multiple KL exits since 2019 (Suria KLCC Feb 2019, MyTOWN Feb 2020, Nu Sentral, etc.)
- **Robinsons** — liquidated company-wide during COVID
- **AEON BiG** — rebranded/closed at several locations from 2021
- **MBO Cinemas** — some locations closed or rebranded to GSC (2021)
- **Tesco** — ALL rebranded to **Lotus's** by March 2022
- **Giant** — some locations closed or converted post-Dairy Farm exit

### 0b. Compile commonly confused grocery brands
These are DISTINCT chains that get mixed up in data entry:
- **Jaya Grocer** — green branding, premium, owned by AEON
- **Village Grocer** — premium independent chain
- **B.I.G. (Ben's Independent Grocer)** — The Food Purveyor group
- **BSC Fine Foods** — BSC-specific grocer (Food Purveyor group)
- **Sam's Groceria / Sam Groceria** — separate chain (some closed)
- **Cold Storage** — DFI Retail Group chain
- **TMC Supermarket** — independent Malaysian chain
- **NSK Grocer / NSK Trade City** — wholesale-retail hybrid

### 0c. Compile KL REIT ownership map
Many malls changed ownership to REITs. Search REIT portfolio pages:
- **Pavilion REIT**: Pavilion KL, Intermark Mall, Pavilion Bukit Jalil
- **IGB REIT**: Mid Valley Megamall, The Gardens Mall
- **Sunway REIT**: Sunway Putra, Sunway Pyramid, Sunway Carnival, Sunway 163 Mall
- **Starhill Global REIT**: Lot 10, The Starhill
- **CapitaLand Malaysia Trust (CLMT)**: Sungei Wang (61.9%), 3 Damansara, Gurney Plaza
- **Sentral REIT**: Part of Plaza Mont Kiara, Arcoris Plaza (partial)
- **Paradigm REIT**: Paradigm Mall PJ, Paradigm Mall JB (IPO 2025)

### 0d. Distribute to agents
Include the above lists in every agent's prompt as **reference data** so they can immediately flag matches without needing to rediscover them.

---

## Phase 1: Per-property verification (by agents in parallel)

### Parameters and verification sources (in priority order)

### 1. year (opening year)
- **Wikipedia** article for the mall (most reliable for established malls)
- Official site "About Us" / "History" page
- WebSearch for "{mall name} opening year" or "{mall name} opened"
- **Watch out:** Don't confuse renovation/rebranding year with original opening year. Record the ORIGINAL opening year unless the property was demolished and rebuilt.

### 2. tenants (approximate number of shops)
- Official site tenant directory (count entries if available)
- Wikipedia (often states number of retail lots)
- REIT annual reports (sometimes list tenant count)
- News articles about the mall
- **Tolerance:** Approximate is fine. Flag only if CSV differs by >30% from verified.
- **Note:** For struggling malls (e.g. Encorp Strand, Glo Damansara), distinguish between total capacity vs actually occupied units.

### 3. nla_sqft (Net Lettable Area in sqft)
- **REIT annual reports** — THE authoritative source. Always check the REIT portfolio page first if the mall is REIT-owned (see Phase 0c list).
- Wikipedia
- Official site
- WebSearch news articles
- **CRITICAL:** Watch for sqm vs sqft confusion. 1 sqm = 10.764 sqft.
- **CRITICAL:** Distinguish NLA (Net Lettable Area) from GFA (Gross Floor Area) and total built-up. NLA is typically 65-75% of GFA. The dashboard uses NLA.
- **CRITICAL:** For mixed-use buildings (e.g. Pertama Complex with office tower), record RETAIL NLA only, not the full building.

### 4. developer (current owner/developer)
- **Check Phase 0c REIT map first** — if the mall is REIT-owned, the developer field should reflect the REIT, not the original developer.
- Wikipedia (usually lists current and former owners)
- Official site "About" page
- Company/REIT announcements
- **Watch out:** Ownership changes are common. Record the CURRENT owner/operator.

### 5. homepage_url
- **MANDATORY: Fetch every URL** using WebFetch to confirm it returns a valid page.
- If dead (404/timeout/domain expired), search for the current official site.
- If redirected to a different domain, update to the final URL.
- For malls without a dedicated website, check if the parent company has a page for it (e.g. REIT portfolio page, developer project page).
- Some smaller malls genuinely have no official website — mark as verified "(none)".

### 6. anchor_tenants (key tenants)
- **First: cross-reference against Phase 0a closures list** — immediately flag any CSV tenant that appears on the known-closures list.
- **Second: cross-reference against Phase 0b grocery brand list** — verify the EXACT grocery brand (not a similar-sounding one).
- Official site tenant directory (most current)
- WebSearch for "{mall name} tenants {current_year}" or "{mall name} directory"
- **Flag closures** with the year they closed.
- **Note additions** of major new tenants opened recently.
- Use semicolons (;) as delimiter between tenants.

### 7. name_ja (Japanese katakana name)
- Verify katakana is a correct phonetic transliteration of the English name.
- If the mall has an official Japanese name (e.g. ららぽーと for LaLaport), use that.
- **Watch out:** Brand names that aren't English words should be transliterated phonetically, not translated. e.g. "Nu Sentral" → ヌ・セントラル (not ニュー which means "new").
- Include the full official name (e.g. アトリア・ショッピング・ギャラリー not just アトリア・ショッピング).
- Alphabetic characters (K, PJ, etc.) should be rendered in katakana (ケー, ピージェー) unless the brand intentionally uses Latin letters.

---

## Phase 2: Cross-validation

After all agents report back, before applying changes:
- **Scan for conflicting findings** — if two agents report different data for the same entity, investigate further.
- **Validate NLA figures** — sort all NLA values by size and check for outliers that might indicate sqm/sqft confusion.
- **Verify all UNVERIFIED items** — for properties where agents couldn't find data, decide whether to keep CSV values or flag for on-ground verification.

---

## Parallelization
- Split properties into batches of 7-8 per agent
- Run all agents in parallel
- **Include Phase 0 reference data in every agent's prompt**
- Each agent follows Phase 1 procedure above

## Output format per property
```
PROPERTY: {name}
YEAR: CSV={v} | VERIFIED={v} | SOURCE={s} | STATUS=OK/MISMATCH
TENANTS: CSV={v} | VERIFIED={v} | SOURCE={s} | STATUS=OK/MISMATCH
NLA: CSV={v} | VERIFIED={v} | SOURCE={s} | STATUS=OK/MISMATCH
DEVELOPER: CSV={v} | VERIFIED={v} | SOURCE={s} | STATUS=OK/MISMATCH
HOMEPAGE: CSV={url} | FETCHED={yes/no} | STATUS=OK/DEAD/REDIRECT | NEW_URL={if needed}
ANCHORS: CSV={v} | CLOSURES_CHECK={checked against Phase 0a list} | CHANGES={closed/new} | STATUS=OK/UPDATE
NAME_JA: CSV={v} | STATUS=OK/FIX | SUGGESTED={if fix needed}
```

**Why:** In the 2026-04-05 audit, ~80 out of ~448 fields (18%) required correction. The most impactful issues were: (1) closed tenants listed as current in 7 properties, (2) wrong grocery brand names in 6 properties, (3) NLA errors averaging 40% in affected properties. All three categories are systematic errors that a pre-investigation phase would have caught faster.

**How to apply:** Any time commercial properties are added or audited in the mont-kiara-dashboard project, execute Phase 0 first, then distribute to parallel agents with the reference data. Always verify NLA units and check for ownership/tenant changes.
