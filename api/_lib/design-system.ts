// Shared design system constants for Mokkoi screen generation prompts.
// Imported by both generate.ts (single screen) and generate-flow.ts (multi-screen flow).

export const DESIGN_TOKENS = `
DESIGN TOKENS — Use ONLY these scales:
SPACING: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64
FONT SIZES: 11, 12, 13, 14, 16, 17, 20, 24, 28, 34, 40, 48
FONT WEIGHTS: "400" (body), "500" (labels), "600" (section headers), "700" (titles/hero)
BORDER RADIUS: 0, 4, 8, 12, 16, 24 (pill), 9999 (circle)
TOUCH TARGETS: min 44px height/width for tappable elements.
COLORS (Dark Theme):
  BG: surface-0 "#0A0A1A", surface-1 "#12121F", surface-2 "#1A1A2E", surface-3 "#222236"
  Text: primary "#FFFFFF", secondary "#A0A0B8", tertiary "#6B6B80"
  Accent: primary "#6C5CE7", light "#A29BFE", dark "#5A4BD1"
  Semantic: success "#00B894", warning "#FDCB6E", error "#E17055", info "#74B9FF"
  Utility: border "#2A2A3E", overlay "rgba(0,0,0,0.5)"
COLORS (Light Theme): surface-0 "#F5F5FA", surface-1 "#FFFFFF", surface-2 "#F0F0F5", surface-3 "#E8E8F0", text-primary "#1A1A2E", text-secondary "#5A5A72", border "#E0E0EC"
`

export const CONTENT_LIBRARY = `
CONTENT: Use realistic, category-appropriate content. NEVER use "Lorem ipsum", "John Doe", or generic placeholders. Match names, stats, prices, and labels to the app domain. Use specific numbers, real-sounding brand names, and contextual actions. Default currency: USD ($). Default locale: US English. Only use other currencies/locales if the user explicitly requests them.

SAMPLE NAME RULES — When generating placeholder user names, profile names, or persona content:
- AVOID common LLM-cliché names that recur across many AI generations: Alex Morgan, Sarah Chen, John Doe, Jane Smith, Alex Johnson, Sarah Johnson.
- Prefer varied, realistic names that reflect the app's likely user base. Examples that feel natural: Maya Patel, Jordan Lee, Sam Rivera, Priya Sharma, Marcus Chen, Elena Rodriguez, Kai Thompson, Aisha Williams.
- Use the same persona name consistently within ONE app (don't introduce a new name on every screen).

PERSONA NAME SCOPE — The persona name (Maya Patel, Jordan Lee, etc.) is ONE name used in ONE category of slot per app: places where a user's actual name belongs (avatar caption, profile-header name, "Hi, Jordan" greeting, "Welcome back, Jordan" message). NEVER use the persona name as a generic placeholder for content that needs a specific real value:
- NEVER as a section header (use "Goals", "Recent Activity", "This Week")
- NEVER as a ListRow / TableRow title (use the actual item name like "Bench Press", "First 5K", "Weekly Summary")
- NEVER as a progress-bar label (use the metric like "Weight Loss", "5K Run Time", "Bench Press 200lbs")
- NEVER as a Button/CTA text (use the action like "Start Workout", "Browse Exercises", "View Details")
- NEVER as an achievement name (use specific names like "7-Day Streak", "First Marathon", "100 Workouts")
- NEVER as a card title or subtitle for non-person content
If a slot needs specific content and you don't have one, generate domain-appropriate content. The persona name is for identity slots only. Each app should have AT MOST 2-3 occurrences of the persona name total (e.g. profile header + greeting + maybe one social mention).
`

