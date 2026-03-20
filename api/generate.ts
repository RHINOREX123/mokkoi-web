import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest, checkCredits, logUsage, logEditDiff, deductCredits, getUserPlan } from './auth-helper.js'
import { normalizeComponentTree } from './normalizer.js'
import { DESIGN_TOKENS, CONTENT_LIBRARY, COMPONENT_TYPES, PLATFORM_RULES, QUALITY_CHECKLIST } from './design-system.js'

// --- Few-shot examples (compact JSON) ---
// Each uses the correct format: style at top level, props for component-specific properties only.

const EXAMPLE_LOGIN = `--- EXAMPLE ---
User: "Create a modern login screen for a fitness app"
Component tree:
{"type":"View","style":{"flex":1,"backgroundColor":"#0A0A1A","paddingTop":54,"paddingBottom":34},"children":[{"type":"ScrollView","style":{"flex":1},"props":{"showsVerticalScrollIndicator":false},"children":[{"type":"View","style":{"paddingTop":64,"alignItems":"center","paddingHorizontal":24},"children":[{"type":"View","style":{"width":64,"height":64,"borderRadius":16,"backgroundColor":"#6C5CE7","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":28,"color":"#FFFFFF"},"children":["\\u26A1"]}]},{"type":"Text","style":{"fontSize":28,"fontWeight":"700","color":"#FFFFFF","marginTop":24,"textAlign":"center"},"children":["Welcome back, athlete"]},{"type":"Text","style":{"fontSize":14,"color":"#A0A0B8","marginTop":8,"textAlign":"center"},"children":["Sign in to crush your goals"]}]},{"type":"View","style":{"paddingHorizontal":24,"marginTop":40},"children":[{"type":"View","style":{"backgroundColor":"#222236","borderRadius":12,"height":48,"paddingHorizontal":16,"justifyContent":"center"},"children":[{"type":"TextInput","style":{"fontSize":16,"color":"#FFFFFF"},"props":{"placeholder":"Email","placeholderTextColor":"#6B6B80"}}]},{"type":"View","style":{"backgroundColor":"#222236","borderRadius":12,"height":48,"paddingHorizontal":16,"justifyContent":"center","marginTop":16},"children":[{"type":"TextInput","style":{"fontSize":16,"color":"#FFFFFF"},"props":{"placeholder":"Password","placeholderTextColor":"#6B6B80","secureTextEntry":true}}]},{"type":"TouchableOpacity","style":{"backgroundColor":"#6C5CE7","borderRadius":24,"height":48,"alignItems":"center","justifyContent":"center","marginTop":24},"children":[{"type":"Text","style":{"fontSize":16,"fontWeight":"700","color":"#FFFFFF"},"children":["Sign In"]}]},{"type":"Text","style":{"fontSize":14,"color":"#6C5CE7","textAlign":"center","marginTop":16},"children":["Forgot password?"]},{"type":"View","style":{"flexDirection":"row","alignItems":"center","marginTop":24},"children":[{"type":"View","style":{"flex":1,"height":1,"backgroundColor":"#2A2A3E"}},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80","marginHorizontal":16},"children":["or continue with"]},{"type":"View","style":{"flex":1,"height":1,"backgroundColor":"#2A2A3E"}}]},{"type":"View","style":{"flexDirection":"row","justifyContent":"center","gap":16,"marginTop":24},"children":[{"type":"View","style":{"width":48,"height":48,"borderRadius":9999,"backgroundColor":"#1A1A2E","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20},"children":["G"]}]},{"type":"View","style":{"width":48,"height":48,"borderRadius":9999,"backgroundColor":"#1A1A2E","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uF8FF"]}]}]},{"type":"View","style":{"flexDirection":"row","justifyContent":"center","marginTop":32},"children":[{"type":"Text","style":{"fontSize":14,"color":"#A0A0B8"},"children":["Don't have an account? "]},{"type":"Text","style":{"fontSize":14,"fontWeight":"600","color":"#6C5CE7"},"children":["Sign Up"]}]}]}]}]}
--- END EXAMPLE ---`

