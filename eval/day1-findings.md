# Day 1 findings — macro usage diagnostic

**Captured:** 2026-04-28
**Source:** Supabase `screens` table, all 303 generated screens
**Headline:** average macro density across all 303 screens = **1.9%** (per-screen averaged). Across real screens (≥30 nodes, n=249), **87.1% have ZERO macros**. Only 32 of 249 real screens use any macro at all.

## How I sliced the data

- Pulled all 303 screens from production Supabase.
- For each, counted nodes whose `type` matches one of the 26 canonical macros from `lib/component-library.ts` (`COMPONENT_EXPANSIONS` dispatch table).
- Computed `macro_density = macro_count / total_nodes`.
- Filtered out 54 empty placeholder screens (≤1 node) before picking the worst offenders, since those are AI-generation orphans, not real "low-macro" screens.

Among real (≥30-node) screens:
- Mean total_nodes: 109. Median: 127. p90: 198.
- Mean macros: 1.4. Median: **0**. Most real screens have zero macro nodes.
- Mean density: 2.3%. Max density: 46.5% (one outlier).

The screens *with* macros tend to cluster in a small set of recently-generated projects (the FitTrack one we worked on, mostly). Almost everything older is raw stacks.

---

## Screen 1: "Create a Nike shoe…" PDP (id `d68b3d9b`, project `b30eb42d`)

**287 nodes, 0 macros.**

**What this screen is trying to be:**
A product detail page (PDP) for Nike Air Max 270 — hero image with carousel dots, brand/title/price block with strikethrough original price, 4.6-star rating with 2,847 reviews, color swatches, size grid, key features list (3 items with icons), customer reviews summary with 5-bar distribution + 2 review snippets, sticky footer with favorite + Add to Cart CTA.

**Macros that should have been used:**
- `HeaderBar`: top nav with back arrow, title "NikeStore", and 2 right icons (favorite_border, shopping_cart).
- `RatingStars`: the 4.6 stars + "(2,847 reviews)" — currently 5 hand-rendered `Icon[name="star"]` plus a Text node.
- `ChipSelector`: the 9 size buttons (7 / 7.5 / 8 / 8.5 active / 9 / 9.5 / 10 / 10.5 / 11). Currently 9 hand-styled `TouchableOpacity`s each with bg/br/w/h/Text.
- `FeatureCard` (×3): the "Key Features" list (Air-Sole Cushioning / Lightweight Mesh Upper / Rubber Outsole), each with icon, title, subtitle. Currently each is `View [row, bg, br]` containing `View [bg, br, 40x40]` + `Icon` + `View` + `Text` + `Text` — exactly what `FeatureCard` was made for.
- `Button`: the orange "Add to Cart — $159.99" CTA.

**Raw stacks the AI wrote instead:**
The whole bottom-nav style sticky footer is `View [bg=#111111] > View [row] > 2 TouchableOpacity` with manual styling. The 5-bar review distribution is built bar-by-bar with View+View+View patterns. Five individual `Icon[name="star"]` nodes in a row instead of `RatingStars`.

**Diagnosis:**
This is exactly the scenario the macro library was built for. Every PDP-shaped piece of this screen has a 1:1 macro: `RatingStars` for stars, `ChipSelector` for sizes, `FeatureCard` for features, `Button` for the CTA. The AI used none of them and produced a 287-node tree that should have been ~80 nodes. The hand-built version is also where the icon-name inconsistency surfaces — `favorite_border`, `bolt`, `verified`, `star_half` — these mix Material Symbols names with Lucide names with each other, which is what causes the icons-as-text bug downstream.

---

## Screen 2: "Create a real estate…" LuxeStay (id `8b377bbd`, project `0b5c2c4f`)

**269 nodes, 0 macros.**

**What this screen is trying to be:**
A real-estate discovery home screen — hero card for a featured "Marina Bay Penthouse" with image + gradient overlay + title + location, carousel-position dots, search bar, "Featured Listings" section (3 cards), "Recommended For You" section (2 row cards with image + details), 4-tab bottom nav.

**Macros that should have been used:**
- `HeaderBar`: top "Discover / LuxeStay" header + heart icon button.
- `SearchBar`: the search input row.
- `SectionHeader` (×2): "Featured Listings · See All" and "Recommended For You · See All".
- `ProductCard` (×5): both the featured listings and the recommended row cards.
- `BottomNav`: the 4-tab bottom navigation.

**Raw stacks the AI wrote instead:**
Bottom nav: `View [row, bg]` containing 4 `TouchableOpacity` each with `Icon` + `Text` — the literal expansion of `BottomNav`'s default. Section headers: a `View [row]` with `Text [fs=16 fw=600]` + `Text [fs=13]` ("See All"). Search bar: `View [row, bg, br=12]` + `Icon[name="search"]` + `TextInput`. Each pattern is one or two macro calls, hand-built.

**Diagnosis:**
Of the 5 screens I inspected, this is the most "every macro the library has, hand-built from primitives" — bottom nav, section headers, search bar, product cards, even the featured listings card structure. The AI got the pattern *right* (the cards look correct) but didn't recognize that the patterns ARE the macros. Strong signal that the prompt's macro list isn't reaching the AI's attention at output time.

