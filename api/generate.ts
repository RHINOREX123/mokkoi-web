import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest, checkCredits, logUsage, logEditDiff, deductCredits, getUserPlan, getSupabaseConfig } from './_lib/auth-helper.js'
import { createClient } from '@supabase/supabase-js'
import { normalizeComponentTree, type NormalizerOptions } from './_lib/normalizer.js'
import { expandComponents } from '../lib/component-library.js'
import { parseHtmlToComponentTree, shouldUseDomParser, extractAllText } from '../lib/html-parser.js'
import { DESIGN_TOKENS, CONTENT_LIBRARY, COMPONENT_TYPES, VIEWPORT_BUDGET, CONTENT_DENSITY, PLATFORM_RULES, QUALITY_CHECKLIST, FUNCTIONAL_APP_RULES } from './_lib/design-system.js'
import { resolveTheme, formatPaletteForPrompt, type ThemeResult } from './_lib/color-themes.js'

// --- Few-shot examples (compact JSON) ---
// ANCHOR examples: DASHBOARD + SETTINGS (always included)
// Type-specific: 1 per category max

const EXAMPLE_DASHBOARD = `--- EXAMPLE ---
User: "fitness dashboard"
{"type":"View","style":{"flex":1,"backgroundColor":"#0A0A1A","paddingTop":54},"children":[{"type":"View","style":{"flex":1,"paddingHorizontal":20},"children":[{"type":"View","style":{"flexDirection":"row","justifyContent":"space-between","alignItems":"center","paddingTop":12},"children":[{"type":"View","children":[{"type":"Text","style":{"fontSize":14,"color":"#6B6B80"},"children":["Good morning"]},{"type":"Text","style":{"fontSize":24,"fontWeight":"600","color":"#FFFFFF","marginTop":2},"children":["Sarah"]}]},{"type":"Image","style":{"width":40,"height":40,"borderRadius":9999},"props":{"avatar":"Sarah"}}]},{"type":"View","style":{"flexDirection":"row","gap":12,"marginTop":16},"children":[{"type":"View","style":{"flex":1,"backgroundColor":"#12121F","borderRadius":12,"padding":12,"height":80,"justifyContent":"center","alignItems":"center"},"children":[{"type":"Icon","props":{"name":"monitoring","size":17,"color":"#A78BFA"}},{"type":"Text","style":{"fontSize":20,"fontWeight":"700","color":"#FFFFFF","marginTop":4},"children":["8,450"]},{"type":"Text","style":{"fontSize":11,"color":"#6B6B80","marginTop":2},"children":["steps"]}]},{"type":"View","style":{"flex":1,"backgroundColor":"#12121F","borderRadius":12,"padding":12,"height":80,"justifyContent":"center","alignItems":"center"},"children":[{"type":"Icon","props":{"name":"bolt","size":17,"color":"#FF6B6B"}},{"type":"Text","style":{"fontSize":20,"fontWeight":"700","color":"#FFFFFF","marginTop":4},"children":["342"]},{"type":"Text","style":{"fontSize":11,"color":"#6B6B80","marginTop":2},"children":["kcal"]}]},{"type":"View","style":{"flex":1,"backgroundColor":"#12121F","borderRadius":12,"padding":12,"height":80,"justifyContent":"center","alignItems":"center"},"children":[{"type":"Icon","props":{"name":"favorite","size":17,"color":"#FF6B6B"}},{"type":"Text","style":{"fontSize":20,"fontWeight":"700","color":"#FFFFFF","marginTop":4},"children":["72"]},{"type":"Text","style":{"fontSize":11,"color":"#6B6B80","marginTop":2},"children":["bpm"]}]}]},{"type":"View","style":{"flexDirection":"row","alignItems":"center","marginTop":16,"backgroundColor":"#12121F","borderRadius":12,"padding":16,"gap":16},"children":[{"type":"Svg","style":{"width":56,"height":56},"props":{"viewBox":"0 0 56 56"},"children":[{"type":"Circle","props":{"cx":28,"cy":28,"r":24,"stroke":"#222236","strokeWidth":4,"fill":"none"}},{"type":"Circle","props":{"cx":28,"cy":28,"r":24,"stroke":"#6C5CE7","strokeWidth":4,"fill":"none","strokeDasharray":"151","strokeDashoffset":"27","strokeLinecap":"round"}}]},{"type":"View","style":{"flex":1},"children":[{"type":"Text","style":{"fontSize":16,"fontWeight":"700","color":"#FFFFFF"},"children":["Daily Goal"]},{"type":"Text","style":{"fontSize":13,"color":"#A0A0B8","marginTop":2},"children":["82% complete"]}]}]},{"type":"View","style":{"marginTop":16},"children":[{"type":"View","style":{"flexDirection":"row","justifyContent":"space-between","alignItems":"center","marginBottom":12},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"600","color":"#FFFFFF"},"children":["Recent Activity"]},{"type":"Text","style":{"fontSize":13,"color":"#6C5CE7"},"children":["See All"]}]},{"type":"View","style":{"gap":8},"children":[{"type":"View","style":{"flexDirection":"row","alignItems":"center","backgroundColor":"#12121F","borderRadius":12,"padding":12,"height":52},"children":[{"type":"Icon","props":{"name":"monitoring","size":20,"color":"#22C55E"},"style":{"marginRight":12}},{"type":"View","style":{"flex":1},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"500","color":"#FFFFFF"},"children":["Evening Run"]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80"},"children":["5.2 km"]}]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80"},"children":["Yesterday"]}]},{"type":"View","style":{"flexDirection":"row","alignItems":"center","backgroundColor":"#12121F","borderRadius":12,"padding":12,"height":52},"children":[{"type":"Icon","props":{"name":"monitoring","size":20,"color":"#A78BFA"},"style":{"marginRight":12}},{"type":"View","style":{"flex":1},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"500","color":"#FFFFFF"},"children":["Yoga Flow"]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80"},"children":["45 min"]}]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80"},"children":["2d ago"]}]}]}]}]},{"type":"View","style":{"flexDirection":"row","backgroundColor":"#12121F","paddingTop":8,"paddingBottom":34,"paddingHorizontal":20,"justifyContent":"space-around","alignItems":"center","borderTopWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Icon","props":{"name":"home","size":20,"color":"#6C5CE7"}},{"type":"Text","style":{"fontSize":11,"color":"#6C5CE7","marginTop":4},"children":["Home"]}]},{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Icon","props":{"name":"bolt","size":20,"color":"#6B6B80"}},{"type":"Text","style":{"fontSize":11,"color":"#6B6B80","marginTop":4},"children":["Activity"]}]},{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Icon","props":{"name":"favorite","size":20,"color":"#6B6B80"}},{"type":"Text","style":{"fontSize":11,"color":"#6B6B80","marginTop":4},"children":["Nutrition"]}]},{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Icon","props":{"name":"person","size":20,"color":"#6B6B80"}},{"type":"Text","style":{"fontSize":11,"color":"#6B6B80","marginTop":4},"children":["Profile"]}]}]}]}
--- END EXAMPLE ---`

const EXAMPLE_SETTINGS = `--- EXAMPLE ---
User: "app settings"
{"type":"View","style":{"flex":1,"backgroundColor":"#0A0A1A","paddingTop":54},"children":[{"type":"View","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":20,"height":44},"children":[{"type":"TouchableOpacity","style":{"width":44,"height":44,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Icon","props":{"name":"arrow_back","size":20,"color":"#FFFFFF"}}]},{"type":"Text","style":{"fontSize":28,"fontWeight":"700","color":"#FFFFFF","marginLeft":8},"children":["Settings"]}]},{"type":"ScrollView","style":{"flex":1},"props":{"showsVerticalScrollIndicator":false},"children":[{"type":"View","style":{"marginTop":24,"paddingHorizontal":20},"children":[{"type":"Text","style":{"fontSize":13,"fontWeight":"500","color":"#6B6B80","textTransform":"uppercase","letterSpacing":1,"marginBottom":8},"children":["Account"]},{"type":"View","style":{"backgroundColor":"#12121F","borderRadius":12,"overflow":"hidden"},"children":[{"type":"View","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":16,"height":48,"borderBottomWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"Icon","props":{"name":"notifications","size":20,"color":"#A0A0B8"}},{"type":"Text","style":{"flex":1,"fontSize":16,"color":"#FFFFFF","marginLeft":12},"children":["Notifications"]},{"type":"Switch","props":{"value":true,"trackColor":{"true":"#00B894","false":"#222236"},"thumbColor":"#FFFFFF"}}]},{"type":"TouchableOpacity","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":16,"height":48},"children":[{"type":"Icon","props":{"name":"lock","size":20,"color":"#A0A0B8"}},{"type":"Text","style":{"flex":1,"fontSize":16,"color":"#FFFFFF","marginLeft":12},"children":["Privacy & Security"]},{"type":"Text","style":{"fontSize":16,"color":"#6B6B80"},"children":["\\u203A"]}]}]}]},{"type":"View","style":{"marginTop":24,"paddingHorizontal":20},"children":[{"type":"Text","style":{"fontSize":13,"fontWeight":"500","color":"#6B6B80","textTransform":"uppercase","letterSpacing":1,"marginBottom":8},"children":["Preferences"]},{"type":"View","style":{"backgroundColor":"#12121F","borderRadius":12,"overflow":"hidden"},"children":[{"type":"TouchableOpacity","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":16,"height":48,"borderBottomWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"Icon","props":{"name":"visibility","size":20,"color":"#A0A0B8"}},{"type":"Text","style":{"flex":1,"fontSize":16,"color":"#FFFFFF","marginLeft":12},"children":["Appearance"]},{"type":"Text","style":{"fontSize":14,"color":"#6B6B80","marginRight":8},"children":["Dark"]},{"type":"Text","style":{"fontSize":16,"color":"#6B6B80"},"children":["\\u203A"]}]},{"type":"TouchableOpacity","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":16,"height":48},"children":[{"type":"Icon","props":{"name":"language","size":20,"color":"#A0A0B8"}},{"type":"Text","style":{"flex":1,"fontSize":16,"color":"#FFFFFF","marginLeft":12},"children":["Language"]},{"type":"Text","style":{"fontSize":14,"color":"#6B6B80","marginRight":8},"children":["English"]},{"type":"Text","style":{"fontSize":16,"color":"#6B6B80"},"children":["\\u203A"]}]}]}]},{"type":"View","style":{"marginTop":32,"paddingHorizontal":20,"paddingBottom":34},"children":[{"type":"TouchableOpacity","style":{"height":48,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":16,"fontWeight":"500","color":"#E17055"},"children":["Log Out"]}]}]}]}]}
--- END EXAMPLE ---`

const EXAMPLE_CHAT = `--- EXAMPLE ---
User: "whatsapp chat"
{"type":"View","style":{"flex":1,"backgroundColor":"#0F172A","paddingTop":54},"children":[{"type":"View","style":{"flexDirection":"row","alignItems":"center","justifyContent":"space-between","paddingHorizontal":16,"height":56,"backgroundColor":"#1A2236","borderBottomWidth":1,"borderColor":"#2A3352"},"children":[{"type":"TouchableOpacity","style":{"width":44,"height":44,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Icon","props":{"name":"arrow_back","size":20,"color":"#FFFFFF"}}]},{"type":"View","style":{"flexDirection":"row","alignItems":"center","gap":12,"flex":1},"children":[{"type":"AvatarCircle","props":{"name":"Sarah","size":40}},{"type":"View","children":[{"type":"Text","style":{"fontSize":16,"fontWeight":"600","color":"#FFFFFF"},"children":["Sarah Chen"]},{"type":"View","style":{"flexDirection":"row","alignItems":"center","gap":4},"children":[{"type":"View","style":{"width":6,"height":6,"borderRadius":4,"backgroundColor":"#22C55E"}},{"type":"Text","style":{"fontSize":12,"color":"#94A3B8"},"children":["Active now"]}]}]}]},{"type":"View","style":{"flexDirection":"row","gap":8},"children":[{"type":"TouchableOpacity","style":{"width":44,"height":44,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Icon","props":{"name":"call","size":20,"color":"#FFFFFF"}}]},{"type":"TouchableOpacity","style":{"width":44,"height":44,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Icon","props":{"name":"info","size":20,"color":"#FFFFFF"}}]}]}]},{"type":"ScrollView","style":{"flex":1,"paddingHorizontal":16,"paddingVertical":12},"props":{"showsVerticalScrollIndicator":false},"children":[{"type":"MessageBubble","props":{"text":"Hey! How are you doing today?","sent":false,"time":"10:30 AM"}},{"type":"MessageBubble","props":{"text":"I'm doing great! Just finished a project","sent":true,"time":"10:32 AM"}},{"type":"MessageBubble","props":{"text":"That's awesome! Want to grab coffee?","sent":false,"time":"10:35 AM"}},{"type":"MessageBubble","props":{"text":"Absolutely! 3 PM works?","sent":true,"time":"10:38 AM"}},{"type":"View","style":{"flexDirection":"row","alignItems":"center","gap":4,"marginTop":8},"children":[{"type":"View","style":{"width":6,"height":6,"borderRadius":4,"backgroundColor":"#94A3B8"}},{"type":"View","style":{"width":6,"height":6,"borderRadius":4,"backgroundColor":"#94A3B8"}},{"type":"View","style":{"width":6,"height":6,"borderRadius":4,"backgroundColor":"#94A3B8"}},{"type":"Text","style":{"fontSize":12,"color":"#94A3B8","marginLeft":4},"children":["Sarah is typing..."]}]}]},{"type":"ChatInputBar","props":{"placeholder":"Message..."}},{"type":"View","style":{"height":34}}]}
--- END EXAMPLE ---`

const EXAMPLE_PROFILE = `--- EXAMPLE ---
User: "instagram profile"
{"type":"View","style":{"flex":1,"backgroundColor":"#0F172A","paddingTop":54},"children":[{"type":"View","style":{"flexDirection":"row","alignItems":"center","justifyContent":"space-between","paddingHorizontal":16,"height":44},"children":[{"type":"TouchableOpacity","style":{"width":44,"height":44,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Icon","props":{"name":"lock","size":18,"color":"#FFFFFF"}}]},{"type":"Text","style":{"fontSize":16,"fontWeight":"600","color":"#FFFFFF"},"children":["alex.design"]},{"type":"TouchableOpacity","style":{"width":44,"height":44,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Icon","props":{"name":"menu","size":20,"color":"#FFFFFF"}}]}]},{"type":"View","style":{"paddingHorizontal":16,"paddingTop":12},"children":[{"type":"View","style":{"flexDirection":"row","alignItems":"center"},"children":[{"type":"Image","style":{"width":80,"height":80,"borderRadius":9999},"props":{"avatar":"Alex"}},{"type":"View","style":{"flex":1,"flexDirection":"row","justifyContent":"space-around","marginLeft":24},"children":[{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":17,"fontWeight":"700","color":"#FFFFFF"},"children":["284"]},{"type":"Text","style":{"fontSize":12,"color":"#94A3B8"},"children":["Posts"]}]},{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":17,"fontWeight":"700","color":"#FFFFFF"},"children":["12.5K"]},{"type":"Text","style":{"fontSize":12,"color":"#94A3B8"},"children":["Followers"]}]},{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":17,"fontWeight":"700","color":"#FFFFFF"},"children":["891"]},{"type":"Text","style":{"fontSize":12,"color":"#94A3B8"},"children":["Following"]}]}]}]},{"type":"Text","style":{"fontSize":16,"fontWeight":"600","color":"#FFFFFF","marginTop":12},"children":["Alex Chen"]},{"type":"Text","style":{"fontSize":14,"color":"#818CF8","marginTop":2},"children":["Photographer & Designer"]},{"type":"Text","style":{"fontSize":14,"color":"#CBD5E1","marginTop":4},"children":["Creating visual stories through light and color"]},{"type":"Text","style":{"fontSize":14,"color":"#818CF8","marginTop":2},"children":["linktr.ee/alexdesign"]},{"type":"View","style":{"flexDirection":"row","gap":8,"marginTop":12},"children":[{"type":"TouchableOpacity","style":{"flex":1,"height":36,"backgroundColor":"#6C5CE7","borderRadius":8,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"600","color":"#FFFFFF"},"children":["Follow"]}]},{"type":"TouchableOpacity","style":{"flex":1,"height":36,"backgroundColor":"#1E293B","borderRadius":8,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"600","color":"#FFFFFF"},"children":["Message"]}]},{"type":"TouchableOpacity","style":{"width":36,"height":36,"backgroundColor":"#1E293B","borderRadius":8,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Icon","props":{"name":"person_add","size":16,"color":"#FFFFFF"}}]}]}]},{"type":"View","style":{"flexDirection":"row","borderTopWidth":1,"borderColor":"#1E293B","marginTop":16},"children":[{"type":"TouchableOpacity","style":{"flex":1,"alignItems":"center","paddingVertical":12,"borderBottomWidth":2,"borderColor":"#FFFFFF"},"children":[{"type":"Icon","props":{"name":"grid_view","size":20,"color":"#FFFFFF"}}]},{"type":"TouchableOpacity","style":{"flex":1,"alignItems":"center","paddingVertical":12},"children":[{"type":"Icon","props":{"name":"video_library","size":20,"color":"#64748B"}}]},{"type":"TouchableOpacity","style":{"flex":1,"alignItems":"center","paddingVertical":12},"children":[{"type":"Icon","props":{"name":"person_pin","size":20,"color":"#64748B"}}]}]},{"type":"View","style":{"flexDirection":"row","flexWrap":"wrap"},"children":[{"type":"Image","style":{"width":"33.33%","aspectRatio":1},"props":{"searchQuery":"urban architecture photography city"}},{"type":"Image","style":{"width":"33.33%","aspectRatio":1},"props":{"searchQuery":"portrait photography studio lighting"}},{"type":"Image","style":{"width":"33.33%","aspectRatio":1},"props":{"searchQuery":"sunset landscape ocean photography"}},{"type":"Image","style":{"width":"33.33%","aspectRatio":1},"props":{"searchQuery":"street photography black white"}},{"type":"Image","style":{"width":"33.33%","aspectRatio":1},"props":{"searchQuery":"minimal interior design photography"}},{"type":"Image","style":{"width":"33.33%","aspectRatio":1},"props":{"searchQuery":"nature macro flower photography"}}]}]}
--- END EXAMPLE ---`

