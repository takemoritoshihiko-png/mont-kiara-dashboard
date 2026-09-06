---
name: feedback_condo_data_verification
description: MUST READ when verifying/adding condominium data in mont-kiara-dashboard. Covers all parameters except address/coordinates. Categorized by data type with source priority and Phase 0 pre-investigation.
type: feedback
project_scope: mont-kiara-dashboard
---

When verifying or adding condominium data for the dashboard, follow this methodology. Address/coordinate verification is covered by a separate procedure. The condo CSV has ~186 rows and 21+ parameters per property (excluding addr/lat/lng).

## Phase 0: Pre-investigation (MANDATORY before dispatching agents)

### 0a. Identify accessible data sources
The following sites are known to work or not work:
- **EdgeProp.my** ✅ — Best single source. Project pages contain embedded JSON with year, units, size, blocks, floors, tenure, developer, AND lat/lon. Fetch `https://www.edgeprop.my/condo/{slug}` or `/project/{slug}`.
- **iProperty.com.my** ❌ — Returns 403 on direct fetch. BUT the URLs in the CSV are useful as identifiers, and Google search snippets from iProperty often contain key data.
- **PropertyGuru** ❌ — Returns 403 on direct fetch. Same approach: use search snippets.
- **Developer official sites** ✅ — Variable quality but authoritative for specs and premium features.
- **Wikipedia** ✅ — Good for major developments only.
- **StarProperty / The Edge** ✅ — Good for project reviews with specs.

### 0b. Compile developer name standardization list
Ensure consistent developer names across the CSV. Known variations:
- "UEM Sunrise" = "Sunrise Berhad" (former name)
- "Bukit Kiara Properties" = "BKP"
- "Tan & Tan (IGB)" = "IGB Berhad" subsidiary
- "E&O / Mitsui Fudosan" = JV entity
- Check if any developer has been acquired/renamed since the data was entered.