const EXAMPLE_DASHBOARD = `--- EXAMPLE ---
User: "Create a fitness dashboard home screen"
Component tree:
{"type":"View","style":{"flex":1,"backgroundColor":"#0A0A1A","paddingTop":54},"children":[{"type":"ScrollView","style":{"flex":1},"props":{"showsVerticalScrollIndicator":false},"children":[{"type":"View","style":{"paddingHorizontal":20,"paddingTop":16},"children":[{"type":"View","style":{"flexDirection":"row","justifyContent":"space-between","alignItems":"center"},"children":[{"type":"View","children":[{"type":"Text","style":{"fontSize":14,"color":"#6B6B80"},"children":["Good morning"]},{"type":"Text","style":{"fontSize":24,"fontWeight":"600","color":"#FFFFFF","marginTop":4},"children":["Sarah"]}]},{"type":"View","style":{"width":40,"height":40,"borderRadius":9999,"backgroundColor":"#6C5CE7","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":17,"fontWeight":"600","color":"#FFFFFF"},"children":["S"]}]}]},{"type":"Text","style":{"fontSize":13,"color":"#6B6B80","marginTop":4},"children":["Monday, March 20"]}]},{"type":"View","style":{"flexDirection":"row","gap":12,"paddingHorizontal":20,"marginTop":24},"children":[{"type":"View","style":{"flex":1,"backgroundColor":"#12121F","borderRadius":12,"padding":16,"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uD83D\\uDC5F"]},{"type":"Text","style":{"fontSize":20,"fontWeight":"700","color":"#FFFFFF","marginTop":8},"children":["8,450"]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80","marginTop":4},"children":["steps"]}]},{"type":"View","style":{"flex":1,"backgroundColor":"#12121F","borderRadius":12,"padding":16,"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uD83D\\uDD25"]},{"type":"Text","style":{"fontSize":20,"fontWeight":"700","color":"#FFFFFF","marginTop":8},"children":["342"]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80","marginTop":4},"children":["kcal burned"]}]},{"type":"View","style":{"flex":1,"backgroundColor":"#12121F","borderRadius":12,"padding":16,"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\u2764\\uFE0F"]},{"type":"Text","style":{"fontSize":20,"fontWeight":"700","color":"#FFFFFF","marginTop":8},"children":["72"]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80","marginTop":4},"children":["bpm resting"]}]}]},{"type":"View","style":{"paddingHorizontal":20,"marginTop":32},"children":[{"type":"View","style":{"flexDirection":"row","justifyContent":"space-between","alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":17,"fontWeight":"600","color":"#FFFFFF"},"children":["Daily Goal"]},{"type":"Text","style":{"fontSize":14,"color":"#6C5CE7"},"children":["82%"]}]},{"type":"View","style":{"height":8,"backgroundColor":"#222236","borderRadius":12,"marginTop":12,"overflow":"hidden"},"children":[{"type":"View","style":{"width":"82%","height":8,"backgroundColor":"#6C5CE7","borderRadius":12}}]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80","marginTop":8},"children":["You're 82% to your daily goal!"]}]},{"type":"View","style":{"paddingHorizontal":20,"marginTop":32},"children":[{"type":"Text","style":{"fontSize":17,"fontWeight":"600","color":"#FFFFFF","marginBottom":16},"children":["Today's Workout"]},{"type":"View","style":{"backgroundColor":"#12121F","borderRadius":12,"overflow":"hidden"},"children":[{"type":"View","style":{"height":160,"backgroundColor":"#1A1A2E","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":48},"children":["\\uD83C\\uDFCB\\uFE0F"]}]},{"type":"View","style":{"padding":16},"children":[{"type":"Text","style":{"fontSize":17,"fontWeight":"600","color":"#FFFFFF"},"children":["Morning HIIT"]},{"type":"Text","style":{"fontSize":14,"color":"#A0A0B8","marginTop":4},"children":["30 min · Intermediate"]},{"type":"TouchableOpacity","style":{"backgroundColor":"#6C5CE7","borderRadius":24,"height":40,"alignItems":"center","justifyContent":"center","marginTop":12},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"700","color":"#FFFFFF"},"children":["Start Workout"]}]}]}]}]},{"type":"View","style":{"flexDirection":"row","flexWrap":"wrap","gap":12,"paddingHorizontal":20,"marginTop":32,"paddingBottom":24},"children":[{"type":"View","style":{"width":"47%","backgroundColor":"#12121F","borderRadius":12,"padding":16,"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":28},"children":["\\uD83C\\uDF4E"]},{"type":"Text","style":{"fontSize":13,"fontWeight":"500","color":"#FFFFFF","marginTop":8},"children":["Nutrition"]}]},{"type":"View","style":{"width":"47%","backgroundColor":"#12121F","borderRadius":12,"padding":16,"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":28},"children":["\\uD83D\\uDCA7"]},{"type":"Text","style":{"fontSize":13,"fontWeight":"500","color":"#FFFFFF","marginTop":8},"children":["Hydration"]}]},{"type":"View","style":{"width":"47%","backgroundColor":"#12121F","borderRadius":12,"padding":16,"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":28},"children":["\\uD83D\\uDE34"]},{"type":"Text","style":{"fontSize":13,"fontWeight":"500","color":"#FFFFFF","marginTop":8},"children":["Sleep"]}]},{"type":"View","style":{"width":"47%","backgroundColor":"#12121F","borderRadius":12,"padding":16,"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":28},"children":["\\uD83D\\uDCCA"]},{"type":"Text","style":{"fontSize":13,"fontWeight":"500","color":"#FFFFFF","marginTop":8},"children":["Insights"]}]}]}]},{"type":"View","style":{"flexDirection":"row","backgroundColor":"#12121F","paddingTop":8,"paddingBottom":34,"paddingHorizontal":20,"justifyContent":"space-around","alignItems":"center","borderTopWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uD83C\\uDFE0"]},{"type":"Text","style":{"fontSize":11,"color":"#6C5CE7","marginTop":4},"children":["Home"]}]},{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\u26A1"]},{"type":"Text","style":{"fontSize":11,"color":"#6B6B80","marginTop":4},"children":["Activity"]}]},{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uD83C\\uDF4E"]},{"type":"Text","style":{"fontSize":11,"color":"#6B6B80","marginTop":4},"children":["Nutrition"]}]},{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uD83D\\uDC64"]},{"type":"Text","style":{"fontSize":11,"color":"#6B6B80","marginTop":4},"children":["Profile"]}]}]}]}
--- END EXAMPLE ---`