const EXAMPLE_FOOD = `--- EXAMPLE ---
User: "food delivery app"
{"type":"View","style":{"flex":1,"backgroundColor":"#0F172A","paddingTop":54},"children":[{"type":"View","style":{"paddingHorizontal":16,"paddingTop":8},"children":[{"type":"View","style":{"flexDirection":"row","justifyContent":"space-between","alignItems":"center"},"children":[{"type":"View","children":[{"type":"Text","style":{"fontSize":12,"color":"#94A3B8"},"children":["Deliver to"]},{"type":"View","style":{"flexDirection":"row","alignItems":"center","gap":4},"children":[{"type":"Icon","props":{"name":"location_on","size":16,"color":"#EF4444"}},{"type":"Text","style":{"fontSize":16,"fontWeight":"600","color":"#FFFFFF"},"children":["New York, NY"]}]}]},{"type":"Image","style":{"width":36,"height":36,"borderRadius":9999},"props":{"avatar":"Alex"}}]},{"type":"View","style":{"flexDirection":"row","alignItems":"center","backgroundColor":"#1E293B","borderRadius":12,"paddingHorizontal":12,"height":44,"marginTop":12},"children":[{"type":"Icon","props":{"name":"search","size":18,"color":"#64748B"}},{"type":"TextInput","style":{"flex":1,"fontSize":14,"color":"#FFFFFF","marginLeft":8},"props":{"placeholder":"Search restaurants, food...","placeholderTextColor":"#64748B"}}]},{"type":"View","style":{"backgroundColor":"#1E293B","borderRadius":12,"padding":16,"marginTop":16,"flexDirection":"row","justifyContent":"space-between","alignItems":"center"},"children":[{"type":"View","children":[{"type":"Text","style":{"fontSize":17,"fontWeight":"700","color":"#FFFFFF"},"children":["50% Off Pizza"]},{"type":"Text","style":{"fontSize":13,"color":"#94A3B8","marginTop":2},"children":["On orders above $30"]}]},{"type":"TouchableOpacity","style":{"paddingHorizontal":16,"height":36,"borderRadius":8,"backgroundColor":"#EF4444","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":13,"fontWeight":"600","color":"#FFFFFF"},"children":["Order Now"]}]}]}]},{"type":"ScrollView","style":{"flex":1},"props":{"showsVerticalScrollIndicator":false},"children":[{"type":"View","style":{"paddingHorizontal":16,"paddingTop":20},"children":[{"type":"Text","style":{"fontSize":16,"fontWeight":"700","color":"#FFFFFF","marginBottom":12},"children":["Featured"]},{"type":"View","style":{"flexDirection":"row","gap":12},"children":[{"type":"View","style":{"flex":1},"children":[{"type":"Image","style":{"width":"100%","height":120,"borderRadius":12},"props":{"searchQuery":"margherita pizza fresh basil mozzarella"}},{"type":"Text","style":{"fontSize":14,"fontWeight":"600","color":"#FFFFFF","marginTop":8},"children":["Margherita Supreme"]},{"type":"View","style":{"flexDirection":"row","alignItems":"center","gap":4,"marginTop":2},"children":[{"type":"Icon","props":{"name":"star","size":14,"color":"#FBBF24"}},{"type":"Text","style":{"fontSize":12,"color":"#94A3B8"},"children":["4.8"]}]},{"type":"Text","style":{"fontSize":15,"fontWeight":"700","color":"#FFFFFF","marginTop":4},"children":["$18.90"]}]},{"type":"View","style":{"flex":1},"children":[{"type":"Image","style":{"width":"100%","height":120,"borderRadius":12},"props":{"searchQuery":"gourmet cheeseburger brioche bun fries"}},{"type":"Text","style":{"fontSize":14,"fontWeight":"600","color":"#FFFFFF","marginTop":8},"children":["Classic Burger"]},{"type":"View","style":{"flexDirection":"row","alignItems":"center","gap":4,"marginTop":2},"children":[{"type":"Icon","props":{"name":"star","size":14,"color":"#FBBF24"}},{"type":"Text","style":{"fontSize":12,"color":"#94A3B8"},"children":["4.6"]}]},{"type":"Text","style":{"fontSize":15,"fontWeight":"700","color":"#FFFFFF","marginTop":4},"children":["$14.50"]}]}]}]}]},{"type":"View","style":{"flexDirection":"row","paddingTop":8,"paddingBottom":34,"paddingHorizontal":20,"justifyContent":"space-around","alignItems":"center","borderTopWidth":1,"borderColor":"#1E293B","backgroundColor":"#0F172A"},"children":[{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Icon","props":{"name":"home","size":20,"color":"#EF4444"}},{"type":"Text","style":{"fontSize":11,"color":"#EF4444","marginTop":4},"children":["Home"]}]},{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Icon","props":{"name":"search","size":20,"color":"#64748B"}},{"type":"Text","style":{"fontSize":11,"color":"#64748B","marginTop":4},"children":["Browse"]}]},{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Icon","props":{"name":"shopping_cart","size":20,"color":"#64748B"}},{"type":"Text","style":{"fontSize":11,"color":"#64748B","marginTop":4},"children":["Cart"]}]},{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Icon","props":{"name":"person","size":20,"color":"#64748B"}},{"type":"Text","style":{"fontSize":11,"color":"#64748B","marginTop":4},"children":["Account"]}]}]}]}
--- END EXAMPLE ---`

// --- Screen type classification ---
type ScreenType = 'dashboard' | 'auth' | 'profile' | 'settings' | 'product' | 'chat' | 'music' | 'calendar' | 'onboarding' | 'food' | 'checkout' | 'unknown'

const SCREEN_TYPE_KEYWORDS: Array<{ type: ScreenType; keywords: RegExp }> = [
  { type: 'dashboard', keywords: /\b(dashboard|home\s*screen|stats|metrics|overview|activity|energy|performance|steps|calories|heart\s*rate|fitness|health|tracker|analytics|monitor|banking|finance|wallet|payment|fintech|real\s*estate|zillow|trulia|property|listing|weather|forecast|crypto|portfolio)\b/i },
  { type: 'auth', keywords: /\b(login|sign\s*in|sign\s*up|register|auth|password|forgot|reset\s*password|create\s*account|welcome\s*back)\b/i },
  { type: 'profile', keywords: /\b(profile|my\s*account|user\s*page|followers|following|posts|bio|avatar)\b/i },
  { type: 'settings', keywords: /\b(settings|preferences|config|notifications\s*toggle|privacy|account\s*settings|options)\b/i },
  { type: 'product', keywords: /\b(product|shop|store|price|buy|purchase|shoe|clothing|detail\s*page|item\s*detail)\b/i },
  { type: 'checkout', keywords: /\b(cart|checkout|order\s*summary|buy\s*now|payment\s*method)\b/i },
  { type: 'chat', keywords: /\b(chat|message|messaging|conversation|inbox|dm|direct\s*message|send\s*message)\b/i },
  { type: 'music', keywords: /\b(music|player|now\s*playing|song|album|playlist|audio|podcast|spotify)\b/i },
  { type: 'calendar', keywords: /\b(calendar|schedule|events|appointment|agenda|planner|date\s*picker)\b/i },
  { type: 'onboarding', keywords: /\b(onboarding|welcome|get\s*started|intro|tutorial|walkthrough|first\s*time)\b/i },
  { type: 'food', keywords: /\b(food|restaurant|delivery|menu|order|meal|recipe|cuisine|eat)\b/i },
]

function classifyScreenType(prompt: string): ScreenType {
  for (const { type, keywords } of SCREEN_TYPE_KEYWORDS) {
    if (keywords.test(prompt)) return type
  }
  return 'unknown'
}

// --- Complexity detection for model routing ---
// Haiku pre-classifier: cheap fast call to decide if Sonnet is needed.
// Cost: ~$0.0001 per classification. Accuracy: ~90%+ vs regex ~60%.
// Falls back to regex if classifier call fails.
const COMPLEXITY_CLASSIFIER_SYSTEM = `You are a complexity classifier for mobile screen generation.
Respond with ONLY "complex" or "simple".

Complex = needs powerful model: dashboards with multiple data visualizations, banking/fintech with transaction lists and balance displays, analytics screens with charts/graphs/donut rings, multi-screen flows with 3+ linked screens, complex data-heavy layouts with tables or grids of metrics.

Simple = lightweight model is fine: login, sign up, onboarding, music player, chat, messaging, food delivery, ecommerce product page, profile, settings, calendar, single-purpose screens without complex data visualization.`

const COMPLEX_REGEX_FALLBACK = [
  /dashboard/i,
  /banking|finance|fintech/i,
  /analytics|metrics.*chart/i,
  /multi.*screen|flow|onboarding.*flow/i,
]

// Confidence threshold: override "simple" → "complex" if prompt is long with 3+ feature keywords.
// Catches edge cases like "Real estate with map view, photo gallery and mortgage calculator".
const FEATURE_KEYWORDS = /\b(map|gallery|calculator|chart|graph|stats|analytics|metrics|feed|stories|nested|carousel|timeline|portfolio|transaction|payment)\b/gi

function shouldOverrideToComplex(prompt: string): boolean {
  const wordCount = prompt.trim().split(/\s+/).length
  if (wordCount <= 20) return false
  const matches = prompt.match(FEATURE_KEYWORDS)
  const uniqueMatches = new Set((matches || []).map(m => m.toLowerCase()))
  return uniqueMatches.size >= 3
}

async function classifyComplexity(prompt: string, apiKey: string): Promise<boolean> {
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 5,
        temperature: 0,
        system: [{ type: 'text', text: COMPLEXITY_CLASSIFIER_SYSTEM, cache_control: { type: 'ephemeral', ttl: '1h' } }],
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!resp.ok) throw new Error(`Classifier HTTP ${resp.status}`)
    const data = await resp.json() as { content?: Array<{ text?: string }> }
    const answer = (data.content?.[0]?.text ?? '').trim().toLowerCase()

    // Confidence threshold: if classifier says "simple" but prompt has 3+ feature keywords in 20+ words, override to complex
    if (answer !== 'complex' && shouldOverrideToComplex(prompt)) {
      console.log(`[model-router] Haiku classifier: "${prompt.slice(0, 60)}..." → ${answer} → OVERRIDDEN to complex (confidence threshold)`)
      return true
    }

    console.log(`[model-router] Haiku classifier: "${prompt.slice(0, 60)}..." → ${answer}`)
    return answer === 'complex'
  } catch (err) {
    // Fallback to regex if classifier fails
    console.warn('[model-router] Classifier failed, falling back to regex:', err)
    if (shouldOverrideToComplex(prompt)) return true
    return COMPLEX_REGEX_FALLBACK.some(pattern => pattern.test(prompt))
  }
}

// 2 anchor examples always included; type-specific example added to dynamic context
const SCREEN_TYPE_EXAMPLES: Partial<Record<ScreenType, string>> = {
  chat: EXAMPLE_CHAT,
  profile: EXAMPLE_PROFILE,
  food: EXAMPLE_FOOD,
}

function getDefaultExamples(): string {
  return [EXAMPLE_DASHBOARD, EXAMPLE_SETTINGS].join('\n\n')
}

function getTypeSpecificExample(screenType: ScreenType): string | null {
  return SCREEN_TYPE_EXAMPLES[screenType] ?? null
}

// --- Edit mode instructions and examples (Task 4) ---
const EDIT_MODE_INSTRUCTIONS = `
--- EDIT MODE INSTRUCTIONS ---
When modifying an existing screen, you MUST preserve ALL content, layout, and structure. Only change what the user specifically asks to change. If user says 'make it white background', change ONLY the background color and text colors for contrast — keep everything else identical. If user says 'recreate with light theme', keep the same layout, content, and elements but swap to light theme color tokens. Never discard or replace existing screen content during edits.

Return the COMPLETE tree with ONLY the requested changes. Do not restructure, restyle, or regenerate unrelated parts.

--- EDIT EXAMPLE 1: Color Change ---
User's existing screen has a login form with a blue (#6C5CE7) "Sign In" button.
User says: "Change the primary button to green"
Expected behavior: Find the TouchableOpacity with backgroundColor "#6C5CE7" and change it to "#00B894". Keep ALL other nodes, styles, text content, and structure IDENTICAL.

--- EDIT EXAMPLE 2: Adding a Component ---
User's existing screen has a list of items with no search functionality.
User says: "Add a search bar at the top"
Expected behavior: Insert a NEW View+TextInput search bar as the first child of the main content area (after any header/navigation). The search bar should have:
{"type":"View","style":{"paddingHorizontal":20,"marginBottom":16},"children":[{"type":"View","style":{"backgroundColor":"#222236","borderRadius":12,"height":48,"paddingHorizontal":16,"flexDirection":"row","alignItems":"center"},"children":[{"type":"Icon","props":{"name":"search","size":16,"color":"#6B6B80"},"style":{"marginRight":8}},{"type":"TextInput","style":{"flex":1,"fontSize":16,"color":"#FFFFFF"},"props":{"placeholder":"Search...","placeholderTextColor":"#6B6B80"}}]}]}
Keep ALL existing nodes EXACTLY as they are. Only add the new component.
--- END EDIT MODE INSTRUCTIONS ---
`

// --- Data flywheel: query learned patterns ---
async function getLearnedPatterns(): Promise<string> {
  try {
    const { url } = getSupabaseConfig()
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return ''

    const supabase = createClient(url, serviceKey)
    const { data: patterns } = await supabase
      .from('design_patterns')
      .select('pattern_type, pattern_data, frequency')
      .gte('frequency', 10)
      .order('frequency', { ascending: false })
      .limit(5)

    if (!patterns || patterns.length === 0) return ''

    const lines = patterns.map(p => {
      if (p.pattern_type === 'spacing_change') {
        return `- Users frequently change ${p.pattern_data.property} from ${p.pattern_data.from} to ${p.pattern_data.to} (${p.frequency} times)`
      }
      if (p.pattern_type === 'color_change') {
        return `- Users frequently change colors from ${p.pattern_data.from} to ${p.pattern_data.to} (${p.frequency} times)`
      }
      if (p.pattern_type === 'component_add') {
        return `- Users frequently add ${p.pattern_data.type} components (${p.frequency} times)`
      }
      return null
    }).filter(Boolean)

    if (lines.length === 0) return ''

    return `\n\n## LEARNED PATTERNS (from user edits)\nUsers frequently make these changes to generated screens:\n${lines.join('\n')}\n\nApply these preferences by default to new generations.\n`
  } catch {
    return ''
  }
}

