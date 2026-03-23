// Shared design system constants for Mokkoi screen generation prompts.
// Imported by both generate.ts (single screen) and generate-flow.ts (multi-screen flow).

export const DESIGN_TOKENS = `
MOKKOI DESIGN TOKENS — STRICT CONSTRAINTS
You must ONLY use values from these scales. Never invent custom spacing, font sizes, border radius, or colors. If a value isn't in the scale, use the nearest scale value.

SPACING (all padding, margin, gap values must come from this scale):
  4, 8, 12, 16, 20, 24, 32, 40, 48, 64

FONT SIZES (all fontSize values must come from this scale):
  11, 12, 13, 14, 16, 17, 20, 24, 28, 34, 40, 48
  (11-17: body/labels, 20-28: headings, 34-48: hero/display/decorative emoji)

FONT WEIGHTS (all fontWeight values must come from this scale):
  "400" (regular — body text, descriptions, long-form content)
  "500" (medium — labels, subtitles, UI control text, navigation items)
  "600" (semibold — section headers, card titles, emphasis within body)
  "700" (bold — screen titles, primary headings, hero numbers)

LINE HEIGHT (use 1.3-1.5x the font size, rounded to nearest 4):
  fontSize 11 → lineHeight 16, fontSize 12 → lineHeight 16, fontSize 13 → lineHeight 20,
  fontSize 14 → lineHeight 20, fontSize 16 → lineHeight 24, fontSize 17 → lineHeight 24,
  fontSize 20 → lineHeight 28, fontSize 24 → lineHeight 32, fontSize 28 → lineHeight 36,
  fontSize 34 → lineHeight 44, fontSize 40 → lineHeight 52, fontSize 48 → lineHeight 60

LETTER SPACING (optional, for refined typography):
  fontSize 11-13: letterSpacing 0.4 (open up small text for readability)
  fontSize 14-17: letterSpacing 0 (default, no adjustment needed)
  fontSize 20-28: letterSpacing -0.2 (tighten headings slightly)
  fontSize 34-48: letterSpacing -0.5 (tighten display/hero text)

BORDER RADIUS:
  0 (sharp edges), 4 (subtle rounding), 8 (moderate — chips, badges),
  12 (standard — cards, inputs, modals), 16 (large card — hero cards, image containers),
  24 (pill — buttons, selection chips), 9999 (full circle — avatars, FABs)

ICON SIZES: 16 (inline tiny), 20 (inline standard), 24 (standard nav/toolbar), 28 (feature), 32 (large feature), 40 (hero small), 48 (hero large)

AVATAR SIZES: 24 (tiny), 32 (small/chat), 40 (list item), 48 (card), 56 (profile card), 80 (profile medium), 120 (profile hero)

TOUCH TARGET MINIMUM: 44px height and width for any tappable element.

OPACITY LEVELS: 1.0 (primary/default), 0.7 (secondary text/icons), 0.4 (tertiary/hints/timestamps), 0.1 (subtle dividers/tinted backgrounds)
STATE OPACITY: pressed 0.7, disabled 0.4, hover 0.8 (apply to interactive elements)

ELEVATION/SHADOW (use sparingly — max 3 levels):
  none: no shadow
  subtle: shadowColor "#000", shadowOffset {0, 1}, shadowOpacity 0.08, shadowRadius 4, elevation 2
  medium: shadowColor "#000", shadowOffset {0, 2}, shadowOpacity 0.12, shadowRadius 8, elevation 4
  prominent: shadowColor "#000", shadowOffset {0, 4}, shadowOpacity 0.16, shadowRadius 16, elevation 8

STANDARD COMPONENT HEIGHTS:
  Button: 48 (standard), 40 (compact), 56 (large/hero)
  Input field: 48 (standard), 40 (compact)
  List row: 48 (compact), 56 (standard), 72 (with subtitle)
  Tab bar item: 49 (content area), Navigation bar: 44 (content area)

COLOR SYSTEM (Dark Theme — Default):
  Backgrounds:
    surface-0: "#0A0A1A" (screen base), surface-1: "#12121F" (cards, list items),
    surface-2: "#1A1A2E" (elevated card, modal), surface-3: "#222236" (input bg, hover)
  Text:
    text-primary: "#FFFFFF" (headings), text-secondary: "#A0A0B8" (descriptions),
    text-tertiary: "#6B6B80" (hints, timestamps), text-inverse: "#0A0A1A" (on colored bg)
  Brand/Accent:
    primary: "#6C5CE7" (main actions, buttons), primary-light: "#A29BFE" (badges, highlights),
    primary-dark: "#5A4BD1" (pressed state), primary-surface: "rgba(108, 92, 231, 0.1)" (tag bg)
  Semantic:
    success: "#00B894", success-surface: "rgba(0, 184, 148, 0.1)",
    warning: "#FDCB6E", warning-surface: "rgba(253, 203, 110, 0.1)",
    error: "#E17055", error-surface: "rgba(225, 112, 85, 0.1)",
    info: "#74B9FF", info-surface: "rgba(116, 185, 255, 0.1)"
  Utility:
    border: "#2A2A3E", border-strong: "#3A3A52", overlay: "rgba(0, 0, 0, 0.5)"

COLOR SYSTEM (Light Theme — use when user requests light/white theme):
  Backgrounds: surface-0: "#F5F5FA", surface-1: "#FFFFFF", surface-2: "#F0F0F5", surface-3: "#E8E8F0"
  Text: text-primary: "#1A1A2E", text-secondary: "#5A5A72", text-tertiary: "#9090A8", text-inverse: "#FFFFFF"
  Brand/Accent: Same as dark theme
  Semantic: Same as dark theme
  Utility: border: "#E0E0EC", border-strong: "#C8C8DA", overlay: "rgba(0, 0, 0, 0.3)"
`