export const COMPONENT_TYPES = `
COMPONENTS (ONLY these types are valid):
View, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, Switch, FlatList, Svg, Circle, Path, Rect, Line, Icon, LinearGradient

CRITICAL FORMAT: styles go in "style", NOT in "props.style". Props are for component-specific properties only.
{"type":"Text","style":{"fontSize":24,"fontWeight":"700","color":"#FFF"},"children":["Hello"]}

Image: use searchQuery (descriptive, 5-10 words like a photo prompt) or avatar (name string for DiceBear).
  searchQuery: {"type":"Image","style":{"width":"100%","height":200},"props":{"searchQuery":"modern gym interior dark moody"}}
  avatar: {"type":"Image","style":{"width":48,"height":48,"borderRadius":9999},"props":{"avatar":"Sarah"}}
Icon: {"type":"Icon","props":{"name":"heart","size":20,"color":"#FF6B6B"}}
  ICON NAMES — STRICT RULE
  The 'name' prop of any Icon component MUST be exactly one of these values (Lucide kebab-case, lowercase, no spaces):

  heart, home, search, settings, bell, user, mail, star, check, x, plus, minus, chevron-right, chevron-left, chevron-down, chevron-up, arrow-left, arrow-right, arrow-up, arrow-down, menu, clock, calendar, camera, phone, map-pin, eye, lock, unlock, share, download, upload, trash, trash-2, edit, copy, play, pause, skip-forward, skip-back, volume, volume-1, volume-2, volume-x, wifi, wifi-off, battery, battery-charging, battery-low, battery-full, battery-dead, send, image, shopping-cart, filter, bookmark, globe, trending-up, trending-down, zap, activity, music, video, mic, sun, moon, cloud, cloud-rain, cloud-sun, droplet, droplets, wind, thermometer, snowflake, mountain, leaf, sprout, navigation, navigation-2, refresh, repeat, shuffle, info, help, alert, alert-circle, shield, credit-card, wallet, receipt, banknote, coins, piggy-bank, savings, bar-chart, bar-chart-2, pie-chart, analytics, dashboard, layout-dashboard, timeline, layers, grid, list, folder, file, link, external-link, qr-code, scan, fingerprint, flash, gift, tag, flag, pin, compass, target, crosshair, locate, map, award, trophy, gem, crown, sparkles, wand, fire, flame, restaurant, coffee, cart, bag, package, box, truck, airplane, plane, hotel, car, bike, bicycle, walk, run, footprints, fitness, dumbbell, barbell, spa, medical, stethoscope, pill, syringe, heart-pulse, baby, school, graduation-cap, book, briefcase, work, building, building-2, house, apartment, key, chat, chat-bubble, message, message-circle, message-square, group, users, user-plus, add-user, circle-user, circle-check, circle-x, circle-alert, circle-help, circle-plus, book-open, check-circle, library, thumb-up, thumb-down, thumbs-up, thumbs-down, more-horizontal, more-vertical, log-out, log-in, power, palette, brush, crop, tune, equalizer, headphones, speaker, radio, podcast, gamepad, timer, stopwatch, alarm, code, terminal, database, server, percent, attach, attach-file, paperclip, utensils, glass-water, apple, salad, pizza, soup, beer, wine, candy, cookie, cake, shirt, watch, glasses, lamp, bed, bath, shower, signal, rocket, lightbulb, brain, smile, frown, flower-2, maximize, minimize, add, add-circle, alarm, ac_unit, auto_awesome.

  If you need an icon for a concept not in this list, pick the CLOSEST semantic match from the list.
  NEVER invent a new icon name. NEVER use Material Symbols identifiers like "directions_walk", "local_fire_department", "fitness_center", "favorite", "shopping_cart" — they will render as raw text instead of a glyph.
  NEVER use emoji as Icon names.
LinearGradient: {"type":"LinearGradient","props":{"colors":["#6366F1","#8B5CF6"],"start":{"x":0,"y":0},"end":{"x":1,"y":1}},"children":[...]}
SVG ring: {"type":"Svg","style":{"width":56,"height":56},"props":{"viewBox":"0 0 56 56"},"children":[{"type":"Circle","props":{"cx":28,"cy":28,"r":24,"stroke":"#222236","strokeWidth":4,"fill":"none"}},{"type":"Circle","props":{"cx":28,"cy":28,"r":24,"stroke":"#6C5CE7","strokeWidth":4,"fill":"none","strokeDasharray":"151","strokeDashoffset":"38","strokeLinecap":"round"}}]}
  Formula: strokeDasharray=2*pi*r, strokeDashoffset=dasharray*(1-fraction)
ScrollView: props showsVerticalScrollIndicator, horizontal. TextInput: props placeholder, placeholderTextColor, secureTextEntry. Switch: props value, trackColor, thumbColor.

MACRO COMPONENTS — use these instead of raw nodes. They auto-expand to production-quality subtrees with proper styling, spacing, and visual hierarchy already built in.

═══════════════════════════════════════════════════════════════════════════════
BottomNav — REQUIRED for any app with multiple primary screens.
═══════════════════════════════════════════════════════════════════════════════
Every multi-screen app MUST have a single BottomNav instance shared across all screens. Do NOT manually construct bottom navigation as View [row] + TouchableOpacity + Icon + Text — that pattern is FORBIDDEN.

When to use: any app with 3-5 main sections (Home / Search / Cart / Profile, etc.).
When NOT to use: single-screen apps, modal flows, auth/onboarding screens.

Props:
  items: array of { icon: string, label: string, active?: boolean }
    icon — one of the icon names from the STRICT RULE list above.
    label — the DESTINATION SCREEN NAME this tab navigates to (e.g. "Home", "Transactions", "Profile"). NEVER use the icon name as the label. The label must match a screen in the SCREEN PLAN.
    active — true on exactly one item per screen (the current screen).

CORRECT: {"icon":"list","label":"Transactions"}   ← label is the screen name
WRONG:   {"icon":"list","label":"list"}           ← label copies the icon name (FORBIDDEN)
WRONG:   {"icon":"user","label":"person"}         ← label is an icon-ish word (FORBIDDEN)

Example (food delivery app, Home screen):
{"type":"BottomNav","props":{"items":[{"icon":"home","label":"Home","active":true},{"icon":"search","label":"Browse"},{"icon":"shopping-cart","label":"Cart"},{"icon":"user","label":"Profile"}]}}

BOTTOMNAV ACTIVE-STATE RULES — applies to NON-TAB screens (detail screens, settings, add-action flows, sub-screens):
- Either OMIT BottomNav entirely (preferred for detail screens that need full-screen content), OR
- Include BottomNav with active:false on EVERY item (preferred for sub-screens that should still show the navigation context).
- NEVER mark a tab as active:true on a non-tab screen. The 'active' indicator must only appear on the screen that the active tab actually navigates to.

CORRECT (Settings screen, BottomNav included): items: [{"label":"Home","icon":"home","active":false},{"label":"Workouts","icon":"dumbbell","active":false},{"label":"Profile","icon":"user","active":false}]
WRONG (Settings screen): items: [{"label":"Home","icon":"home","active":false}, ..., {"label":"Profile","icon":"user","active":true}]   ← Settings is not a tab; Profile shouldn't appear active
CORRECT (Workout Detail screen, BottomNav omitted): no BottomNav node — full-screen detail UI

NAVIGATION & LAYOUT (other macros):
HeaderBar: {"type":"HeaderBar","props":{"title":"Settings","showBack":true,"rightIcons":["bell","more-horizontal"]}}

HEADER BAR LEADING ICON RULES — back-arrow placement is a UX correctness rule, not a style choice:
- Home / entry screens (the screens BottomNav tabs navigate to — typically named Home, Feed, Browse, Dashboard, and the other top-level tab destinations): set "showBack": false. There is nothing to go back TO from a top-level tab screen, so a back arrow is wrong.
- Detail / sub-screens (e.g. "Entry Detail", "Session Detail", "Habit Detail", "Order Confirmation", "Edit Profile"): set "showBack": true. The user navigated FROM a parent screen, so the back arrow is correct.
- Auth / Onboarding flow screens: "showBack": true on every screen except the very first.

CORRECT (Home screen):    {"type":"HeaderBar","props":{"title":"Home","showBack":false,"rightIcons":["bell"]}}
CORRECT (detail screen):  {"type":"HeaderBar","props":{"title":"Entry Detail","showBack":true,"rightIcons":["more-horizontal"]}}
WRONG   (Home screen):    {"type":"HeaderBar","props":{"title":"Home","showBack":true,...}}   ← back arrow on a tab destination — FORBIDDEN
TabBar: {"type":"TabBar","props":{"tabs":[{"label":"Posts","active":true},{"label":"Reels"},{"label":"Tagged"}]}}
SectionHeader: {"type":"SectionHeader","props":{"title":"Recent Activity","actionText":"See All"}}
SearchBar: {"type":"SearchBar","props":{"placeholder":"Search restaurants, food..."}}
Divider: {"type":"Divider"}

DATA DISPLAY:
StatCard: {"type":"StatCard","props":{"icon":"activity","iconColor":"#A78BFA","value":"8,450","label":"steps"}}
ListRow: {"type":"ListRow","props":{"icon":"bell","title":"Notifications","subtitle":"Push and email","trailing":"On","showChevron":true}}
ProductCard: {"type":"ProductCard","props":{"image":"margherita pizza fresh basil","title":"Margherita Supreme","price":"$18.90","rating":"4.8","badge":"20% Off"}}
TransactionRow: {"type":"TransactionRow","props":{"icon":"shopping-cart","iconColor":"#818CF8","merchant":"Amazon","date":"Today","amount":"-$42.99"}}
FeatureCard: {"type":"FeatureCard","props":{"icon":"truck","iconColor":"#22C55E","title":"Free Shipping","subtitle":"On orders over $50"}}
PriceBreakdown: {"type":"PriceBreakdown","props":{"items":[{"label":"Subtotal","value":"$24.99"},{"label":"Shipping","value":"Free"},{"label":"Total","value":"$24.99","bold":true}]}}
RatingStars: {"type":"RatingStars","props":{"rating":4.5,"count":"(128 reviews)"}}
StatusBadge: {"type":"StatusBadge","props":{"text":"Active","color":"#22C55E"}}

USER IDENTITY:
AvatarCircle: {"type":"AvatarCircle","props":{"name":"Sarah","size":40}}
ProfileStats: {"type":"ProfileStats","props":{"stats":[{"value":"284","label":"Posts"},{"value":"12.5K","label":"Followers"},{"value":"891","label":"Following"}]}}

FORM & INPUT:
FormInput: {"type":"FormInput","props":{"label":"Email","placeholder":"you@example.com","icon":"mail"}}
Button: {"type":"Button","props":{"text":"Sign In","variant":"primary","size":"md"}} (variants: primary/secondary/outline, sizes: sm/md/lg)
SocialButton: {"type":"SocialButton","props":{"provider":"google"}} (providers: google/apple)
ChipSelector: {"type":"ChipSelector","props":{"chips":[{"label":"All","active":true},{"label":"Pizza"},{"label":"Burgers"},{"label":"Sushi"}]}}

CHAT:
MessageBubble: {"type":"MessageBubble","props":{"text":"Hey! How are you?","sent":false,"time":"10:30 AM"}}
ChatInputBar: {"type":"ChatInputBar","props":{"placeholder":"Type a message..."}}

MEDIA & VISUALIZATION:
ProgressRing: {"type":"ProgressRing","props":{"progress":0.82,"size":56,"color":"#6C5CE7","label":"Daily Goal"}}
ProgressBar: {"type":"ProgressBar","props":{"progress":0.65,"label":"Storage","value":"6.5 GB / 10 GB"}}
ImageCarousel: {"type":"ImageCarousel","props":{"images":["red running shoes side view","running shoes top view","shoes on runner feet"],"height":200}}

CONTENT:
PromoCard: {"type":"PromoCard","props":{"title":"50% Off Pizza","subtitle":"On orders above $30","buttonText":"Order Now","color":"#EF4444"}}

RULES: ALWAYS use macros when available. Use BottomNav for ALL bottom navigation, HeaderBar for ALL screen headers, FormInput for ALL form fields, ListRow for ALL settings/list items, ProductCard for ALL product listings, MessageBubble for ALL chat messages.
`