const EXAMPLE_PROFILE = `--- EXAMPLE ---
User: "Create a social media profile page"
Component tree:
{"type":"View","style":{"flex":1,"backgroundColor":"#0A0A1A","paddingTop":54},"children":[{"type":"View","style":{"flexDirection":"row","alignItems":"center","justifyContent":"space-between","paddingHorizontal":20,"height":44},"children":[{"type":"TouchableOpacity","style":{"width":44,"height":44,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20,"color":"#FFFFFF"},"children":["\\u2190"]}]},{"type":"Text","style":{"fontSize":17,"fontWeight":"600","color":"#FFFFFF"},"children":["Profile"]},{"type":"TouchableOpacity","style":{"width":44,"height":44,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20,"color":"#FFFFFF"},"children":["\\u2699"]}]}]},{"type":"ScrollView","style":{"flex":1},"props":{"showsVerticalScrollIndicator":false},"children":[{"type":"View","style":{"alignItems":"center","paddingTop":24},"children":[{"type":"View","style":{"width":80,"height":80,"borderRadius":9999,"backgroundColor":"#1A1A2E","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":34,"color":"#FFFFFF"},"children":["M"]}]},{"type":"Text","style":{"fontSize":20,"fontWeight":"700","color":"#FFFFFF","marginTop":16},"children":["Maya Chen"]},{"type":"Text","style":{"fontSize":14,"color":"#6B6B80","marginTop":4},"children":["@maya.creates"]},{"type":"Text","style":{"fontSize":14,"color":"#A0A0B8","marginTop":12,"textAlign":"center","paddingHorizontal":40},"children":["Coffee enthusiast. Currently exploring Tokyo"]}]},{"type":"View","style":{"flexDirection":"row","justifyContent":"space-around","paddingVertical":24,"marginHorizontal":20,"borderBottomWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":17,"fontWeight":"600","color":"#FFFFFF"},"children":["3,241"]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80","marginTop":4},"children":["Posts"]}]},{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":17,"fontWeight":"600","color":"#FFFFFF"},"children":["12.4K"]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80","marginTop":4},"children":["Followers"]}]},{"type":"View","style":{"alignItems":"center"},"children":[{"type":"Text","style":{"fontSize":17,"fontWeight":"600","color":"#FFFFFF"},"children":["892"]},{"type":"Text","style":{"fontSize":12,"color":"#6B6B80","marginTop":4},"children":["Following"]}]}]},{"type":"View","style":{"flexDirection":"row","gap":12,"paddingHorizontal":20,"marginTop":20},"children":[{"type":"TouchableOpacity","style":{"flex":1,"backgroundColor":"#6C5CE7","borderRadius":24,"height":40,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"700","color":"#FFFFFF"},"children":["Follow"]}]},{"type":"TouchableOpacity","style":{"flex":1,"backgroundColor":"#1A1A2E","borderRadius":24,"height":40,"alignItems":"center","justifyContent":"center","borderWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"600","color":"#FFFFFF"},"children":["Message"]}]}]},{"type":"View","style":{"flexDirection":"row","marginTop":24,"borderBottomWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"View","style":{"flex":1,"alignItems":"center","paddingBottom":12,"borderBottomWidth":3,"borderColor":"#6C5CE7"},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"500","color":"#6C5CE7"},"children":["Posts"]}]},{"type":"View","style":{"flex":1,"alignItems":"center","paddingBottom":12},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"500","color":"#6B6B80"},"children":["Reels"]}]},{"type":"View","style":{"flex":1,"alignItems":"center","paddingBottom":12},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"500","color":"#6B6B80"},"children":["Tagged"]}]}]},{"type":"View","style":{"flexDirection":"row","flexWrap":"wrap","gap":4,"padding":4,"paddingBottom":34},"children":[{"type":"View","style":{"width":"32.6%","aspectRatio":1,"backgroundColor":"#1A1A2E","borderRadius":0}},{"type":"View","style":{"width":"32.6%","aspectRatio":1,"backgroundColor":"#222236","borderRadius":0}},{"type":"View","style":{"width":"32.6%","aspectRatio":1,"backgroundColor":"#1A1A2E","borderRadius":0}},{"type":"View","style":{"width":"32.6%","aspectRatio":1,"backgroundColor":"#222236","borderRadius":0}},{"type":"View","style":{"width":"32.6%","aspectRatio":1,"backgroundColor":"#1A1A2E","borderRadius":0}},{"type":"View","style":{"width":"32.6%","aspectRatio":1,"backgroundColor":"#222236","borderRadius":0}}]}]}]}
--- END EXAMPLE ---`