export const CONTENT_LIBRARY = `
CONTENT LIBRARY — USE CONTEXTUAL, REALISTIC CONTENT
Never use "Lorem ipsum", "John Doe", "Jane Smith", "User", or generic placeholder text. Match content to the app category. If unsure, use productivity defaults.

FITNESS/HEALTH: Names: "Sarah M.", "Alex K.", "Coach Rivera". Stats: "5.2 km · 342 cal", "8,450 steps", "72 bpm resting", "7h 23m sleep". Labels: "Today's Progress", "Weekly Goal", "Active Calories". Actions: "Start Workout", "Log Meal", "Track Water". Motivation: "You're 82% to your daily goal!", "Great streak — 7 days!"

E-COMMERCE/SHOPPING: Products: "Ceramic Pour-Over Set", "Wool Blend Overcoat", "Wireless Studio Headphones". Prices: "$34.99", "$189.00", "$249.00". Details: "4.8 ★ (2.4k reviews)", "Free shipping over $50", "Only 3 left". Actions: "Add to Cart", "Buy Now", "Save for Later".

SOCIAL MEDIA: Usernames: "@maya.creates", "@alex_travels", "@designwithjay". Stats: "12.4K followers", "892 following", "3,241 posts". Captions: "Golden hour at the coast", "New project launch day!". Timestamps: "2h ago", "Yesterday", "Mar 18".

BANKING/FINANCE: Accounts: "Main Checking", "Savings Goal", "Investment Portfolio". Amounts: "$4,285.50", "$12,847.32", "+$2,450.00". Transactions: "Netflix Subscription -$15.99", "Whole Foods Market -$67.32", "Payroll +$3,200". Labels: "Available Balance", "Monthly Spending".

FOOD DELIVERY: Restaurants: "Sakura Ramen House", "The Green Kitchen", "Bella's Pizzeria". Items: "Tonkotsu Ramen · $16", "Avocado Toast · $12". Details: "4.7 ★ · 25-35 min · $2.99 delivery". Actions: "Order Now", "Track Delivery", "Reorder".

MUSIC/MEDIA: Songs: "Midnight Blue", "Chasing Light", "Ocean Drive". Artists: "Luna Park", "The Wanderers", "Neon Pulse". Details: "3:42", "Album · 2026". Actions: "Play", "Shuffle", "Add to Library".

PRODUCTIVITY/TASKS: Tasks: "Review Q1 design specs", "Team standup at 10am", "Send invoice to client". Labels: "Today", "This Week", "Priority". Projects: "Website Redesign", "Mobile App v2". Stats: "8 of 12 tasks complete", "3 overdue".

TRAVEL: Destinations: "Kyoto, Japan", "Barcelona, Spain", "Bali, Indonesia". Details: "Mar 24 – Mar 31", "2 travelers", "$1,280/person". Accommodations: "Sakura Guesthouse · 4.9 ★", "$185/night".

EDUCATION: Courses: "Advanced React Patterns", "UX Design Fundamentals", "Data Science 101". Progress: "Lesson 8 of 24", "72% complete", "3h 20m remaining". Actions: "Continue Learning", "Take Quiz".

REAL ESTATE: Listings: "Modern Loft in SoHo", "3BR Family Home", "Studio Apartment". Details: "$2,450/mo · 2 bed · 1 bath · 850 sq ft". Actions: "Schedule Tour", "Save Listing".

DATING: Profiles: "Emma, 28 · Designer", "Raj, 31 · Photographer". Bios: "Coffee enthusiast. Dog person.", "Adventure seeker. Foodie.". Details: "5 miles away", "92% match".

WEATHER: Conditions: "Mostly Sunny", "Partly Cloudy", "Light Rain". Temps: "24°C / 75°F", "High 28° · Low 16°". Locations: "San Francisco, CA", "London, UK".

NEWS/MEDIA: Headlines: "Tech Giants Report Record Q4 Earnings", "Climate Summit Reaches New Agreement". Sources: "Reuters · 2h ago", "Bloomberg · 45m ago". Details: "5 min read", "42 comments".

MESSAGING/CHAT: Contacts: "Design Team", "Mom", "Alex Rivera". Previews: "Sure, let's meet at 3pm!", "Shared a photo". Status: "Online", "Typing...". Details: "3 unread", "Pinned".

HEALTHCARE: Appointments: "Annual Checkup · Apr 2", "Dental Cleaning · Mar 28". Doctors: "Dr. Sarah Kim · Cardiology", "Dr. James Patel · General Practice". Vitals: "120/80 mmHg", "98.6°F", "SpO2 98%".

RIDE-HAILING: Routes: "Home → Office · 25 min", "Airport → Downtown · 40 min". Fares: "$18.50 · UberX", "$32.00 · Comfort". Drivers: "Miguel R. · 4.9 ★ · Toyota Camry".

STREAMING/VIDEO: Titles: "The Last Frontier · S2 E4", "Pixel Perfect · Documentary". Details: "1h 42m", "TV-MA". Categories: "Continue Watching", "Trending Now".

CRYPTO/TRADING: Assets: "Bitcoin (BTC)", "Ethereum (ETH)", "Solana (SOL)". Prices: "$67,842.50", "$3,421.80". Changes: "+2.4%", "-0.8%". Portfolio: "Total Value: $24,580".

HABIT TRACKING: Habits: "Morning Meditation", "Read 30 min", "Exercise". Streaks: "14 day streak", "Best: 32 days", "5 of 7 this week". Moods: "Great", "Good", "Okay".

PET CARE: Pets: "Luna · Golden Retriever · 3 years", "Mochi · Persian Cat · 5 years". Events: "Vet Checkup · Apr 5". Logs: "Breakfast: 2 cups kibble", "Walk: 45 min".

RECIPE/COOKING: Recipes: "Thai Green Curry", "Sourdough Bread", "Acai Bowl". Details: "Prep: 15 min · Cook: 30 min · Serves 4". Nutrition: "420 cal · 32g protein".

EVENTS/TICKETING: Events: "Neon Pulse Live · Madison Square Garden", "Design Conference 2026". Details: "Mar 28, 8:00 PM", "Starting at $45". Actions: "Buy Tickets", "Add to Calendar".

PARKING/MAPS: Locations: "Lot A · 0.3 mi away", "Garage B · 2 min walk". Pricing: "$3.50/hr · $18 max". Availability: "12 spots available".

KIDS/PARENTING: Children: "Emma · 4 years old", "Noah · 18 months". Milestones: "First Steps!", "Said first word · Mar 15". Tracking: "Nap: 1h 30m", "Feeding: 8oz at 2pm".

GAMING: Players: "NightRider_99", "StarQueen", "ThunderBolt". Scores: "2,450 pts", "Level 34", "Rank #128 Global". Actions: "Play Now", "Join Match".

SUBSCRIPTION/SAAS: Plans: "Pro Plan · $19/mo", "Team · $49/mo", "Enterprise". Usage: "8,450 / 10,000 API calls", "Storage: 4.2 GB of 10 GB". Actions: "Upgrade Plan", "Manage Billing".
`

