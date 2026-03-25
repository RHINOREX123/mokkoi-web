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
CONTENT: Use realistic, category-appropriate content. NEVER use "Lorem ipsum", "John Doe", or generic placeholders. Match names, stats, prices, and labels to the app domain. Use specific numbers, real-sounding brand names, and contextual actions.
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
`

export const VIEWPORT_BUDGET = `
VIEWPORT: Phone is 375×812pt. Usable ~724px. Content MUST fit one viewport unless explicitly scrollable.
CRITICAL: ALL content must fit within 724px usable height. Do NOT generate screens taller than the phone viewport.
- Dashboard/Home/Profile: 4-5 sections max, NO ScrollView. header(~50)+content(~530)+nav(~80)=~660px.
- AUTH (Login/Signup/Register): MUST fit one viewport, NO ScrollView needed. logo(~80)+title(~48)+subtitle(~24)+form(~180)+CTA(~56)+divider+social(~56)+footer(~40)=~520px. Use compact 12-16px spacing between elements, NOT 24-48px. Keep padding tight.
- Onboarding/Welcome: MUST fit one viewport. illustration(~200)+title(~48)+subtitle(~40)+dots(~20)+CTA(~56)=~400px. Center content vertically using justifyContent:"center".
- PDP/Detail: SCROLLABLE with ScrollView. hero(~320)+title/price(~80)+colors(~56)+sizes(~60)+features(~180)+desc(~60)+shipping(~50)+CTA(~80). paddingBottom 98 for sticky CTA.
- Settings/Chat/List: ScrollView allowed for long lists.
- Text limits: descriptions max 80 chars, bios max 60, any block max 3 lines.
- Stat cards: 70-90px tall, horizontal row (2-3 per row), NEVER 120+.
SPACING RULES: Use 8-16px between form elements, 16-24px between sections. NEVER use 32-64px gaps between elements on auth/onboarding screens. Keep layouts COMPACT.
`

export const CONTENT_DENSITY = `
DENSITY RULES:
Dashboard: ONE hero number (28-34px) + 2-3 horizontal stat cards (80px, gap 12) + 2-3 list items with "See All" + 3-4 quick actions + bottom nav (4-5 tabs).
Auth (Login/Signup): Logo/icon (56px circle or small icon) + app name (fontSize 28) + subtitle (fontSize 14, max 1 line) + form fields (each input 48px + 8px gap) + primary CTA (48px) + "or continue with" divider + social buttons row (2 buttons, 48px) + "Don't have account?" link + legal text. Use gap:12-16px in form section, NOT 24+. Total form area should be ~300px max.
Onboarding: Centered illustration/icon (~120px) + headline (fontSize 28-34) + subtitle (fontSize 14-16, max 2 lines) + pagination dots + CTA button. Use justifyContent:"center" on root. Keep spacing 16-24px.
PDP sections (all required, 16px between, 8px within): image carousel with dot pagination → title/price/rating → color swatches (40px circles, active has accent border) → size chips (48x44, wrap, active=accent bg) → features list (3-5 styled cards: icon container 36x36 + title + subtitle, surface-1 bg, borderRadius 12) → description (2 lines max) → shipping/returns (icon+text rows) → sticky CTA bar.
Do NOT: stack cards vertically when they fit side-by-side, show >3 list items on dashboards, add extra motivational/tips sections, use >5 sections on single-viewport screens, use excessive spacing (32-64px) between form fields or small elements.
`

export const PLATFORM_RULES = `
iOS LAYOUT: paddingTop 54 (status bar), paddingBottom 34 (home indicator). Tab bar: 49+34=83px. Nav bar: 44px.
Root: View with flex:1, surface-0 bg. Horizontal padding 16-20px.
Spacing between sections by screen type:
  Dashboard: 12-16px. Auth/Login: 12-16px (keep compact). Detail: 16-20px. Settings: 20-24px. Onboarding: 20-32px.
  NEVER use paddingTop/paddingBottom >48px on content sections (except root paddingTop:54 for status bar).
Cards: borderRadius 12-16, padding 16, surface-1 bg. Buttons: height 48, borderRadius 24, bold text. Inputs: height 48, borderRadius 12, surface-3 bg.
`

export const QUALITY_CHECKLIST = `
VERIFY: 1) Root has flex:1, surface-0, paddingTop:54, paddingBottom:34. 2) All spacing/fontSize from scales. 3) Clear type hierarchy. 4) Realistic content. 5) Professional quality.
`
