import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest, checkCredits, logUsage, logEditDiff, deductCredits, getUserPlan, getSupabaseConfig } from './auth-helper.js'
import { createClient } from '@supabase/supabase-js'
import { normalizeComponentTree, type NormalizerOptions } from './normalizer.js'
import { DESIGN_TOKENS, CONTENT_LIBRARY, COMPONENT_TYPES, VIEWPORT_BUDGET, CONTENT_DENSITY, PLATFORM_RULES, QUALITY_CHECKLIST } from './design-system.js'

// --- Few-shot examples (compact minified JSON) ---
// Each example is tagged with metadata for retrieval. JSON is minified to save tokens.
// ANCHOR examples (always included): EXAMPLE_DASHBOARD, EXAMPLE_SETTINGS
// Total examples per prompt: 3-4 max (~5000 tokens)

// Screen type: auth | Category: fitness | Patterns: centered vertical layout, logo + form + CTA + social login
const EXAMPLE_LOGIN = `--- EXAMPLE ---
User: "Create a modern login screen for a fitness app"
Component tree:
{"type":"View","style":{"flex":1,"backgroundColor":"#0A0A1A","paddingTop":54,"paddingBottom":34},"children":[{"type":"ScrollView","style":{"flex":1},"props":{"showsVerticalScrollIndicator":false},"children":[{"type":"View","style":{"paddingTop":64,"alignItems":"center","paddingHorizontal":24},"children":[{"type":"View","style":{"width":64,"height":64,"borderRadius":16,"backgroundColor":"#6C5CE7","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":28,"color":"#FFFFFF"},"children":["\\u26A1"]}]},{"type":"Text","style":{"fontSize":28,"fontWeight":"700","color":"#FFFFFF","marginTop":24,"textAlign":"center"},"children":["Welcome back, athlete"]},{"type":"Text","style":{"fontSize":14,"color":"#A0A0B8","marginTop":8,"textAlign":"center"},"children":["Sign in to crush your goals"]}]},{"type":"View","style":{"paddingHorizontal":24,"marginTop":40},"children":[{"type":"View","style":{"backgroundColor":"#222236","borderRadius":12,"height":48,"paddingHorizontal":16,"justifyContent":"center"},"children":[{"type":"TextInput","style":{"fontSize":16,"color":"#FFFFFF"},"props":{"placeholder":"Email","placeholderTextColor":"#6B6B80"}}]},{"type":"View","style":{"backgroundColor":"#222236","borderRadius":12,"height":48,"paddingHorizontal":16,"justifyContent":"center","marginTop":16},"children":[{"type":"TextInput","style":{"fontSize":16,"color":"#FFFFFF"},"props":{"placeholder":"Password","placeholderTextColor":"#6B6B80","secureTextEntry":true}}]},{"type":"TouchableOpacity","style":{"backgroundColor":"#6C5CE7","borderRadius":24,"height":48,"alignItems":"center","justifyContent":"center","marginTop":24},"children":[{"type":"Text","style":{"fontSize":16,"fontWeight":"700","color":"#FFFFFF"},"children":["Sign In"]}]},{"type":"Text","style":{"fontSize":14,"color":"#6C5CE7","textAlign":"center","marginTop":16},"children":["Forgot password?"]},{"type":"View","style":{"flexDirection":"row","alignItems":"center","marginTop":24},"children":[{"type":"View","style":{"flex":1,"height":1,"backgroundColor":"#2A2A3E"}},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80","marginHorizontal":16},"children":["or continue with"]},{"type":"View","style":{"flex":1,"height":1,"backgroundColor":"#2A2A3E"}}]},{"type":"View","style":{"flexDirection":"row","justifyContent":"center","gap":16,"marginTop":24},"children":[{"type":"View","style":{"width":48,"height":48,"borderRadius":9999,"backgroundColor":"#1A1A2E","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20},"children":["G"]}]},{"type":"View","style":{"width":48,"height":48,"borderRadius":9999,"backgroundColor":"#1A1A2E","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uF8FF"]}]}]},{"type":"View","style":{"flexDirection":"row","justifyContent":"center","marginTop":32},"children":[{"type":"Text","style":{"fontSize":14,"color":"#A0A0B8"},"children":["Don't have an account? "]},{"type":"Text","style":{"fontSize":14,"fontWeight":"600","color":"#6C5CE7"},"children":["Sign Up"]}]}]}]}]}
--- END EXAMPLE ---`