export const COMPONENT_TYPES = `
SUPPORTED COMPONENT TYPES AND PROPS:
These are the ONLY types you may use. Using any other type will show an error.

1. View — Generic container. Renders as flex column by default.
   Style: all layout props (flex, flexDirection, justifyContent, alignItems, padding*, margin*, gap, width, height, backgroundColor, borderRadius, borderWidth, borderColor, opacity, position, top/bottom/left/right, overflow, shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation)

2. SafeAreaView — Same as View but implies safe area awareness. Use as root wrapper.

3. ScrollView — Scrollable container. Use when content may overflow.
   Props: showsVerticalScrollIndicator (bool), horizontal (bool), contentContainerStyle ({})
   Style: same as View

4. Text — Text content. Children must be strings or nested Text nodes.
   Style: fontSize, fontWeight, color, textAlign, lineHeight, letterSpacing, textDecorationLine, textTransform, plus layout props
   IMPORTANT: Put text styling in the top-level "style" property, NOT inside "props".

5. TextInput — Text input field. Always wrap in a View for proper styling.
   Props: placeholder (string), placeholderTextColor (string), secureTextEntry (bool), keyboardType (string)
   Style: fontSize, color, plus layout props. Put styling in top-level "style".

6. TouchableOpacity — Tappable button/link. Minimum 44px touch target.
   Style: same as View (renders as clickable container)

7. Image — Image display with automatic stock photo integration.
   Props: searchQuery (string — describe the image in 2-4 keywords, e.g. "fitness gym workout", "pizza restaurant interior", "nike sneakers side view", "tropical beach resort")
   The renderer automatically fetches a matching real photo using searchQuery.
   IMPORTANT: Always include searchQuery with 2-4 descriptive keywords. Always set explicit width and height in style.
   Example: { "type": "Image", "style": { "width": "100%", "height": 200, "borderRadius": 12 }, "props": { "searchQuery": "modern gym interior dark" } }
   For avatars/profile photos use the avatar prop: {"type":"Image","style":{"width":48,"height":48,"borderRadius":9999},"props":{"avatar":"Sarah"}}
   Avatar styles: "avataaars-neutral" (default), "lorelei", "notionists", "thumbs", "bottts" (robot), "fun-emoji"
   Use avatar for: profile screens, chat avatars, user lists, team members.
   Use searchQuery for: hero images, product photos, food, landscapes, venues.
   Fallback: If you need a specific URL, use source: { uri: "https://..." } instead.

8. ActivityIndicator — Loading spinner.
   Props: color (string), size ("large" | "small")

9. Switch — Toggle switch.
   Props: value (bool), trackColor ({ true: string, false: string }), thumbColor (string)

10. FlatList — List container (renders same as ScrollView in web).
    Props: contentContainerStyle ({})
    Style: same as View

SVG DATA VISUALIZATION COMPONENTS (for progress rings, sparklines, charts):
Use these INSIDE an Svg wrapper for data-rich screens (dashboards, fitness, finance).

11. Svg — SVG container. Must wrap all SVG child elements.
    Props: viewBox (string, e.g. "0 0 100 100")
    Style: width, height

12. Circle — SVG circle for progress rings.
    Props: cx, cy, r, fill, stroke, strokeWidth, strokeDasharray, strokeDashoffset, strokeLinecap

13. Path — SVG path for sparklines and custom shapes.
    Props: d (path data string), fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin

14. Rect — SVG rectangle for bar charts.
    Props: x, y, width, height, rx, ry, fill, stroke, strokeWidth

15. Line — SVG line.
    Props: x1, y1, x2, y2, stroke, strokeWidth, strokeLinecap

PROGRESS RING PATTERN (copy this for circular progress):
{"type":"Svg","style":{"width":64,"height":64},"props":{"viewBox":"0 0 64 64"},"children":[{"type":"Circle","props":{"cx":32,"cy":32,"r":28,"stroke":"#222236","strokeWidth":4,"fill":"none"}},{"type":"Circle","props":{"cx":32,"cy":32,"r":28,"stroke":"#22C55E","strokeWidth":4,"fill":"none","strokeDasharray":"176","strokeDashoffset":"44","strokeLinecap":"round"}}]}
(strokeDasharray = 2*pi*r ≈ 176 for r=28. strokeDashoffset = dasharray * (1 - progress). E.g., 75% = 176 * 0.25 = 44)

ENHANCED COMPONENTS:

16. Icon — Google Material Symbols icon (2500+ icons). Rendered via Material Symbols font.
    Props: name (string — Material Symbols name, lowercase with underscores), size (number, default 24), color (string), filled (bool, default false)
    Common names: favorite, home, search, settings, notifications, person, star, check, close, add, remove, send, delete, edit, bookmark, share, play_arrow, pause, skip_next, skip_previous, volume_up, music_note, shopping_cart, credit_card, wallet, trending_up, bar_chart, analytics, monitoring, bolt, location_on, restaurant, directions_run, fitness_center, water_drop, local_fire_department, schedule, calendar_today, visibility, lock, arrow_back, chevron_right, expand_more, menu, more_horiz, logout
    Example: {"type":"Icon","props":{"name":"favorite","size":20,"color":"#FF6B6B"}}
    Filled: {"type":"Icon","props":{"name":"favorite","size":20,"color":"#FF6B6B","filled":true}}
    NEVER use emoji or Lucide names. Use Material Symbols names with underscores.

17. LinearGradient — Container with gradient background. Children render on top.
    Props: colors (array of hex strings), start ({x,y}), end ({x,y}) — normalized 0-1 coordinates
    Style: same as View (padding, borderRadius, etc.)
    Example: {"type":"LinearGradient","style":{"padding":20,"borderRadius":16},"props":{"colors":["#6366F1","#8B5CF6"],"start":{"x":0,"y":0},"end":{"x":1,"y":1}},"children":[...]}

COMPONENT TREE FORMAT:
{
  "type": "View",          // Component type (required)
  "style": {},             // Styling (optional) — this is where ALL styles go
  "props": {},             // Component-specific props (optional)
  "children": []           // Child nodes or strings (optional)
}

CRITICAL: ALL styling (fontSize, color, padding, margin, etc.) goes in the top-level "style" property.
Do NOT put styles inside "props.style" — the renderer reads from "style" directly.
The "props" object is ONLY for component-specific properties like placeholder, source, value, etc.

Correct:  {"type":"Text","style":{"fontSize":24,"fontWeight":"700","color":"#FFFFFF"},"children":["Hello"]}
Wrong:    {"type":"Text","props":{"style":{"fontSize":24}},"children":["Hello"]}
`