---

## Screen 3: "Create a food deliv…" home (id `f6a22a5d`, project `6cd8e600`)

**247 nodes, 0 macros.**

**What this screen is trying to be:**
A food-delivery home — location header (Deliver to Downtown), notifications icon, avatar, search bar, horizontal scroll of 2 promo cards ("Flash Deal 30% off pizza", "Free Delivery"), 4 category tiles (Burgers / Asian / Pizza / Dessert), "Popular Near You" section with 3 restaurant cards, 4-tab bottom nav.

**Macros that should have been used:**
- `HeaderBar` (custom variant) — actually this header has a unique left side ("Deliver to / Downtown" with a location icon), which doesn't fit `HeaderBar`'s default. Acceptable to hand-build.
- `SearchBar`: the search row.
- `PromoCard` (×2): the Flash Deal and Free Delivery cards.
- `ChipSelector`: the 4 category tiles row.
- `SectionHeader` (×3): Categories, Popular Near You.
- `ProductCard` (×3): the 3 popular restaurants.
- `BottomNav`: the 4-tab bottom nav.

**Raw stacks the AI wrote instead:**
Promo cards are `View [bg, br=12]` + Image + Text + Text + `View [row]` + Icon + Text — exactly `PromoCard`'s shape. Category tiles are `TouchableOpacity [bg, br=12]` + `View [bg, br=12, 44x44]` + Icon + Text — closer to a custom mini-card, but `ChipSelector` would handle the row. The 3 popular-near-you restaurant cards have minimal content (just Image + 2 row Views with no children expanded in my outline) — looks like the AI lost steam by the time it got to them.

**Diagnosis:**
Food-delivery is the most-used template archetype based on the worst-20 list (6 of 20 are food-delivery prompts). The AI has clearly internalized the shape, but every component of that shape is hand-built. This screen also shows a tail-end quality drop — the Popular Near You cards trail off into half-empty `View [row]` placeholders that the AI didn't finish. That's a separate failure mode (running out of token budget on 247-node screens) that macros would also help with by reducing node density.

---

## Screen 4: "Create an Airbnb st…" Oceanview Villa (id `0de572f9`, project `b30eb42d`)

**221 nodes, 0 macros.**

**What this screen is trying to be:**
An Airbnb-style property detail page — hero image with gradient overlay, back/share/favorite floating icons, "Superhost" + "Entire Villa" + "Instant Book" badges, 4-position carousel dots, title (Oceanview Villa with Private Pool), location (Candolim, North Goa, India), price ($285/night), rating row (4.93 · 148 reviews · 8 guests · 4 beds), host card (avatar Priya Sharma, "Superhost · 4 years hosting", Contact button), about/amenities (6 chips: Private Pool / Free WiFi / Full Kitchen / Free Parking / AC / Beach Access), reviews summary, sticky footer with price + Reserve Now CTA.

**Macros that should have been used:**
- `RatingStars`: the 4.93 + "(148 reviews)" star row in the title section.
- `AvatarCircle`: the Priya Sharma host avatar (currently `Image[avatar="Priya Sharma"]` — most of the way there but missing the macro wrapper).
- `ChipSelector`: the 6 amenity chips (Private Pool, Free WiFi, etc.).
- `Button`: the orange "Reserve Now" CTA.
- `StatusBadge` (×3): Superhost, Entire Villa, Instant Book.

**Raw stacks the AI wrote instead:**
6 amenity chips each as `View [row]` > `View [row]` > `View [bg=#1A1A2E br=16]` > `Text` — three layers of nesting per chip when `ChipSelector` would do it in one prop. Host card built from `View [row]` + Image + 3 nested Texts + TouchableOpacity, when a slimmer `AvatarCircle` + ProfileStats variant would handle it. Single star + Text in the rating row instead of `RatingStars` (which does multiple stars + count).

**Diagnosis:**
This screen has interesting domain content (Goa villa, Priya Sharma host, Superhost badge) but the visual structure is again entirely hand-built from primitives. The amenities row is the most striking case — six identical chips repeated with three levels of View nesting each, which `ChipSelector` would render in one node spec. Each amenity chip: 4 nodes (View+View+View+Text); ChipSelector: 1 node with a `chips: [{label}]` array. 6 chips × 4 nodes = 24 nodes saved by ChipSelector.

---

## Screen 5: "Create a settings p…" Aura settings (id `f0f66a89`, project `68ff0fa9`)

**213 nodes, 0 macros.**

**What this screen is trying to be:**
A settings page with grouped sections — header (Settings / more_vert icon), profile card (avatar Jordan Lee with photo_camera badge, name + email + Edit Profile button), 4 sections (Appearance / Notifications / Privacy & Security / Aura) each with 2-3 list rows (some with Switch toggles, some with chevron_right navigation), Log Out button, copyright text.