// Screen type: dashboard | Category: fitness | Patterns: hero stat, horizontal cards, compact layout, bottom tabs
// ANCHOR EXAMPLE — always included to establish dashboard/data-display quality bar
const EXAMPLE_DASHBOARD = `--- EXAMPLE ---
User: "Create a fitness dashboard home screen"
NOTE: This dashboard fits in ONE viewport (~600px content). No ScrollView. Compact spacing (12-16px between sections). Stat cards in a horizontal row.
Component tree:
{"type":"View","style":{"flex":1,"backgroundColor":"#0A0A1A","paddingTop":54},"children":[{"type":"View","style":{"flex":1,"paddingHorizontal":20},"children":[{"type":"View","style":{"flexDirection":"row","justifyContent":"space-between","alignItems":"center","paddingTop":12},"children":[{"type":"View","children":[{"type":"Text","style":{"fontSize":14,"color":"#6B6B80"},"children":["Good morning"]},{"type":"Text","style":{"fontSize":24,"fontWeight":"600","color":"#FFFFFF","marginTop":2},"children":["Sarah"]}]},{"type":"View","style":{"width":40,"height":40,"borderRadius":9999,"backgroundColor":"#6C5CE7","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":17,"fontWeight":"600","color":"#FFFFFF"},"children":["S"]}]}]},{"type":"View","style":{"flexDirection":"row","gap":12,"marginTop":16},"children":[{"type":"View","style":{"flex":1,"backgroundColor":"#12121F","borderRadius":12,"padding":12,"height":80,"justifyContent":"center","alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":17},"children":["\\uD83D\\uDC5F"]},{"type":"Text","style":{"fontSize":20,"fontWeight":"700","color":"#FFFFFF","marginTop":4},"children":["8,450"]},{"type":"Text","style":{"fontSize":11,"color":"#6B6B80","marginTop":2},"children":["steps"]}]},{"type":"View","style":{"flex":1,"backgroundColor":"#12121F","borderRadius":12,"padding":12,"height":80,"justifyContent":"center","alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":17},"children":["\\uD83D\\uDD25"]},{"type":"Text","style":{"fontSize":20,"fontWeight":"700","color":"#FFFFFF","marginTop":4},"children":["342"]},{"type":"Text","style":{"fontSize":11,"color":"#6B6B80","marginTop":2},"children":["kcal"]}]},{"type":"View","style":{"flex":1,"backgroundColor":"#12121F","borderRadius":12,"padding":12,"height":80,"justifyContent":"center","alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":17},"children":["\\u2764\\uFE0F"]},{"type":"Text","style":{"fontSize":20,"fontWeight":"700","color":"#FFFFFF","marginTop":4},"children":["72"]},{"type":"Text","style":{"fontSize":11,"color":"#6B6B80","marginTop":2},"children":["bpm"]}]}]},{"type":"View","style":{"marginTop":16},"children":[{"type":"View","style":{"flexDirection":"row","justifyContent":"space-between","alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"600","color":"#FFFFFF"},"children":["Daily Goal"]},{"type":"Text","style":{"fontSize":14,"fontWeight":"600","color":"#6C5CE7"},"children":["82%"]}]},{"type":"View","style":{"height":6,"backgroundColor":"#222236","borderRadius":12,"marginTop":8,"overflow":"hidden"},"children":[{"type":"View","style":{"width":"82%","height":6,"backgroundColor":"#6C5CE7","borderRadius":12}}]}]},{"type":"View","style":{"backgroundColor":"#12121F","borderRadius":12,"padding":16,"marginTop":16,"flexDirection":"row","alignItems":"center","gap":16},"children":[{"type":"View","style":{"width":48,"height":48,"borderRadius":12,"backgroundColor":"#1A1A2E","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":24},"children":["\\uD83C\\uDFCB\\uFE0F"]}]},{"type":"View","style":{"flex":1},"children":[{"type":"Text","style":{"fontSize":16,"fontWeight":"600","color":"#FFFFFF"},"children":["Morning HIIT"]},{"type":"Text","style":{"fontSize":13,"color":"#A0A0B8","marginTop":2},"children":["30 min \\u00B7 Intermediate"]}]},{"type":"TouchableOpacity","style":{"backgroundColor":"#6C5CE7","borderRadius":24,"paddingHorizontal":16,"height":36,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":13,"fontWeight":"700","color":"#FFFFFF"},"children":["Start"]}]}]},{"type":"View","style":{"marginTop":16},"children":[{"type":"View","style":{"flexDirection":"row","justifyContent":"space-between","alignItems":"center","marginBottom":12},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"600","color":"#FFFFFF"},"children":["Recent Activity"]},{"type":"Text","style":{"fontSize":13,"color":"#6C5CE7"},"children":["See All"]}]},{"type":"View","style":{"gap":8},"children":[{"type":"View","style":{"flexDirection":"row","alignItems":"center","backgroundColor":"#12121F","borderRadius":12,"padding":12,"height":52},"children":[{"type":"Text","style":{"fontSize":20,"marginRight":12},"children":["\\uD83C\\uDFC3"]},{"type":"View","style":{"flex":1},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"500","color":"#FFFFFF"},"children":["Evening Run"]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80"},"children":["5.2 km \\u00B7 342 cal"]}]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80"},"children":["Yesterday"]}]},{"type":"View","style":{"flexDirection":"row","alignItems":"center","backgroundColor":"#12121F","borderRadius":12,"padding":12,"height":52},"children":[{"type":"Text","style":{"fontSize":20,"marginRight":12},"children":["\\uD83E\\uDDD8"]},{"type":"View","style":{"flex":1},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"500","color":"#FFFFFF"},"children":["Yoga Flow"]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80"},"children":["45 min \\u00B7 180 cal"]}]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80"},"children":["2d ago"]}]},{"type":"View","style":{"flexDirection":"row","alignItems":"center","backgroundColor":"#12121F","borderRadius":12,"padding":12,"height":52},"children":[{"type":"Text","style":{"fontSize":20,"marginRight":12},"children":["\\uD83D\\uDEB4"]},{"type":"View","style":{"flex":1},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"500","color":"#FFFFFF"},"children":["Cycling"]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80"},"children":["12 km \\u00B7 410 cal"]}]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80"},"children":["3d ago"]}]}]}]}]},{"type":"View","style":{"flexDirection":"row","backgroundColor":"#12121F","paddingTop":8,"paddingBottom":34,"paddingHorizontal":20,"justifyContent":"space-around","alignItems":"center","borderTopWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uD83C\\uDFE0"]},{"type":"Text","style":{"fontSize":11,"color":"#6C5CE7","marginTop":4},"children":["Home"]}]},{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\u26A1"]},{"type":"Text","style":{"fontSize":11,"color":"#6B6B80","marginTop":4},"children":["Activity"]}]},{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uD83C\\uDF4E"]},{"type":"Text","style":{"fontSize":11,"color":"#6B6B80","marginTop":4},"children":["Nutrition"]}]},{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uD83D\\uDC64"]},{"type":"Text","style":{"fontSize":11,"color":"#6B6B80","marginTop":4},"children":["Profile"]}]}]}]}
--- END EXAMPLE ---`

// Screen type: profile | Category: social | Patterns: avatar + stats row + action buttons + content tabs, horizontal data display
const EXAMPLE_PROFILE = `--- EXAMPLE ---
User: "Create a social media profile page"
Component tree:
{"type":"View","style":{"flex":1,"backgroundColor":"#0A0A1A","paddingTop":54},"children":[{"type":"View","style":{"flexDirection":"row","alignItems":"center","justifyContent":"space-between","paddingHorizontal":20,"height":44},"children":[{"type":"TouchableOpacity","style":{"width":44,"height":44,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20,"color":"#FFFFFF"},"children":["\\u2190"]}]},{"type":"Text","style":{"fontSize":17,"fontWeight":"600","color":"#FFFFFF"},"children":["Profile"]},{"type":"TouchableOpacity","style":{"width":44,"height":44,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20,"color":"#FFFFFF"},"children":["\\u2699"]}]}]},{"type":"ScrollView","style":{"flex":1},"props":{"showsVerticalScrollIndicator":false},"children":[{"type":"View","style":{"alignItems":"center","paddingTop":24},"children":[{"type":"View","style":{"width":80,"height":80,"borderRadius":9999,"backgroundColor":"#1A1A2E","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":34,"color":"#FFFFFF"},"children":["M"]}]},{"type":"Text","style":{"fontSize":20,"fontWeight":"700","color":"#FFFFFF","marginTop":16},"children":["Maya Chen"]},{"type":"Text","style":{"fontSize":14,"color":"#6B6B80","marginTop":4},"children":["@maya.creates"]},{"type":"Text","style":{"fontSize":14,"color":"#A0A0B8","marginTop":12,"textAlign":"center","paddingHorizontal":40},"children":["Coffee enthusiast. Currently exploring Tokyo"]}]},{"type":"View","style":{"flexDirection":"row","justifyContent":"space-around","paddingVertical":24,"marginHorizontal":20,"borderBottomWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":17,"fontWeight":"600","color":"#FFFFFF"},"children":["3,241"]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80","marginTop":4},"children":["Posts"]}]},{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":17,"fontWeight":"600","color":"#FFFFFF"},"children":["12.4K"]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80","marginTop":4},"children":["Followers"]}]},{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":17,"fontWeight":"600","color":"#FFFFFF"},"children":["892"]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80","marginTop":4},"children":["Following"]}]}]},{"type":"View","style":{"flexDirection":"row","gap":12,"paddingHorizontal":20,"marginTop":20},"children":[{"type":"TouchableOpacity","style":{"flex":1,"backgroundColor":"#6C5CE7","borderRadius":24,"height":44,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"700","color":"#FFFFFF"},"children":["Follow"]}]},{"type":"TouchableOpacity","style":{"flex":1,"backgroundColor":"#1A1A2E","borderRadius":24,"height":44,"alignItems":"center","justifyContent":"center","borderWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"600","color":"#FFFFFF"},"children":["Message"]}]}]},{"type":"View","style":{"flexDirection":"row","marginTop":24,"borderBottomWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"View","style":{"flex":1,"alignItems":"center","paddingBottom":12,"borderBottomWidth":3,"borderColor":"#6C5CE7"},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"500","color":"#6C5CE7"},"children":["Posts"]}]},{"type":"View","style":{"flex":1,"alignItems":"center","paddingBottom":12},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"500","color":"#6B6B80"},"children":["Reels"]}]},{"type":"View","style":{"flex":1,"alignItems":"center","paddingBottom":12},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"500","color":"#6B6B80"},"children":["Tagged"]}]}]},{"type":"View","style":{"flexDirection":"row","flexWrap":"wrap","gap":4,"padding":4,"paddingBottom":34},"children":[{"type":"View","style":{"width":"32.6%","aspectRatio":1,"backgroundColor":"#1A1A2E"}},{"type":"View","style":{"width":"32.6%","aspectRatio":1,"backgroundColor":"#222236"}},{"type":"View","style":{"width":"32.6%","aspectRatio":1,"backgroundColor":"#1A1A2E"}},{"type":"View","style":{"width":"32.6%","aspectRatio":1,"backgroundColor":"#222236"}},{"type":"View","style":{"width":"32.6%","aspectRatio":1,"backgroundColor":"#1A1A2E"}},{"type":"View","style":{"width":"32.6%","aspectRatio":1,"backgroundColor":"#222236"}}]}]}]}
--- END EXAMPLE ---`