export const VIEWPORT_BUDGET = `
VIEWPORT BUDGET — ABSOLUTE RULE (MOST CRITICAL):
The phone screen is 375×812pt. Usable content height is ~724px. The TOTAL height of ALL content MUST fit within 724px (one viewport).

STRICT HEIGHT ENFORCEMENT:
- NEVER generate content that requires scrolling on dashboards, home screens, or product pages.
- Total content height: header (~50px) + main content (~530px) + bottom nav (~80px) = ~660px MAX.
- If content exceeds this budget, REMOVE sections — do NOT add ScrollView.
- Count your sections: 4-5 max per screen. Each section 80-120px. No exceptions.

TEXT LENGTH LIMITS (ABSOLUTE):
- Product descriptions: MAX 80 characters (2 lines). Truncate with "..." if needed.
- Bio/about text: MAX 60 characters (1-2 lines).
- Any text block: MAX 3 lines. NEVER write paragraphs.
- Card descriptions: MAX 40 characters (1 line).
- List item subtitles: MAX 50 characters (1 line).
- NEVER include long marketing copy, feature descriptions, or multi-paragraph text. Mobile screens show SUMMARY data only.

COMPACT SPACING:
- 8-12px between items within a section, 12-16px between major sections.
- Stat cards: 70-90px tall, NEVER 120+.
- Use horizontal layouts (flexDirection: "row") for stat cards — 2-3 per row.
- Bottom tab bar: ~80px (49px content + 34px safe area).

SCROLLVIEW RULES:
- NEVER use ScrollView for: dashboards, home screens, product pages, profiles
- ONLY use ScrollView for: settings pages (long list), chat/message lists
- If a screen has a bottom tab bar, content above MUST fit without scrolling.

HEIGHT BUDGET BY SCREEN TYPE:
- Dashboard: 4-5 sections max, ~500-600px content + nav.
- Product: Hero image (~200px) + title/price (~80px) + options (~100px) + CTA (~60px) + nav (~80px) = ~520px. NO long descriptions.
- Profile: Avatar (~120px) + stats (~50px) + actions (~50px) + content (~250px) + nav (~80px) = ~550px
- Banking: Balance (~100px) + accounts (~90px) + transactions (~180px) + nav (~80px) = ~450px
`