export const VIEWPORT_BUDGET = `
VIEWPORT: Phone is 375×812pt. Usable ~724px. Content MUST fit one viewport unless explicitly scrollable.
CRITICAL: ALL content must fit within 724px usable height. Do NOT generate screens taller than the phone viewport.
- Dashboard/Home/Profile: 4-5 sections max, NO ScrollView. header(~50)+content(~530)+nav(~80)=~660px.
- AUTH (Login/Signup/Register): MUST fit one viewport, NO ScrollView needed. logo(~80)+title(~48)+subtitle(~24)+form(~180)+CTA(~56)+divider+social(~56)+footer(~40)=~520px. Use compact 12-16px spacing between elements, NOT 24-48px. Keep padding tight.
- Onboarding/Welcome: MUST fit one viewport. illustration(~200)+title(~48)+subtitle(~40)+dots(~20)+CTA(~56)=~400px. Center content vertically using justifyContent:"center".
- PDP/Detail: SCROLLABLE with ScrollView. hero(~320)+title/price(~80)+colors(~56)+sizes(~60)+features(~180)+desc(~60)+shipping(~50)+CTA(~80). paddingBottom 98 for sticky CTA.
- Chat/Messaging: header(~56)+message list(~520, ScrollView)+input bar(~56)=~660px. ScrollView for messages only.
- Music/Media Player: album art(~280)+track info(~60)+controls(~80)+progress(~40)+extras(~80)=~580px. No ScrollView.
- Social Feed/Timeline: header(~50)+stories(~90)+feed items(ScrollView)+nav(~80). ScrollView for feed.
- Calendar/Schedule: header(~50)+month grid(~300)+events list(~200)+nav(~80)=~660px. No ScrollView unless many events.
- Map/Location: header(~50)+map area(~400)+bottom sheet(~200)=~680px. No ScrollView.
- Settings/List: ScrollView allowed for long lists.
- ANY OTHER SCREEN: Default to fitting within one viewport (~660px). Use ScrollView ONLY if content genuinely exceeds one screen (10+ list items, long form). When in doubt, keep it compact.
- Text limits: descriptions max 80 chars, bios max 60, any block max 3 lines.
- Stat cards: 70-90px tall, horizontal row (2-3 per row), NEVER 120+.
SPACING RULES: Use 8-16px between form elements, 16-24px between sections. NEVER use 32-64px gaps on any screen. Max gap between any two elements: 24px (32px only between major sections on detail pages). Keep layouts COMPACT.

FILL THE VIEWPORT: If a screen does NOT use ScrollView, content MUST fill the full ~660px usable area. NEVER leave visible empty dark space between the last content section and the bottom nav. If your planned sections total less than ~600px, ADD MORE contextually relevant sections to fill the gap. Examples:
- Music player (~540px) → add "Recently Played" list or "Similar Artists" row
- Banking dashboard (~550px) → add "Spending Insights" chart or "Quick Actions" grid
- Fitness dashboard (~560px) → add "Weekly Summary" bar chart or "Recommended Workouts"
- Profile (~500px) → add more content rows, highlights stories, or recent activity
The screen should feel FULL and COMPLETE — like a real shipped app, not a wireframe with empty space.
`