// Screen type: settings | Category: utility | Patterns: section headers + grouped list items + toggles/chevrons, navigation rows
// ANCHOR EXAMPLE — always included to establish settings/form quality bar
const EXAMPLE_SETTINGS = `--- EXAMPLE ---
User: "Create an app settings screen"
Component tree:
{"type":"View","style":{"flex":1,"backgroundColor":"#0A0A1A","paddingTop":54},"children":[{"type":"View","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":20,"height":44},"children":[{"type":"TouchableOpacity","style":{"width":44,"height":44,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20,"color":"#FFFFFF"},"children":["\\u2190"]}]},{"type":"Text","style":{"fontSize":28,"fontWeight":"700","color":"#FFFFFF","marginLeft":8},"children":["Settings"]}]},{"type":"ScrollView","style":{"flex":1},"props":{"showsVerticalScrollIndicator":false},"children":[{"type":"TouchableOpacity","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":20,"paddingVertical":16,"marginTop":8},"children":[{"type":"View","style":{"width":48,"height":48,"borderRadius":9999,"backgroundColor":"#6C5CE7","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20,"fontWeight":"600","color":"#FFFFFF"},"children":["S"]}]},{"type":"View","style":{"flex":1,"marginLeft":16},"children":[{"type":"Text","style":{"fontSize":16,"fontWeight":"500","color":"#FFFFFF"},"children":["Sarah Mitchell"]},{"type":"Text","style":{"fontSize":13,"color":"#6B6B80","marginTop":4},"children":["sarah@email.com"]}]},{"type":"Text","style":{"fontSize":16,"color":"#6B6B80"},"children":["\\u203A"]}]},{"type":"View","style":{"marginTop":24,"paddingHorizontal":20},"children":[{"type":"Text","style":{"fontSize":13,"fontWeight":"500","color":"#6B6B80","textTransform":"uppercase","letterSpacing":1,"marginBottom":8},"children":["Account"]},{"type":"View","style":{"backgroundColor":"#12121F","borderRadius":12,"overflow":"hidden"},"children":[{"type":"View","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":16,"height":48,"borderBottomWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uD83D\\uDD14"]},{"type":"Text","style":{"flex":1,"fontSize":16,"color":"#FFFFFF","marginLeft":12},"children":["Notifications"]},{"type":"Switch","props":{"value":true,"trackColor":{"true":"#00B894","false":"#222236"},"thumbColor":"#FFFFFF"}}]},{"type":"TouchableOpacity","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":16,"height":48},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uD83D\\uDEE1"]},{"type":"Text","style":{"flex":1,"fontSize":16,"color":"#FFFFFF","marginLeft":12},"children":["Privacy & Security"]},{"type":"Text","style":{"fontSize":16,"color":"#6B6B80"},"children":["\\u203A"]}]}]}]},{"type":"View","style":{"marginTop":24,"paddingHorizontal":20},"children":[{"type":"Text","style":{"fontSize":13,"fontWeight":"500","color":"#6B6B80","textTransform":"uppercase","letterSpacing":1,"marginBottom":8},"children":["Preferences"]},{"type":"View","style":{"backgroundColor":"#12121F","borderRadius":12,"overflow":"hidden"},"children":[{"type":"TouchableOpacity","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":16,"height":48,"borderBottomWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uD83C\\uDFA8"]},{"type":"Text","style":{"flex":1,"fontSize":16,"color":"#FFFFFF","marginLeft":12},"children":["Appearance"]},{"type":"Text","style":{"fontSize":14,"color":"#6B6B80","marginRight":8},"children":["Dark"]},{"type":"Text","style":{"fontSize":16,"color":"#6B6B80"},"children":["\\u203A"]}]},{"type":"TouchableOpacity","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":16,"height":48,"borderBottomWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uD83C\\uDF10"]},{"type":"Text","style":{"flex":1,"fontSize":16,"color":"#FFFFFF","marginLeft":12},"children":["Language"]},{"type":"Text","style":{"fontSize":14,"color":"#6B6B80","marginRight":8},"children":["English"]},{"type":"Text","style":{"fontSize":16,"color":"#6B6B80"},"children":["\\u203A"]}]},{"type":"TouchableOpacity","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":16,"height":48},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uD83D\\uDCCA"]},{"type":"Text","style":{"flex":1,"fontSize":16,"color":"#FFFFFF","marginLeft":12},"children":["Data Usage"]},{"type":"Text","style":{"fontSize":16,"color":"#6B6B80"},"children":["\\u203A"]}]}]}]},{"type":"View","style":{"marginTop":24,"paddingHorizontal":20},"children":[{"type":"Text","style":{"fontSize":13,"fontWeight":"500","color":"#6B6B80","textTransform":"uppercase","letterSpacing":1,"marginBottom":8},"children":["Support"]},{"type":"View","style":{"backgroundColor":"#12121F","borderRadius":12,"overflow":"hidden"},"children":[{"type":"TouchableOpacity","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":16,"height":48,"borderBottomWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\u2753"]},{"type":"Text","style":{"flex":1,"fontSize":16,"color":"#FFFFFF","marginLeft":12},"children":["Help Center"]},{"type":"Text","style":{"fontSize":16,"color":"#6B6B80"},"children":["\\u203A"]}]},{"type":"TouchableOpacity","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":16,"height":48},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\u2139\\uFE0F"]},{"type":"Text","style":{"flex":1,"fontSize":16,"color":"#FFFFFF","marginLeft":12},"children":["About"]},{"type":"Text","style":{"fontSize":14,"color":"#6B6B80","marginRight":8},"children":["v2.1.0"]},{"type":"Text","style":{"fontSize":16,"color":"#6B6B80"},"children":["\\u203A"]}]}]}]},{"type":"View","style":{"marginTop":32,"paddingHorizontal":20,"paddingBottom":34},"children":[{"type":"TouchableOpacity","style":{"height":48,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":16,"fontWeight":"500","color":"#E17055"},"children":["Log Out"]}]}]}]}]}
--- END EXAMPLE ---`