export const CONTENT_DENSITY = `
CONTENT DENSITY:
Show SUMMARY data, not exhaustive data. Users can tap "See All" for more.

DASHBOARD/HOME DENSITY RULES:
- Balance/hero number: ONE prominent number (total balance, daily calories, step count). Large font (28-34px), centered or left-aligned.
- Account/stat cards: Show 2-3 cards in a HORIZONTAL ROW (flexDirection: "row", gap: 12). Each card: 48% width or 31% width. Height: 80-90px max.
- Transaction/activity list: Show 2-3 items maximum with a "See All" link. Each item: 48-56px height (icon + text + amount in one row).
- Quick actions: Show 3-4 icon buttons in a horizontal row. Each: 44-48px.
- Bottom tab bar: 4-5 tabs max, 49px height + 34px safe area.

WHAT NOT TO DO:
- Do NOT stack cards vertically when they can go side-by-side
- Do NOT show more than 3 transactions/activities on a dashboard
- Do NOT add "Financial Health" or "Emergency Fund" or "Weekly Summary" sections to a banking dashboard — keep it to: balance + accounts + recent transactions + nav
- Do NOT add extra motivational text, tips, or insights sections on dashboards
- Do NOT use more than 5 visual sections on any single viewport screen

COMPACT CARD PATTERN:
A stat card should be:
  { height: 80, borderRadius: 12, padding: 12, justifyContent: "center" }
NOT:
  { height: 160, borderRadius: 16, padding: 24 }

LAYOUT PATTERNS (use these to create variety, not just vertical stacking):

1. HORIZONTAL SCROLL SECTION (category chips, card carousel):
{"type":"ScrollView","props":{"horizontal":true,"showsVerticalScrollIndicator":false},"style":{"marginTop":16},"children":[
  {"type":"View","style":{"flexDirection":"row","gap":12,"paddingHorizontal":20},"children":[
    {"type":"TouchableOpacity","style":{"backgroundColor":"#6C5CE7","borderRadius":24,"paddingHorizontal":16,"height":36,"justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":13,"fontWeight":"600","color":"#FFFFFF"},"children":["All"]}]},
    {"type":"TouchableOpacity","style":{"backgroundColor":"#222236","borderRadius":24,"paddingHorizontal":16,"height":36,"justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":13,"color":"#A0A0B8"},"children":["Popular"]}]}
  ]}
]}

2. TWO-COLUMN GRID (product cards, image tiles):
{"type":"View","style":{"flexDirection":"row","flexWrap":"wrap","gap":12,"paddingHorizontal":20},"children":[
  {"type":"View","style":{"width":"48%","backgroundColor":"#12121F","borderRadius":12,"overflow":"hidden"},"children":[
    {"type":"Image","style":{"width":"100%","height":160},"props":{"searchQuery":"product photo"}},
    {"type":"View","style":{"padding":12},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"600","color":"#FFFFFF"},"children":["Item Name"]}]}
  ]}
]}

3. HERO CARD WITH OVERLAY (travel, streaming, food):
{"type":"View","style":{"borderRadius":16,"overflow":"hidden","height":200},"children":[
  {"type":"Image","style":{"width":"100%","height":"100%","position":"absolute"},"props":{"searchQuery":"scenic landscape"}},
  {"type":"LinearGradient","style":{"position":"absolute","bottom":0,"left":0,"right":0,"padding":16},"props":{"colors":["transparent","rgba(0,0,0,0.8)"],"start":{"x":0,"y":0},"end":{"x":0,"y":1}},"children":[
    {"type":"Text","style":{"fontSize":20,"fontWeight":"700","color":"#FFFFFF"},"children":["Title"]}
  ]}
]}

Use horizontal scrolls for: category filters, story avatars, featured cards, quick actions.
Use grids for: product listings, photo galleries, menu items, team members.
Use hero overlays for: travel destinations, movie posters, restaurant hero, event banners.
`