export const CONTENT_DENSITY = `
DENSITY RULES:
Dashboard: ONE hero number (28-34px) + 2-3 horizontal stat cards (80px, gap 12) + 2-3 list items with "See All" + 3-4 quick actions + bottom nav (4-5 tabs).
Auth (Login/Signup): Logo/icon (56px circle or small icon) + app name (fontSize 28) + subtitle (fontSize 14, max 1 line) + form fields (each input 48px + 8px gap) + primary CTA (48px) + "or continue with" divider + social buttons row (2 buttons, 48px) + "Don't have account?" link + legal text. Use gap:12-16px in form section, NOT 24+. Total form area should be ~300px max.
Onboarding: Centered illustration/icon (~120px) + headline (fontSize 28-34) + subtitle (fontSize 14-16, max 2 lines) + pagination dots + CTA button. Use justifyContent:"center" on root. Keep spacing 16-24px.
PDP sections (all required, 16px between, 8px within): image carousel with dot pagination → title/price/rating → color swatches (40px circles, active has accent border) → size chips (48x44, wrap, active=accent bg) → features list (3-5 styled cards: icon container 36x36 + title + subtitle, surface-1 bg, borderRadius 12) → description (2 lines max) → shipping/returns (icon+text rows) → sticky CTA bar.
Chat/Messaging: Header row (back arrow + avatar 40px circle with avatar prop + name + status "Active now" + call/info icons) + ScrollView message list (4-6 messages alternating sent/received, bubbles with borderRadius 16, padding 12, maxWidth "75%", sent=accent aligned right, received=surface-2 aligned left, timestamps fontSize 11) + typing indicator (3 animated dots) + input bar (TextInput + send button, height 48). NEVER put Image nodes inside message bubbles — messages are TEXT ONLY. Use avatar prop for contact photos, never searchQuery.
Do NOT: stack cards vertically when they fit side-by-side, show >3 list items on dashboards, add extra motivational/tips sections, use >5 sections on single-viewport screens, use excessive spacing (32-64px) between form fields or small elements, put Image nodes inside chat bubbles, use cartoon/emoji-style avatars.
`