// Screen type: product | Category: ecommerce | Patterns: hero image + metadata + size selector + sticky CTA, detail page layout
const EXAMPLE_PRODUCT = `--- EXAMPLE ---
User: "Create a product detail page for a shoe store"
Component tree:
{"type":"View","style":{"flex":1,"backgroundColor":"#0A0A1A"},"children":[{"type":"ScrollView","style":{"flex":1},"props":{"showsVerticalScrollIndicator":false},"children":[{"type":"View","style":{"height":280,"backgroundColor":"#1A1A2E","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":48},"children":["\\uD83D\\uDC5F"]},{"type":"View","style":{"position":"absolute","top":54,"left":16},"children":[{"type":"TouchableOpacity","style":{"width":44,"height":44,"borderRadius":9999,"backgroundColor":"rgba(0,0,0,0.3)","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20,"color":"#FFFFFF"},"children":["\\u2190"]}]}]}]},{"type":"View","style":{"paddingHorizontal":20,"paddingTop":20},"children":[{"type":"Text","style":{"fontSize":13,"color":"#6B6B80","textTransform":"uppercase","letterSpacing":1},"children":["Nike"]},{"type":"Text","style":{"fontSize":24,"fontWeight":"700","color":"#FFFFFF","marginTop":4},"children":["Air Max 270"]},{"type":"View","style":{"flexDirection":"row","alignItems":"center","marginTop":8,"gap":8},"children":[{"type":"Text","style":{"fontSize":24,"fontWeight":"700","color":"#6C5CE7"},"children":["$189.00"]},{"type":"View","style":{"flexDirection":"row","alignItems":"center","marginLeft":12},"children":[{"type":"Text","style":{"fontSize":14,"color":"#FDCB6E"},"children":["\\u2605 4.8"]},{"type":"Text","style":{"fontSize":14,"color":"#6C5CE7","marginLeft":4},"children":["(2.4k)"]}]}]}]},{"type":"View","style":{"paddingHorizontal":20,"marginTop":24},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"500","color":"#FFFFFF","marginBottom":12},"children":["Select Size"]},{"type":"View","style":{"flexDirection":"row","gap":8},"children":[{"type":"View","style":{"width":48,"height":44,"borderRadius":8,"backgroundColor":"#222236","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":14,"color":"#A0A0B8"},"children":["8"]}]},{"type":"View","style":{"width":48,"height":44,"borderRadius":8,"backgroundColor":"#6C5CE7","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"600","color":"#FFFFFF"},"children":["9"]}]},{"type":"View","style":{"width":48,"height":44,"borderRadius":8,"backgroundColor":"#222236","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":14,"color":"#A0A0B8"},"children":["10"]}]},{"type":"View","style":{"width":48,"height":44,"borderRadius":8,"backgroundColor":"#222236","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":14,"color":"#A0A0B8"},"children":["11"]}]}]}]},{"type":"View","style":{"paddingHorizontal":20,"marginTop":24,"paddingBottom":98},"children":[{"type":"Text","style":{"fontSize":17,"fontWeight":"600","color":"#FFFFFF"},"children":["About this product"]},{"type":"Text","style":{"fontSize":14,"color":"#A0A0B8","lineHeight":20,"marginTop":8},"children":["The Nike Air Max 270 delivers visible cushioning under every step. Updated for modern comfort."]}]}]},{"type":"View","style":{"position":"absolute","bottom":0,"left":0,"right":0,"backgroundColor":"#12121F","paddingHorizontal":20,"paddingTop":16,"paddingBottom":34,"flexDirection":"row","gap":12,"borderTopWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"TouchableOpacity","style":{"width":48,"height":48,"borderRadius":9999,"backgroundColor":"#1A1A2E","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\u2661"]}]},{"type":"TouchableOpacity","style":{"flex":1,"backgroundColor":"#6C5CE7","borderRadius":24,"height":48,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":16,"fontWeight":"700","color":"#FFFFFF"},"children":["Add to Cart"]}]}]}]}
--- END EXAMPLE ---`

// Screen type: chat | Category: messaging | Patterns: chat header + message bubbles + input bar, alternating alignment
const EXAMPLE_CHAT = `--- EXAMPLE ---
User: "Create a messaging chat screen"
Component tree:
{"type":"View","style":{"flex":1,"backgroundColor":"#0A0A1A","paddingTop":54},"children":[{"type":"View","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":20,"height":44,"borderBottomWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"TouchableOpacity","style":{"width":44,"height":44,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20,"color":"#FFFFFF"},"children":["\\u2190"]}]},{"type":"View","style":{"width":40,"height":40,"borderRadius":9999,"backgroundColor":"#6C5CE7","alignItems":"center","justifyContent":"center","marginLeft":8},"children":[{"type":"Text","style":{"fontSize":17,"fontWeight":"600","color":"#FFFFFF"},"children":["A"]}]},{"type":"View","style":{"flex":1,"marginLeft":12},"children":[{"type":"Text","style":{"fontSize":16,"fontWeight":"600","color":"#FFFFFF"},"children":["Alex Rivera"]},{"type":"Text","style":{"fontSize":12,"color":"#00B894"},"children":["Online"]}]},{"type":"TouchableOpacity","style":{"width":44,"height":44,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20,"color":"#A0A0B8"},"children":["\\u22EF"]}]}]},{"type":"ScrollView","style":{"flex":1},"props":{"showsVerticalScrollIndicator":false},"children":[{"type":"View","style":{"padding":20,"gap":16},"children":[{"type":"View","style":{"flexDirection":"row","gap":8,"maxWidth":"80%"},"children":[{"type":"View","style":{"width":32,"height":32,"borderRadius":9999,"backgroundColor":"#1A1A2E","alignItems":"center","justifyContent":"center","marginTop":4},"children":[{"type":"Text","style":{"fontSize":13,"fontWeight":"600","color":"#FFFFFF"},"children":["A"]}]},{"type":"View","children":[{"type":"View","style":{"backgroundColor":"#12121F","borderRadius":16,"borderTopLeftRadius":4,"padding":12},"children":[{"type":"Text","style":{"fontSize":14,"color":"#FFFFFF","lineHeight":20},"children":["Hey! Are we still meeting at 3pm today?"]}]},{"type":"Text","style":{"fontSize":11,"color":"#6B6B80","marginTop":4,"marginLeft":4},"children":["2:15 PM"]}]}]},{"type":"View","style":{"alignItems":"flex-end"},"children":[{"type":"View","style":{"backgroundColor":"#6C5CE7","borderRadius":16,"borderTopRightRadius":4,"padding":12,"maxWidth":"80%"},"children":[{"type":"Text","style":{"fontSize":14,"color":"#FFFFFF","lineHeight":20},"children":["Sure, let's meet at 3pm!"]}]},{"type":"Text","style":{"fontSize":11,"color":"#6B6B80","marginTop":4,"marginRight":4},"children":["2:18 PM \\u2713\\u2713"]}]}]}]},{"type":"View","style":{"paddingHorizontal":16,"paddingTop":12,"paddingBottom":34,"borderTopWidth":1,"borderColor":"#2A2A3E","flexDirection":"row","alignItems":"center","gap":8},"children":[{"type":"TouchableOpacity","style":{"width":44,"height":44,"borderRadius":9999,"backgroundColor":"#1A1A2E","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20},"children":["+"]}]},{"type":"View","style":{"flex":1,"backgroundColor":"#222236","borderRadius":24,"height":44,"paddingHorizontal":16,"justifyContent":"center"},"children":[{"type":"TextInput","style":{"fontSize":14,"color":"#FFFFFF"},"props":{"placeholder":"Type a message...","placeholderTextColor":"#6B6B80"}}]},{"type":"TouchableOpacity","style":{"width":44,"height":44,"borderRadius":9999,"backgroundColor":"#6C5CE7","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":16,"color":"#FFFFFF"},"children":["\\u27A4"]}]}]}]}
--- END EXAMPLE ---`