**KNOWN DEVELOPER ERRORS FOUND IN 2026-04 AUDIT (cross-check these patterns):**
- OOAK Kiara 163 was listed as "Naza TTDI" → actually **YNH Property** (D'Kiara Place Sdn Bhd)
- Kami Mont Kiara was listed as "OSK Property" → actually **Ireka** (United Time Development)
- Flora Murni was listed as "Bukit Kiara Properties" → actually **Tian Global**
- Developer names MUST be verified via EdgeProp, not assumed from the area/brand.

**ADDITIONAL DEVELOPER ERRORS FOUND IN C-TIER AUDIT:**
- TWY Mont Kiara was listed as "Tropicana" → actually **Symphony Life** Berhad
- Lumina Kiara was listed as "UEM Sunrise" → actually **ECH Development**
- The Luxe was listed as "Macly Equity" → actually **Mammoth Empire** (Macly develops a different "The Luxe" at KLCC)
- One Kiara was listed as "Other" → actually **Monday-Off Development**
→ Total developer errors across all tiers: **7 out of ~48 properties (15%)** — systematic problem requiring EdgeProp verification for EVERY property.

### 0c-extra. Known systematic data errors to pre-check

**1. premium_pool=0 is ALMOST CERTAINLY WRONG.** Across B/A/S/C tiers (48 properties), pool=0 was wrong in **35+ cases (~73%)**. Nearly all KL condos and even most low-rise/landed developments have pools. **Treat pool=0 as an error until verified otherwise. The ONLY legitimate pool=0 cases are very old (pre-1990) or very small landed developments.**

**2. premium_score uses a WEIGHTED formula** (not simple sum):
  ```
  premium_score = private_lift × 7 + concierge × 2 + low_density + pool + sky_lounge + ev_charging
  ```
  Maximum = 15. Always recalculate after verifying individual features.

**3. Agents must NOT independently calculate premium_score without the formula.** In earlier audits, agents used simple sums or invented their own weights, causing incorrect corrections that had to be re-fixed. **Include the exact formula in every agent prompt.**

**4. Agents should NOT directly edit the CSV.** In the C-tier audit, multiple agents edited the CSV concurrently, risking conflicts and making it hard to verify changes. **Best practice: agents report findings only → central process applies all edits.**

**5. Boutique/landed Bangsar properties** often have data that looks wrong but is correct (e.g. 8 units total, very high PSF, no homepage). These are legitimate ultra-luxury boutique developments. Don't flag low unit counts as errors for Bukit Bandaraya area.

### 0c. Establish market data reference period
Rent and sale PSF data is time-sensitive. Before auditing:
- Define the reference period (e.g. "iProperty/PropertyGuru listings as of Q1 2026")
- Note that upcoming/uncompleted projects may have NO rental data (leave as 0)
- Mont Kiara PSF range: typically RM400-1400. KLCC: RM800-3500. Flag outliers.

### 0d. Distribute reference data to all agents
Include the above lists, accessible source URLs, and market benchmarks in every agent prompt.

---

## Phase 1: Per-property verification (by agents in parallel)

### Category A: Building specs (fixed at construction)

These rarely change after completion. Verify once and they should remain accurate.

#### year (completion year)
- **EdgeProp.my project page** (most reliable, shows "Completion Year")
- WebSearch for "{property name} completion year" or "{property name} TOP date"
- Developer official site
- **Watch out:** For "upcoming" status properties, year is the EXPECTED completion. For completed, year is actual completion (not launch year).

#### units (total residential units)
- **EdgeProp.my** (shows "Total Units")
- WebSearch for "{property name} total units"
- Developer brochure/marketing materials
- **Watch out:** Some developments mix residential + commercial/SoHo units. Record RESIDENTIAL units only.

#### sizeMin / sizeMax (unit size range in sqft)
- **EdgeProp.my** (shows "Built-up Size" range)
- Developer official site floor plans
- WebSearch for "{property name} unit size sqft"
- **Watch out:** Some sources list built-up area, others list land area (for villa-type). Use built-up area. Also beware of penthouse sizes inflating sizeMax — include penthouses if they are standard residential units for sale.

#### blocks (number of towers/blocks)
- **EdgeProp.my** or developer site
- WebSearch + satellite imagery descriptions
- **Watch out:** Some developments have multiple "phases" counted as separate blocks. Count physical towers.

#### floors (number of storeys)
- **EdgeProp.my** or developer site
- WebSearch for "{property name} storeys" or "{property name} floors"
- SkyscraperCity forum threads often have accurate floor counts

#### tenure (FH = Freehold, LH = Leasehold)
- **EdgeProp.my** (explicitly stated)
- Developer site
- Land title search results in property portals
- **This never changes.** Once verified, it's permanent.

#### developer
- **EdgeProp.my** (shows developer name)
- Wikipedia
- Developer official site
- **Use the parent brand name** as listed in the DEVELOPERS constant in index.html (e.g. "UEM Sunrise" not "UEM Sunrise Berhad" or subsidiary names). The brand_score mapping depends on exact name matching.

---

### Category B: Market data (dynamic, time-sensitive)

These change with market conditions. The goal is a reasonable current range, not a precise single figure.

#### rentMin / rentMax (monthly rental range in RM)
- **WebSearch for "{property name} rent monthly RM"** — look at listing snippets from iProperty, PropertyGuru, EdgeProp
- Look for the range across available listings (e.g. "RM 5,000 - RM 12,000/month")
- Use the LOW end of current listings as rentMin, HIGH end as rentMax
- **For upcoming/uncompleted projects with no rental market:** leave as 0
- **Tolerance:** Rental market is volatile. Accept ±20% as reasonable.

#### salePsfMin / salePsfMax (sale price per sqft range in RM)
- **WebSearch for "{property name} price per sqft PSF RM"**
- EdgeProp transaction history (shows actual transacted PSF)
- iProperty/PropertyGuru listing snippets
- Use recent (last 12 months) transaction or listing data
- **For upcoming projects:** use developer launch price PSF
- **Tolerance:** PSF can vary widely within a building. Accept ±15%.
- **Sanity check:** Mont Kiara typical range RM400-1400, KLCC RM800-3500, Bangsar RM500-2000. Flag values outside these ranges.

---

### Category C: URLs and status

#### iproperty_url
- Verify the URL format matches `https://www.iproperty.com.my/building/{slug}/`
- Do NOT fetch (will return 403) — just verify the slug exists by checking if the URL appears in Google search results
- If the property has no iProperty page, leave blank

#### homepage_url
- **Fetch the URL** to confirm it returns a valid page (not 404/expired domain)
- For upcoming projects, developer project pages are the homepage
- If the URL is dead, search for the current official site
- Many older condos genuinely have no homepage — that's OK

#### status
- **completed** — building is finished and occupied
- **upcoming** — under construction or announced but not yet completed
- Check whether "upcoming" projects have since been completed: WebSearch for "{property name} completion" or "{property name} handover keys"
- **Do not use** "commercial" or "school" — those are separate CSV files

---

### Category D: Scoring and premium features

#### brand_score (0-100)
- This is an INTERNALLY DEFINED score based on the DEVELOPERS constant in index.html
- **Do not verify against external sources** — it's editorial
- Only check that the value matches what the DEVELOPERS map would give for that developer name
- If brand_score in CSV > 0, it overrides the DEVELOPERS map. Only flag if it seems clearly wrong (e.g. a small unknown developer with score 100)

#### Premium features (0 or 1, except low_density which is 0-3)

Each premium feature should be verified against the developer's official site or marketing materials:

| Feature | Field | How to verify |
|---------|-------|---------------|
| **Private lift** | premium_private_lift | Does each unit have a dedicated/private lift lobby? Check developer site, floor plans. Common in luxury low-density condos. |
| **Concierge** | premium_concierge | Is there a dedicated concierge/butler service? Check developer site amenities list. |
| **Low density** | premium_low_density | 0 = >8 units/floor, 1 = 5-8 units/floor, 2 = 3-4 units/floor, 3 = 1-2 units/floor or villa. Calculate from units ÷ floors ÷ blocks. |
| **Pool** | premium_pool | Does it have a swimming pool? **Almost all KL condos have pools — default assumption is 1.** Only set to 0 if explicitly confirmed absent. In the 2026-04 audit, 7/16 properties had this wrong. |
| **Sky lounge** | premium_sky_lounge | Is there a sky lounge, sky deck, or rooftop amenity? Check amenity list. |
| **EV charging** | premium_ev_charging | Are EV charging stations provided? Primarily newer developments (2020+). Check developer site or news. |

#### premium_score
- **WEIGHTED formula** (discovered in 2026-04 S/A-tier audit, verified against 20+ correct CSV values):
  ```
  premium_score = private_lift × 7 + concierge × 2 + low_density + pool + sky_lounge + ev_charging
  ```
- **Maximum = 15** (matches dashboard normalization: `premiumNorm = premiumScore / 15 * 100`)
- **ALWAYS recalculate** after verifying individual features — do NOT trust the CSV value blindly.
- **CRITICAL: This is NOT a simple sum.** In the B-tier audit, scores were incorrectly "fixed" to simple sums before the weighted formula was discovered. The weighted formula was verified against 20+ properties where individual features were independently confirmed.
- **Weight rationale:** private_lift (×7) is the highest-impact luxury feature; concierge (×2) is next; other features are ×1 each.
- **Must communicate the correct formula to ALL agents** — in the B-tier audit, agents independently used simple sums or invented their own weights, producing inconsistent results.

---

### Category E: Japanese name

#### name_ja
- Verify katakana is a correct phonetic transliteration of the English/Malay name
- **Common patterns:**
  - "Mont Kiara" → モントキアラ (not モンキアラ)
  - "Residences" → レジデンシズ or レジデンシーズ
  - "Suites" → スイーツ
  - "Heights" → ハイツ
  - Numbers: use the common reading (e.g. "22" → トゥエンティトゥー or just 22)
- If the development has an official Japanese name (from Japanese developer like Mitsui Fudosan), use that
- Include sub-names in parentheses where applicable: e.g. パビリオン・ダマンサラハイツ (クラウン)

---

## Phase 2: Post-verification checks

After all agents report:

1. **Cross-check units × floors × blocks** — units should be roughly = (units_per_floor × floors × blocks). If units = 332, blocks = 2, floors = 43, then ~4 units/floor — reasonable. Flag if the math doesn't work (e.g. 50 units but 40 floors and 1 block = 1.25 units/floor is suspicious).
   - **Known pattern**: Kami MK had floors=38 (actually 19, exactly 2x). Double-check any floor count that seems unusually high for the unit count.
   - **Landed developments** (e.g. Adiva Courtyard): blocks/floors don't follow tower logic. Flag these for manual review.

2. **Validate premium_score totals** — recalculate sum for each property.

3. **Check sizeMin < sizeMax** and **rentMin < rentMax** and **salePsfMin < salePsfMax** — flag any inversions.

4. **Check status consistency** — if year < current_year, status should be "completed" (not "upcoming"). If year > current_year, status should be "upcoming".

5. **Sort by salePsfMax and flag outliers** — any property with PSF wildly different from its neighbors in the same area likely has a data error.

---

## Parallelization

- ~186 condos → split into batches of 10-12 per agent (15-16 agents)
- For efficiency, **Category A + C + E** can be checked from a single EdgeProp page fetch per property
- **Category B** (rent/sale prices) requires separate market searches
- **Category D** (premium features) requires developer site checks
- Consider splitting work by task type rather than geography:
  - Agents 1-8: Check Category A + C + E (specs, URLs, Japanese names) — 23 properties each
  - Agents 9-12: Check Category B (market data) — grouped by area for price context
  - Agents 13-16: Check Category D (premium features) — requires developer site research

**Why:** Condos have 21+ parameters vs 7 for commercial properties. Splitting by task type is more efficient because one EdgeProp fetch can verify 8+ fields at once (Category A), while market data (Category B) requires different sources and benefits from area-based grouping for price context.

**Lessons from 2026-04 full audit (86 properties across S/A/B/C tiers + 64 commercial):**

Error rates by category (across all tiers):
- **pool=0**: Wrong in ~73% of cases (35+ out of 48 condos). Treat as error until proven otherwise.
- **premium_score**: Wrong in ~60% of cases before weighted formula was discovered. After formula discovery, all scores were recalculated correctly.
- **developer name**: Wrong in 15% of cases (7 out of ~48). Must verify via EdgeProp for every property.
- **floors**: Wrong in ~40% of cases. Cross-check with units ÷ blocks always.
- **blocks**: Wrong in ~25% of cases. Landed developments especially problematic.
- **coordinates**: Wrong in ~24% of properties checked (27 out of 112). Some as far as 3.4km off.

Operational lessons:
- **EdgeProp.my** is the single most reliable source for building specs, transaction data, and coordinates.
- **montkiara.properties** is excellent supplementary source for Mont Kiara area.
- **Agents must be given the exact premium_score WEIGHTED formula** in their prompts — without it, each agent invents their own calculation.
- **Agents should NOT directly edit the CSV** — concurrent edits cause conflicts and make verification difficult. Agents report findings → central process applies all edits.
- **Low-rise Bangsar/Bukit Bandaraya properties** are legitimate ultra-luxury boutique developments with very low unit counts (8-60 units). Don't flag as errors.
- **Rate limiting**: If many agents run simultaneously, some may hit API rate limits (Nominatim, or the agent platform itself). Build in retry logic for failed agents.
- **Retry agents serve as cross-validation**: In the C-tier audit, a retry agent found 3 errors in the original agent's edits (Desa Bangsar Ria: wrong developer name, wrong sizeMin, wrong low_density; Palmyra: wrong sizeMax, wrong low_density). **When an agent fails and is re-run, use the retry results to cross-check the original agent's work if it partially completed.**
- **Boutique Bangsar properties are the hardest to verify** — data sources often conflict on unit counts, sizes, and even developer names. EdgeProp transaction data is the most reliable for these, but even EdgeProp can have incomplete data for very small developments (8-60 units).

**How to apply:** Any time condominiums are added or audited in the mont-kiara-dashboard project, execute Phase 0 first, then dispatch agents with the reference data. Use task-type splitting for large audits (>50 properties).