const EXAMPLE_SETTINGS = `--- EXAMPLE ---
User: "Create an app settings screen"
Component tree:
{"type":"View","style":{"flex":1,"backgroundColor":"#0A0A1A","paddingTop":54},"children":[{"type":"View","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":20,"height":44},"children":[{"type":"TouchableOpacity","style":{"width":44,"height":44,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20,"color":"#FFFFFF"},"children":["\\u2190"]}]},{"type":"Text","style":{"fontSize":28,"fontWeight":"700","color":"#FFFFFF","marginLeft":8},"children":["Settings"]}]},{"type":"ScrollView","style":{"flex":1},"props":{"showsVerticalScrollIndicator":false},"children":[{"type":"TouchableOpacity","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":20,"paddingVertical":16,"marginTop":8},"children":[{"type":"View","style":{"width":48,"height":48,"borderRadius":9999,"backgroundColor":"#6C5CE7","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20,"fontWeight":"600","color":"#FFFFFF"},"children":["S"]}]},{"type":"View","style":{"flex":1,"marginLeft":16},"children":[{"type":"Text","style":{"fontSize":16,"fontWeight":"500","color":"#FFFFFF"},"children":["Sarah Mitchell"]},{"type":"Text","style":{"fontSize":13,"color":"#6B6B80","marginTop":4},"children":["sarah@email.com"]}]},{"type":"Text","style":{"fontSize":16,"color":"#6B6B80"},"children":["\\u203A"]}]},{"type":"View","style":{"marginTop":24,"paddingHorizontal":20},"children":[{"type":"Text","style":{"fontSize":13,"fontWeight":"500","color":"#6B6B80","textTransform":"uppercase","letterSpacing":1,"marginBottom":8},"children":["Account"]},{"type":"View","style":{"backgroundColor":"#12121F","borderRadius":12,"overflow":"hidden"},"children":[{"type":"View","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":16,"height":48,"borderBottomWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uD83D\\uDD14"]},{"type":"Text","style":{"flex":1,"fontSize":16,"color":"#FFFFFF","marginLeft":12},"children":["Notifications"]},{"type":"Switch","props":{"value":true,"trackColor":{"true":"#00B894","false":"#222236"},"thumbColor":"#FFFFFF"}}]},{"type":"TouchableOpacity","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":16,"height":48},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uD83D\\uDEE1"]},{"type":"Text","style":{"flex":1,"fontSize":16,"color":"#FFFFFF","marginLeft":12},"children":["Privacy & Security"]},{"type":"Text","style":{"fontSize":16,"color":"#6B6B80"},"children":["\\u203A"]}]}]}]},{"type":"View","style":{"marginTop":24,"paddingHorizontal":20},"children":[{"type":"Text","style":{"fontSize":13,"fontWeight":"500","color":"#6B6B80","textTransform":"uppercase","letterSpacing":1,"marginBottom":8},"children":["Preferences"]},{"type":"View","style":{"backgroundColor":"#12121F","borderRadius":12,"overflow":"hidden"},"children":[{"type":"TouchableOpacity","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":16,"height":48,"borderBottomWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uD83C\\uDFA8"]},{"type":"Text","style":{"flex":1,"fontSize":16,"color":"#FFFFFF","marginLeft":12},"children":["Appearance"]},{"type":"Text","style":{"fontSize":14,"color":"#6B6B80","marginRight":8},"children":["Dark"]},{"type":"Text","style":{"fontSize":16,"color":"#6B6B80"},"children":["\\u203A"]}]},{"type":"TouchableOpacity","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":16,"height":48,"borderBottomWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uD83C\\uDF10"]},{"type":"Text","style":{"flex":1,"fontSize":16,"color":"#FFFFFF","marginLeft":12},"children":["Language"]},{"type":"Text","style":{"fontSize":14,"color":"#6B6B80","marginRight":8},"children":["English"]},{"type":"Text","style":{"fontSize":16,"color":"#6B6B80"},"children":["\\u203A"]}]},{"type":"TouchableOpacity","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":16,"height":48},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uD83D\\uDCCA"]},{"type":"Text","style":{"flex":1,"fontSize":16,"color":"#FFFFFF","marginLeft":12},"children":["Data Usage"]},{"type":"Text","style":{"fontSize":16,"color":"#6B6B80"},"children":["\\u203A"]}]}]}]},{"type":"View","style":{"marginTop":24,"paddingHorizontal":20},"children":[{"type":"Text","style":{"fontSize":13,"fontWeight":"500","color":"#6B6B80","textTransform":"uppercase","letterSpacing":1,"marginBottom":8},"children":["Support"]},{"type":"View","style":{"backgroundColor":"#12121F","borderRadius":12,"overflow":"hidden"},"children":[{"type":"TouchableOpacity","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":16,"height":48,"borderBottomWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\u2753"]},{"type":"Text","style":{"flex":1,"fontSize":16,"color":"#FFFFFF","marginLeft":12},"children":["Help Center"]},{"type":"Text","style":{"fontSize":16,"color":"#6B6B80"},"children":["\\u203A"]}]},{"type":"TouchableOpacity","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":16,"height":48,"borderBottomWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\uD83D\\uDCAC"]},{"type":"Text","style":{"flex":1,"fontSize":16,"color":"#FFFFFF","marginLeft":12},"children":["Send Feedback"]},{"type":"Text","style":{"fontSize":16,"color":"#6B6B80"},"children":["\\u203A"]}]},{"type":"TouchableOpacity","style":{"flexDirection":"row","alignItems":"center","paddingHorizontal":16,"height":48},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\u2139\\uFE0F"]},{"type":"Text","style":{"flex":1,"fontSize":16,"color":"#FFFFFF","marginLeft":12},"children":["About"]},{"type":"Text","style":{"fontSize":14,"color":"#6B6B80","marginRight":8},"children":["v2.1.0"]},{"type":"Text","style":{"fontSize":16,"color":"#6B6B80"},"children":["\\u203A"]}]}]}]},{"type":"View","style":{"marginTop":32,"paddingHorizontal":20,"paddingBottom":34},"children":[{"type":"TouchableOpacity","style":{"height":48,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":16,"fontWeight":"500","color":"#E17055"},"children":["Log Out"]}]},{"type":"TouchableOpacity","style":{"height":48,"alignItems":"center","justifyContent":"center","marginTop":4},"children":[{"type":"Text","style":{"fontSize":14,"color":"#6B6B80"},"children":["Delete Account"]}]}]}]}]}
--- END EXAMPLE ---`