// Screen type: music | Category: media | Patterns: centered artwork + track info + playback controls + progress bar
const EXAMPLE_MUSIC = `--- EXAMPLE ---
User: "Create a music player now playing screen"
Component tree:
{"type":"View","style":{"flex":1,"backgroundColor":"#0A0A1A","paddingTop":54,"paddingBottom":34},"children":[{"type":"View","style":{"flexDirection":"row","alignItems":"center","justifyContent":"space-between","paddingHorizontal":20,"height":44},"children":[{"type":"TouchableOpacity","style":{"width":44,"height":44,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20,"color":"#FFFFFF"},"children":["\\u2193"]}]},{"type":"Text","style":{"fontSize":14,"fontWeight":"500","color":"#A0A0B8"},"children":["Now Playing"]},{"type":"TouchableOpacity","style":{"width":44,"height":44,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20,"color":"#A0A0B8"},"children":["\\u22EF"]}]}]},{"type":"View","style":{"flex":1,"justifyContent":"center","alignItems":"center","paddingHorizontal":32},"children":[{"type":"View","style":{"width":280,"height":280,"borderRadius":16,"backgroundColor":"#1A1A2E","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":48},"children":["\\uD83C\\uDFB5"]}]},{"type":"View","style":{"width":"100%","marginTop":32,"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":24,"fontWeight":"700","color":"#FFFFFF","textAlign":"center"},"children":["Midnight Blue"]},{"type":"Text","style":{"fontSize":16,"color":"#A0A0B8","marginTop":8},"children":["Luna Park"]}]},{"type":"View","style":{"width":"100%","marginTop":32},"children":[{"type":"View","style":{"height":4,"backgroundColor":"#222236","borderRadius":4,"overflow":"hidden"},"children":[{"type":"View","style":{"width":"35%","height":4,"backgroundColor":"#6C5CE7","borderRadius":4}}]},{"type":"View","style":{"flexDirection":"row","justifyContent":"space-between","marginTop":8},"children":[{"type":"Text","style":{"fontSize":12,"color":"#6B6B80"},"children":["1:16"]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80"},"children":["3:42"]}]}]},{"type":"View","style":{"flexDirection":"row","alignItems":"center","justifyContent":"center","gap":32,"marginTop":32},"children":[{"type":"TouchableOpacity","style":{"width":48,"height":48,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":24,"color":"#FFFFFF"},"children":["\\u23EE"]}]},{"type":"TouchableOpacity","style":{"width":64,"height":64,"borderRadius":9999,"backgroundColor":"#6C5CE7","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":28,"color":"#FFFFFF"},"children":["\\u25B6"]}]},{"type":"TouchableOpacity","style":{"width":48,"height":48,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":24,"color":"#FFFFFF"},"children":["\\u23ED"]}]}]}]}]}
--- END EXAMPLE ---`

// Screen type: food | Category: food delivery | Patterns: hero image + restaurant info + category tabs + menu items + cart bar
const EXAMPLE_FOOD = `--- EXAMPLE ---
User: "Create a food delivery restaurant detail screen"
Component tree:
{"type":"View","style":{"flex":1,"backgroundColor":"#0A0A1A"},"children":[{"type":"ScrollView","style":{"flex":1},"props":{"showsVerticalScrollIndicator":false},"children":[{"type":"View","style":{"height":200,"backgroundColor":"#1A1A2E","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":48},"children":["\\uD83C\\uDF5C"]},{"type":"View","style":{"position":"absolute","top":54,"left":16},"children":[{"type":"TouchableOpacity","style":{"width":44,"height":44,"borderRadius":9999,"backgroundColor":"rgba(0,0,0,0.3)","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20,"color":"#FFFFFF"},"children":["\\u2190"]}]}]}]},{"type":"View","style":{"paddingHorizontal":20,"paddingTop":20},"children":[{"type":"Text","style":{"fontSize":24,"fontWeight":"700","color":"#FFFFFF"},"children":["Sakura Ramen House"]},{"type":"Text","style":{"fontSize":14,"color":"#A0A0B8","marginTop":4},"children":["Japanese \\u00B7 Ramen \\u00B7 Noodles"]},{"type":"View","style":{"flexDirection":"row","gap":16,"marginTop":12},"children":[{"type":"Text","style":{"fontSize":13,"color":"#FDCB6E"},"children":["\\u2605 4.7"]},{"type":"Text","style":{"fontSize":13,"color":"#6B6B80"},"children":["25-35 min"]},{"type":"Text","style":{"fontSize":13,"color":"#6B6B80"},"children":["$2.99 delivery"]}]}]},{"type":"View","style":{"paddingHorizontal":20,"marginTop":24,"paddingBottom":98,"gap":16},"children":[{"type":"View","style":{"backgroundColor":"#12121F","borderRadius":12,"padding":16,"flexDirection":"row","gap":16},"children":[{"type":"View","style":{"width":80,"height":80,"borderRadius":12,"backgroundColor":"#1A1A2E","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":28},"children":["\\uD83C\\uDF5C"]}]},{"type":"View","style":{"flex":1},"children":[{"type":"Text","style":{"fontSize":16,"fontWeight":"600","color":"#FFFFFF"},"children":["Tonkotsu Ramen"]},{"type":"Text","style":{"fontSize":13,"color":"#6B6B80","marginTop":4},"children":["Rich pork bone broth, chashu, soft egg"]},{"type":"View","style":{"flexDirection":"row","justifyContent":"space-between","alignItems":"center","marginTop":8},"children":[{"type":"Text","style":{"fontSize":16,"fontWeight":"700","color":"#FFFFFF"},"children":["$16.00"]},{"type":"TouchableOpacity","style":{"width":44,"height":44,"borderRadius":9999,"backgroundColor":"#6C5CE7","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20,"color":"#FFFFFF"},"children":["+"]}]}]}]}]},{"type":"View","style":{"backgroundColor":"#12121F","borderRadius":12,"padding":16,"flexDirection":"row","gap":16},"children":[{"type":"View","style":{"width":80,"height":80,"borderRadius":12,"backgroundColor":"#1A1A2E","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":28},"children":["\\uD83E\\uDD5F"]}]},{"type":"View","style":{"flex":1},"children":[{"type":"Text","style":{"fontSize":16,"fontWeight":"600","color":"#FFFFFF"},"children":["Gyoza (6 pcs)"]},{"type":"Text","style":{"fontSize":13,"color":"#6B6B80","marginTop":4},"children":["Pan-fried pork dumplings"]},{"type":"View","style":{"flexDirection":"row","justifyContent":"space-between","alignItems":"center","marginTop":8},"children":[{"type":"Text","style":{"fontSize":16,"fontWeight":"700","color":"#FFFFFF"},"children":["$9.00"]},{"type":"TouchableOpacity","style":{"width":44,"height":44,"borderRadius":9999,"backgroundColor":"#6C5CE7","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20,"color":"#FFFFFF"},"children":["+"]}]}]}]}]}]}]},{"type":"View","style":{"position":"absolute","bottom":0,"left":0,"right":0,"backgroundColor":"#12121F","paddingHorizontal":20,"paddingTop":16,"paddingBottom":34,"flexDirection":"row","alignItems":"center","justifyContent":"space-between","borderTopWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"View","children":[{"type":"Text","style":{"fontSize":12,"color":"#6B6B80"},"children":["2 items"]},{"type":"Text","style":{"fontSize":17,"fontWeight":"700","color":"#FFFFFF","marginTop":4},"children":["$25.00"]}]},{"type":"TouchableOpacity","style":{"backgroundColor":"#6C5CE7","borderRadius":24,"paddingHorizontal":24,"height":48,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":16,"fontWeight":"700","color":"#FFFFFF"},"children":["View Cart"]}]}]}]}
--- END EXAMPLE ---`