**Macros that should have been used:**
- `HeaderBar`: top "Settings" header.
- `AvatarCircle`: profile picture wrapper.
- `Button`: Edit Profile pill, Log Out button.
- `SectionHeader` (×4): Appearance / Notifications / Privacy & Security / Aura.
- `ListRow` (×11): EVERY settings row — every one has icon + title + subtitle + trailing (Switch or chevron). This screen alone is 11 ListRows.

**Raw stacks the AI wrote instead:**
The settings rows are ALL hand-built from `View [row]` + `View [bg br 36x36]` + Icon + `View` + Text + Text + (Switch | chevron_right). 11 rows × ~7 nodes each = 77 nodes for what should have been 11 ListRow macro calls = 11 nodes (the macro expands to ~7 nodes each only at render time, not in the tree).

**Diagnosis:**
This is THE most egregious case. Settings screens are the canonical use case for `ListRow`. The macro accepts exactly the shape this screen produced 11 times: `{icon, title, subtitle, trailing, showChevron}`. The AI built it from raw nodes 11 separate times. One caveat: `ListRow` doesn't currently support `Switch` as a trailing element, so 6 of the 11 rows (the toggles) might be reasonably hand-built under current library limits. But the 5 rows with chevron (Change Password / Privacy Policy / Rate Aura / etc.) have no excuse. **This finding suggests a macro library gap**: `ListRow` should accept a `switch` prop to handle the toggle case, which would unlock the remaining 6 rows.

---

## Patterns observed across the 5 inspected screens

1. **Bottom navigation is hand-built every single time, even though `BottomNav` is the loudest macro in the prompt.** Across all 5 screens (and 87% of all real screens overall), the bottom tab bar is a `View [row]` containing `TouchableOpacity` + `Icon` + `Text` repeated per tab. `BottomNav` accepts exactly that as a `{items: [{icon, label, active}]}` array. The AI never uses it.

2. **Settings/list rows are reconstructed 11 times per screen instead of using `ListRow` once per item.** The settings screen is the strongest case but the pattern shows up everywhere a screen has structured rows (food categories, amenities, recommended listings, transaction-style items).

3. **Star ratings are individual `Icon[name="star"]` × 5 plus a Text, never `RatingStars`.** The Nike PDP and the Airbnb villa both did this. `RatingStars` is exactly designed for it.

4. **Section headers ("Featured Listings · See All") are hand-built `View [row]` + Text + Text every time, never `SectionHeader`.** Across the food-delivery, real-estate, and Nike screens this pattern repeats 8+ times.

5. **`ChipSelector` is invisible to the AI.** Size grids (Nike), category tiles (food delivery), amenities (Airbnb) — all are exactly what `ChipSelector` is for. None used it.

6. **Avatar images use `Image[avatar="Name"]` but are never wrapped in `AvatarCircle`.** The avatar prop pattern works (DiceBear initials) but the macro wrapper that bundles the standard 40px-circle styling is bypassed.

7. **Hand-built screens are 3-5× larger in node count than macro-equivalent ones.** Nike PDP at 287 nodes would be ~80 with macros. Settings at 213 would be ~60. This compounds with the AI's token budget — the larger the tree, the more likely the AI runs out of context near the end and produces empty `View` placeholders (visible in the food-delivery Popular Near You section).

8. **Macro library has at least one real gap:** `ListRow` lacks a `switch` trailing prop. 6/11 settings rows on the Aura screen had toggles — if the macro supported `trailingType: 'switch' | 'chevron' | 'text'`, AI could use ListRow there too. This is library work, not prompt work.

## Hypotheses for Day 3 prompt rewrite

- **Move the macro list to the top of the system prompt, before `DESIGN_TOKENS` and the long viewport/density rules.** Currently it's buried hundreds of lines deep — by the time the AI reads it, attention has wandered. First-position guidance gets followed; buried guidance gets ignored.

- **Add a "MANDATORY MACRO TRIGGERS" table** mapping screen patterns to required macros. "If you generate a bottom tab bar → MUST be `BottomNav`. If you generate a settings row → MUST be `ListRow`. If you generate a star rating → MUST be `RatingStars`. If you generate a row of category chips or size buttons → MUST be `ChipSelector`. If you generate a section title with 'See All' → MUST be `SectionHeader`." Direct trigger-action mappings, not gentle "ALWAYS use macros" guidance.

- **Replace the existing macro list block with strong "DON'T DO THIS / DO THIS" examples.** Show a raw 7-node settings row vs the 1-line `ListRow` that produces it. Show a raw 60-node bottom nav vs `BottomNav`. Negative+positive paired examples calibrate the AI better than abstract rules.

- **Consider a two-pass generation flow** for complex screens: pass 1 emits a macro outline ("BottomNav + HeaderBar + SectionHeader('Featured') + 3 ProductCards + SectionHeader('Recommended') + 2 ProductCards + BottomNav"), pass 2 fills in props. More expensive in tokens but forces macro-aware structure. Worth A/B testing on the 6 archetype prompts.

- **Fix the `ListRow` switch-trailing gap as a low-risk parallel improvement.** Add `props.switchValue` and `props.onSwitchChange`; expand to a Switch in the trailing slot when present. Unblocks ~5 settings rows per settings screen.