// --- DESIGN.md parser ---
// Extracts design tokens from markdown code blocks, inline DESIGN.md content,
// or Stitch-style DESIGN.md format (# Colors, # Typography, # Spacing, etc.)
function extractDesignMd(prompt: string): { cleanPrompt: string; designMd: string | null } {
  // Pattern 1: Fenced code block with design tokens
  const fencedPattern = /```(?:md|markdown|design|yaml|json)?\n([\s\S]*?(?:#\s*(?:Colors|Typography|Spacing|Components|Theme|Tokens|Brand)[\s\S]*?))```/i
  const fencedMatch = prompt.match(fencedPattern)
  if (fencedMatch) {
    return { cleanPrompt: prompt.replace(fencedMatch[0], '').trim(), designMd: fencedMatch[1] }
  }

  // Pattern 2: Inline DESIGN.md markers
  const inlinePattern = /(?:---\s*DESIGN\.MD\s*---\s*\n)([\s\S]*?)(?:---\s*END\s*DESIGN\.MD\s*---)/i
  const inlineMatch = prompt.match(inlinePattern)
  if (inlineMatch) {
    return { cleanPrompt: prompt.replace(inlineMatch[0], '').trim(), designMd: inlineMatch[1] }
  }

  // Pattern 3: Detect unfenced markdown with design headers (Colors, Typography, etc.)
  // Only matches if there are at least 2 design-related headers
  const headerPattern = /((?:^|\n)#+ (?:Colors|Typography|Spacing|Components|Theme|Tokens|Brand)\b[\s\S]*)/i
  const headerMatch = prompt.match(headerPattern)
  if (headerMatch) {
    const content = headerMatch[1]
    const headerCount = (content.match(/^#+\s+(?:Colors|Typography|Spacing|Components|Theme|Tokens|Brand)\b/gim) || []).length
    if (headerCount >= 2) {
      return { cleanPrompt: prompt.replace(content, '').trim(), designMd: content.trim() }
    }
  }

  return { cleanPrompt: prompt, designMd: null }
}

// --- Parse custom tokens from DESIGN.md content ---
function parseDesignMdTokens(designMd: string | null): NormalizerOptions | undefined {
  if (!designMd) return undefined
  const opts: NormalizerOptions = {}

  // Extract numbers after spacing-related keywords
  const spacingMatch = designMd.match(/(?:spacing|padding|margin|gap)[^:]*:\s*([\d,\s]+)/gi)
  if (spacingMatch) {
    const nums = spacingMatch.join(' ').match(/\d+/g)
    if (nums) opts.customSpacing = [...new Set(nums.map(Number))]
  }

  // Extract borderRadius values
  const radiusMatch = designMd.match(/(?:border[- ]?radius|radius|corner[- ]?radius)[^:]*:\s*([\d,\s]+)/gi)
  if (radiusMatch) {
    const nums = radiusMatch.join(' ').match(/\d+/g)
    if (nums) opts.customBorderRadius = [...new Set(nums.map(Number))]
  }

  // Extract fontSize values
  const fontMatch = designMd.match(/(?:font[- ]?size|text[- ]?size|typography)[^:]*:\s*([\d,\s]+)/gi)
  if (fontMatch) {
    const nums = fontMatch.join(' ').match(/\d+/g)
    if (nums) opts.customFontSizes = [...new Set(nums.map(Number))]
  }

  return (opts.customSpacing || opts.customFontSizes || opts.customBorderRadius) ? opts : undefined
}

// --- Build system prompt ---
// Static system prompts — identical string every time for prompt cache hits.
// All dynamic content (theme, device, brand color, design.md, learned patterns) goes in user message.
const SYSTEM_PROMPT_NEW = `You are a world-class mobile UI designer and React Native expert. You create screens that look like they were designed by senior designers at Airbnb, Spotify, Stripe, or Nike. Your output is production-quality — not a prototype, not a wireframe, but a polished, beautiful screen ready to ship.

Your designs follow these principles:
- Hierarchy through size and weight, not just color
- Spacing creates visual grouping (tight within sections, generous between sections)
- Color restraint — one primary accent, surfaces for depth, greys for most text
- Every element has a purpose — no decorative noise
- Content is realistic and contextual — never generic placeholder text

Generate a React Native component tree as JSON.

DESIGN PROCESS — MANDATORY TWO PHASES:

PHASE 1: Before generating ANY JSON, write a design brief inside <design_brief> tags:
<design_brief>
App Name: [Creative brand name inspired by the prompt]
Design Mood: [2-3 word mood]
Layout Strategy: [Specific layout choices]
Typography: [Font size and weight choices]
Visual Accents: [SVG rings, gradients, images, avatars]
Icon Style: [material-symbols style and sizes]
Image Strategy: [searchQuery and avatar usage]
</design_brief>

PHASE 2: Generate the JSON component tree following your design brief EXACTLY.

For user avatars, use Image with avatar prop (renders clean initial-letter circles, NOT cartoon faces): {"type":"Image","style":{"width":40,"height":40,"borderRadius":9999},"props":{"avatar":"Sarah"}}
NEVER use avatarStyle="avataaars" or any cartoon avatar style. The default "initials" style is professional.

After the design brief, return a single JSON object. No markdown fences, no explanation.

ICONS: Use Icon component with Google Material Symbols names only (lowercase, underscores). NEVER use emoji for icons. NEVER use emoji characters as avatars or profile pictures.
Common: home, search, menu, arrow_back, chevron_right, close, favorite, star, bookmark, share, send, person, notifications, play_arrow, pause, skip_next, shopping_cart, credit_card, trending_up, monitoring, bolt, location_on, fitness_center, settings, lock, calendar_today

${DESIGN_TOKENS}
${COMPONENT_TYPES}
${CONTENT_LIBRARY}
${VIEWPORT_BUDGET}
${CONTENT_DENSITY}
${PLATFORM_RULES}

SCREEN TYPES (follow viewport budget strictly):
- DASHBOARD: greeting + horizontal stat cards + content cards + bottom nav. No ScrollView. MUST fit one viewport.
- PROFILE: avatar + name + stats row + action buttons + content tabs. No ScrollView. MUST fit one viewport.
- SETTINGS: section headers + grouped list items + toggles/chevrons. ScrollView allowed.
- PDP: SCROLLABLE. hero image carousel → title/price/rating → color swatches → size grid → features list (3-5 icon+label cards) → description → shipping/returns → sticky CTA
- AUTH: logo/icon + app name + subtitle + form inputs (compact 12px gaps) + primary CTA + social login row + footer link. NO ScrollView. MUST fit one viewport. Keep spacing TIGHT (12-16px between elements, NOT 24-48px). Total content should be ~500-550px.
- ONBOARDING: centered illustration + headline + subtitle + dots + CTA. NO ScrollView. MUST fit one viewport. Use justifyContent:"center" to vertically center content.
- CHAT/MESSAGING: header(avatar+name+status, ~56px) + message list(ScrollView, ~520px) + input bar(~56px). Message bubbles are View+Text ONLY — NO Image nodes inside bubbles. Use avatar prop for contact photo in header only (40x40, borderRadius:9999). Bubble style: borderRadius 16, padding 12, maxWidth "75%". Sent=accent bg aligned right, received=surface-2 aligned left. Add timestamps (fontSize 11, dim color) below bubbles. Include typing indicator and input bar with send button.
- MUSIC/PLAYER: album art Image(searchQuery, ~280px square, borderRadius 16) + track title + artist + progress bar + playback controls. No ScrollView. MUST fit one viewport.
- SOCIAL FEED: header + stories row(horizontal ScrollView, avatar circles 56px) + feed cards(ScrollView) + bottom nav. Feed cards: avatar(36px)+name+Image(searchQuery)+likes/comments.

SCREENSHOT FIDELITY: When recreating from screenshot, preserve ALL data displays, stat cards, navigation, and complexity.

IMAGE RULES: Every Image MUST have searchQuery (5-10 descriptive words) or avatar prop. NEVER use Image without one of these — empty Images render as broken placeholders. For user photos/avatars, ALWAYS use avatar prop (renders clean initial-letter circles). Do NOT put Image nodes inside chat/message bubbles — text messages are View+Text only.

DESIGN BRIEF: The App Name from <design_brief> MUST appear in the screen.

VAGUE PROMPTS: If just an app name, generate a HOME DASHBOARD with header, stat cards, content, and bottom nav.

${getDefaultExamples()}

${FUNCTIONAL_APP_RULES}

${QUALITY_CHECKLIST}

Return ONLY valid JSON, no markdown, no explanation.`

const SYSTEM_PROMPT_EDIT = `You are a world-class mobile UI designer and React Native expert. You create screens that look like they were designed by senior designers at Airbnb, Spotify, Stripe, or Nike. Your output is production-quality.

Generate a React Native component tree as JSON.
Return ONLY valid JSON, no markdown, no explanation.

ICONS: Use Icon component with Google Material Symbols names only (lowercase, underscores). NEVER use emoji for icons.
Common: home, search, menu, arrow_back, chevron_right, close, favorite, star, bookmark, share, send, person, notifications, play_arrow, pause, skip_next, shopping_cart, credit_card, trending_up, monitoring, bolt, location_on, fitness_center, settings, lock, calendar_today

${DESIGN_TOKENS}
${COMPONENT_TYPES}
${CONTENT_LIBRARY}
${VIEWPORT_BUDGET}
${CONTENT_DENSITY}
${PLATFORM_RULES}

${QUALITY_CHECKLIST}

${EDIT_MODE_INSTRUCTIONS}

Return ONLY valid JSON, no markdown, no explanation.`

/** Build dynamic context to prepend to the user message.
 *  Keeps system prompt static for prompt caching. */
function buildDynamicContext(opts: {
  themeResult?: ThemeResult;
  deviceInfo?: { name: string; width: number; height: number; category: string };
  brandColor?: string;
  designMd?: string | null;
  learnedPatterns?: string;
  screenType?: ScreenType;
}): string {
  const parts: string[] = []

  // Add type-specific few-shot example if available
  if (opts.screenType) {
    const example = getTypeSpecificExample(opts.screenType)
    if (example) {
      parts.push(`REFERENCE EXAMPLE for this screen type:\n${example}`)
    }
  }

  if (opts.themeResult) {
    parts.push(formatPaletteForPrompt(opts.themeResult))
    parts.push('IMPORTANT: Replace ALL colors in your output with the DESIGN PALETTE colors above.')
  }

  if (opts.deviceInfo) {
    const d = opts.deviceInfo
    const platform = d.category === 'Android'
      ? 'This is an Android device — use Material Design conventions where appropriate.'
      : 'This is an iOS device — use iOS/HIG conventions where appropriate.'
    parts.push(`TARGET DEVICE: Designing for ${d.name} at ${d.width}x${d.height}px. ${platform}`)
  }

  if (opts.brandColor && /^#[0-9a-fA-F]{3,8}$/.test(opts.brandColor)) {
    parts.push(`BRAND COLOR OVERRIDE: Use ${opts.brandColor} instead of #6C5CE7 for all primary buttons, accents, active states, and highlights.`)
  }

  if (opts.designMd) {
    parts.push(`DESIGN.MD TOKENS — Override defaults with these:\n${opts.designMd}`)
  }

  if (opts.learnedPatterns) {
    parts.push(opts.learnedPatterns)
  }

  return parts.length > 0 ? parts.join('\n\n') + '\n\n' : ''
}

/** Build a Claude-compatible messages array from conversation history + current prompt.
 *  Ensures alternating user/assistant roles and that the first message is user. */
function buildMessages(
  conversationHistory: Array<{ role: string; content: string }> | undefined,
  currentContent: string | Array<{ type: string; [key: string]: unknown }>
): Array<{ role: 'user' | 'assistant'; content: string | Array<{ type: string; [key: string]: unknown }> }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

  if (Array.isArray(conversationHistory)) {
    for (const m of conversationHistory.slice(-5)) {
      const role = m.role === 'assistant' ? 'assistant' : 'user'
      // Claude requires alternating roles — merge consecutive same-role messages
      if (messages.length > 0 && messages[messages.length - 1].role === role) {
        messages[messages.length - 1].content += '\n' + m.content
      } else {
        messages.push({ role, content: m.content })
      }
    }
    // Claude requires first message to be user role
    if (messages.length > 0 && messages[0].role === 'assistant') {
      messages.shift()
    }
  }

  // If last history message is user role, merge or insert assistant placeholder before current
  if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
    // Need an assistant message before our new user message
    messages.push({ role: 'assistant', content: 'Understood, continuing.' })
  }

  return [...messages, { role: 'user', content: currentContent }]
}

// --- Image generation proxy (merged to save serverless function slots) ---
// Accessed via GET /api/generate?action=image&query=...&width=400&height=300
// Waterfall: Supabase cache → Pexels (free) → FLUX (paid) → LoremFlickr
const imgCache = new Map<string, { url: string; source: string; ts: number }>()
const IMG_CACHE_TTL = 1000 * 60 * 30 // 30 minutes
const IMG_MAX_DIM = 512 // Cap resolution for cost savings — 512px is plenty for mobile preview

// --- Persistent image cache (Supabase) ---
async function getCachedImage(cacheKey: string): Promise<{ url: string; source: string } | null> {
  try {
    const { url, key } = getSupabaseConfig()
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return null
    const supabase = createClient(url, serviceKey)
    const { data } = await supabase
      .from('image_cache')
      .select('image_url, source')
      .eq('cache_key', cacheKey)
      .single()
    if (data?.image_url) return { url: data.image_url, source: data.source }
  } catch { /* table may not exist yet — ignore */ }
  return null
}

async function setCachedImage(cacheKey: string, imageUrl: string, source: string, query: string): Promise<void> {
  try {
    const { url, key } = getSupabaseConfig()
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return
    const supabase = createClient(url, serviceKey)
    await supabase
      .from('image_cache')
      .upsert({ cache_key: cacheKey, image_url: imageUrl, source, query, created_at: new Date().toISOString() }, { onConflict: 'cache_key' })
  } catch { /* ignore — cache write failure is non-critical */ }
}

async function handleImageProxy(req: VercelRequest, res: VercelResponse) {
  const query = ((req.query.query as string) || '').trim()
  // Cap resolution at 512px for cost savings
  const rawWidth = parseInt(req.query.width as string) || 400
  const rawHeight = parseInt(req.query.height as string) || 300
  const width = Math.min(rawWidth, IMG_MAX_DIM)
  const height = Math.min(rawHeight, IMG_MAX_DIM)

  if (!query) return res.status(400).json({ error: 'No query provided' })

  res.setHeader('Access-Control-Allow-Origin', '*')

  const cacheKey = `${query}:${width}x${height}`

  // Layer 1: In-memory cache (hot path — same serverless instance)
  const memCached = imgCache.get(cacheKey)
  if (memCached && Date.now() - memCached.ts < IMG_CACHE_TTL) {
    return res.json({ url: memCached.url, source: memCached.source, cached: true })
  }

  // Layer 2: Persistent Supabase cache (survives cold starts, shared across users)
  const dbCached = await getCachedImage(cacheKey)
  if (dbCached) {
    imgCache.set(cacheKey, { ...dbCached, ts: Date.now() })
    return res.json({ url: dbCached.url, source: dbCached.source, cached: true })
  }

  // Source 1: Pexels API (FREE — try first to avoid FLUX costs)
  const pexelsKey = process.env.PEXELS_API_KEY
  if (pexelsKey) {
    try {
      const pexelsQuery = query.split(/\s+/).slice(0, 5).join(' ')
      const pexelsRes = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(pexelsQuery)}&per_page=5&size=small`,
        { headers: { 'Authorization': pexelsKey } }
      )
      if (pexelsRes.ok) {
        const data = await pexelsRes.json()
        if (data.photos?.length > 0) {
          const photo = data.photos[Math.floor(Math.random() * Math.min(data.photos.length, 3))]
          const imageUrl = width > 400
            ? (photo.src?.landscape || photo.src?.medium || photo.src?.original)
            : (photo.src?.medium || photo.src?.landscape || photo.src?.original)
          if (imageUrl) {
            imgCache.set(cacheKey, { url: imageUrl, source: 'pexels', ts: Date.now() })
            setCachedImage(cacheKey, imageUrl, 'pexels', query) // fire-and-forget
            return res.json({ url: imageUrl, source: 'pexels' })
          }
        }
      }
    } catch (e) { console.error('[image] Pexels error:', (e as Error).message) }
  }

  // Source 2: fal.ai FLUX schnell (PAID — only when Pexels has no results)
  const falKey = process.env.FAL_API_KEY
  if (falKey) {
    try {
      const submitRes = await fetch('https://queue.fal.run/fal-ai/flux/schnell', {
        method: 'POST',
        headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query + ', high quality, professional photography, 4k',
          image_size: { width, height },
          num_images: 1, num_inference_steps: 4, enable_safety_checker: true,
        }),
      })
      if (submitRes.ok) {
        const data = await submitRes.json()
        const imageUrl = data?.images?.[0]?.url
        if (imageUrl) {
          imgCache.set(cacheKey, { url: imageUrl, source: 'flux', ts: Date.now() })
          setCachedImage(cacheKey, imageUrl, 'flux', query) // fire-and-forget
          return res.json({ url: imageUrl, source: 'flux' })
        }
      }
    } catch (e) { console.error('[image] FLUX error:', (e as Error).message) }
  }

  // Source 3: LoremFlickr fallback (free, always works)
  const keywords = query.split(/\s+/).slice(0, 3).join(',')
  const hash = Math.abs(query.split('').reduce((a, c) => a + c.charCodeAt(0), 0))
  const fallbackUrl = `https://loremflickr.com/${width}/${height}/${encodeURIComponent(keywords)}?lock=${hash}`
  imgCache.set(cacheKey, { url: fallbackUrl, source: 'loremflickr', ts: Date.now() })
  return res.json({ url: fallbackUrl, source: 'loremflickr' })
}

// =====================================================================
// HTML Import Mode — helpers for mode: "import-html"
// =====================================================================

interface ImportInputDetection {
  type: 'html' | 'react-jsx' | 'react-tsx' | 'tailwind-html' | 'unknown'
  source: 'stitch' | 'v0' | 'bolt' | 'lovable' | 'unknown'
  hasInlineStyles: boolean
  hasTailwind: boolean
  hasCSS: boolean
}

function detectImportInputType(code: string): ImportInputDetection {
  const hasReactImport = /import\s+React|from\s+['"]react['"]|export\s+default\s+function/.test(code)
  const hasTSX = hasReactImport && /:\s*(React\.FC|JSX\.Element|string|number|boolean|\{)/.test(code)
  const hasTailwind = /\b(bg-|text-|p-|m-|flex|rounded-|shadow-|border-|gap-|w-|h-|items-|justify-|font-|leading-|tracking-|space-|grid-|col-span|row-span)\b/.test(code)
  const hasInlineStyles = /style\s*=\s*\{\s*\{/.test(code) || /style\s*=\s*"/.test(code)
  const hasCSS = /<style[\s>]|\.css['"]/.test(code)
  const hasHTMLTags = /<(?:div|section|header|main|article|footer|nav|span|p|h[1-6]|button|input|img|ul|ol|form)\b/.test(code)

  let type: ImportInputDetection['type'] = 'unknown'
  if (hasTSX) type = 'react-tsx'
  else if (hasReactImport) type = 'react-jsx'
  else if (hasTailwind && hasHTMLTags) type = 'tailwind-html'
  else if (hasHTMLTags) type = 'html'

  let source: ImportInputDetection['source'] = 'unknown'
  if (/stitch/i.test(code) || /data-stitch/i.test(code)) source = 'stitch'
  else if (/shadcn|@\/components\/ui|"use client"/.test(code)) source = 'v0'
  else if (/bolt-|data-bolt/.test(code)) source = 'bolt'
  else if (/@supabase\/supabase-js|supabase\.from\(/.test(code) && hasReactImport) source = 'lovable'

  return { type, source, hasInlineStyles, hasTailwind, hasCSS }
}

function detectImportScreenName(code: string): string {
  const exportMatch = code.match(/export\s+(?:default\s+)?function\s+(\w+)/)
  if (exportMatch) return exportMatch[1]
  const h1Match = code.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  if (h1Match) return h1Match[1].trim().replace(/\s+/g, '')
  const titleMatch = code.match(/(?:title|aria-label)\s*=\s*"([^"]+)"/i)
  if (titleMatch) return titleMatch[1].trim().replace(/\s+/g, '')
  return 'ImportedScreen'
}

function extractColorsFromTree(tree: any): string[] {
  const colors = new Set<string>()
  function walk(node: any) {
    if (!node || typeof node !== 'object') return
    const style = node.style || node.props?.style || {}
    for (const [, value] of Object.entries(style)) {
      if (typeof value === 'string' && /^(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/.test(value)) {
        colors.add(value)
      }
    }
    if (node.props?.color && typeof node.props.color === 'string') colors.add(node.props.color)
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        if (typeof child === 'object') walk(child)
      }
    }
  }
  walk(tree)
  return [...colors]
}

function validateImportTree(tree: any): { valid: boolean; error?: string } {
  if (!tree || typeof tree !== 'object') return { valid: false, error: 'Response is not a valid object' }
  if (!tree.type) return { valid: false, error: 'Root node missing "type" property' }
  let nodeCount = 0
  function walk(node: any) {
    if (!node || typeof node !== 'object') return
    nodeCount++
    if (Array.isArray(node.children)) {
      for (const child of node.children) { if (typeof child === 'object') walk(child) }
    }
  }
  walk(tree)
  if (nodeCount < 2) return { valid: false, error: 'Could not detect any visual elements in the code' }
  return { valid: true }
}

function repairImportJSON(raw: string): any {
  let s = raw.trim()
  // Strip markdown fences
  s = s.replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
  const firstBrace = s.indexOf('{')
  if (firstBrace === -1) throw new Error('No JSON object found in response')
  const lastBrace = s.lastIndexOf('}')
  if (lastBrace > firstBrace) s = s.slice(firstBrace, lastBrace + 1)
  else s = s.slice(firstBrace)
  try { return JSON.parse(s) } catch { /* continue — likely truncated at max_tokens */ }

  // Truncation repair: the model hit max_tokens and output was cut mid-JSON.
  // Strategy: find the last valid structural point and close everything.
  let repaired = s

  // Step 1: Close any unclosed string
  let inString = false, escaped = false
  for (const ch of repaired) {
    if (escaped) { escaped = false; continue }
    if (ch === '\\') { escaped = true; continue }
    if (ch === '"') { inString = !inString }
  }
  if (inString) repaired += '"'

  // Step 2: Repeatedly strip trailing incomplete constructs until parseable or stable.
  // This handles truncation at any nesting depth:
  //   ..."color":"#0A"  → strip incomplete property
  //   ...,              → strip trailing comma
  //   ...:"val          → already closed by step 1, strip incomplete property
  for (let attempt = 0; attempt < 20; attempt++) {
    // Strip trailing incomplete key-value pair (key with no/partial value)
    repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*"[^"]*"?\s*$/, '')
    // Strip trailing incomplete value after colon
    repaired = repaired.replace(/:\s*"[^"]*"?\s*$/, '')
    // Strip trailing key with no value
    repaired = repaired.replace(/,\s*"[^"]*"\s*$/, '')
    // Strip trailing punctuation/whitespace
    repaired = repaired.replace(/[,:\s]+$/, '')

    // Recount and close brackets/braces
    let openBraces = 0, openBrackets = 0
    inString = false; escaped = false
    for (const ch of repaired) {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue
      if (ch === '{') openBraces++
      else if (ch === '}') openBraces--
      else if (ch === '[') openBrackets++
      else if (ch === ']') openBrackets--
    }

    let closed = repaired
    for (let i = 0; i < openBrackets; i++) closed += ']'
    for (let i = 0; i < openBraces; i++) closed += '}'

    try { return JSON.parse(closed) } catch { /* try stripping more */ }
  }

  // Last resort: find the last valid closing brace/bracket and truncate there
  for (let i = repaired.length - 1; i > 0; i--) {
    if (repaired[i] === '}' || repaired[i] === ']') {
      const truncated = repaired.slice(0, i + 1)
      // Recount and close
      let openBraces = 0, openBrackets = 0
      inString = false; escaped = false
      for (const ch of truncated) {
        if (escaped) { escaped = false; continue }
        if (ch === '\\') { escaped = true; continue }
        if (ch === '"') { inString = !inString; continue }
        if (inString) continue
        if (ch === '{') openBraces++
        else if (ch === '}') openBraces--
        else if (ch === '[') openBrackets++
        else if (ch === ']') openBrackets--
      }
      let closed = truncated
      for (let j = 0; j < openBrackets; j++) closed += ']'
      for (let j = 0; j < openBraces; j++) closed += '}'
      try { return JSON.parse(closed) } catch { continue }
    }
  }

  throw new Error('Could not repair truncated JSON')
}

const HTML_IMPORT_SYSTEM_PROMPT = `You are Mokkoi's HTML-to-React-Native converter. Your job is to convert web UI code (HTML, CSS, React, Tailwind) into Mokkoi's React Native JSON component tree format.

## YOUR OUTPUT FORMAT
Return a JSON object with this EXACT structure:
{
  "type": "View",
  "style": { "flex": 1, "backgroundColor": "..." },
  "children": [ ... child nodes ... ]
}

Each node follows this structure:
{
  "type": "View" | "Text" | "ScrollView" | "Image" | "TouchableOpacity" | "TextInput" | "Switch" | "SafeAreaView" | "Icon" | "LinearGradient",
  "style": { ...React Native StyleSheet properties... },
  "props": {
    "children"?: string (for Text nodes — the actual text content goes here OR as string in children array),
    "source"?: { "uri": string } (for Image nodes),
    "placeholder"?: string (for TextInput),
    "placeholderTextColor"?: string,
    "name"?: string (for Icon — Google Material Symbols name),
    "size"?: number (for Icon),
    "color"?: string (for Icon)
  },
  "children"?: [ ...child ComponentNode[] or string for Text ]
}

## CONVERSION RULES

### Element Mapping (Web → React Native)
- <div>, <section>, <article>, <main>, <aside>, <footer> → View
- <p>, <span>, <h1>-<h6>, <label>, <a> → Text (with appropriate fontSize/fontWeight)
  h1: fontSize 34, fontWeight "700"
  h2: fontSize 28, fontWeight "700"
  h3: fontSize 24, fontWeight "600"
  h4: fontSize 20, fontWeight "600"
  h5: fontSize 17, fontWeight "600"
  h6: fontSize 14, fontWeight "600"
- <button> → TouchableOpacity wrapping a Text child
- <input>, <textarea> → TextInput
- <img> → Image with props: { source: { uri: "..." } } and searchQuery for Mokkoi image proxy
- <ul>/<ol> with <li> → View with View children (no list markers needed)
- <nav> at bottom of page → View styled as bottom tab bar
- <header> → View at top
- <svg> → For simple shapes: View with backgroundColor/borderRadius. For charts/graphs with <path>: use Svg + Path components to preserve the line/curve. For circles: Svg + Circle.
- <form> → View
- <select> → TouchableOpacity styled as dropdown

### Style Conversion (CSS → React Native)
- Remove all units: "16px" → 16, "1rem" → 16, "0.5em" → 8, "1.5rem" → 24
- camelCase all properties: font-size → fontSize, background-color → backgroundColor
- Convert Tailwind classes to style objects:
  p-4 → padding: 16, p-6 → padding: 24, px-4 → paddingHorizontal: 16, py-3 → paddingVertical: 12
  m-4 → margin: 16, mb-2 → marginBottom: 8, mt-4 → marginTop: 16
  rounded-xl → borderRadius: 12, rounded-2xl → borderRadius: 16, rounded-full → borderRadius: 9999
  text-sm → fontSize: 14, text-xl → fontSize: 20, text-3xl → fontSize: 28
  font-bold → fontWeight: "700", font-semibold → fontWeight: "600", font-medium → fontWeight: "500"
  flex → flex: 1, flex-col → flexDirection: "column", flex-row → flexDirection: "row"
  items-center → alignItems: "center", justify-center → justifyContent: "center"
  justify-between → justifyContent: "space-between"
  gap-4 → gap: 16, space-y-4 → gap: 16 (on parent View)
  w-full → width: "100%", h-full → height: "100%"
  max-w-sm → maxWidth: 384
  shadow-lg → shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5
  min-h-screen → flex: 1
- box-shadow → shadowColor, shadowOffset, shadowOpacity, shadowRadius + elevation
- CSS Grid → flexbox (flexDirection: "row", flexWrap: "wrap" if needed)
- hover/focus states → IGNORE
- transition/animation → IGNORE
- @media queries → IGNORE (use mobile values)
- backdrop-filter: blur() → semi-transparent backgroundColor
- linear-gradient() → solid color (pick dominant gradient color)
- position: fixed → position: "absolute"
- overflow: scroll → wrap in ScrollView
- cursor: pointer → skip
- ::before, ::after → skip pseudo-elements
- text-decoration → textDecorationLine
- text-transform → textTransform
- letter-spacing → letterSpacing
- line-height → lineHeight (as number)
- opacity → opacity
- z-index → zIndex
- gap → gap

### Tailwind Color Mapping (common colors to hex)
bg-gray-900/#111827, bg-gray-800/#1F2937, bg-gray-700/#374151, bg-gray-600/#4B5563
bg-gray-500/#6B7280, bg-gray-400/#9CA3AF, bg-gray-300/#D1D5DB
text-white/#FFFFFF, text-gray-400/#9CA3AF, text-gray-500/#6B7280
bg-blue-600/#2563EB, bg-blue-500/#3B82F6, bg-blue-400/#60A5FA
bg-green-400/#4ADE80, bg-green-500/#22C55E, text-green-400/#4ADE80
bg-red-500/#EF4444, bg-purple-500/#A855F7, bg-indigo-500/#6366F1
bg-black/#000000, bg-white/#FFFFFF

### Color Preservation (CRITICAL)
- Keep ALL original colors EXACTLY as they appear in the input
- Do NOT substitute Mokkoi default colors
- If the input uses #1E1E2E background, the output must use #1E1E2E
- Preserve opacity values: "rgba(255,255,255,0.1)" stays as "rgba(255,255,255,0.1)"

### Layout Rules
- Root element should have: flex: 1, backgroundColor: [detected from input]
- All content must fit in a mobile viewport (width ~393px)
- If the web layout is wider than mobile, restructure:
  Multi-column grid → stack vertically or use horizontal scroll
  Wide tables → scrollable or restructured cards
  Sidebar layouts → remove sidebar, use bottom nav instead
- Maximum visible viewport ~724px height (use ScrollView for overflow)
- Keep spacing proportional but adjust for mobile: if web uses 32px padding, RN should use 16-20px
- iOS safe areas: paddingTop: 54 (status bar), paddingBottom: 34 (home indicator)

### Content Preservation (HIGHEST PRIORITY — preserve EVERYTHING)
- Keep ALL text content EXACTLY as it appears — every label, every number, every title
- Keep ALL image URLs exactly as they appear
- Keep icon references — use Icon component with closest Google Material Symbols name
  Common: home, search, menu, arrow_back, chevron_right, close, favorite, star, bookmark, share, send, person, notifications, play_arrow, pause, skip_next, shopping_cart, credit_card, trending_up, monitoring, bolt, location_on, fitness_center, settings, lock, calendar_today
- Keep placeholder text in inputs
- Keep button labels EXACTLY (including arrows like →, icons, and text)
- NEVER drop text from bottom nav tabs — every tab MUST have its Icon + Text label (e.g. "Home", "Activity", "Wallet", "Profile")
- NEVER simplify cards by removing text — if a card shows "Gym & Fitness Hub" + "2 DAYS AGO", keep BOTH texts
- Preserve ALL prices, ratings, ETAs, counts, percentages — every number matters
- If a section has a title like "RECENT JOURNEYS" or "CHOOSE RIDE", keep the EXACT title text
- Selected/active states: if an element has a highlighted border or different background, preserve that visual distinction

### What to Skip
- Script tags and JavaScript logic
- CSS animations and transitions
- Web-specific meta tags
- Link/stylesheet imports
- Complex SVG paths: use Svg + Path with the original d attribute, stroke, strokeWidth. For very complex SVGs (>500 chars of path data), approximate with View + backgroundColor + borderRadius
- iframes

### CRITICAL — ELEMENTS YOU MUST NEVER SKIP
These web patterns MUST be converted, not ignored:
1. Bottom navigation bars (<nav> at page bottom, position: fixed/sticky at bottom) → View with flexDirection: "row", position: "absolute", bottom: 0, left: 0, right: 0, paddingBottom: 34 (home indicator). Each nav item → TouchableOpacity with Icon + Text label. NEVER omit bottom nav.
2. Hero/promotional banners with gradients → View with backgroundColor set to the primary gradient color. ALL overlay text (discount %, headings, CTAs) MUST be included. If there is an image, include it as an Image component. NEVER skip promotional sections.
3. Image cards with overlay badges (ratings, delivery time, price tags) → View containing Image + absolutely positioned View badges on top (position: "absolute", top/right/bottom/left).
4. Floating action buttons or fixed buttons → TouchableOpacity with position: "absolute".
5. Search inputs with icons → View wrapping Icon + TextInput with placeholder preserved.
6. Tab bars, segmented controls → View with flexDirection: "row", children as TouchableOpacity buttons.

Remember: position: fixed → position: "absolute" (do NOT skip fixed-position elements, convert them).

### MACRO COMPONENTS — Use these for common patterns detected in the HTML:
- Bottom nav bar → use BottomNav: {"type":"BottomNav","props":{"items":[{"icon":"home","label":"Home","active":true},{"icon":"search","label":"Browse"}]}}
- Navigation header → use HeaderBar: {"type":"HeaderBar","props":{"title":"Screen Title","showBack":true,"rightIcons":["notifications"]}}
- User avatar circles → use AvatarCircle: {"type":"AvatarCircle","props":{"name":"User","size":40}}
- Search input with icon → use SearchBar: {"type":"SearchBar","props":{"placeholder":"Search..."}}
These expand to guaranteed-correct subtrees. Use them whenever the HTML has matching patterns.

${DESIGN_TOKENS}
${COMPONENT_TYPES}
${VIEWPORT_BUDGET}
${PLATFORM_RULES}

## IMPORTANT — OUTPUT FORMAT
- Return ONLY valid JSON. No markdown backticks, no \`\`\`json, no explanation, no preamble, no trailing text.
- Output MINIFIED JSON: NO newlines, NO indentation, NO extra spaces. Compact single-line output.
  CORRECT: {"type":"View","style":{"flex":1},"children":[{"type":"Text","children":["Hello"]}]}
  WRONG: {
    "type": "View",
    "style": { "flex": 1 }
  }
- The JSON must parse with JSON.parse() directly.
- Every node MUST have: type, style (with at least {})
- Text content goes as a string in the children array: "children": ["Hello"]
- Style values must be numbers (not "16px") or valid strings (colors, "center", etc.)
- The output should render correctly as a React Native mobile screen
- CRITICAL: The entire JSON tree MUST be complete. Do NOT truncate or cut off the output. If the tree is getting long, simplify deeply nested sections rather than stopping mid-output.`

// --- Preprocess HTML to reduce token count and avoid Vercel 10s timeout ---

function preprocessHtmlForConversion(code: string): {
  cleanedCode: string
  extractedColors: Record<string, string>
  extractedGradients: string[]
} {
  let s = code
  const extractedColors: Record<string, string> = {}
  const extractedGradients: string[] = []

  // Extract Tailwind color config from <script> or tailwind.config before stripping
  const twConfigMatch = s.match(/tailwind\.config[^{]*\{[\s\S]*?colors\s*:\s*\{([\s\S]*?)\}/i)
  if (twConfigMatch) {
    const colorBlock = twConfigMatch[1]
    const colorPairs = colorBlock.match(/'([^']+)'\s*:\s*'(#[0-9a-fA-F]{3,8})'/g)
      || colorBlock.match(/"([^"]+)"\s*:\s*"(#[0-9a-fA-F]{3,8})"/g)
    if (colorPairs) {
      for (const pair of colorPairs) {
        const m = pair.match(/['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/)
        if (m) extractedColors[m[1]] = m[2]
      }
    }
  }

  // Extract inline CSS colors and gradients from <style> tags before stripping
  const styleMatches = s.match(/<style[^>]*>([\s\S]*?)<\/style>/gi)
  if (styleMatches) {
    for (const styleBlock of styleMatches) {
      // Extract color definitions
      const cssColors = styleBlock.match(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)
      if (cssColors) {
        for (const c of cssColors) {
          const m = c.match(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/)
          if (m) extractedColors[m[1]] = m[2]
        }
      }
      // Extract gradient definitions
      const grads = styleBlock.match(/linear-gradient\([^)]+\)/g)
      if (grads) extractedGradients.push(...grads)
    }
  }

  // Also extract gradients from inline styles
  const inlineGrads = s.match(/background(?:-image)?\s*:\s*linear-gradient\([^)]+\)/g)
  if (inlineGrads) {
    for (const g of inlineGrads) {
      const m = g.match(/linear-gradient\([^)]+\)/)
      if (m && !extractedGradients.includes(m[0])) extractedGradients.push(m[0])
    }
  }

  // Strip <head>...</head>
  s = s.replace(/<head[\s\S]*?<\/head>/gi, '')
  // Strip <script> tags
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  // Strip <style> tags
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  // Strip HTML comments
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  // Strip all data- attributes
  s = s.replace(/\s+data-[\w-]+="[^"]*"/g, '')
  s = s.replace(/\s+data-[\w-]+='[^']*'/g, '')
  s = s.replace(/\s+data-[\w-]+/g, '')
  // Strip hover/focus/transition Tailwind classes (mobile doesn't need these)
  s = s.replace(/\b(?:hover|focus|focus-within|focus-visible|active|group-hover|peer-hover):[^\s"']+/g, '')
  s = s.replace(/\b(?:transition-\w+|duration-\w+|ease-\w+|animate-\w+|delay-\w+)/g, '')
  // Strip React import statements (not needed for conversion)
  s = s.replace(/^import\s+.*?\n/gm, '')
  // Strip export statements wrapping (keep the JSX)
  s = s.replace(/export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{?\s*return\s*\(/m, '')
  // Collapse multiple blank lines
  s = s.replace(/\n{3,}/g, '\n\n')
  // Collapse multiple spaces (not inside quotes)
  s = s.replace(/  +/g, ' ')
  // Trim lines
  s = s.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n')

  return { cleanedCode: s.trim(), extractedColors, extractedGradients }
}

/** Call Anthropic non-streaming, return raw text + usage */
async function callAnthropicImport(
  model: string, maxTokens: number, systemPrompt: string,
  messages: Array<{ role: string; content: string }>, apiKey: string
): Promise<{ text: string; inputTokens: number; outputTokens: number } | null> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'prompt-caching-2024-07-31' },
    body: JSON.stringify({
      model, max_tokens: maxTokens,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral', ttl: '1h' } }],
      messages,
    }),
  })
  if (!response.ok) {
    const errBody = await response.text().catch(() => '(no body)')
    console.error(`[import-html] Anthropic API error ${response.status}: ${errBody.substring(0, 500)}`)
    return null
  }
  const data = await response.json() as { content?: Array<{ text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } }
  const text = data.content?.[0]?.text
  if (!text) {
    console.error(`[import-html] Anthropic returned no text. Stop reason: ${(data as any).stop_reason}, content: ${JSON.stringify(data.content)?.substring(0, 200)}`)
    return null
  }
  return { text, inputTokens: data.usage?.input_tokens || 0, outputTokens: data.usage?.output_tokens || 0 }
}

/** Stream Anthropic response as SSE, collect full text, return it */
async function streamAnthropicImport(
  model: string, maxTokens: number, systemPrompt: string,
  messages: Array<{ role: string; content: string }>, apiKey: string,
  res: VercelResponse, phase: string
): Promise<{ text: string; inputTokens: number; outputTokens: number } | null> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'prompt-caching-2024-07-31' },
    body: JSON.stringify({
      model, max_tokens: maxTokens, stream: true,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral', ttl: '1h' } }],
      messages,
    }),
  })
  if (!response.ok) {
    const errBody = await response.text().catch(() => '(no body)')
    console.error(`[import-html] Streaming Anthropic API error ${response.status}: ${errBody.substring(0, 500)}`)
    return null
  }

  const reader = response.body as any
  if (!reader || typeof reader[Symbol.asyncIterator] !== 'function') {
    // Fallback to non-streaming
    const text = await response.text()
    return { text, inputTokens: 0, outputTokens: 0 }
  }

  let fullText = ''
  let inputTokens = 0, outputTokens = 0
  const decoder = new TextDecoder()
  let sseBuffer = ''

  for await (const chunk of reader) {
    const text = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true })
    sseBuffer += text
    const lines = sseBuffer.split('\n')
    sseBuffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (!data || data === '[DONE]') continue
      try {
        const event = JSON.parse(data)
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          fullText += event.delta.text
          // Send progress to client
          res.write(`data: ${JSON.stringify({ type: 'progress', phase, chars: fullText.length })}\n\n`)
        } else if (event.type === 'message_delta' && event.usage) {
          outputTokens = event.usage.output_tokens || 0
        } else if (event.type === 'message_start' && event.message?.usage) {
          inputTokens = event.message.usage.input_tokens || 0
        }
      } catch { /* skip */ }
    }
  }

  if (!fullText) return null
  return { text: fullText, inputTokens, outputTokens }
}