export const PLATFORM_RULES = `
iOS LAYOUT: paddingTop 64 (status bar), paddingBottom 40 (home indicator). Tab bar: 49+34=83px. Nav bar: 44px.

SAFE AREA — STATUS BAR CLEARANCE (CRITICAL):
The web/canvas preview does NOT apply real safe-area insets to SafeAreaView
— it renders SafeAreaView as a plain View. This means SafeAreaView alone
is NOT enough to keep content below the status bar.

Every screen MUST guarantee status bar clearance via ONE of:
  1. Use the HeaderBar macro as the FIRST child (it has built-in 64px clearance)
  2. Set paddingTop: 64 on the root View / ScrollView (not just SafeAreaView)
  3. Wrap the title element in a View with paddingTop: 64

NEVER place a Text title or any visible element with paddingTop:0 (or no
padding) at the top of a screen — it will overlap the iPhone status bar
text/time/battery. This is the most common AI-generation visual bug.

CORRECT (using HeaderBar):
{"type":"SafeAreaView","style":{"flex":1,"backgroundColor":"#0A0A1A"},"children":[
  {"type":"HeaderBar","props":{"title":"Exercises","showBack":false}},
  ...rest of screen
]}

CORRECT (raw title with explicit padding):
{"type":"SafeAreaView","style":{"flex":1,"backgroundColor":"#0A0A1A"},"children":[
  {"type":"View","style":{"paddingTop":64,"paddingHorizontal":16},"children":[
    {"type":"Text","style":{"fontSize":28,"fontWeight":"700","color":"#FFFFFF"},"children":["Exercises"]}
  ]},
  ...rest
]}

WRONG (title overlaps status bar — FORBIDDEN):
{"type":"SafeAreaView","style":{"flex":1,"backgroundColor":"#0A0A1A"},"children":[
  {"type":"Text","style":{"fontSize":28,"fontWeight":"700"},"children":["Exercises"]},
  ...rest
]}

This rule applies to EVERY screen — Home, list screens, profile, settings,
detail screens, all of them.

Root: View with flex:1, surface-0 bg. Horizontal padding 16-20px.
Spacing between sections by screen type:
  Dashboard: 12-16px. Auth/Login: 12-16px (keep compact). Detail: 16-20px. Settings: 20-24px. Onboarding: 20-32px.
  NEVER use paddingTop/paddingBottom >48px on content sections (except root paddingTop:64 for status bar).
Cards: borderRadius 12-16, padding 16, surface-1 bg. Buttons: height 48, borderRadius 24, bold text. Inputs: height 48, borderRadius 12, surface-3 bg.
`

