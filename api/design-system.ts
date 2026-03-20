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

7. Image — Image display.
   Props: source ({ uri: string })
   Style: width, height, borderRadius, resizeMode (not supported in web renderer — use as placeholder areas with backgroundColor instead)

8. ActivityIndicator — Loading spinner.
   Props: color (string), size ("large" | "small")

9. Switch — Toggle switch.
   Props: value (bool), trackColor ({ true: string, false: string }), thumbColor (string)

10. FlatList — List container (renders same as ScrollView in web).
    Props: contentContainerStyle ({})
    Style: same as View

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
- Maximum 4-5 different font sizes per screen — clear hierarchy
- Cards: 12-16px borderRadius, 16px padding, surface-1 background
- Buttons: 48px height, 24px borderRadius (pill shape), bold text
- Inputs: 48px height, 12px borderRadius, surface-3 background, 16px horizontal padding
- Section spacing: 24-32px between sections, 8-16px within sections
- Horizontal padding: 16-20px on all screen content
- Icons: use emoji characters or colored View circles — never text descriptions like "[icon]"
- Screen width is 320px — use percentage widths (width: "100%", width: "48%") for responsive elements

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
- No gradient support: Use solid colors from the surface/accent palette. Simulate depth with layered surfaces (surface-0 behind surface-1 cards).
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
9. Sections are visually separated with 24-32px spacing
10. The screen would look professional in a design portfolio
`