const EXAMPLE_PRODUCT = `--- EXAMPLE ---
User: "Create a product detail page for a shoe store"
Component tree:
{"type":"View","style":{"flex":1,"backgroundColor":"#0A0A1A"},"children":[{"type":"ScrollView","style":{"flex":1},"props":{"showsVerticalScrollIndicator":false},"children":[{"type":"View","style":{"height":280,"backgroundColor":"#1A1A2E","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":48},"children":["\\uD83D\\uDC5F"]},{"type":"View","style":{"position":"absolute","top":54,"left":16},"children":[{"type":"TouchableOpacity","style":{"width":44,"height":44,"borderRadius":9999,"backgroundColor":"rgba(0,0,0,0.3)","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20,"color":"#FFFFFF"},"children":["\\u2190"]}]}]}]},{"type":"View","style":{"paddingHorizontal":20,"paddingTop":20},"children":[{"type":"Text","style":{"fontSize":13,"color":"#6B6B80","textTransform":"uppercase","letterSpacing":1},"children":["Nike"]},{"type":"Text","style":{"fontSize":24,"fontWeight":"700","color":"#FFFFFF","marginTop":4},"children":["Air Max 270"]},{"type":"View","style":{"flexDirection":"row","alignItems":"center","marginTop":8,"gap":8},"children":[{"type":"Text","style":{"fontSize":24,"fontWeight":"700","color":"#6C5CE7"},"children":["$189.00"]},{"type":"View","style":{"flexDirection":"row","alignItems":"center","marginLeft":12},"children":[{"type":"Text","style":{"fontSize":14,"color":"#FDCB6E"},"children":["\\u2605 4.8"]},{"type":"Text","style":{"fontSize":14,"color":"#6C5CE7","marginLeft":4},"children":["(2.4k reviews)"]}]}]},{"type":"View","style":{"backgroundColor":"rgba(0, 184, 148, 0.1)","borderRadius":8,"paddingHorizontal":12,"paddingVertical":4,"alignSelf":"flex-start","marginTop":12},"children":[{"type":"Text","style":{"fontSize":12,"fontWeight":"500","color":"#00B894"},"children":["Free Shipping"]}]}]},{"type":"View","style":{"paddingHorizontal":20,"marginTop":24},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"500","color":"#FFFFFF","marginBottom":12},"children":["Select Size"]},{"type":"View","style":{"flexDirection":"row","gap":8},"children":[{"type":"View","style":{"width":48,"height":40,"borderRadius":8,"backgroundColor":"#222236","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":14,"color":"#A0A0B8"},"children":["8"]}]},{"type":"View","style":{"width":48,"height":40,"borderRadius":8,"backgroundColor":"#6C5CE7","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"600","color":"#FFFFFF"},"children":["9"]}]},{"type":"View","style":{"width":48,"height":40,"borderRadius":8,"backgroundColor":"#222236","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":14,"color":"#A0A0B8"},"children":["10"]}]},{"type":"View","style":{"width":48,"height":40,"borderRadius":8,"backgroundColor":"#222236","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":14,"color":"#A0A0B8"},"children":["11"]}]},{"type":"View","style":{"width":48,"height":40,"borderRadius":8,"backgroundColor":"#222236","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":14,"color":"#A0A0B8"},"children":["12"]}]}]}]},{"type":"View","style":{"paddingHorizontal":20,"marginTop":24},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"500","color":"#FFFFFF","marginBottom":12},"children":["Color"]},{"type":"View","style":{"flexDirection":"row","gap":12},"children":[{"type":"View","style":{"width":32,"height":32,"borderRadius":9999,"backgroundColor":"#1A1A2E","borderWidth":2,"borderColor":"#6C5CE7"}},{"type":"View","style":{"width":32,"height":32,"borderRadius":9999,"backgroundColor":"#FFFFFF"}},{"type":"View","style":{"width":32,"height":32,"borderRadius":9999,"backgroundColor":"#E17055"}},{"type":"View","style":{"width":32,"height":32,"borderRadius":9999,"backgroundColor":"#74B9FF"}}]}]},{"type":"View","style":{"paddingHorizontal":20,"marginTop":24},"children":[{"type":"Text","style":{"fontSize":17,"fontWeight":"600","color":"#FFFFFF"},"children":["About this product"]},{"type":"Text","style":{"fontSize":14,"color":"#A0A0B8","lineHeight":20,"marginTop":8},"children":["The Nike Air Max 270 delivers visible cushioning under every step. Updated for modern comfort, it nods to the original 1991 design with its exaggerated tongue top and heritage tongue logo."]}]},{"type":"View","style":{"paddingHorizontal":20,"marginTop":24,"paddingBottom":98},"children":[{"type":"Text","style":{"fontSize":17,"fontWeight":"600","color":"#FFFFFF","marginBottom":16},"children":["Reviews"]},{"type":"View","style":{"backgroundColor":"#12121F","borderRadius":12,"padding":16},"children":[{"type":"View","style":{"flexDirection":"row","alignItems":"center"},"children":[{"type":"View","style":{"width":32,"height":32,"borderRadius":9999,"backgroundColor":"#222236","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":13,"fontWeight":"600","color":"#FFFFFF"},"children":["A"]}]},{"type":"View","style":{"marginLeft":12},"children":[{"type":"Text","style":{"fontSize":14,"fontWeight":"500","color":"#FFFFFF"},"children":["Alex K."]},{"type":"Text","style":{"fontSize":12,"color":"#FDCB6E","marginTop":2},"children":["\\u2605\\u2605\\u2605\\u2605\\u2605"]}]}]},{"type":"Text","style":{"fontSize":14,"color":"#A0A0B8","marginTop":12,"lineHeight":20},"children":["Super comfortable, great for daily wear. The cushioning is amazing."]}]}]}]},{"type":"View","style":{"position":"absolute","bottom":0,"left":0,"right":0,"backgroundColor":"#12121F","paddingHorizontal":20,"paddingTop":16,"paddingBottom":34,"flexDirection":"row","gap":12,"borderTopWidth":1,"borderColor":"#2A2A3E"},"children":[{"type":"TouchableOpacity","style":{"width":48,"height":48,"borderRadius":9999,"backgroundColor":"#1A1A2E","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":20},"children":["\\u2661"]}]},{"type":"TouchableOpacity","style":{"flex":1,"backgroundColor":"#6C5CE7","borderRadius":24,"height":48,"alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","style":{"fontSize":16,"fontWeight":"700","color":"#FFFFFF"},"children":["Add to Cart"]}]}]}]}
--- END EXAMPLE ---`