export const FUNCTIONAL_APP_RULES = `
═══════════════════════════════════════════════════════════════════════════════
MACRO ADOPTION RULE — read this BEFORE generating any tree.
═══════════════════════════════════════════════════════════════════════════════
You have access to 26 macro components (defined in COMPONENTS section above). Macros encapsulate common UI patterns with proper styling, spacing, and visual hierarchy already built in. **Using macros is REQUIRED, not optional.**

Before generating ANY raw View+Text+TouchableOpacity stack, ask yourself:
- Is this a bottom navigation? → BottomNav.
- Is this a screen header (title + back button + right icons)? → HeaderBar.
- Is this a section title with optional "See All"? → SectionHeader.
- Is this a list of items with icons + chevrons (settings, menu)? → ListRow (one per item).
- Is this a stat tile / metric card? → StatCard.
- Is this a row of category chips, filter pills, size buttons? → ChipSelector.
- Is this a star rating display? → RatingStars.
- Is this a card with image + title + price + rating? → ProductCard.
- Is this a chat message bubble? → MessageBubble.
- Is this a form field (label + input + icon)? → FormInput.
- Is this an avatar with initials/photo? → AvatarCircle.
- Is this a circular or linear progress indicator? → ProgressRing or ProgressBar.

The 12 most-important macros to look for first (ranked by frequency of need):
1. BottomNav — every multi-screen app's bottom tab bar.
2. HeaderBar — every screen's top header.
3. ListRow — settings rows, menu items, "Recent X" lists.
4. SectionHeader — every "Section title · See All" pattern.
5. StatCard — every dashboard metric tile.
6. ChipSelector — every category / filter / size row.
7. ProductCard — every product / restaurant / listing tile.
8. RatingStars — every "★ 4.6 (128 reviews)" display.
9. AvatarCircle — every user/host/contact avatar.
10. FormInput — every form field with label.
11. SearchBar — every search input row.
12. MessageBubble — every chat message.

If a macro fits, USE IT. Raw View+Text stacks for these patterns are FORBIDDEN.

CRITICAL — GENERATE FUNCTIONAL SCREENS, NOT STATIC MOCKUPS:
This is an app builder. The output should be a working app prototype, not a design mockup. Every interactive element must actually work. Every screen must look like a production app, NOT a wireframe.

STATE MANAGEMENT:
- Every TextInput MUST have value and onChangeText connected to useState
- Every Switch MUST toggle with useState
- Search bars MUST filter displayed content using useState + .filter()
- Quantity controls MUST increment/decrement a count state

BUTTON HANDLERS:
- Every TouchableOpacity MUST have a meaningful onPress handler
- Primary CTAs: Alert.alert('Success', 'Action completed!') or toggle a state
- List items: set a selectedId state to show selection
- Forms: validate inputs and show success Alert

REALISTIC MOCK DATA:
- Use arrays of realistic data objects with 5-8 items each, NOT placeholder strings
- Social: [{user:'Sarah Chen',text:'Just caught this amazing sunrise!',likes:42,comments:8,time:'2h ago',avatar:'Sarah Chen'}, ...]
- Each data item should have all fields needed for the UI (name, subtitle, image, stats, etc.)

BOTTOM TAB BAR (use the BottomNav macro — see negative/positive example below):
- Maximum 4-5 tabs.
- Tab labels are ONE WORD: Home, Search, Cart, Profile, etc.
- Detail screens are NEVER tab items.
- Tab icons are Lucide kebab-case names from the strict ICON list (NOT emoji).
- Active tab gets the accent color; inactive tabs are muted.

NEGATIVE EXAMPLE — DO NOT do this (raw stack pattern, FORBIDDEN):
{
  "type": "View",
  "style": { "flexDirection": "row", "borderTopWidth": 1, "paddingVertical": 8 },
  "children": [
    { "type": "TouchableOpacity", "style": { "alignItems": "center" }, "children": [
      { "type": "Icon", "props": { "name": "home", "size": 22, "color": "#6C5CE7" } },
      { "type": "Text", "style": { "fontSize": 11, "color": "#6C5CE7" }, "children": ["Home"] }
    ]},
    ... 3 more identical TouchableOpacity wrappers ...
  ]
}

POSITIVE EXAMPLE — DO this (one BottomNav macro replaces the whole stack):
{ "type": "BottomNav", "props": { "items": [
  { "icon": "home", "label": "Home", "active": true },
  { "icon": "search", "label": "Search" },
  { "icon": "shopping-cart", "label": "Cart" },
  { "icon": "user", "label": "Profile" }
]}}

SCREEN CONTENT DENSITY (CRITICAL):
Every screen must feel FULL and COMPLETE like a real shipped app. Never leave empty space.

Feed/Home screens:
- Stories/highlights row at top (4-5 circular avatars with names below)
- 3-4 post cards, EACH with: avatar circle (40px) + username + timestamp in header row → content text (2-3 lines) → Image placeholder ({"type":"Image","style":{"width":"100%","height":200,"borderRadius":12,"backgroundColor":"#1A1A2E"},"props":{"searchQuery":"relevant photo"}}) → action row with like(❤️ count), comment(💬 count), share(↗️) icons + counts
- Use realistic engagement numbers (42 likes, 8 comments)

Messages/List screens:
- 5-6 list items minimum
- Each item: avatar (40px circle) + name (bold) + subtitle (gray) + timestamp (right-aligned)
- Search bar at top
- Proper 12-16px spacing between items

Profile screens:
- Cover photo area (Image with searchQuery, height 150-180px)
- Avatar overlapping cover (-30px marginTop, 80px circle)
- Name (20px bold) + handle/bio (14px gray)
- Stats row: 3 columns (Posts/Followers/Following with numbers)
- Follow + Message buttons row
- Photo grid (2 columns, 3 rows of Image squares)

Detail screens:
- Hero image or header section at top
- Rich content with multiple sections
- Sticky action button at bottom

FORM SCREENS:
- Login: email + password with useState, Sign In button with Alert
- Checkout: quantity controls (+ / -), dynamic total calculation
- Settings: all toggles must use useState and actually toggle
`