// Screen type: onboarding | Category: utility | Patterns: centered illustration + headline + pagination dots + CTA
const EXAMPLE_ONBOARDING = `--- EXAMPLE ---
User: "Create an onboarding welcome screen"
Component tree:
{"type":"View","style":{"flex":1,"backgroundColor":"#0A0A1A","paddingTop":54,"paddingBottom":34},"children":[{"type":"View","style":{"flex":1,"justifyContent":"center","alignItems":"center","paddingHorizontal":32},"children":[{"type":"View","style":{"width":200,"height":200,"borderRadius":24,"backgroundColor":"rgba(108,92,231,0.1)","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":48},"children":["\\uD83D\\uDE80"]}]},{"type":"Text","style":{"fontSize":28,"fontWeight":"700","color":"#FFFFFF","textAlign":"center","marginTop":40},"children":["Discover Amazing Things"]},{"type":"Text","style":{"fontSize":16,"color":"#A0A0B8","textAlign":"center","lineHeight":24,"marginTop":16},"children":["Track your goals, build habits, and unlock your full potential with smart insights."]}]},{"type":"View","style":{"paddingHorizontal":32},"children":[{"type":"View","style":{"flexDirection":"row","justifyContent":"center","gap":8,"marginBottom":32},"children":[{"type":"View","style":{"width":24,"height":8,"borderRadius":4,"backgroundColor":"#6C5CE7"}},{"type":"View","style":{"width":8,"height":8,"borderRadius":4,"backgroundColor":"#222236"}},{"type":"View","style":{"width":8,"height":8,"borderRadius":4,"backgroundColor":"#222236"}}]},{"type":"TouchableOpacity","style":{"backgroundColor":"#6C5CE7","borderRadius":24,"height":48,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":16,"fontWeight":"700","color":"#FFFFFF"},"children":["Get Started"]}]},{"type":"TouchableOpacity","style":{"height":48,"alignItems":"center","justifyContent":"center","marginTop":8},"children":[{"type":"Text","style":{"fontSize":14,"color":"#6B6B80"},"children":["Skip"]}]}]}]}
--- END EXAMPLE ---`

// --- Smart example selection: 3-4 examples per prompt (anchors + type-specific) ---
// Anchor examples are ALWAYS included to establish JSON format and quality bar.
// Type-specific examples are added when screen type is detected.
// Max 4 examples total (~5000 tokens vs previous ~15-20K).

// --- Screen type classification for dynamic few-shot selection ---
type ScreenType = 'dashboard' | 'auth' | 'profile' | 'settings' | 'product' | 'chat' | 'music' | 'calendar' | 'onboarding' | 'food' | 'checkout' | 'unknown'

// Maps screen type → 1-2 type-specific examples (anchors are added separately)
const SCREEN_TYPE_EXAMPLES: Record<ScreenType, string[]> = {
  dashboard: [EXAMPLE_DASHBOARD, EXAMPLE_PROFILE],
  auth: [EXAMPLE_LOGIN, EXAMPLE_ONBOARDING],
  profile: [EXAMPLE_PROFILE, EXAMPLE_DASHBOARD],
  settings: [EXAMPLE_SETTINGS],
  product: [EXAMPLE_PRODUCT, EXAMPLE_FOOD],
  chat: [EXAMPLE_CHAT],
  music: [EXAMPLE_MUSIC],
  calendar: [EXAMPLE_DASHBOARD],
  onboarding: [EXAMPLE_ONBOARDING, EXAMPLE_LOGIN],
  food: [EXAMPLE_FOOD, EXAMPLE_PRODUCT],
  checkout: [EXAMPLE_PRODUCT],
  unknown: [EXAMPLE_PROFILE],
}