/** Validate import tree quality — returns true if tree is good enough */
function isImportTreeGoodEnough(tree: any): boolean {
  if (!tree || typeof tree !== 'object' || !tree.type) return false
  let nodeCount = 0
  let textNodes = 0
  let hasStringContent = false
  function walk(node: any) {
    if (!node || typeof node !== 'object') return
    nodeCount++
    if (node.type === 'Text') textNodes++
    // Check for text in children array (strings) or props.children (string)
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        if (typeof child === 'string') hasStringContent = true
        else if (typeof child === 'object') walk(child)
      }
    }
    if (typeof node.props?.children === 'string') hasStringContent = true
  }
  walk(tree)
  // Accept if tree has reasonable structure: >= 2 nodes with any text content
  return nodeCount >= 2 && (textNodes >= 1 || hasStringContent)
}

async function handleImportHtml(req: VercelRequest, res: VercelResponse, user: { id: string; email?: string; isMCP?: boolean }) {
  const { code, source: providedSource, projectId, screenName: providedScreenName } = req.body ?? {}

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "code" field' })
  }
  const trimmedCode = code.trim()
  if (trimmedCode.length < 50) {
    return res.status(400).json({ error: 'Code too short to convert. Paste a complete HTML/React component.' })
  }
  if (trimmedCode.length > 50000) {
    return res.status(400).json({ error: 'Code too large. Paste a single screen/component, not an entire project.' })
  }

  if (!user.isMCP) {
    const creditCheck = await checkCredits(user.id, 'new_screen', user.email)
    if (!creditCheck.hasCredits) {
      return res.status(402).json({ error: creditCheck.error, creditsRemaining: creditCheck.creditsRemaining, upgradeUrl: creditCheck.upgradeUrl })
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' })

  const detected = detectImportInputType(trimmedCode)
  const source = providedSource || detected.source
  const typeLabel = detected.type === 'unknown' ? 'web' : detected.type
  const tailwindNote = detected.hasTailwind ? ' (uses Tailwind CSS — convert all utility classes to React Native style objects)' : ''
  const sourceNote = source !== 'unknown' ? ` from ${source}` : ''

  // Preprocess HTML to reduce token count
  const { cleanedCode, extractedColors: preColors, extractedGradients } = preprocessHtmlForConversion(trimmedCode)

  // Cost tracking
  console.log(`[import-html] Input: ${trimmedCode.length} chars → ${cleanedCode.length} chars after preprocessing (${Math.round((1 - cleanedCode.length / trimmedCode.length) * 100)}% reduction)`)


  // Build color context if we extracted custom colors/gradients
  let colorContext = ''
  const colorEntries = Object.entries(preColors)
  if (colorEntries.length > 0) {
    colorContext += '\n\nEXTRACTED COLOR TOKENS (use these exact colors):\n' +
      colorEntries.map(([k, v]) => `${k}: ${v}`).join('\n')
  }
  if (extractedGradients.length > 0) {
    colorContext += '\n\nEXTRACTED GRADIENTS (approximate with dominant color):\n' +
      extractedGradients.slice(0, 5).join('\n')
  }

  const userMessage = `Convert this ${typeLabel} code${tailwindNote}${sourceNote} into a Mokkoi React Native component tree JSON.
${colorContext}
SOURCE CODE:
\`\`\`
${cleanedCode}
\`\`\`

Requirements:
- Preserve ALL original colors exactly
- Preserve ALL text content exactly
- Fit the layout for a mobile phone viewport (393px width, iOS safe areas: paddingTop 54, paddingBottom 34)
- Use only these component types: View, Text, ScrollView, Image, TouchableOpacity, TextInput, Switch, SafeAreaView, Icon, LinearGradient
- For icons, use Google Material Symbols names (lowercase with underscores)
- Return ONLY valid JSON`

  const wantsStream = req.headers['accept'] === 'text/event-stream' || req.query?.stream === 'true'
  const HAIKU = 'claude-haiku-4-5-20251001'
  const SONNET = 'claude-sonnet-4-6'
  const importMaxTokens = 8192
  const messages = [{ role: 'user', content: userMessage }]

  // Helper to build the final success response
  function buildSuccessResponse(normalizedTree: any, modelUsed: string) {
    const detectedColors = extractColorsFromTree(normalizedTree)
    const screenName = providedScreenName || detectImportScreenName(trimmedCode)
    const conversionNotes: string[] = []
    if (detected.hasTailwind) conversionNotes.push('Tailwind CSS classes converted to React Native style objects')
    if (detected.hasCSS) conversionNotes.push('CSS styles converted to React Native StyleSheet properties')
    if (detected.type === 'react-jsx' || detected.type === 'react-tsx') conversionNotes.push('React component converted to Mokkoi JSON component tree')
    if (source !== 'unknown') conversionNotes.push(`Source detected: ${source}`)
    return { success: true, screen: { name: screenName, tree: normalizedTree, detectedColors, detectedSource: source, conversionNotes }, modelUsed }
  }

  // --- HYBRID IMPORT: DOM parser extracts text checklist + Sonnet does full conversion ---
  // The DOM parser guarantees 100% text preservation by extracting every text node.
  // Sonnet does the actual conversion using the original HTML, with the text checklist
  // ensuring nothing gets hallucinated or dropped.
  if (shouldUseDomParser(cleanedCode, detected)) {
    try {
      console.log(`[import-html] Hybrid v2: text extraction + Sonnet full conversion...`)
      // Extract all text from HTML via DOM parser (cheap, deterministic)
      const parsedTree = parseHtmlToComponentTree(cleanedCode)
      const textChecklist = extractAllText(parsedTree)
      console.log(`[import-html] Extracted ${textChecklist.length} text nodes for verification`)

      if (textChecklist.length >= 3) {
        // Build conversion prompt — Sonnet converts directly from HTML, text checklist prevents drops
        const conversionPrompt = `Convert this HTML/Tailwind web code to a React Native component tree (JSON format).

SOURCE HTML CODE:
\`\`\`
${cleanedCode.slice(0, 24000)}
\`\`\`

TEXT CONTENT CHECKLIST — every single one of these text strings MUST appear in your output. If any is missing, your conversion is wrong:
${textChecklist.slice(0, 80).map((t: string, i: number) => `${i + 1}. "${t}"`).join('\n')}

CONVERSION RULES:
1. Output a single JSON object: {"type":"View","style":{...},"children":[...]}
2. Component types: View, Text, ScrollView, Image, TouchableOpacity, TextInput, Icon, Svg, Circle, Path
3. Text nodes MUST contain their text as string children in the children array. Example:
   {"type":"Text","style":{"fontSize":16,"color":"#FFFFFF"},"children":["Actual text here"]}
   NEVER output empty Text nodes. Every Text node MUST have at least one string in its children array.
4. EVERY text string from the checklist MUST appear inside a Text node's children array. Missing text = failed conversion.

EXAMPLE of correct structure:
{"type":"View","style":{"flex":1,"backgroundColor":"#0e0e0e"},"children":[
  {"type":"Text","style":{"fontSize":24,"fontWeight":"700","color":"#FFFFFF"},"children":["Dashboard"]},
  {"type":"Text","style":{"fontSize":14,"color":"#9e9e9e"},"children":["Welcome back"]},
  {"type":"View","style":{"flexDirection":"row"},"children":[
    {"type":"Icon","props":{"name":"home","size":20,"color":"#FFF"}},
    {"type":"Text","style":{"fontSize":11,"color":"#FFF"},"children":["Home"]}
  ]}
]}

5. Match the original design as closely as possible:
   - Use exact hex colors from the HTML (not approximations)
   - Match font sizes, weights, spacing, border radius exactly
   - Preserve the visual hierarchy and layout structure
   - Keep working image URLs (https://...) in Image source.uri
   - Convert broken/relative image URLs to searchQuery props
6. SVG elements:
   - Circles/rings → Svg + Circle with stroke, strokeWidth, strokeDasharray for progress rings
   - Line charts/graphs → Svg + Path with d (path data), stroke, strokeWidth, fill:"none" to preserve the chart line
   - Simple shapes (rectangles, dividers) → View with backgroundColor, height, width, borderRadius
   NEVER skip or omit SVG chart/graph lines — they are key visual elements. Use Svg + Path to preserve them.
7. Icons with material-symbols class → Icon component with name prop (e.g. {"type":"Icon","props":{"name":"home","size":20,"color":"#FFF"}})
8. Root must have: flex:1, dark backgroundColor (match HTML), paddingTop:54
9. Bottom navigation: LAST child of root, flexDirection:'row', justifyContent:'space-around', NO position:'absolute'. Each tab = TouchableOpacity with Icon + Text.
10. Use ScrollView (with showsVerticalScrollIndicator:false) for scrollable content areas
11. All Views default to flexDirection:'column'. Use flexDirection:'row' only where HTML has flex-row/inline layout.
12. NO position:'absolute' except for badges overlaid on images (use position:'absolute' + top/left for those only)
13. NO maxWidth:'75%' or chat bubble styling unless the screen is actually a chat/messaging screen
14. lineHeight MUST be at least 1.2x fontSize (e.g. fontSize:48 → lineHeight:56, fontSize:24 → lineHeight:30). Never set lineHeight equal to or less than fontSize.

Return ONLY the JSON. No markdown fences, no explanation.`

        const conversionMessages = [{ role: 'user', content: conversionPrompt }]
        const systemMsg = 'You are an expert at converting HTML/Tailwind web designs to React Native component trees. You produce pixel-perfect conversions that preserve every text label, color, and layout detail. Return ONLY valid minified JSON.'

        // Use non-streaming API internally (proven reliable), send result as SSE
        // Streaming API had parsing issues on Vercel — non-streaming is rock-solid
        if (wantsStream) {
          res.setHeader('Content-Type', 'text/event-stream')
          res.setHeader('Cache-Control', 'no-cache')
          res.setHeader('Connection', 'keep-alive')
          res.setHeader('X-Accel-Buffering', 'no')
          res.write(`data: ${JSON.stringify({ type: 'status', message: 'Analyzing HTML structure...', model: 'dom-parser' })}\n\n`)
          res.write(`data: ${JSON.stringify({ type: 'status', message: 'Converting to React Native...', model: 'sonnet' })}\n\n`)
        }

        const convResult = await callAnthropicImport(SONNET, 12000, systemMsg, conversionMessages, apiKey)

        let finalTree: any = null
        if (convResult) {
          console.log(`[import-html] Hybrid v2 raw output: ${convResult.text.length} chars, first 200: ${convResult.text.substring(0, 200)}`)
          try { finalTree = repairImportJSON(convResult.text) } catch (e) {
            console.log(`[import-html] JSON repair failed: ${e instanceof Error ? e.message : String(e)}`)
            finalTree = null
          }
        } else {
          console.log(`[import-html] Hybrid v2 callAnthropicImport returned null`)
        }

        if (finalTree && isImportTreeGoodEnough(finalTree)) {
          finalTree = expandComponents(finalTree)
          finalTree = normalizeComponentTree(finalTree)

          const result = buildSuccessResponse(finalTree, 'hybrid-v2 (text-check+sonnet)')
          const tokIn = convResult?.inputTokens || 0
          const tokOut = convResult?.outputTokens || 0
          logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: 'claude-sonnet-4-6', tokensIn: tokIn, tokensOut: tokOut, generationType: 'new_screen', promptPreview: `[import-html] Hybrid v2: ${detected.type} from ${source}`, success: true })
          if (!user.isMCP) await deductCredits(user.id, 'new_screen', user.email)

          if (wantsStream) {
            res.write(`data: ${JSON.stringify({ type: 'complete', ...result })}\n\n`)
            res.write('data: [DONE]\n\n')
            return res.end()
          } else {
            return res.status(200).json(result)
          }
        }

        // Hybrid v2 failed — send error for streaming, fall through for non-streaming
        console.log(`[import-html] Sonnet conversion failed (tree=${!!finalTree}, goodEnough=${finalTree ? isImportTreeGoodEnough(finalTree) : false})`)
        if (wantsStream) {
          res.write(`data: ${JSON.stringify({ type: 'error', message: 'Import failed: Could not parse conversion result. Please try again.' })}\n\n`)
          res.write('data: [DONE]\n\n')
          return res.end()
        }
      } else {
        console.log(`[import-html] Too few text nodes (${textChecklist.length}), falling through to full AI...`)
      }
    } catch (parseErr) {
      console.log(`[import-html] Hybrid v2 failed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}, falling through to full AI...`)
    }
  }

  // --- Streaming path (AI fallback) ---
  if (wantsStream) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    try {
      // Streaming: Use Sonnet for better HTML-to-RN conversion quality
      // Haiku was too weak for complex HTML — produced malformed JSON frequently
      res.write(`data: ${JSON.stringify({ type: 'status', message: 'Converting to mobile...', model: 'sonnet' })}\n\n`)
      const importResult = await streamAnthropicImport(SONNET, importMaxTokens, HTML_IMPORT_SYSTEM_PROMPT, messages, apiKey, res, 'sonnet')

      let tree: any = null
      const modelUsed = 'sonnet'

      if (importResult) {
        try { tree = repairImportJSON(importResult.text) } catch { tree = null }
        console.log(`[import-html] Sonnet (${importResult.inputTokens} in, ${importResult.outputTokens} out, tree=${!!tree}, ~$${((importResult.inputTokens * 3 + importResult.outputTokens * 15) / 1000000).toFixed(4)})`)
      }

      if (!tree || !isImportTreeGoodEnough(tree)) {
        console.log(`[import-html] Tree rejected: type=${tree?.type} children=${tree?.children?.length} firstChild=${JSON.stringify(tree?.children?.[0])?.substring(0, 200)}`)
        // Give more helpful error message
        const detail = !importResult ? 'AI service did not respond' : !tree ? 'Failed to parse AI response as valid JSON' : 'Generated screen was too simple — try pasting more complete code'
        res.write(`data: ${JSON.stringify({ type: 'error', message: `Import failed: ${detail}` })}\n\n`)
        res.write('data: [DONE]\n\n')
        logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed, generationType: 'new_screen', promptPreview: `[import-html] ${detected.type} from ${source}`, success: false })
        return res.end()
      }

      const expandedTree = expandComponents(tree)
      const normalizedTree = normalizeComponentTree(expandedTree)
      const result = buildSuccessResponse(normalizedTree, modelUsed)

      if (!user.isMCP) await deductCredits(user.id, 'new_screen', user.email)
      logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed, tokensIn: importResult!.inputTokens, tokensOut: importResult!.outputTokens, generationType: 'new_screen', promptPreview: `[import-html] ${detected.type} from ${source}`, success: true })

      res.write(`data: ${JSON.stringify({ type: 'complete', ...result })}\n\n`)
      res.write('data: [DONE]\n\n')
      return res.end()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[import-html] Streaming error:', message)
      res.write(`data: ${JSON.stringify({ type: 'error', message: `Import failed: ${message}` })}\n\n`)
      res.write('data: [DONE]\n\n')
      return res.end()
    }
  }

  // --- Non-streaming path (MCP clients, simple requests) ---
  try {
    // Use Sonnet directly for better conversion quality
    console.log(`[import-html] Non-streaming, using Sonnet...`)
    const modelUsed = 'sonnet'
    let tree: any = null
    let totalInputTokens = 0
    let totalOutputTokens = 0

    const sonnetResult = await callAnthropicImport(SONNET, importMaxTokens, HTML_IMPORT_SYSTEM_PROMPT, messages, apiKey)
    if (sonnetResult) {
      totalInputTokens += sonnetResult.inputTokens
      totalOutputTokens += sonnetResult.outputTokens
      try { tree = repairImportJSON(sonnetResult.text) } catch { tree = null }
      console.log(`[import-html] Sonnet: ${sonnetResult.inputTokens} in, ${sonnetResult.outputTokens} out, ~$${((sonnetResult.inputTokens * 3 + sonnetResult.outputTokens * 15) / 1000000).toFixed(4)}`)
    }

    if (!tree) return res.status(502).json({ error: 'Failed to generate component tree from HTML' })
    const validation = validateImportTree(tree)
    if (!validation.valid) return res.status(422).json({ error: validation.error })

    const expandedTree = expandComponents(tree)
    const normalizedTree = normalizeComponentTree(expandedTree)
    const result = buildSuccessResponse(normalizedTree, modelUsed)

    if (!user.isMCP) await deductCredits(user.id, 'new_screen', user.email)
    logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed, tokensIn: totalInputTokens, tokensOut: totalOutputTokens, generationType: 'new_screen', promptPreview: `[import-html] ${detected.type} from ${source}`, success: true })

    return res.status(200).json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[import-html] Error:', message)
    logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: 'haiku', generationType: 'new_screen', promptPreview: `[import-html] ${detected.type} from ${source}`, success: false })
    return res.status(500).json({ error: `Import failed: ${message}` })
  }
}