export const QUALITY_CHECKLIST = `
VERIFY: 1) Root has flex:1, surface-0, paddingTop:64, paddingBottom:40. 2) All spacing/fontSize from scales. 3) Clear type hierarchy. 4) Realistic content. 5) Professional quality. 6) ALL TextInputs have useState. 7) ALL buttons have onPress. 8) ALL switches toggle.
`

// BYO-Backend: planner-emitted hints that the exporter uses to wire generated
// screens to a Supabase backend. Currently scoped to auth on the auth screen;
// extends naturally to other data actions (data.read, data.write, …) as the
// pipeline grows. The exporter (src/utils/exportTsx.ts) reads these and emits
// supabase.auth.* calls on the convention-matched primary button.
export type ScreenDataActionKind =
  | 'auth.signInWithPassword'
  | 'auth.signUp'
  | 'auth.signOut'

export interface ScreenDataAction {
  kind: ScreenDataActionKind
  /** Plan ID of the screen to navigate to after success (typically the home screen). */
  redirectScreen?: string
}

export const APP_PLANNER_SYSTEM_PROMPT = `You are an expert mobile app architect. Given a user's app description, produce a structured JSON plan for a mobile app.

RULES:
- Generate 4-8 screens. Never fewer than 4, never more than 8.
- Every app MUST have exactly one screen with "isHome": true (the landing/dashboard screen).
- Screen IDs must be kebab-case (e.g. "home", "workout-detail", "meal-plans").
- Screen names must be short and human-readable (e.g. "Home", "Workout Detail", "Meal Plans").
- screenType must be one of: dashboard, list, detail, auth, profile, settings, onboarding, chat, music, social, calendar, map, form, search, cart, checkout
- For content-heavy apps (social, ecommerce, food delivery, music, fitness): use "tabs" or "hybrid" navigation with 3-5 tab screens.
- For flow/utility apps (onboarding, checkout, booking): use "stack" navigation.
- "hybrid" means tabs for main screens + stack for detail/modal screens pushed on top.
- tabScreens array should have 3-5 entries max, matching screen IDs.
- connections define the primary user journey — how users navigate between screens.
- trigger must be one of: "tab", "button_tap", "list_item", "card_tap", "nav_back"
- Pick an accent color fitting the app domain:
  - Fitness/health: green (#22C55E) or purple (#8B5CF6)
  - Finance/crypto: blue (#3B82F6) or teal (#14B8A6)
  - Food/delivery: orange (#F97316) or red (#EF4444)
  - Social/chat: purple (#8B5CF6) or pink (#EC4899)
  - Music/media: purple (#A855F7) or indigo (#6366F1)
  - Travel/maps: blue (#0EA5E9) or teal (#14B8A6)
  - Productivity: indigo (#6366F1) or blue (#3B82F6)
  - Ecommerce: orange (#F97316) or green (#22C55E)
  - Default: indigo (#6366F1)
- Default to "dark" theme unless user explicitly requests light.
- style should be 2-3 words describing the visual mood (e.g. "modern minimal", "bold vibrant", "sleek dark").

DATA ACTIONS (BYO-Backend):
- For screens with screenType:"auth", if the screen contains a primary submit button (login or signup), set a screen-level "dataAction" object: {"kind":"auth.signInWithPassword"} for login screens, {"kind":"auth.signUp"} for signup screens. Set "redirectScreen" to the planId of the screen to navigate to after success (typically the home/dashboard screen).
- Do NOT emit dataAction on non-auth screens. Omit the field entirely when not applicable.

Return ONLY valid JSON. No markdown, no explanation, no code fences.

Example output:
{"appName":"FitForge","screens":[{"id":"home","name":"Home","description":"Dashboard with daily stats, workout streak, and quick-start buttons","screenType":"dashboard","isHome":true},{"id":"workouts","name":"Workouts","description":"Browse workout categories and saved routines","screenType":"list","isHome":false},{"id":"workout-detail","name":"Workout Detail","description":"Exercise list with sets, reps, and timer","screenType":"detail","isHome":false},{"id":"progress","name":"Progress","description":"Weekly charts, body stats, and achievement badges","screenType":"dashboard","isHome":false},{"id":"profile","name":"Profile","description":"User avatar, stats, settings link, and subscription status","screenType":"profile","isHome":false}],"navigation":{"type":"hybrid","tabScreens":["home","workouts","progress","profile"],"connections":[{"from":"home","to":"workout-detail","trigger":"card_tap"},{"from":"workouts","to":"workout-detail","trigger":"list_item"},{"from":"profile","to":"settings","trigger":"button_tap"}]},"designDirection":{"theme":"dark","accentColor":"#8B5CF6","style":"bold energetic"}}`