// Keywords → screen type mapping for prompt-based classification
const SCREEN_TYPE_KEYWORDS: Array<{ type: ScreenType; keywords: RegExp }> = [
  { type: 'dashboard', keywords: /\b(dashboard|home\s*screen|stats|metrics|overview|activity|energy|performance|steps|calories|heart\s*rate|fitness|health|tracker|analytics|monitor|banking|finance|wallet|payment|fintech)\b/i },
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
const COMPLEX_PROMPT_INDICATORS = [
  /dashboard/i,
  /home\s*screen/i,
  /home.screen/i,
  /banking|finance|fintech/i,
  /profile.*(?:stats|followers|posts)/i,
  /\$[\d,]+/,  // dollar amounts
  /\d+[KkMm]\s*(?:followers|steps|calories)/i,  // metrics with K/M
  /transaction|payment|history/i,
  /multiple.*(?:cards|sections|tabs)/i,
  /(?:checking|savings|account).*balance/i,
  /fitness/i,
  /social.*media/i,
  /e-?commerce/i,
  /chat.*app/i,
  /food.*delivery/i,
]

function isComplexPrompt(prompt: string): boolean {
  const matchCount = COMPLEX_PROMPT_INDICATORS.filter(pattern => pattern.test(prompt)).length
  return matchCount >= 1
}

// Builds a focused set of 3-4 examples: 2 anchors + 1-2 type-specific
function getRelevantExamples(screenType: ScreenType): string {
  const anchors = [EXAMPLE_DASHBOARD, EXAMPLE_SETTINGS]
  const typeExamples = SCREEN_TYPE_EXAMPLES[screenType] || SCREEN_TYPE_EXAMPLES.unknown

  // Deduplicate: don't include type-specific if it's already an anchor
  const extra = typeExamples.filter(e => !anchors.includes(e))

  // Assemble: 2 anchors + up to 2 type-specific, max 4 total
  const selected = [...anchors, ...extra.slice(0, 2)]
  return selected.join('\n\n')
}

// Default examples when no screen type detected: dashboard + settings (anchors) + profile (diverse)
function getDefaultExamples(): string {
  return [EXAMPLE_DASHBOARD, EXAMPLE_SETTINGS, EXAMPLE_PROFILE].join('\n\n')
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
{"type":"View","style":{"paddingHorizontal":20,"marginBottom":16},"children":[{"type":"View","style":{"backgroundColor":"#222236","borderRadius":12,"height":48,"paddingHorizontal":16,"flexDirection":"row","alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":16,"color":"#6B6B80","marginRight":8},"children":["🔍"]},{"type":"TextInput","style":{"flex":1,"fontSize":16,"color":"#FFFFFF"},"props":{"placeholder":"Search...","placeholderTextColor":"#6B6B80"}}]}]}
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
function buildSystemPrompt(designMd: string | null, isEditMode: boolean = false, learnedPatterns: string = '', brandColor?: string, screenType: ScreenType = 'unknown', hasImage: boolean = false, deviceInfo?: { name: string; width: number; height: number; category: string }): string {
  let prompt = `You are a world-class mobile UI designer and React Native expert. You create screens that look like they were designed by senior designers at Airbnb, Spotify, Stripe, or Nike. Your output is production-quality — not a prototype, not a wireframe, but a polished, beautiful screen ready to ship.

Your designs follow these principles:
- Hierarchy through size and weight, not just color
- Spacing creates visual grouping (tight within sections, generous between sections)
- Color restraint — one primary accent, surfaces for depth, greys for most text
- Every element has a purpose — no decorative noise
- Content is realistic and contextual — never generic placeholder text

Generate a React Native component tree as JSON. Return a single JSON object. Return ONLY valid JSON, no markdown, no explanation.
${deviceInfo ? `
TARGET DEVICE: You are designing for a ${deviceInfo.name} screen at ${deviceInfo.width}x${deviceInfo.height} pixels. Design content to fit within this viewport. ${deviceInfo.category === 'Android' ? 'This is an Android device — use Material Design conventions where appropriate.' : 'This is an iOS device — use iOS/HIG conventions where appropriate.'}
` : ''}
${DESIGN_TOKENS}

${COMPONENT_TYPES}

${CONTENT_LIBRARY}

${VIEWPORT_BUDGET}

${CONTENT_DENSITY}

${PLATFORM_RULES}

SCREENSHOT FIDELITY — DATA PRESERVATION RULES:
When recreating a screen from a screenshot, these rules are MANDATORY:
1. NEVER replace functional UI (dashboards, stat cards, data displays) with decorative hero text or splash pages.
2. If the screenshot shows numeric data (scores, step counts, calories, percentages, prices), you MUST include matching data display components with realistic placeholder values.
3. If the screenshot shows N cards/containers, your output MUST have at least N corresponding View containers.
4. Stat cards with icon + number + label MUST be preserved as stat cards — never merge them into a single text block.
5. User greetings (e.g., "Welcome back, Name") MUST be preserved as personalized text with a placeholder name.
6. Navigation elements (bottom tabs, top nav bars, back buttons) visible in the screenshot MUST be included.
7. Status indicators (badges, pills, progress bars, online/offline) MUST be preserved.
8. Icons and emoji used as functional indicators (not decoration) MUST be included in the output.
9. If a screenshot shows a complex dashboard, the output complexity should MATCH — do not simplify.
10. Color accents and theme (dark/light) from the screenshot MUST be matched.

SCREEN TYPE AWARENESS:
When generating screens, recognize these common patterns and preserve their structure:
- DASHBOARD: Header greeting + stat cards + content cards + optional bottom nav
- PROFILE: Avatar + name + stats row + action buttons + content tabs
- SETTINGS: Section headers + grouped list items with icons + toggles/chevrons
- LIST: Search bar + filter tabs + scrollable item cards
- DETAIL: Hero image/area + title + metadata + description + action button
- ONBOARDING: Centered illustration + headline + description + pagination dots + CTA
- AUTH: Logo + form inputs + primary button + social login + footer link

DESIGN.MD SUPPORT:
If the user's prompt contains a DESIGN.md block or references design tokens from an external source, extract and use those tokens instead of the defaults. Colors, typography, spacing, and component rules from DESIGN.md override Mokkoi defaults. If a DESIGN.md only partially defines tokens, use Mokkoi defaults for unspecified values. Look for markdown headers like "# Colors", "# Typography", "## Primary", "## Spacing" or code blocks containing token definitions.

${screenType !== 'unknown' ? getRelevantExamples(screenType) : getDefaultExamples()}

${QUALITY_CHECKLIST}

${isEditMode ? EDIT_MODE_INSTRUCTIONS : ''}${learnedPatterns}

Return ONLY valid JSON, no markdown, no explanation.`

  if (designMd) {
    prompt += `\n\nThe user has provided a DESIGN.md with custom design tokens. Override the default tokens with these values where specified:\n${designMd}`
  }

  if (brandColor && /^#[0-9a-fA-F]{3,8}$/.test(brandColor)) {
    prompt += `\n\nBRAND COLOR OVERRIDE: The user's brand/accent color is ${brandColor}. Use this instead of the default primary color (#6C5CE7) for all primary buttons, accents, active states, and highlights. Generate complementary light and surface variants by adjusting opacity.`
  }

  return prompt
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // --- Authentication ---
  const user = await authenticateRequest(req, res)
  if (!user) return // 401 already sent

  // --- Credit deduction (skip for MCP — they use their own key via BYOK) ---
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
    const creditCheck = await checkCredits(user.id, creditType)
    if (!creditCheck.hasCredits) {
      return res.status(402).json({
        error: creditCheck.error,
        creditsRemaining: creditCheck.creditsRemaining,
        upgradeUrl: creditCheck.upgradeUrl,
      })
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' })
  }

  // Plan-based model routing with complexity detection
  const userPlan = await getUserPlan(user.id)
  const complex = isComplexPrompt(prompt)
  // Track if free-tier user got upgraded to Sonnet for credit adjustment
  let freeTierSonnetUpgrade = false

  let model: string
  let maxTokens: number
  if (hasImage) {
    // Images always use Sonnet (vision capability required)
    model = 'claude-sonnet-4-20250514'
    maxTokens = 16000
  } else if (userPlan === 'free') {
    if (complex && (isNewScreen || isVariation || isRegenerate)) {
      // Complex prompts get Sonnet even on free tier (costs 2x credits)
      model = 'claude-sonnet-4-20250514'
      maxTokens = 12000
      freeTierSonnetUpgrade = true
    } else {
      model = 'claude-haiku-4-5-20251001'
      maxTokens = (isNewScreen || isVariation || isRegenerate) ? 12000 : 8000
    }
  } else if (isNewScreen || isVariation || isRegenerate) {
    model = 'claude-sonnet-4-20250514'
    maxTokens = 12000
  } else {
    model = 'claude-haiku-4-5-20251001'
    maxTokens = 8000
  }

  // Determine generation type for usage logging
  let generationType: 'new_screen' | 'edit' | 'variation' | 'regenerate' = 'new_screen'
  if (isVariation) generationType = 'variation'
  else if (isRegenerate) generationType = 'regenerate'
  else if (currentScreen) generationType = 'edit'

  // Extract DESIGN.md if present in prompt
  const { cleanPrompt, designMd } = extractDesignMd(prompt)
  const isEditMode = !!currentScreen && generationType === 'edit'
  const learnedPatterns = isNewScreen ? await getLearnedPatterns() : ''
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
  const systemPromptText = buildSystemPrompt(designMd, isEditMode, learnedPatterns, brandColor, screenType, hasImage, deviceInfo)
  const normalizerOpts = parseDesignMdTokens(designMd)

  // Build user message — include current screen if editing, or image if attached
  let userContent: string | Array<{ type: string; [key: string]: unknown }>
  if (imageData && typeof imageData === 'string') {
    // Screenshot-to-screen: send image with text prompt
    const textPrompt = currentScreen
      ? `Here is the current screen JSON:\n${JSON.stringify(currentScreen, null, 2)}\n\nThe user attached a screenshot and says: ${cleanPrompt}\n\nRecreate or modify the screen to match the screenshot. Return complete JSON.`
      : `SCREENSHOT RECREATION — STRUCTURAL ANALYSIS REQUIRED

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
    userContent = `REGENERATE MODE: You are regenerating an existing screen. The user wants a fresh design approach for the SAME type of screen. Keep the same purpose, features, and information architecture but create a new visual design. Do NOT change the screen type (e.g., if it's a fitness screen, keep it as fitness; if it's a dashboard, keep it as a dashboard).

Here is the current screen's component tree JSON for reference:
${JSON.stringify(currentScreen, null, 2)}
${screenName ? `\nScreen name: ${screenName}` : ''}

${cleanPrompt}

Generate a completely fresh design for this same type of screen. Use different layout patterns, card styles, and visual hierarchy — but preserve the same screen purpose and content type. Return ONLY valid JSON.`
  } else if (currentScreen) {
    userContent = `EDIT MODE — You MUST preserve the existing screen's layout, content, and structure. Only change what the user explicitly asks to change.

Here is the current screen's component tree JSON:
${JSON.stringify(currentScreen, null, 2)}

The user's edit request: ${cleanPrompt}

IMPORTANT: Do NOT recreate this screen from scratch. Modify the EXISTING tree above. Keep all text content, element positions, component structure, and styling that the user did NOT ask to change. If the user asks for a color/theme change, update ONLY colors — keep everything else identical. Return the complete modified JSON.`
  } else {
    userContent = cleanPrompt
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

  const modelLabel = model.includes('sonnet') ? 'Sonnet' : 'Haiku'
  const apiPayload = {
    model,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: systemPromptText,
        cache_control: { type: 'ephemeral' },
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
        },
        body: JSON.stringify({ ...apiPayload, stream: true }),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        console.error('Anthropic streaming API error:', response.status, errorBody)
        logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: model, generationType, promptPreview: prompt, success: false })
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
        let tree = repairJSON(fullText)

        // Normalize the component tree
        tree = normalizeComponentTree(tree, normalizerOpts)

        // Structural validation for screenshot recreation
        const validation = validateStructuralFidelity(tree)

        // Deduct credits after successful generation
        if (!user.isMCP) {
          await deductCredits(user.id, creditType)
          // Deduct extra credits for free-tier Sonnet upgrade (2x total)
          if (freeTierSonnetUpgrade) {
            await deductCredits(user.id, creditType)
          }
        }

        res.write(`data: ${JSON.stringify({ type: 'complete', tree, modelUsed: modelLabel, ...(validation.issues.length > 0 ? { structuralWarnings: validation.issues } : {}) })}\n\n`)

        // Usage logging
        logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: model, tokensIn: inputTokens, tokensOut: outputTokens, generationType, promptPreview: prompt, success: true })

        // Edit diff capture
        if (currentScreen && (generationType === 'edit' || generationType === 'variation' || generationType === 'regenerate')) {
          const editType = generationType === 'edit' ? 'ai_edit' : generationType
          logEditDiff({ userId: user.id, projectId: projectId || undefined, screenId: screenId || undefined, editType: editType as 'ai_edit' | 'variation' | 'regenerate', prompt, treeBefore: currentScreen, treeAfter: tree, modelUsed: model })
        }
      } catch (jsonErr) {
        console.error('JSON repair failed on stream. Raw start:', fullText.slice(0, 500))
        res.write(`data: ${JSON.stringify({ type: 'error', message: `AI returned invalid JSON. Raw start: ${fullText.slice(0, 100)}` })}\n\n`)
      }

      res.write('data: [DONE]\n\n')
      return res.end()
    } catch (err) {
      console.error('Streaming generate error:', err)
      const message = err instanceof Error ? err.message : String(err)
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
      },
      body: JSON.stringify(apiPayload),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('Anthropic API error:', response.status, errorBody)
      logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: model, generationType, promptPreview: prompt, success: false })
      return res.status(502).json({ error: 'Failed to generate screen' })
    }

    let data: any
    try {
      data = await response.json()
    } catch (parseErr) {
      console.error('Failed to parse Anthropic response as JSON')
      return res.status(502).json({ error: 'Invalid response from AI service' })
    }

    const text: string = data.content?.[0]?.text ?? ''
    if (!text) {
      return res.status(502).json({ error: 'Empty response from AI service' })
    }

    let tree: any
    try {
      tree = repairJSON(text)
    } catch (jsonErr) {
      console.error('JSON repair failed. Raw start:', text.slice(0, 500))
      return res.status(502).json({ error: `AI returned invalid JSON. Raw start: ${text.slice(0, 100)}` })
    }

    // Normalize the component tree
    tree = normalizeComponentTree(tree, normalizerOpts)

    // Structural validation for screenshot recreation
    const validation = validateStructuralFidelity(tree)

    // Deduct credits after successful generation
    if (!user.isMCP) {
      await deductCredits(user.id, creditType)
      // Deduct extra credits for free-tier Sonnet upgrade (2x total)
      if (freeTierSonnetUpgrade) {
        await deductCredits(user.id, creditType)
      }
    }

    logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: model, tokensIn: data.usage?.input_tokens, tokensOut: data.usage?.output_tokens, generationType, promptPreview: prompt, success: true })

    if (currentScreen && (generationType === 'edit' || generationType === 'variation' || generationType === 'regenerate')) {
      const editType = generationType === 'edit' ? 'ai_edit' : generationType
      logEditDiff({ userId: user.id, projectId: projectId || undefined, screenId: screenId || undefined, editType: editType as 'ai_edit' | 'variation' | 'regenerate', prompt, treeBefore: currentScreen, treeAfter: tree, modelUsed: model })
    }

    return res.status(200).json({ tree, modelUsed: modelLabel, ...(validation.issues.length > 0 ? { structuralWarnings: validation.issues } : {}) })
  } catch (err) {
    console.error('Generate error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: `Failed to generate screen: ${message}` })
  }
}