// =====================================================================
// Main handler
// =====================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET requests with action=image → image proxy (no auth needed)
  if (req.method === 'GET' && req.query.action === 'image') {
    return handleImageProxy(req, res)
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Mokkoi-Source, X-API-Key')
    return res.status(200).end()
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // --- Authentication ---
  const user = await authenticateRequest(req, res)
  if (!user) return // 401 already sent

  // --- Mode routing: import-html mode branches here ---
  const { mode } = req.body ?? {}
  if (mode === 'import-html') {
    return handleImportHtml(req, res, user)
  }

  // --- Normal generation mode ---
  const { prompt, currentScreen, imageData, imageMimeType, projectId, screenId, screenName, conversationHistory, brandColor, deviceId } = req.body ?? {}
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid prompt' })
  }

  // Smart model routing: detect if this is a new screen or an edit
  const isNewScreen = !currentScreen ||
    /\b(create|build|design|make a|generate|new screen|from scratch)\b/i.test(prompt)
  const isVariation = /variation/i.test(prompt) || prompt.includes('VARIATION_PROMPT')
  const isRegenerate = /regenerate/i.test(prompt)
  const hasImage = Boolean(imageData)

  // Determine credit type for deduction
  const creditType: 'new_screen' | 'edit' | 'screenshot' = hasImage
    ? 'screenshot'
    : (isNewScreen || isVariation || isRegenerate) ? 'new_screen' : 'edit'

  if (!user.isMCP) {
    const creditCheck = await checkCredits(user.id, creditType, user.email)
    if (!creditCheck.hasCredits) {
      return res.status(402).json({
        error: creditCheck.error,
        creditsRemaining: creditCheck.creditsRemaining,
        upgradeUrl: creditCheck.upgradeUrl,
      })
    }
  }

  // --- Pre-flight validation: fail fast without hitting the API ---
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' })
  }
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Prompt is empty' })
  }
  if (prompt.trim().length > 10000) {
    return res.status(400).json({ error: 'Prompt too long (max 10,000 characters)' })
  }

  // Model routing: Sonnet for all generation, Haiku for edits only
  // Sonnet produces significantly better quality screens (~$0.04/screen with caching)
  // Haiku is fine for edits which are simpler structural changes (~$0.02/edit)
  const userPlan = await getUserPlan(user.id, user.email)
  const freeTierSonnetUpgrade = false // no longer relevant — all generation uses Sonnet

  let model: string
  let maxTokens: number
  if (isNewScreen || isVariation || isRegenerate || hasImage) {
    // All new screen generation uses Sonnet for consistent quality
    model = 'claude-sonnet-4-6'
    maxTokens = 8000
  } else {
    // Edits use Haiku (simpler task, cost-effective)
    model = 'claude-haiku-4-5-20251001'
    maxTokens = 4000
  }

  // Validate model string against whitelist — prevent paying for guaranteed 400 errors
  const VALID_MODELS = new Set(['claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-haiku-4-5'])
  if (!VALID_MODELS.has(model)) {
    console.error(`Invalid model string: ${model}`)
    return res.status(500).json({ error: 'Internal configuration error' })
  }

  // Determine generation type for usage logging
  let generationType: 'new_screen' | 'edit' | 'variation' | 'regenerate' = 'new_screen'
  if (isVariation) generationType = 'variation'
  else if (isRegenerate) generationType = 'regenerate'
  else if (currentScreen) generationType = 'edit'

  // Extract DESIGN.md if present in prompt
  const { cleanPrompt: rawCleanPrompt, designMd } = extractDesignMd(prompt)
  const isEditMode = !!currentScreen && generationType === 'edit'
  const learnedPatterns = isNewScreen ? await getLearnedPatterns() : ''

  // Enrich vague prompts (just an app name like "Zillow" or "Spotify")
  function enrichVaguePrompt(p: string): string {
    const wordCount = p.trim().split(/\s+/).length
    if (wordCount <= 3 && classifyScreenType(p) === 'unknown') {
      return `Create a home dashboard screen for a ${p.trim()} app. Include a header with app name, key statistics or metrics, main content cards, and a bottom navigation bar.`
    }
    return p
  }
  const cleanPrompt = isEditMode ? rawCleanPrompt : enrichVaguePrompt(rawCleanPrompt)
  const screenType = classifyScreenType(cleanPrompt)
  // Resolve device info for prompt context
  const DEVICE_MAP: Record<string, { name: string; width: number; height: number; category: string }> = {
    'iphone-standard': { name: 'iPhone Standard', width: 393, height: 852, category: 'iOS' },
    'iphone-max': { name: 'iPhone Max', width: 430, height: 932, category: 'iOS' },
    'iphone-se': { name: 'iPhone SE', width: 375, height: 667, category: 'iOS' },
    'android-standard': { name: 'Android', width: 360, height: 800, category: 'Android' },
    'android-large': { name: 'Android Large', width: 412, height: 917, category: 'Android' },
  }
  const deviceInfo = deviceId ? DEVICE_MAP[deviceId as string] : undefined
  // Resolve dynamic color theme — only for new screens, not edits
  const themeResult = !isEditMode ? resolveTheme(cleanPrompt) : undefined
  // Use static system prompt for cache hits; dynamic context goes in user message
  const systemPromptText = isEditMode ? SYSTEM_PROMPT_EDIT : SYSTEM_PROMPT_NEW
  const dynamicContext = buildDynamicContext({ themeResult, deviceInfo, brandColor, designMd, learnedPatterns, screenType })
  const normalizerOpts = parseDesignMdTokens(designMd)

  // Build user message — include current screen if editing, or image if attached
  // Dynamic context (theme palette, device info, brand color, design.md, learned patterns)
  // is prepended to user message to keep system prompt static for cache hits.
  let userContent: string | Array<{ type: string; [key: string]: unknown }>
  if (imageData && typeof imageData === 'string') {
    // Screenshot-to-screen: send image with text prompt
    const textPrompt = currentScreen
      ? `${dynamicContext}Here is the current screen JSON:\n${JSON.stringify(currentScreen, null, 2)}\n\nThe user attached a screenshot and says: ${cleanPrompt}\n\nRecreate or modify the screen to match the screenshot. Return complete JSON.`
      : `${dynamicContext}SCREENSHOT RECREATION — STRUCTURAL ANALYSIS REQUIRED

Before generating JSON, you MUST perform this structural analysis of the screenshot:

STEP 1 — SCREEN CLASSIFICATION:
Identify the screen type: dashboard, profile, settings, list, detail, onboarding, auth/login, chat, player, calendar, form, or other.

STEP 2 — SECTION MAPPING:
Identify ALL distinct visual sections from top to bottom:
- Header area (navigation, title, avatar, status bar elements)
- Content sections (cards, lists, grids, hero areas, forms)
- Footer area (tab bar, bottom navigation, floating action buttons)

STEP 3 — DATA ELEMENT INVENTORY:
Count and list EVERY data element visible in the screenshot:
- Numeric values (scores, counts, percentages, prices, stats)
- Labels and descriptive text (titles, subtitles, categories)
- Status indicators (badges, pills, online/offline, progress bars)
- Icons and emoji used as visual indicators
- User-specific content (names, avatars, greetings)

STEP 4 — LAYOUT PATTERN DETECTION:
Identify the layout patterns used:
- Card grids (2-column, 3-column stat cards)
- List items (vertical lists with icons/text/chevrons)
- Hero sections (large centered content)
- Paired metrics (side-by-side stat boxes)
- Navigation patterns (bottom tabs, top nav, drawer indicators)

CRITICAL RULES:
- Every numeric value in the screenshot MUST appear in the output JSON
- Every card/container in the screenshot MUST have a corresponding View in the output
- Every icon/emoji visible MUST be preserved
- Stat cards with numbers MUST use the paired metric pattern, not be replaced with hero text
- If the screenshot shows a dashboard with data, output a dashboard with data — NEVER convert it to a splash/landing page
- Preserve the EXACT number of sections, cards, and data elements

The user says: ${cleanPrompt}

Now generate the complete React Native component tree JSON that faithfully recreates this screenshot. Return ONLY valid JSON.`
    userContent = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: imageMimeType || 'image/png',
          data: imageData,
        },
      },
      { type: 'text', text: textPrompt },
    ]
  } else if (isRegenerate && currentScreen) {
    // Regenerate mode: send existing tree as reference so Claude preserves screen type
    userContent = `${dynamicContext}REGENERATE MODE: You are regenerating an existing screen. The user wants a fresh design approach for the SAME type of screen. Keep the same purpose, features, and information architecture but create a new visual design. Do NOT change the screen type (e.g., if it's a fitness screen, keep it as fitness; if it's a dashboard, keep it as a dashboard).

Here is the current screen's component tree JSON for reference:
${JSON.stringify(currentScreen, null, 2)}
${screenName ? `\nScreen name: ${screenName}` : ''}

${cleanPrompt}

Generate a completely fresh design for this same type of screen. Use different layout patterns, card styles, and visual hierarchy — but preserve the same screen purpose and content type. Return ONLY valid JSON.`
  } else if (currentScreen) {
    userContent = `${dynamicContext}EDIT MODE — You MUST preserve the existing screen's layout, content, and structure. Only change what the user explicitly asks to change.

Here is the current screen's component tree JSON:
${JSON.stringify(currentScreen, null, 2)}

The user's edit request: ${cleanPrompt}

IMPORTANT: Do NOT recreate this screen from scratch. Modify the EXISTING tree above. Keep all text content, element positions, component structure, and styling that the user did NOT ask to change. If the user asks for a color/theme change, update ONLY colors — keep everything else identical. Return the complete modified JSON.`
  } else {
    userContent = `${dynamicContext}${cleanPrompt}`
  }

  // --- Structural validation: checks generated tree for screenshot fidelity issues ---
  function validateStructuralFidelity(tree: any): { valid: boolean; issues: string[] } {
    const issues: string[] = []
    if (!tree || typeof tree !== 'object') return { valid: false, issues: ['No tree generated'] }

    // Count total nodes, text nodes, and data-like text nodes
    let totalNodes = 0
    let textNodes = 0
    let dataTextNodes = 0 // Text nodes with numbers (likely data/stats)
    let viewNodes = 0
    let touchableNodes = 0
    let hasScrollView = false

    function walk(node: any) {
      if (!node || typeof node !== 'object') return
      totalNodes++
      if (node.type === 'Text' && Array.isArray(node.children)) {
        textNodes++
        const textContent = node.children.join('')
        // Check if text contains numbers (likely data/metrics)
        if (/\d/.test(textContent) && textContent.length < 20) {
          dataTextNodes++
        }
      }
      if (node.type === 'View') viewNodes++
      if (node.type === 'TouchableOpacity') touchableNodes++
      if (node.type === 'ScrollView') hasScrollView = true
      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          if (typeof child === 'object') walk(child)
        }
      }
    }

    walk(tree)

    // Structural warnings for screenshot recreation
    if (hasImage && totalNodes < 10) {
      issues.push(`LOW_COMPLEXITY: Only ${totalNodes} nodes generated — screenshot likely has more elements`)
    }
    if (hasImage && textNodes < 3) {
      issues.push(`LOW_TEXT_COUNT: Only ${textNodes} text nodes — screenshot likely has more labels/values`)
    }
    if (hasImage && viewNodes < 4) {
      issues.push(`LOW_CONTAINER_COUNT: Only ${viewNodes} View containers — screenshot likely has more sections/cards`)
    }
    if (hasImage && touchableNodes === 0) {
      issues.push(`NO_INTERACTIVITY: No TouchableOpacity found — screenshot likely has buttons/tappable areas`)
    }

    // Check if tree is suspiciously simple (hero/splash pattern detection)
    const rootChildren = Array.isArray(tree.children) ? tree.children.filter((c: any) => typeof c === 'object') : []
    if (hasImage && rootChildren.length <= 2 && totalNodes < 15) {
      issues.push(`SPLASH_PATTERN_DETECTED: Tree structure too simple for a dashboard/functional screen — may have been simplified to a hero/splash layout`)
    }

    if (issues.length > 0) {
      console.warn('[StructuralValidation]', issues.join('; '))
    }

    return { valid: issues.length === 0, issues }
  }

  // Extract design brief from two-phase generation response
  function extractDesignBrief(raw: string): { brief: string | null; jsonText: string } {
    const briefMatch = raw.match(/<design_brief>([\s\S]*?)<\/design_brief>/)
    const brief = briefMatch ? briefMatch[1].trim() : null
    // Remove the design brief to isolate the JSON
    const jsonText = raw.replace(/<design_brief>[\s\S]*?<\/design_brief>/, '').trim()
    return { brief, jsonText }
  }

  // Robust JSON repair: strips markdown fences, extracts JSON, closes truncated structures
  function repairJSON(raw: string): any {
    let s = raw.trim()
    s = s.replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
    const firstBrace = s.indexOf('{')
    if (firstBrace === -1) throw new Error('No JSON object found')
    const lastBrace = s.lastIndexOf('}')
    if (lastBrace > firstBrace) {
      s = s.slice(firstBrace, lastBrace + 1)
    } else {
      s = s.slice(firstBrace)
    }
    try { return JSON.parse(s) } catch {}
    let repaired = s
    let inString = false, escaped = false
    for (const ch of repaired) {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '"') { inString = !inString }
    }
    if (inString) repaired += '"'
    repaired = repaired.replace(/,\s*"[^"]*":\s*"?[^"}\]]*$/, '')
    repaired = repaired.replace(/[,:\s]+$/, '')
    let openBraces = 0, openBrackets = 0
    inString = false; escaped = false
    for (const ch of repaired) {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue
      if (ch === '{') openBraces++
      else if (ch === '}') openBraces--
      else if (ch === '[') openBrackets++
      else if (ch === ']') openBrackets--
    }
    for (let i = 0; i < openBrackets; i++) repaired += ']'
    for (let i = 0; i < openBraces; i++) repaired += '}'
    return JSON.parse(repaired)
  }

  // Partial tree parser: tries to extract a renderable tree from incomplete JSON
  function attemptPartialTreeParse(text: string): any | null {
    try {
      // Find the start of a JSON object with a "type" key
      const jsonMatch = text.match(/\{[\s\S]*"type"\s*:/)
      if (!jsonMatch) return null

      let jsonStr = text.slice(text.indexOf(jsonMatch[0]))

      // Remove any trailing incomplete key-value pair
      jsonStr = jsonStr.replace(/,\s*"[^"]*"?\s*:?\s*$/, '')
      jsonStr = jsonStr.replace(/,\s*$/, '')

      // Close unclosed strings
      let inString = false, escaped = false
      for (const ch of jsonStr) {
        if (escaped) { escaped = false; continue }
        if (ch === '\\') { escaped = true; continue }
        if (ch === '"') { inString = !inString }
      }
      if (inString) jsonStr += '"'

      // Remove trailing incomplete values after closing the string
      jsonStr = jsonStr.replace(/,\s*"[^"]*":\s*"?[^"}\]]*$/, '')
      jsonStr = jsonStr.replace(/[,:\s]+$/, '')

      // Count unclosed brackets/braces
      let openBraces = 0, openBrackets = 0
      inString = false; escaped = false
      for (const ch of jsonStr) {
        if (escaped) { escaped = false; continue }
        if (ch === '\\') { escaped = true; continue }
        if (ch === '"') { inString = !inString; continue }
        if (inString) continue
        if (ch === '{') openBraces++
        else if (ch === '}') openBraces--
        else if (ch === '[') openBrackets++
        else if (ch === ']') openBrackets--
      }

      // Close arrays then objects
      for (let i = 0; i < openBrackets; i++) jsonStr += ']'
      for (let i = 0; i < openBraces; i++) jsonStr += '}'

      const parsed = JSON.parse(jsonStr)
      if (parsed && parsed.type) return parsed
      return null
    } catch {
      return null
    }
  }

  // --- CHAT TEMPLATE: Fixed layout, AI only provides content ---
  // When screen type is "chat" and it's a new generation (not edit/screenshot),
  // use a hardcoded template structure. The AI only returns contact name + messages.
  // This guarantees zero colored blocks — the layout is never AI-generated.
  const isChatTemplate = screenType === 'chat' && !isEditMode && !hasImage && !isRegenerate
  if (isChatTemplate) {
    const chatSystemPrompt = `You generate chat message content for a mobile chat screen. Return ONLY a JSON object with this exact structure:
{"contact":"Name","status":"Active now","messages":[{"text":"message text","sent":false,"time":"10:30 AM"},{"text":"reply text","sent":true,"time":"10:31 AM"}]}

Rules:
- contact: the chat partner's name (realistic, match the user's request)
- status: "Active now", "Last seen 2h ago", etc.
- messages: 5-7 messages, alternating sent/received, with realistic timestamps
- sent: false = received from contact, true = sent by user
- Text should be natural, casual conversation matching the user's topic
- Use realistic timestamps (ascending order, 1-5 min gaps)
- Keep messages short (1-2 sentences max)
- Return ONLY the JSON object, no markdown, no explanation`

    const chatResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // Haiku is fine for just generating text content
        max_tokens: 1000,
        system: [{ type: 'text', text: chatSystemPrompt }],
        messages: [{ role: 'user', content: cleanPrompt }],
      }),
    })

    if (chatResponse.ok) {
      const chatData = await chatResponse.json() as any
      const chatText = chatData.content?.[0]?.text || ''
      try {
        // Parse the AI's content response
        const jsonMatch = chatText.match(/\{[\s\S]*\}/)
        const chatContent = JSON.parse(jsonMatch ? jsonMatch[0] : chatText)
        const contact = chatContent.contact || 'Friend'
        const status = chatContent.status || 'Active now'
        const messages = Array.isArray(chatContent.messages) ? chatContent.messages : []

        // Assemble the chat screen from the fixed template
        const tree = {
          type: 'View',
          style: { flex: 1, backgroundColor: '#0F172A', paddingTop: 54 },
          children: [
            // Header
            {
              type: 'View',
              style: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 56, backgroundColor: '#1A2236', borderBottomWidth: 1, borderColor: '#2A3352' },
              children: [
                { type: 'TouchableOpacity', style: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, children: [{ type: 'Icon', props: { name: 'arrow_back', size: 20, color: '#FFFFFF' } }] },
                { type: 'View', style: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }, children: [
                  { type: 'AvatarCircle', props: { name: contact, size: 40 } },
                  { type: 'View', children: [
                    { type: 'Text', style: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' }, children: [contact] },
                    { type: 'View', style: { flexDirection: 'row', alignItems: 'center', gap: 4 }, children: [
                      { type: 'View', style: { width: 6, height: 6, borderRadius: 4, backgroundColor: '#22C55E' } },
                      { type: 'Text', style: { fontSize: 12, color: '#94A3B8' }, children: [status] },
                    ]},
                  ]},
                ]},
                { type: 'View', style: { flexDirection: 'row', gap: 8 }, children: [
                  { type: 'TouchableOpacity', style: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, children: [{ type: 'Icon', props: { name: 'call', size: 20, color: '#FFFFFF' } }] },
                  { type: 'TouchableOpacity', style: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, children: [{ type: 'Icon', props: { name: 'info', size: 20, color: '#FFFFFF' } }] },
                ]},
              ],
            },
            // Messages
            {
              type: 'ScrollView',
              style: { flex: 1, paddingHorizontal: 16, paddingVertical: 12 },
              props: { showsVerticalScrollIndicator: false },
              children: messages.map((msg: any) => ({
                type: 'MessageBubble',
                props: { text: msg.text || '', sent: !!msg.sent, time: msg.time },
              })),
            },
            // Input bar
            { type: 'ChatInputBar', props: { placeholder: `Message ${contact}...` } },
            // Home indicator spacing
            { type: 'View', style: { height: 34 } },
          ],
        }

        // Expand macros (MessageBubble, ChatInputBar, AvatarCircle)
        const expandedTree = expandComponents(tree)
        const normalizedTree = normalizeComponentTree(expandedTree, normalizerOpts)

        // Log usage
        const chatTokensIn = chatData.usage?.input_tokens || 0
        const chatTokensOut = chatData.usage?.output_tokens || 0
        logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: 'claude-haiku-4-5-20251001', tokensIn: chatTokensIn, tokensOut: chatTokensOut, generationType, promptPreview: prompt, success: true })

        // Deduct credits
        if (!user.isMCP) {
          await deductCredits(user.id, creditType, user.email)
        }

        // Return via streaming or direct based on client preference
        const wantsStream = req.headers['accept'] === 'text/event-stream' || req.query?.stream === 'true'
        if (wantsStream) {
          res.setHeader('Content-Type', 'text/event-stream')
          res.setHeader('Cache-Control', 'no-cache')
          res.setHeader('Connection', 'keep-alive')
          res.setHeader('X-Accel-Buffering', 'no')
          res.write(`data: ${JSON.stringify({ type: 'complete', tree: normalizedTree, modelUsed: 'Haiku (chat template)' })}\n\n`)
          res.write('data: [DONE]\n\n')
          return res.end()
        }
        return res.status(200).json({ tree: normalizedTree, modelUsed: 'Haiku (chat template)' })
      } catch (parseErr) {
        console.error('Chat template content parse failed:', chatText.slice(0, 200))
        // Fall through to normal generation
      }
    }
    // If chat template fails, fall through to normal AI generation
  }

  // --- AUTH/LOGIN TEMPLATE: Fixed layout, AI only provides content ---
  const isAuthTemplate = screenType === 'auth' && !isEditMode && !hasImage && !isRegenerate
  if (isAuthTemplate) {
    const authSystemPrompt = `You generate content for a mobile login/signup screen. Return ONLY a JSON object with this exact structure:
{"appName":"App Name","tagline":"Short tagline","mode":"login","fields":[{"label":"Email","placeholder":"you@example.com","icon":"mail","secure":false},{"label":"Password","placeholder":"Enter password","icon":"lock","secure":true}],"forgotText":"Forgot password?","ctaText":"Sign In","socialButtons":["google","apple"],"footerText":"Don't have an account?","footerAction":"Sign Up"}

Rules:
- appName: match the user's request or generate a realistic app name
- tagline: 1 short line (max 40 chars)
- mode: "login" or "signup" based on user's request
- fields: 2-4 form fields appropriate for login or signup
- For signup: add name field, confirm password, etc.
- ctaText: "Sign In", "Create Account", "Get Started" etc.
- Return ONLY the JSON object, no markdown, no explanation`

    const authResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'prompt-caching-2024-07-31' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, system: [{ type: 'text', text: authSystemPrompt }], messages: [{ role: 'user', content: cleanPrompt }] }),
    })

    if (authResponse.ok) {
      const authData = await authResponse.json() as any
      const authText = authData.content?.[0]?.text || ''
      try {
        const jsonMatch = authText.match(/\{[\s\S]*\}/)
        const c = JSON.parse(jsonMatch ? jsonMatch[0] : authText)
        const appName = c.appName || 'MyApp'
        const tagline = c.tagline || 'Welcome back'
        const fields = Array.isArray(c.fields) ? c.fields : [{ label: 'Email', placeholder: 'you@example.com', icon: 'mail' }, { label: 'Password', placeholder: 'Enter password', icon: 'lock', secure: true }]
        const ctaText = c.ctaText || 'Sign In'
        const socialButtons = Array.isArray(c.socialButtons) ? c.socialButtons : ['google', 'apple']
        const footerText = c.footerText || "Don't have an account?"
        const footerAction = c.footerAction || 'Sign Up'

        const tree = {
          type: 'View',
          style: { flex: 1, backgroundColor: '#0F172A', paddingTop: 54, paddingBottom: 34, paddingHorizontal: 24 },
          children: [
            // Spacer top
            { type: 'View', style: { height: 60 } },
            // Logo icon
            { type: 'View', style: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#6C5CE7', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }, children: [
              { type: 'Text', style: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' }, children: [appName.charAt(0)] },
            ]},
            // App name
            { type: 'Text', style: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginTop: 16 }, children: [appName] },
            // Tagline
            { type: 'Text', style: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginTop: 4 }, children: [tagline] },
            // Spacer
            { type: 'View', style: { height: 32 } },
            // Form fields
            ...fields.map((f: any) => ({
              type: 'FormInput',
              props: { label: f.label, placeholder: f.placeholder, icon: f.icon, secureTextEntry: !!f.secure },
            })),
            // Forgot password
            ...(c.forgotText ? [{ type: 'TouchableOpacity', style: { alignSelf: 'flex-end', marginBottom: 16 }, children: [
              { type: 'Text', style: { fontSize: 13, color: '#6C5CE7' }, children: [c.forgotText] },
            ]}] : []),
            // CTA button
            { type: 'Button', props: { text: ctaText, variant: 'primary', size: 'lg' } },
            // Divider
            { type: 'View', style: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 }, children: [
              { type: 'View', style: { flex: 1, height: 1, backgroundColor: '#2A2A3E' } },
              { type: 'Text', style: { fontSize: 13, color: '#6B6B80' }, children: ['or continue with'] },
              { type: 'View', style: { flex: 1, height: 1, backgroundColor: '#2A2A3E' } },
            ]},
            // Social buttons
            { type: 'View', style: { flexDirection: 'row', gap: 12 }, children: socialButtons.map((provider: string) => ({
              type: 'View', style: { flex: 1 }, children: [{ type: 'SocialButton', props: { provider } }],
            }))},
            // Footer
            { type: 'View', style: { flex: 1 } },
            { type: 'View', style: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingBottom: 8 }, children: [
              { type: 'Text', style: { fontSize: 14, color: '#6B6B80' }, children: [footerText] },
              { type: 'TouchableOpacity', children: [{ type: 'Text', style: { fontSize: 14, fontWeight: '600', color: '#6C5CE7' }, children: [footerAction] }] },
            ]},
          ],
        }

        const expandedTree = expandComponents(tree)
        const normalizedTree = normalizeComponentTree(expandedTree, normalizerOpts)
        logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: 'claude-haiku-4-5-20251001', tokensIn: authData.usage?.input_tokens || 0, tokensOut: authData.usage?.output_tokens || 0, generationType, promptPreview: prompt, success: true })
        if (!user.isMCP) await deductCredits(user.id, creditType, user.email)

        const wantsStream = req.headers['accept'] === 'text/event-stream' || req.query?.stream === 'true'
        if (wantsStream) {
          res.setHeader('Content-Type', 'text/event-stream')
          res.setHeader('Cache-Control', 'no-cache')
          res.setHeader('Connection', 'keep-alive')
          res.setHeader('X-Accel-Buffering', 'no')
          res.write(`data: ${JSON.stringify({ type: 'complete', tree: normalizedTree, modelUsed: 'Haiku (auth template)' })}\n\n`)
          res.write('data: [DONE]\n\n')
          return res.end()
        }
        return res.status(200).json({ tree: normalizedTree, modelUsed: 'Haiku (auth template)' })
      } catch { /* Fall through */ }
    }
  }

  // --- SETTINGS TEMPLATE: Fixed layout, AI only provides content ---
  const isSettingsTemplate = screenType === 'settings' && !isEditMode && !hasImage && !isRegenerate
  if (isSettingsTemplate) {
    const settingsSystemPrompt = `You generate content for a mobile settings screen. Return ONLY a JSON object with this exact structure:
{"userName":"Alex Chen","userEmail":"alex@example.com","sections":[{"title":"ACCOUNT","items":[{"icon":"notifications","title":"Notifications","subtitle":"Push and email","type":"toggle","value":true},{"icon":"lock","title":"Privacy & Security","type":"chevron"}]},{"title":"PREFERENCES","items":[{"icon":"dark_mode","title":"Dark Mode","subtitle":"Always on dark theme","type":"toggle","value":true},{"icon":"language","title":"Language","trailing":"English","type":"chevron"}]}]}

Rules:
- userName and userEmail: realistic, match user's request if specified
- sections: 2-4 grouped sections with uppercase titles
- Each item has: icon (Material Symbols name), title, optional subtitle, type (toggle/chevron/text)
- For toggle type: include value (true/false)
- For chevron type: optional trailing text
- Include at least one "Appearance/Dark Mode" toggle and one "Notifications" toggle
- Last section should have a destructive "Log Out" or "Delete Account" option
- Return ONLY the JSON object, no markdown, no explanation`

    const settingsResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'prompt-caching-2024-07-31' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, system: [{ type: 'text', text: settingsSystemPrompt }], messages: [{ role: 'user', content: cleanPrompt }] }),
    })

    if (settingsResponse.ok) {
      const settingsData = await settingsResponse.json() as any
      const settingsText = settingsData.content?.[0]?.text || ''
      try {
        const jsonMatch = settingsText.match(/\{[\s\S]*\}/)
        const c = JSON.parse(jsonMatch ? jsonMatch[0] : settingsText)
        const userName = c.userName || 'User'
        const userEmail = c.userEmail || 'user@example.com'
        const sections = Array.isArray(c.sections) ? c.sections : []

        // Build settings rows from AI content
        const sectionChildren: any[] = []
        for (const section of sections) {
          // Section header
          sectionChildren.push({ type: 'Text', style: { fontSize: 13, fontWeight: '500', color: '#6B6B80', textTransform: 'uppercase', letterSpacing: 1, marginTop: 24, marginBottom: 8, paddingHorizontal: 20 }, children: [section.title || 'SECTION'] })
          // Grouped card
          const items: any[] = (section.items || []).map((item: any, idx: number) => {
            const isLast = idx === (section.items || []).length - 1
            const isDestructive = /log\s*out|delete|sign\s*out/i.test(item.title || '')
            const row: any = {
              type: 'View',
              style: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 48, ...(!isLast ? { borderBottomWidth: 1, borderColor: '#2A2A3E' } : {}) },
              children: [
                { type: 'Icon', props: { name: item.icon || 'settings', size: 20, color: isDestructive ? '#E17055' : '#A0A0B8' } },
                { type: 'View', style: { flex: 1, marginLeft: 12 }, children: [
                  { type: 'Text', style: { fontSize: 16, color: isDestructive ? '#E17055' : '#FFFFFF' }, children: [item.title || 'Setting'] },
                  ...(item.subtitle ? [{ type: 'Text', style: { fontSize: 12, color: '#6B6B80', marginTop: 1 }, children: [item.subtitle] }] : []),
                ]},
                ...(item.type === 'toggle' ? [{ type: 'Switch', props: { value: !!item.value, trackColor: { true: '#00B894', false: '#222236' }, thumbColor: '#FFFFFF' } }] : []),
                ...(item.trailing ? [{ type: 'Text', style: { fontSize: 14, color: '#6B6B80', marginRight: 4 }, children: [item.trailing] }] : []),
                ...(item.type === 'chevron' ? [{ type: 'Icon', props: { name: 'chevron_right', size: 18, color: '#6B6B80' } }] : []),
              ],
            }
            return row
          })
          sectionChildren.push({
            type: 'View',
            style: { backgroundColor: '#12121F', borderRadius: 12, overflow: 'hidden', marginHorizontal: 20 },
            children: items,
          })
        }

        const tree = {
          type: 'View',
          style: { flex: 1, backgroundColor: '#0A0A1A', paddingTop: 54 },
          children: [
            // Header
            { type: 'View', style: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 44 }, children: [
              { type: 'TouchableOpacity', style: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, children: [
                { type: 'Icon', props: { name: 'arrow_back', size: 20, color: '#FFFFFF' } },
              ]},
              { type: 'Text', style: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', marginLeft: 8 }, children: ['Settings'] },
            ]},
            // Profile section
            { type: 'View', style: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12 }, children: [
              { type: 'AvatarCircle', props: { name: userName, size: 56 } },
              { type: 'View', style: { flex: 1 }, children: [
                { type: 'Text', style: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' }, children: [userName] },
                { type: 'Text', style: { fontSize: 14, color: '#6B6B80', marginTop: 2 }, children: [userEmail] },
              ]},
              { type: 'TouchableOpacity', style: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#12121F', alignItems: 'center', justifyContent: 'center' }, children: [
                { type: 'Icon', props: { name: 'edit', size: 16, color: '#6C5CE7' } },
              ]},
            ]},
            // Settings sections (scrollable)
            { type: 'ScrollView', style: { flex: 1 }, props: { showsVerticalScrollIndicator: false }, children: [
              ...sectionChildren,
              { type: 'View', style: { height: 34 } },
            ]},
          ],
        }

        const expandedTree = expandComponents(tree)
        const normalizedTree = normalizeComponentTree(expandedTree, normalizerOpts)
        logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: 'claude-haiku-4-5-20251001', tokensIn: settingsData.usage?.input_tokens || 0, tokensOut: settingsData.usage?.output_tokens || 0, generationType, promptPreview: prompt, success: true })
        if (!user.isMCP) await deductCredits(user.id, creditType, user.email)

        const wantsStream = req.headers['accept'] === 'text/event-stream' || req.query?.stream === 'true'
        if (wantsStream) {
          res.setHeader('Content-Type', 'text/event-stream')
          res.setHeader('Cache-Control', 'no-cache')
          res.setHeader('Connection', 'keep-alive')
          res.setHeader('X-Accel-Buffering', 'no')
          res.write(`data: ${JSON.stringify({ type: 'complete', tree: normalizedTree, modelUsed: 'Haiku (settings template)' })}\n\n`)
          res.write('data: [DONE]\n\n')
          return res.end()
        }
        return res.status(200).json({ tree: normalizedTree, modelUsed: 'Haiku (settings template)' })
      } catch { /* Fall through */ }
    }
  }

  // --- Helper: call Haiku for template content + assemble + return ---
  async function runTemplate(
    templateName: string, systemPrompt: string, maxTok: number,
    buildTree: (content: any) => any
  ): Promise<boolean> {
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'prompt-caching-2024-07-31' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTok, system: [{ type: 'text', text: systemPrompt }], messages: [{ role: 'user', content: cleanPrompt }] }),
      })
      if (!resp.ok) return false
      const data = await resp.json() as any
      const text = data.content?.[0]?.text || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      const content = JSON.parse(jsonMatch ? jsonMatch[0] : text)
      const tree = buildTree(content)
      const expanded = expandComponents(tree)
      const normalized = normalizeComponentTree(expanded, normalizerOpts)
      logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: 'claude-haiku-4-5-20251001', tokensIn: data.usage?.input_tokens || 0, tokensOut: data.usage?.output_tokens || 0, generationType, promptPreview: prompt, success: true })
      if (!user.isMCP) await deductCredits(user.id, creditType, user.email)
      const wantsStream = req.headers['accept'] === 'text/event-stream' || req.query?.stream === 'true'
      if (wantsStream) {
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.setHeader('X-Accel-Buffering', 'no')
        res.write(`data: ${JSON.stringify({ type: 'complete', tree: normalized, modelUsed: `Haiku (${templateName} template)` })}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
        return true
      }
      res.status(200).json({ tree: normalized, modelUsed: `Haiku (${templateName} template)` })
      return true
    } catch { return false }
  }

  // --- PROFILE TEMPLATE ---
  const isProfileTemplate = screenType === 'profile' && !isEditMode && !hasImage && !isRegenerate
  if (isProfileTemplate) {
    const sent = await runTemplate('profile',
      `You generate content for a mobile social media profile screen. Return ONLY a JSON object:
{"username":"alex.design","displayName":"Alex Chen","bio":"Photographer & Designer. Creating visual stories through light and color.","link":"linktr.ee/alexdesign","posts":"284","followers":"12.5K","following":"891","photos":["urban architecture photography","portrait studio lighting","sunset landscape ocean","street photography black white","minimal interior design","nature macro flower"]}

Rules:
- username: lowercase with dots/underscores, match user request
- displayName: realistic full name
- bio: 1-2 lines max, match the persona
- link: realistic link
- posts/followers/following: realistic numbers (use K for thousands)
- photos: exactly 6 searchQuery strings (5-7 words each) for the photo grid
- Return ONLY JSON, no markdown`, 500,
      (c: any) => ({
        type: 'View',
        style: { flex: 1, backgroundColor: '#0F172A', paddingTop: 54 },
        children: [
          // Header
          { type: 'View', style: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44 }, children: [
            { type: 'TouchableOpacity', style: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, children: [{ type: 'Icon', props: { name: 'lock', size: 18, color: '#FFFFFF' } }] },
            { type: 'Text', style: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' }, children: [c.username || 'user'] },
            { type: 'TouchableOpacity', style: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, children: [{ type: 'Icon', props: { name: 'menu', size: 20, color: '#FFFFFF' } }] },
          ]},
          // Avatar + stats
          { type: 'View', style: { paddingHorizontal: 16, paddingTop: 12 }, children: [
            { type: 'View', style: { flexDirection: 'row', alignItems: 'center' }, children: [
              { type: 'AvatarCircle', props: { name: c.displayName || 'User', size: 80 } },
              { type: 'View', style: { flex: 1, marginLeft: 24 }, children: [
                { type: 'ProfileStats', props: { stats: [{ value: c.posts || '0', label: 'Posts' }, { value: c.followers || '0', label: 'Followers' }, { value: c.following || '0', label: 'Following' }] } },
              ]},
            ]},
            // Name + bio
            { type: 'Text', style: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginTop: 12 }, children: [c.displayName || 'User'] },
            { type: 'Text', style: { fontSize: 14, color: '#CBD5E1', marginTop: 4, lineHeight: 20 }, children: [c.bio || ''] },
            ...(c.link ? [{ type: 'Text', style: { fontSize: 14, color: '#818CF8', marginTop: 2 }, children: [c.link] }] : []),
            // Action buttons
            { type: 'View', style: { flexDirection: 'row', gap: 8, marginTop: 12 }, children: [
              { type: 'View', style: { flex: 1 }, children: [{ type: 'Button', props: { text: 'Follow', variant: 'primary', size: 'sm' } }] },
              { type: 'View', style: { flex: 1 }, children: [{ type: 'Button', props: { text: 'Message', variant: 'secondary', size: 'sm' } }] },
              { type: 'TouchableOpacity', style: { width: 36, height: 36, backgroundColor: '#1E293B', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, children: [{ type: 'Icon', props: { name: 'person_add', size: 16, color: '#FFFFFF' } }] },
            ]},
          ]},
          // Tab bar
          { type: 'TabBar', props: { tabs: [{ label: 'Posts', active: true }, { label: 'Reels' }, { label: 'Tagged' }] } },
          // Photo grid
          { type: 'View', style: { flexDirection: 'row', flexWrap: 'wrap' }, children: (Array.isArray(c.photos) ? c.photos : []).slice(0, 6).map((q: string) => ({
            type: 'Image', style: { width: '33.33%', aspectRatio: 1 }, props: { searchQuery: q },
          }))},
        ],
      })
    )
    if (sent) return
  }

  // --- ONBOARDING TEMPLATE ---
  const isOnboardingTemplate = screenType === 'onboarding' && !isEditMode && !hasImage && !isRegenerate
  if (isOnboardingTemplate) {
    const sent = await runTemplate('onboarding',
      `You generate content for a mobile onboarding/welcome screen. Return ONLY a JSON object:
{"appName":"AppName","icon":"rocket_launch","title":"Welcome to AppName","subtitle":"Discover amazing features and get started in seconds.","ctaText":"Get Started","footerText":"Already have an account?","footerAction":"Sign In","features":[{"icon":"bolt","title":"Fast & Easy"},{"icon":"lock","title":"Secure"},{"icon":"favorite","title":"Personalized"}]}

Rules:
- appName: match user request or generate realistic name
- icon: Material Symbols icon name for the hero icon
- title: bold welcome headline (max 6 words)
- subtitle: 1-2 lines explaining the app value (max 80 chars)
- ctaText: action button text
- features: 3 feature highlights with icon + short title (2-3 words)
- Return ONLY JSON, no markdown`, 400,
      (c: any) => ({
        type: 'View',
        style: { flex: 1, backgroundColor: '#0F172A', paddingTop: 54, paddingBottom: 34, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' },
        children: [
          { type: 'View', style: { flex: 1 } },
          // Hero icon
          { type: 'View', style: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(108,92,231,0.15)', alignItems: 'center', justifyContent: 'center' }, children: [
            { type: 'Icon', props: { name: c.icon || 'rocket_launch', size: 36, color: '#6C5CE7' } },
          ]},
          // Title
          { type: 'Text', style: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginTop: 24 }, children: [c.title || 'Welcome'] },
          // Subtitle
          { type: 'Text', style: { fontSize: 16, color: '#94A3B8', textAlign: 'center', marginTop: 8, lineHeight: 24, paddingHorizontal: 16 }, children: [c.subtitle || 'Get started with our app'] },
          // Feature highlights
          ...(Array.isArray(c.features) ? [{
            type: 'View', style: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 32 }, children: c.features.slice(0, 3).map((f: any) => ({
              type: 'View', style: { alignItems: 'center', gap: 8 }, children: [
                { type: 'View', style: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' }, children: [
                  { type: 'Icon', props: { name: f.icon || 'star', size: 22, color: '#6C5CE7' } },
                ]},
                { type: 'Text', style: { fontSize: 12, fontWeight: '500', color: '#94A3B8' }, children: [f.title || 'Feature'] },
              ],
            })),
          }] : []),
          // Pagination dots
          { type: 'View', style: { flexDirection: 'row', gap: 6, marginTop: 32 }, children: [
            { type: 'View', style: { width: 24, height: 6, borderRadius: 4, backgroundColor: '#6C5CE7' } },
            { type: 'View', style: { width: 6, height: 6, borderRadius: 4, backgroundColor: '#2A2A3E' } },
            { type: 'View', style: { width: 6, height: 6, borderRadius: 4, backgroundColor: '#2A2A3E' } },
          ]},
          { type: 'View', style: { flex: 1 } },
          // CTA button
          { type: 'View', style: { width: '100%' }, children: [{ type: 'Button', props: { text: c.ctaText || 'Get Started', variant: 'primary', size: 'lg' } }] },
          // Footer
          { type: 'View', style: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 16 }, children: [
            { type: 'Text', style: { fontSize: 14, color: '#6B6B80' }, children: [c.footerText || 'Already have an account?'] },
            { type: 'TouchableOpacity', children: [{ type: 'Text', style: { fontSize: 14, fontWeight: '600', color: '#6C5CE7' }, children: [c.footerAction || 'Sign In'] }] },
          ]},
        ],
      })
    )
    if (sent) return
  }

  // --- MUSIC PLAYER TEMPLATE ---
  const isMusicTemplate = screenType === 'music' && !isEditMode && !hasImage && !isRegenerate
  if (isMusicTemplate) {
    const sent = await runTemplate('music',
      `You generate content for a mobile music player screen. Return ONLY a JSON object:
{"title":"Midnight Dreams","artist":"Luna Echo","albumArt":"album cover dark moody neon aesthetic","currentTime":"2:34","totalTime":"4:18","isPlaying":true,"upNext":[{"title":"Neon Lights","artist":"The Weeknd","duration":"3:42"},{"title":"Blinding Lights","artist":"The Weeknd","duration":"3:20"},{"title":"After Hours","artist":"The Weeknd","duration":"6:01"}],"playlist":"Chill Vibes 2024"}

Rules:
- title/artist: realistic song and artist names matching user request
- albumArt: searchQuery string (5-7 words) for album artwork image
- currentTime/totalTime: realistic timestamps
- upNext: 3 songs with title, artist, duration
- playlist: name of the current playlist/album
- Return ONLY JSON, no markdown`, 500,
      (c: any) => {
        const progress = (() => { try { const [cm, cs] = (c.currentTime||'2:00').split(':').map(Number); const [tm, ts] = (c.totalTime||'4:00').split(':').map(Number); return (cm*60+cs)/(tm*60+ts) } catch { return 0.4 } })()
        return {
          type: 'View',
          style: { flex: 1, backgroundColor: '#0A0A1A', paddingTop: 54, paddingBottom: 34 },
          children: [
            // Header
            { type: 'View', style: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44 }, children: [
              { type: 'TouchableOpacity', style: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, children: [{ type: 'Icon', props: { name: 'keyboard_arrow_down', size: 24, color: '#FFFFFF' } }] },
              { type: 'View', style: { alignItems: 'center' }, children: [
                { type: 'Text', style: { fontSize: 11, fontWeight: '500', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }, children: ['NOW PLAYING'] },
                { type: 'Text', style: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' }, children: [c.playlist || 'Playlist'] },
              ]},
              { type: 'TouchableOpacity', style: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, children: [{ type: 'Icon', props: { name: 'more_vert', size: 20, color: '#FFFFFF' } }] },
            ]},
            // Album art
            { type: 'View', style: { paddingHorizontal: 32, marginTop: 16 }, children: [
              { type: 'Image', style: { width: '100%', aspectRatio: 1, borderRadius: 16 }, props: { searchQuery: c.albumArt || 'album cover dark aesthetic music' } },
            ]},
            // Track info
            { type: 'View', style: { paddingHorizontal: 32, marginTop: 20 }, children: [
              { type: 'View', style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, children: [
                { type: 'View', style: { flex: 1 }, children: [
                  { type: 'Text', style: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' }, children: [c.title || 'Song Title'] },
                  { type: 'Text', style: { fontSize: 14, color: '#94A3B8', marginTop: 2 }, children: [c.artist || 'Artist'] },
                ]},
                { type: 'TouchableOpacity', children: [{ type: 'Icon', props: { name: 'favorite', size: 22, color: '#EF4444' } }] },
              ]},
            ]},
            // Progress bar
            { type: 'View', style: { paddingHorizontal: 32, marginTop: 16 }, children: [
              { type: 'ProgressBar', props: { progress, color: '#6C5CE7' } },
              { type: 'View', style: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }, children: [
                { type: 'Text', style: { fontSize: 11, color: '#6B6B80' }, children: [c.currentTime || '0:00'] },
                { type: 'Text', style: { fontSize: 11, color: '#6B6B80' }, children: [c.totalTime || '0:00'] },
              ]},
            ]},
            // Controls
            { type: 'View', style: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32, marginTop: 16 }, children: [
              { type: 'TouchableOpacity', children: [{ type: 'Icon', props: { name: 'shuffle', size: 22, color: '#6B6B80' } }] },
              { type: 'TouchableOpacity', children: [{ type: 'Icon', props: { name: 'skip_previous', size: 32, color: '#FFFFFF' } }] },
              { type: 'TouchableOpacity', style: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#6C5CE7', alignItems: 'center', justifyContent: 'center' }, children: [
                { type: 'Icon', props: { name: c.isPlaying ? 'pause' : 'play_arrow', size: 28, color: '#FFFFFF' } },
              ]},
              { type: 'TouchableOpacity', children: [{ type: 'Icon', props: { name: 'skip_next', size: 32, color: '#FFFFFF' } }] },
              { type: 'TouchableOpacity', children: [{ type: 'Icon', props: { name: 'repeat', size: 22, color: '#6B6B80' } }] },
            ]},
            // Up Next
            { type: 'View', style: { marginTop: 20, paddingHorizontal: 24 }, children: [
              { type: 'SectionHeader', props: { title: 'Up Next', actionText: 'See All' } },
              ...(Array.isArray(c.upNext) ? c.upNext.slice(0, 3).map((song: any) => ({
                type: 'View', style: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }, children: [
                  { type: 'View', style: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, children: [
                    { type: 'Icon', props: { name: 'music_note', size: 18, color: '#6B6B80' } },
                  ]},
                  { type: 'View', style: { flex: 1 }, children: [
                    { type: 'Text', style: { fontSize: 14, fontWeight: '500', color: '#FFFFFF' }, children: [song.title || 'Song'] },
                    { type: 'Text', style: { fontSize: 12, color: '#6B6B80' }, children: [song.artist || 'Artist'] },
                  ]},
                  { type: 'Text', style: { fontSize: 12, color: '#6B6B80' }, children: [song.duration || '0:00'] },
                ],
              })) : []),
            ]},
          ],
        }
      }
    )
    if (sent) return
  }

  // --- FOOD DELIVERY TEMPLATE ---
  const isFoodTemplate = screenType === 'food' && !isEditMode && !hasImage && !isRegenerate
  if (isFoodTemplate) {
    const sent = await runTemplate('food',
      `You generate content for a mobile food delivery app screen. Return ONLY a JSON object:
{"appName":"FoodExpress","location":"New York, NY","promoTitle":"50% Off Pizza","promoSubtitle":"On orders above $30","categories":[{"label":"Pizza","icon":"local_pizza"},{"label":"Burgers","icon":"lunch_dining"},{"label":"Sushi","icon":"set_meal"},{"label":"Desserts","icon":"cake"},{"label":"Drinks","icon":"local_cafe"}],"featured":[{"title":"Margherita Supreme","image":"margherita pizza fresh basil mozzarella","price":"$18.90","rating":"4.8"},{"title":"Classic Burger","image":"gourmet cheeseburger brioche bun","price":"$14.50","rating":"4.6"}],"popular":[{"title":"Pad Thai","image":"thai pad thai noodles shrimp","price":"$16.90","rating":"4.7"},{"title":"Caesar Salad","image":"caesar salad croutons parmesan","price":"$12.50","rating":"4.5"}]}

Rules:
- appName/location: match user request, default to US city
- promoTitle/promoSubtitle: realistic promo, USD prices
- categories: 5 food categories with Material Symbols icons
- featured: 2 items with searchQuery for image (5-7 words), USD price, rating
- popular: 2 more items, same format
- ALL prices in USD ($)
- Return ONLY JSON, no markdown`, 800,
      (c: any) => ({
        type: 'View',
        style: { flex: 1, backgroundColor: '#0F172A', paddingTop: 54 },
        children: [
          // Header
          { type: 'View', style: { paddingHorizontal: 16, paddingTop: 8 }, children: [
            { type: 'View', style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, children: [
              { type: 'View', children: [
                { type: 'Text', style: { fontSize: 12, color: '#94A3B8' }, children: ['Deliver to'] },
                { type: 'View', style: { flexDirection: 'row', alignItems: 'center', gap: 4 }, children: [
                  { type: 'Icon', props: { name: 'location_on', size: 16, color: '#EF4444' } },
                  { type: 'Text', style: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' }, children: [c.location || 'New York, NY'] },
                ]},
              ]},
              { type: 'AvatarCircle', props: { name: 'User', size: 36 } },
            ]},
            // Search
            { type: 'SearchBar', props: { placeholder: `Search ${c.appName || 'restaurants'}...` } },
          ]},
          // Scrollable content
          { type: 'ScrollView', style: { flex: 1 }, props: { showsVerticalScrollIndicator: false }, children: [
            // Promo
            { type: 'View', style: { paddingHorizontal: 16, marginTop: 16 }, children: [
              { type: 'PromoCard', props: { title: c.promoTitle || '50% Off', subtitle: c.promoSubtitle || 'On orders above $30', buttonText: 'Order Now', color: '#EF4444' } },
            ]},
            // Categories
            ...(Array.isArray(c.categories) ? [{ type: 'View', style: { paddingHorizontal: 16, marginTop: 20 }, children: [
              { type: 'ChipSelector', props: { chips: c.categories.slice(0, 5).map((cat: any, i: number) => ({ label: cat.label || 'Category', active: i === 0 })) } },
            ]}] : []),
            // Featured
            { type: 'View', style: { paddingHorizontal: 16, marginTop: 20 }, children: [
              { type: 'SectionHeader', props: { title: 'Featured', actionText: 'See All' } },
              { type: 'View', style: { flexDirection: 'row', gap: 12 }, children: (Array.isArray(c.featured) ? c.featured : []).slice(0, 2).map((item: any) => ({
                type: 'ProductCard', props: { image: item.image || 'food photography', title: item.title || 'Dish', price: item.price || '$0', rating: item.rating || '4.5' },
              }))},
            ]},
            // Popular
            { type: 'View', style: { paddingHorizontal: 16, marginTop: 20 }, children: [
              { type: 'SectionHeader', props: { title: 'Popular Right Now', actionText: 'See All' } },
              { type: 'View', style: { flexDirection: 'row', gap: 12 }, children: (Array.isArray(c.popular) ? c.popular : []).slice(0, 2).map((item: any) => ({
                type: 'ProductCard', props: { image: item.image || 'food photography', title: item.title || 'Dish', price: item.price || '$0', rating: item.rating || '4.5' },
              }))},
            ]},
            { type: 'View', style: { height: 16 } },
          ]},
          // Bottom nav
          { type: 'BottomNav', props: { items: [{ icon: 'home', label: 'Home', active: true }, { icon: 'search', label: 'Browse' }, { icon: 'shopping_cart', label: 'Cart' }, { icon: 'person', label: 'Account' }] } },
        ],
      })
    )
    if (sent) return
  }

  const modelLabel = model.includes('sonnet') ? 'Sonnet' : 'Haiku'
  const apiPayload = {
    model,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: systemPromptText,
        cache_control: { type: 'ephemeral', ttl: '1h' },
      },
    ],
    messages: buildMessages(conversationHistory, userContent),
  }

  // --- SSE streaming path ---
  const wantsStream = req.headers['accept'] === 'text/event-stream' || req.query?.stream === 'true'

  if (wantsStream) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'prompt-caching-2024-07-31',
        },
        body: JSON.stringify({ ...apiPayload, stream: true }),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        console.error('Anthropic streaming API error:', response.status, errorBody)
        // Try to extract token usage from error response (Anthropic charges for input even on errors)
        let errorUsage: any = null
        try { errorUsage = JSON.parse(errorBody)?.usage } catch {}
        logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: model, tokensIn: errorUsage?.input_tokens, tokensOut: errorUsage?.output_tokens, cacheReadTokens: errorUsage?.cache_read_input_tokens, cacheCreationTokens: errorUsage?.cache_creation_input_tokens, generationType, promptPreview: prompt, success: false })
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to generate screen' })}\n\n`)
        return res.end()
      }

      const reader = response.body as any
      if (!reader || typeof reader[Symbol.asyncIterator] !== 'function') {
        // Fallback: read entire body if not iterable (shouldn't happen)
        const text = await response.text()
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Streaming not supported in this environment' })}\n\n`)
        return res.end()
      }

      let fullText = ''
      let inputTokens = 0
      let outputTokens = 0
      let cacheReadTokens = 0
      let cacheCreationTokens = 0
      const decoder = new TextDecoder()
      let sseBuffer = ''
      let lastPartialTreeLen = 0

      for await (const chunk of reader) {
        const text = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true })
        sseBuffer += text

        // Parse SSE events from Anthropic's streaming format
        const lines = sseBuffer.split('\n')
        sseBuffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (!data || data === '[DONE]') continue

          try {
            const event = JSON.parse(data)

            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              const deltaText = event.delta.text
              fullText += deltaText
              // Forward text chunk to client
              res.write(`data: ${JSON.stringify({ type: 'text', content: deltaText })}\n\n`)

              // Every ~500 chars, attempt to parse a partial tree
              if (fullText.length - lastPartialTreeLen >= 500) {
                const partialTree = attemptPartialTreeParse(fullText)
                if (partialTree) {
                  res.write(`data: ${JSON.stringify({ type: 'partial_tree', tree: partialTree })}\n\n`)
                  lastPartialTreeLen = fullText.length
                }
              }
            } else if (event.type === 'message_delta' && event.usage) {
              outputTokens = event.usage.output_tokens || 0
            } else if (event.type === 'message_start' && event.message?.usage) {
              inputTokens = event.message.usage.input_tokens || 0
              cacheReadTokens = event.message.usage.cache_read_input_tokens || 0
              cacheCreationTokens = event.message.usage.cache_creation_input_tokens || 0
            }
          } catch {
            // Skip unparseable SSE lines
          }
        }
      }

      // Stream complete — parse the full response into a component tree
      if (!fullText) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Empty response from AI service' })}\n\n`)
        return res.end()
      }

      try {
        // Extract design brief from two-phase response
        const { brief: designBrief, jsonText } = extractDesignBrief(fullText)
        let tree = repairJSON(jsonText || fullText)

        // Expand macro components (BottomNav, HeaderBar, etc.) into full subtrees
        tree = expandComponents(tree)

        // Normalize the component tree
        tree = normalizeComponentTree(tree, normalizerOpts)

        // Structural validation for screenshot recreation
        const validation = validateStructuralFidelity(tree)

        // Deduct credits after successful generation
        if (!user.isMCP) {
          await deductCredits(user.id, creditType, user.email)
          // Deduct extra credits for free-tier Sonnet upgrade (2x total)
          if (freeTierSonnetUpgrade) {
            await deductCredits(user.id, creditType, user.email)
          }
        }

        res.write(`data: ${JSON.stringify({ type: 'complete', tree, modelUsed: modelLabel, ...(designBrief ? { designBrief } : {}), ...(validation.issues.length > 0 ? { structuralWarnings: validation.issues } : {}) })}\n\n`)

        // Usage logging with cache metrics
        logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: model, tokensIn: inputTokens, tokensOut: outputTokens, cacheReadTokens, cacheCreationTokens, generationType, promptPreview: prompt, success: true })

        // Edit diff capture
        if (currentScreen && (generationType === 'edit' || generationType === 'variation' || generationType === 'regenerate')) {
          const editType = generationType === 'edit' ? 'ai_edit' : generationType
          logEditDiff({ userId: user.id, projectId: projectId || undefined, screenId: screenId || undefined, editType: editType as 'ai_edit' | 'variation' | 'regenerate', prompt, treeBefore: currentScreen, treeAfter: tree, modelUsed: model })
        }
      } catch (jsonErr) {
        console.error('JSON repair failed on stream. Raw start:', fullText.slice(0, 500))
        // Log the cost even though generation failed — tokens were consumed
        logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: model, tokensIn: inputTokens, tokensOut: outputTokens, cacheReadTokens, cacheCreationTokens, generationType, promptPreview: prompt, success: false })
        res.write(`data: ${JSON.stringify({ type: 'error', message: `AI returned invalid JSON. Raw start: ${fullText.slice(0, 100)}` })}\n\n`)
      }

      res.write('data: [DONE]\n\n')
      return res.end()
    } catch (err) {
      console.error('Streaming generate error:', err)
      const message = err instanceof Error ? err.message : String(err)
      logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: model, generationType, promptPreview: prompt, success: false })
      res.write(`data: ${JSON.stringify({ type: 'error', message: `Failed to generate screen: ${message}` })}\n\n`)
      return res.end()
    }
  }

  // --- Non-streaming path (backward compatible for MCP / variations) ---
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(apiPayload),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('Anthropic API error:', response.status, errorBody)
      let errorUsage: any = null
      try { errorUsage = JSON.parse(errorBody)?.usage } catch {}
      logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: model, tokensIn: errorUsage?.input_tokens, tokensOut: errorUsage?.output_tokens, cacheReadTokens: errorUsage?.cache_read_input_tokens, cacheCreationTokens: errorUsage?.cache_creation_input_tokens, generationType, promptPreview: prompt, success: false })
      return res.status(502).json({ error: 'Failed to generate screen' })
    }

    let data: any
    try {
      data = await response.json()
    } catch (parseErr) {
      console.error('Failed to parse Anthropic response as JSON')
      logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: model, generationType, promptPreview: prompt, success: false })
      return res.status(502).json({ error: 'Invalid response from AI service' })
    }

    const text: string = data.content?.[0]?.text ?? ''
    if (!text) {
      logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: model, tokensIn: data.usage?.input_tokens, tokensOut: data.usage?.output_tokens, cacheReadTokens: data.usage?.cache_read_input_tokens, cacheCreationTokens: data.usage?.cache_creation_input_tokens, generationType, promptPreview: prompt, success: false })
      return res.status(502).json({ error: 'Empty response from AI service' })
    }

    // Extract design brief from two-phase response
    const { brief: designBrief, jsonText } = extractDesignBrief(text)

    let tree: any
    try {
      tree = repairJSON(jsonText || text)
    } catch (jsonErr) {
      console.error('JSON repair failed. Raw start:', text.slice(0, 500))
      logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: model, tokensIn: data.usage?.input_tokens, tokensOut: data.usage?.output_tokens, cacheReadTokens: data.usage?.cache_read_input_tokens, cacheCreationTokens: data.usage?.cache_creation_input_tokens, generationType, promptPreview: prompt, success: false })
      return res.status(502).json({ error: `AI returned invalid JSON. Raw start: ${text.slice(0, 100)}` })
    }

    // Expand macro components (BottomNav, HeaderBar, etc.) into full subtrees
    tree = expandComponents(tree)

    // Normalize the component tree
    tree = normalizeComponentTree(tree, normalizerOpts)

    // Structural validation for screenshot recreation
    const validation = validateStructuralFidelity(tree)

    // Deduct credits after successful generation
    if (!user.isMCP) {
      await deductCredits(user.id, creditType, user.email)
      // Deduct extra credits for free-tier Sonnet upgrade (2x total)
      if (freeTierSonnetUpgrade) {
        await deductCredits(user.id, creditType, user.email)
      }
    }

    logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: model, tokensIn: data.usage?.input_tokens, tokensOut: data.usage?.output_tokens, cacheReadTokens: data.usage?.cache_read_input_tokens, cacheCreationTokens: data.usage?.cache_creation_input_tokens, generationType, promptPreview: prompt, success: true })

    if (currentScreen && (generationType === 'edit' || generationType === 'variation' || generationType === 'regenerate')) {
      const editType = generationType === 'edit' ? 'ai_edit' : generationType
      logEditDiff({ userId: user.id, projectId: projectId || undefined, screenId: screenId || undefined, editType: editType as 'ai_edit' | 'variation' | 'regenerate', prompt, treeBefore: currentScreen, treeAfter: tree, modelUsed: model })
    }

    return res.status(200).json({
      tree,
      modelUsed: modelLabel,
      ...(designBrief ? { designBrief } : {}),
      ...(validation.issues.length > 0 ? { structuralWarnings: validation.issues } : {}),
      ...(themeResult ? { theme: { category: themeResult.category, palette: themeResult.palette.name, isDarkMode: themeResult.isDarkMode } } : {}),
    })
  } catch (err) {
    console.error('Generate error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: `Failed to generate screen: ${message}` })
  }
}