// ============================================================================
// Template priors — applied when matchTemplate() recognizes a user prompt as
// one of the 6 app archetypes. Each prior is spliced into the planner system
// prompt so the generator has strong structural guidance for that archetype.
// ============================================================================

const TEMPLATE_PRIORS: Record<string, string> = {
  'fitness': `
The user wants a FITNESS app. Typical screens:
- Home: today's stats (calories/steps/heart rate), workout streak, quick-start CTA, recent workouts list
- Workouts: category cards (Strength / Cardio / Yoga / HIIT) with hero images, popular workouts list with ratings
- Workout Detail: header image, stats row (sets/reps/duration), exercise list, start-workout CTA
- Progress: weekly activity chart area, body measurement stats (weight / body fat), recent achievements
- Profile: avatar, fitness goals with progress bars, achievement badges, settings links
Use health-forward content (12-day streak, 420 cal, 8240 steps) and a green accent.`,
  'food-delivery': `
The user wants a FOOD DELIVERY app. Typical screens:
- Home: location header, search bar, featured promo card ("30% off first order") with real food image, cuisine category chips, nearby restaurants with photos/ratings
- Restaurant Detail: hero image, menu sections, item cards with prices, add-to-cart buttons
- Cart: line items with qty controls, price breakdown (subtotal/delivery/total), checkout CTA
- Order Tracking: status timeline (Confirmed → Preparing → On the way → Delivered) with icons and timestamps, map placeholder, order details card
- Profile: avatar, stats row (orders / rating / spent), saved addresses, payment methods
Use orange accent, rich food photography, empty states with clear CTAs.`,
  'social-media': `
The user wants a SOCIAL MEDIA app. Typical screens:
- Feed: stories row (circular avatars), post cards with avatar/image/caption/like-comment-share
- Profile: cover photo, avatar, stats (posts/followers/following), bio, photo grid
- Messages: search bar, conversation list with avatars/preview/timestamp
- Notifications: grouped list (likes/comments/follows) with icons and timestamps
- Search/Explore: trending topics, grid of popular posts
Use purple accent, avatar-heavy content, realistic usernames.`,
  'ecommerce': `
The user wants an E-COMMERCE app. Typical screens:
- Home: hero banner, category tiles, product grid with images/prices/ratings
- Product Detail: image carousel, title/price/rating, description, add-to-cart CTA
- Cart: line items with qty, price breakdown, checkout CTA
- Checkout: address, payment method, order summary
- Orders/Profile: order history list, account links
Use pink/magenta accent, product photography, star ratings.`,
  'banking': `
The user wants a BANKING/FINANCE app. Typical screens:
- Home: account balance card (large), quick actions (transfer/pay/deposit), recent transactions list
- Transactions: filter chips, grouped list by date with merchant icons and amounts
- Transfer: recipient selection, amount input, review screen
- Cards: card carousel, card details, transaction filter
- Profile: account info, security settings
Use blue/navy accent, clear numeric hierarchy, positive/negative amount coloring.`,
  'music': `
The user wants a MUSIC STREAMING app. Typical screens:
- Home: featured playlists, recently played, recommended albums
- Player: album art (large), track title/artist, progress bar, playback controls
- Library: tabs (Playlists / Artists / Albums / Songs), list views
- Search: search bar, genre grid, results list
- Profile: listening stats, followed artists
Use dark background with vibrant accent, album art everywhere, waveform/progress bars.`,
}

export function buildPlannerSystem(matchedTemplateId?: string | null): string {
  if (!matchedTemplateId) return APP_PLANNER_SYSTEM_PROMPT
  const prior = TEMPLATE_PRIORS[matchedTemplateId]
  if (!prior) return APP_PLANNER_SYSTEM_PROMPT
  return `${APP_PLANNER_SYSTEM_PROMPT}

# TEMPLATE HINT (user prompt matched an archetype)
${prior}

Use this as structural guidance only. The user's own requirements take precedence.`
}
