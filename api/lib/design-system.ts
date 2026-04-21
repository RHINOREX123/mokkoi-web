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
`

export const COMPONENT_TYPES = `
COMPONENTS (ONLY these types are valid):
View, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, Switch, FlatList, Svg, Circle, Path, Rect, Line, Icon, LinearGradient

CRITICAL FORMAT: styles go in "style", NOT in "props.style". Props are for component-specific properties only.
{"type":"Text","style":{"fontSize":24,"fontWeight":"700","color":"#FFF"},"children":["Hello"]}

Image: use searchQuery (descriptive, 5-10 words like a photo prompt) or avatar (name string for DiceBear).
  searchQuery: {"type":"Image","style":{"width":"100%","height":200},"props":{"searchQuery":"modern gym interior dark moody"}}
  avatar: {"type":"Image","style":{"width":48,"height":48,"borderRadius":9999},"props":{"avatar":"Sarah"}}
Icon: Google Material Symbols only. {"type":"Icon","props":{"name":"favorite","size":20,"color":"#FF6B6B"}}
  NEVER use emoji for icons or Lucide-style names.
LinearGradient: {"type":"LinearGradient","props":{"colors":["#6366F1","#8B5CF6"],"start":{"x":0,"y":0},"end":{"x":1,"y":1}},"children":[...]}
SVG ring: {"type":"Svg","style":{"width":56,"height":56},"props":{"viewBox":"0 0 56 56"},"children":[{"type":"Circle","props":{"cx":28,"cy":28,"r":24,"stroke":"#222236","strokeWidth":4,"fill":"none"}},{"type":"Circle","props":{"cx":28,"cy":28,"r":24,"stroke":"#6C5CE7","strokeWidth":4,"fill":"none","strokeDasharray":"151","strokeDashoffset":"38","strokeLinecap":"round"}}]}
  Formula: strokeDasharray=2*pi*r, strokeDashoffset=dasharray*(1-fraction)
ScrollView: props showsVerticalScrollIndicator, horizontal. TextInput: props placeholder, placeholderTextColor, secureTextEntry. Switch: props value, trackColor, thumbColor.

MACRO COMPONENTS — use these instead of raw nodes. They auto-expand to production-quality subtrees:

NAVIGATION & LAYOUT:
BottomNav: {"type":"BottomNav","props":{"items":[{"icon":"home","label":"Home","active":true},{"icon":"search","label":"Browse"},{"icon":"shopping_cart","label":"Cart"},{"icon":"person","label":"Account"}]}}
HeaderBar: {"type":"HeaderBar","props":{"title":"Settings","showBack":true,"rightIcons":["notifications","more_vert"]}}
TabBar: {"type":"TabBar","props":{"tabs":[{"label":"Posts","active":true},{"label":"Reels"},{"label":"Tagged"}]}}
SectionHeader: {"type":"SectionHeader","props":{"title":"Recent Activity","actionText":"See All"}}
SearchBar: {"type":"SearchBar","props":{"placeholder":"Search restaurants, food..."}}
Divider: {"type":"Divider"}

DATA DISPLAY:
StatCard: {"type":"StatCard","props":{"icon":"monitoring","iconColor":"#A78BFA","value":"8,450","label":"steps"}}
ListRow: {"type":"ListRow","props":{"icon":"notifications","title":"Notifications","subtitle":"Push and email","trailing":"On","showChevron":true}}
ProductCard: {"type":"ProductCard","props":{"image":"margherita pizza fresh basil","title":"Margherita Supreme","price":"$18.90","rating":"4.8","badge":"20% Off"}}
TransactionRow: {"type":"TransactionRow","props":{"icon":"shopping_bag","iconColor":"#818CF8","merchant":"Amazon","date":"Today","amount":"-$42.99"}}
FeatureCard: {"type":"FeatureCard","props":{"icon":"local_shipping","iconColor":"#22C55E","title":"Free Shipping","subtitle":"On orders over $50"}}
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
iOS LAYOUT: paddingTop 54 (status bar), paddingBottom 34 (home indicator). Tab bar: 49+34=83px. Nav bar: 44px.
Root: View with flex:1, surface-0 bg. Horizontal padding 16-20px.
Spacing between sections by screen type:
  Dashboard: 12-16px. Auth/Login: 12-16px (keep compact). Detail: 16-20px. Settings: 20-24px. Onboarding: 20-32px.
  NEVER use paddingTop/paddingBottom >48px on content sections (except root paddingTop:54 for status bar).
Cards: borderRadius 12-16, padding 16, surface-1 bg. Buttons: height 48, borderRadius 24, bold text. Inputs: height 48, borderRadius 12, surface-3 bg.
`

export const FUNCTIONAL_APP_RULES = `
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

BOTTOM TAB BAR (CRITICAL):
- Maximum 4 tabs (NEVER more than 5)
- Tab labels must be ONE WORD: Home, Explore, Chat, Profile
- Detail screens are NEVER tab items
- Every tab MUST have an emoji icon ABOVE the label. Required icons:
  Home: 🏠  Explore/Search: 🔍  Messages/Chat: 💬  Cart: 🛒  Profile: 👤  Notifications: 🔔  Settings: ⚙️  Favorites: ❤️  Activity: 📊
- Tab bar height: 60-70px. Icon size: 20-24px above 10-11px label.
- Active tab: accent color icon+label. Inactive: gray/muted.
- Use BottomNav macro: {"type":"BottomNav","props":{"items":[{"icon":"home","label":"Home","active":true},{"icon":"search","label":"Explore"},{"icon":"chat","label":"Chat"},{"icon":"person","label":"Profile"}]}}

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
VERIFY: 1) Root has flex:1, surface-0, paddingTop:54, paddingBottom:34. 2) All spacing/fontSize from scales. 3) Clear type hierarchy. 4) Realistic content. 5) Professional quality. 6) ALL TextInputs have useState. 7) ALL buttons have onPress. 8) ALL switches toggle.
`

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

Return ONLY valid JSON. No markdown, no explanation, no code fences.

Example output:
{"appName":"FitForge","screens":[{"id":"home","name":"Home","description":"Dashboard with daily stats, workout streak, and quick-start buttons","screenType":"dashboard","isHome":true},{"id":"workouts","name":"Workouts","description":"Browse workout categories and saved routines","screenType":"list","isHome":false},{"id":"workout-detail","name":"Workout Detail","description":"Exercise list with sets, reps, and timer","screenType":"detail","isHome":false},{"id":"progress","name":"Progress","description":"Weekly charts, body stats, and achievement badges","screenType":"dashboard","isHome":false},{"id":"profile","name":"Profile","description":"User avatar, stats, settings link, and subscription status","screenType":"profile","isHome":false}],"navigation":{"type":"hybrid","tabScreens":["home","workouts","progress","profile"],"connections":[{"from":"home","to":"workout-detail","trigger":"card_tap"},{"from":"workouts","to":"workout-detail","trigger":"list_item"},{"from":"profile","to":"settings","trigger":"button_tap"}]},"designDirection":{"theme":"dark","accentColor":"#8B5CF6","style":"bold energetic"}}`