const FEW_SHOT_EXAMPLES = [EXAMPLE_LOGIN, EXAMPLE_DASHBOARD, EXAMPLE_PROFILE, EXAMPLE_SETTINGS, EXAMPLE_PRODUCT].join('\n\n')

// --- DESIGN.md parser ---
function extractDesignMd(prompt: string): { cleanPrompt: string; designMd: string | null } {
  const designMdPattern = /```(?:md|markdown|design)?\n([\s\S]*?(?:#\s*(?:Colors|Typography|Spacing|Components)[\s\S]*?))```/i
  const match = prompt.match(designMdPattern)

  if (match) {
    const designMd = match[1]
    const cleanPrompt = prompt.replace(match[0], '').trim()
    return { cleanPrompt, designMd }
  }

  return { cleanPrompt: prompt, designMd: null }
}

// --- Build system prompt ---
function buildSystemPrompt(designMd: string | null): string {
  let prompt = `You are a world-class mobile UI designer and React Native expert. You create screens that look like they were designed by senior designers at Airbnb, Spotify, Stripe, or Nike. Your output is production-quality — not a prototype, not a wireframe, but a polished, beautiful screen ready to ship.

Your designs follow these principles:
- Hierarchy through size and weight, not just color
- Spacing creates visual grouping (tight within sections, generous between sections)
- Color restraint — one primary accent, surfaces for depth, greys for most text
- Every element has a purpose — no decorative noise
- Content is realistic and contextual — never generic placeholder text

Generate a React Native component tree as JSON. Return a single JSON object. Return ONLY valid JSON, no markdown, no explanation.

${DESIGN_TOKENS}

${COMPONENT_TYPES}

${CONTENT_LIBRARY}

${PLATFORM_RULES}

DESIGN.MD SUPPORT:
If the user's prompt contains a DESIGN.md block or references design tokens from an external source, extract and use those tokens instead of the defaults. Colors, typography, spacing, and component rules from DESIGN.md override Mokkoi defaults. If a DESIGN.md only partially defines tokens, use Mokkoi defaults for unspecified values. Look for markdown headers like "# Colors", "# Typography", "## Primary", "## Spacing" or code blocks containing token definitions.

${FEW_SHOT_EXAMPLES}

${QUALITY_CHECKLIST}

EDIT MODE: When modifying an existing screen, preserve ALL content, layout, and structure. Only change what the user specifically asks to change. If user says 'make it white background', change ONLY the background color and text colors for contrast — keep everything else identical. If user says 'recreate with light theme', keep the same layout, content, and elements but swap to light theme color tokens. Never discard or replace existing screen content during edits.

Return ONLY valid JSON, no markdown, no explanation.`

  if (designMd) {
    prompt += `\n\nThe user has provided a DESIGN.md with custom design tokens. Override the default tokens with these values where specified:\n${designMd}`
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
  const { prompt, currentScreen, imageData, imageMimeType, projectId, screenId, screenName, conversationHistory } = req.body ?? {}
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

  // Plan-based model routing
  const userPlan = await getUserPlan(user.id)

  let model: string
  let maxTokens: number
  if (userPlan === 'free') {
    // Free plan: always Haiku
    model = 'claude-haiku-4-5-20251001'
    maxTokens = hasImage ? 16000 : (isNewScreen || isVariation || isRegenerate) ? 12000 : 8000
  } else if (hasImage) {
    model = 'claude-sonnet-4-20250514'
    maxTokens = 16000
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
  const systemPromptText = buildSystemPrompt(designMd)

  // Build user message — include current screen if editing, or image if attached
  let userContent: string | Array<{ type: string; [key: string]: unknown }>
  if (imageData && typeof imageData === 'string') {
    // Screenshot-to-screen: send image with text prompt
    const textPrompt = currentScreen
      ? `Here is the current screen JSON:\n${JSON.stringify(currentScreen, null, 2)}\n\nThe user attached a screenshot and says: ${cleanPrompt}\n\nRecreate or modify the screen to match the screenshot. Return complete JSON.`
      : `Analyze this screenshot and recreate it as a React Native component tree JSON. The user says: ${cleanPrompt}\n\nRecreate this design faithfully using the supported component types. Match the layout, colors, typography, and spacing as closely as possible. Return ONLY valid JSON.`
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
        tree = normalizeComponentTree(tree)

        // Deduct credits after successful generation
        if (!user.isMCP) {
          await deductCredits(user.id, creditType)
        }

        res.write(`data: ${JSON.stringify({ type: 'complete', tree, modelUsed: modelLabel })}\n\n`)

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
    tree = normalizeComponentTree(tree)

    // Deduct credits after successful generation
    if (!user.isMCP) {
      await deductCredits(user.id, creditType)
    }

    logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: model, tokensIn: data.usage?.input_tokens, tokensOut: data.usage?.output_tokens, generationType, promptPreview: prompt, success: true })

    if (currentScreen && (generationType === 'edit' || generationType === 'variation' || generationType === 'regenerate')) {
      const editType = generationType === 'edit' ? 'ai_edit' : generationType
      logEditDiff({ userId: user.id, projectId: projectId || undefined, screenId: screenId || undefined, editType: editType as 'ai_edit' | 'variation' | 'regenerate', prompt, treeBefore: currentScreen, treeAfter: tree, modelUsed: model })
    }

    return res.status(200).json({ tree, modelUsed: modelLabel })
  } catch (err) {
    console.error('Generate error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: `Failed to generate screen: ${message}` })
  }
}