export const PLATFORM_RULES = `
iOS CONVENTIONS AND LAYOUT RULES:
- Status bar: paddingTop 54 on root container
- Home indicator: paddingBottom 34 on root or bottom-most element
- Tab bar: 49px content + 34px safe area = 83px total
- Navigation bar: 44px content area
- Touch target minimum: 44x44px for all interactive elements
- Back navigation: left arrow on left side, title centered
- Safe areas must ALWAYS be respected

LAYOUT RULES:
- Root element: type "View" or "SafeAreaView" with flex: 1, backgroundColor: surface-0
- Use ScrollView for any content that might overflow the phone screen
- Aim for 4-8 different font sizes per screen — clear typographic hierarchy
- Cards: 12-16px borderRadius, 16px padding, surface-1 background
- Buttons: 48px height, 24px borderRadius (pill shape), bold text
- Inputs: 48px height, 12px borderRadius, surface-3 background, 16px horizontal padding
- SPACING BY CONTEXT:
  Dashboard/Home: 12-16px between sections, 4-8px within sections (COMPACT)
  Detail/Article: 20-24px between sections, 8-12px within sections (STANDARD)
  Settings/Forms: 24-32px between sections, 0-4px within groups (GROUPED)
  Onboarding/Hero: 32-48px between elements (BREATHING)
  Default to COMPACT spacing unless the screen type calls for more.
- Horizontal padding: 16-20px on all screen content
- Icons: use emoji characters or colored View circles — never text descriptions like "[icon]"
- Design for standard mobile proportions (375pt width) — use percentage widths (width: "100%", width: "48%") for responsive elements

HIERARCHY PRINCIPLES:
- Hierarchy through size and weight, not just color
- Spacing creates visual grouping — tight within sections, generous between sections
- Color restraint — one primary accent, surfaces for depth, greys for text
- Every element has a purpose — no decorative noise
- The most important element should be largest and most vivid; secondary elements smaller and muted

EDGE CASES:
- Empty states: Show a centered emoji + title + subtitle + action button. Never leave a screen blank.
- Loading states: Use ActivityIndicator centered in the content area with a "Loading..." label below it.
- Error states: Show error icon + error message + retry button using the error color tokens.
- Long text: Use numberOfLines on Text components isn't supported in web preview — instead design with realistic text lengths and let overflow be hidden.
- For gradients: Use the LinearGradient component with colors array. Great for hero cards and CTAs.
- No blur/glassmorphism: Use semi-transparent backgrounds (rgba) for overlay effects instead.
`

export const QUALITY_CHECKLIST = `
QUALITY CHECKLIST — Verify before generating output:
1. Root element has flex: 1, surface-0 background, and proper safe area padding (paddingTop: 54, paddingBottom: 34)
2. ALL spacing values come from: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64
3. ALL font sizes come from: 11, 12, 13, 14, 16, 17, 20, 24, 28, 34, 40, 48
4. Typography has clear hierarchy: big+bold headings → medium labels → regular body → light hints
5. Colors follow the surface/text/accent hierarchy — no random hex codes
6. All buttons and touchable elements are at least 44px tall
7. Content is realistic and matches the app category
8. Cards have consistent padding (16px) and border radius (12px)
9. Dashboard sections fit within one viewport (~724px). Non-dashboard screens use appropriate ScrollView when content exceeds viewport. Spacing matches screen type: compact (12-16px) for dashboards, standard (20-24px) for details, grouped (24-32px) for settings.
10. The screen would look professional in a design portfolio
`
