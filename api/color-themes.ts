/**
 * Dynamic color theming for Mokkoi screen generation.
 * 200+ palettes across 27 categories, researched from 150+ real apps.
 *
 * Usage:
 *   const { palette, category } = resolveTheme(userPrompt)
 *   // Inject palette into system prompt
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColorPalette {
  name: string
  backgrounds: { dark: string; light: string }
  primary: string
  secondary: string
  accent: string
  surface: string
  cardBg: string
  textPrimary: string
  textSecondary: string
  success: string
  error: string
  mood: string
  gradientPair?: [string, string]
}

// ---------------------------------------------------------------------------
// Keyword → category mapping (17 existing + 10 new = 27 categories)
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Array<{ category: string; keywords: RegExp }> = [
  { category: 'fitness', keywords: /\b(fitness|health|workout|gym|exercise|training|yoga|running|sports|calories|steps|heart\s*rate|peloton|strava|weight\s*loss|hiit|crossfit|athletic|whoop|garmin|apple\s*fitness|under\s*armour|samsung\s*health|fitbit)\b/i },
  { category: 'finance', keywords: /\b(finance|banking|bank|money|investment|stocks|trading|payments|wallet|fintech|budget|venmo|paypal|transfer|savings|portfolio|expense|loan|stripe|square|groww|zerodha|angel\s*one|kite)\b/i },
  { category: 'india_fintech', keywords: /\b(phonepe|google\s*pay|gpay|paytm|cred|jupiter\s*money|bhim|upi|razorpay|navi|fi\s*money)\b/i },
  { category: 'food_delivery', keywords: /\b(food|delivery|restaurant|ordering|takeout|recipe|cooking|meal|uber\s*eats|doordash|cuisine|swiggy|zomato|rappi|ifood|foodpanda|grubhub)\b/i },
  { category: 'grocery', keywords: /\b(grocery|groceries|instacart|blinkit|zepto|gorillas|gopuff|bigbasket|quick\s*commerce|fresh|supermarket|pantry)\b/i },
  { category: 'social', keywords: /\b(social|community|feed|stories|network|instagram|tiktok|twitter|linkedin|reddit|pinterest|snapchat|threads|followers|news\s*feed|timeline|reels|mastodon|bluesky|bereal)\b/i },
  { category: 'ecommerce', keywords: /\b(ecommerce|shopping|shop|store|marketplace|retail|fashion|clothing|products|cart|checkout|add\s*to\s*cart|amazon|price|buy\s*now|sneaker|shoe|etsy|flipkart|meesho|nykaa|myntra|walmart|target|shein)\b/i },
  { category: 'crypto', keywords: /\b(crypto|web3|blockchain|nft|defi|token|bitcoin|ethereum|solana|coinbase|swap\s*token|metamask|phantom|kraken|uniswap|opensea|raydium)\b/i },
  { category: 'travel', keywords: /\b(travel|hotel|flight|booking|vacation|trip|airbnb|tourism|resort|check\s*in|itinerary|destination|hostel|tripadvisor|kayak|makemytrip|goibibo|cleartrip)\b/i },
  { category: 'music', keywords: /\b(music|podcast|audio|player|radio|spotify|playlist|now\s*playing|album|song|apple\s*music|tidal|deezer|gaana|jiosaavn|amazon\s*music)\b/i },
  { category: 'education', keywords: /\b(education|learning|course|study|school|tutorial|quiz|duolingo|lesson|homework|classroom|exam|coursera|udemy|skillshare|edx|unacademy|byjus)\b/i },
  { category: 'ride_hailing', keywords: /\b(ride|taxi|uber|lyft|cab|transport|commute|carpool|book\s*a\s*ride|driver|rapido|indrive|careem|didi|ola)\b/i },
  { category: 'messaging', keywords: /\b(messaging|chat|direct\s*message|whatsapp|telegram|signal|conversation|inbox|send\s*message|sms|wechat|line\s*app|viber|kakaotalk|imessage)\b/i },
  { category: 'streaming', keywords: /\b(streaming|video|netflix|youtube|disney|hbo|watch\s*now|movie|tv\s*show|series|hulu|peacock|paramount|crunchyroll|hotstar)\b/i },
  { category: 'dating', keywords: /\b(dating|tinder|bumble|hinge|match|swipe|love\s*interest|okcupid|coffee\s*meets\s*bagel|happn|aisle)\b/i },
  { category: 'wellness', keywords: /\b(wellness|meditation|mindfulness|headspace|calm|mental\s*health|breathing|sleep|relaxation|self\s*care|journal|waking\s*up|balance\s*app|insight\s*timer|flo)\b/i },
  { category: 'productivity', keywords: /\b(productivity|notion|todoist|slack|task|to\s*do|kanban|project|notes|calendar|planner|agenda|workspace|asana|clickup|monday|obsidian|bear\s*app|linear)\b/i },
  { category: 'navigation', keywords: /\b(navigation|map|maps|directions|google\s*maps|waze|gps|route|find\s*nearby|location|here\s*wego|sygic|tomtom|mappls)\b/i },
  { category: 'news', keywords: /\b(news|breaking\s*news|article|headline|magazine|editorial|newspaper|blog|digest|reuters|bbc|guardian|inshorts|dailyhunt)\b/i },
  { category: 'weather', keywords: /\b(weather|forecast|temperature|rain|wind|humidity|storm|climate|dark\s*sky|carrot\s*weather|accuweather|sunny|cloudy|snow)\b/i },
  { category: 'real_estate', keywords: /\b(real\s*estate|property|house|apartment|rent|buy\s*home|zillow|trulia|realtor|99acres|magicbricks|housing\.com|flat|condo|mortgage)\b/i },
  { category: 'gaming', keywords: /\b(gaming|game|steam|epic\s*games|twitch|discord|esports|playstation|xbox|nintendo|gamer|leaderboard|achievement|multiplayer)\b/i },
  { category: 'photography', keywords: /\b(photography|camera|photo\s*editor|vsco|snapseed|lightroom|filter|edit\s*photo|gallery|portrait|exposure|preset)\b/i },
  { category: 'parking', keywords: /\b(parking|ev\s*charging|chargepoint|plugshare|electrify|parkmobile|parkwhiz|electric\s*vehicle|charging\s*station|park\s*spot)\b/i },
  { category: 'healthcare', keywords: /\b(healthcare|doctor|hospital|medical|health\s*care|practo|zocdoc|mychart|teladoc|appointment|prescription|pharmacy|diagnosis|patient|clinic)\b/i },
  { category: 'jobs', keywords: /\b(job|career|hiring|recruit|resume|indeed|glassdoor|naukri|monster|angellist|linkedin\s*jobs|apply|interview|salary|employment)\b/i },
  { category: 'kids', keywords: /\b(kids|children|parenting|baby|toddler|youtube\s*kids|khan\s*academy\s*kids|babycenter|pbs\s*kids|nursery|preschool|family|mom|dad|parent)\b/i },
]

// ---------------------------------------------------------------------------
// Palettes per category — 200+ total
// ---------------------------------------------------------------------------

const PALETTES: Record<string, ColorPalette[]> = {

  // =========================================================================
  // 1. FITNESS (10 palettes)
  // Nike, Strava, Peloton, Fitbit, Apple Fitness+, Whoop, Garmin, Under Armour, Samsung Health
  // =========================================================================
  fitness: [
    { name: 'Midnight Athlete', backgrounds: { dark: '#111111', light: '#F5F5F5' }, primary: '#E5E5E5', secondary: '#FA5A5A', accent: '#3A80F8', surface: '#1A1A1A', cardBg: '#1E1E1E', textPrimary: '#FFFFFF', textSecondary: '#A0A0A0', success: '#34C759', error: '#FF3B30', mood: 'bold, minimal, premium athletic', gradientPair: ['#3A80F8', '#D859F7'] },
    { name: 'Neon Burn', backgrounds: { dark: '#0E0E0E', light: '#FFF8F5' }, primary: '#FC4C02', secondary: '#FCE434', accent: '#FF6B2B', surface: '#1C1C1E', cardBg: '#2C2C2E', textPrimary: '#FFFFFF', textSecondary: '#8E8E93', success: '#30D158', error: '#FF453A', mood: 'energetic, competitive, outdoor', gradientPair: ['#FC4C02', '#FCE434'] },
    { name: 'Electric Pulse', backgrounds: { dark: '#0A0A0A', light: '#F0FFF4' }, primary: '#22C55E', secondary: '#06B6D4', accent: '#A855F7', surface: '#141414', cardBg: '#1E1E1E', textPrimary: '#F0F0F0', textSecondary: '#6B7280', success: '#22C55E', error: '#EF4444', mood: 'futuristic, tech-forward, intense', gradientPair: ['#22C55E', '#06B6D4'] },
    { name: 'Peloton Red', backgrounds: { dark: '#0C0C0C', light: '#FFFFFF' }, primary: '#C41F2F', secondary: '#CED0CF', accent: '#E83545', surface: '#181818', cardBg: '#222222', textPrimary: '#FFFFFF', textSecondary: '#909090', success: '#4CAF50', error: '#C41F2F', mood: 'premium, intense, community-driven' },
    { name: 'Apple Fitness Glow', backgrounds: { dark: '#000000', light: '#F2F2F7' }, primary: '#30D158', secondary: '#FF375F', accent: '#64D2FF', surface: '#1C1C1E', cardBg: '#2C2C2E', textPrimary: '#FFFFFF', textSecondary: '#8E8E93', success: '#30D158', error: '#FF375F', mood: 'polished, ring-closing, Apple-ecosystem', gradientPair: ['#30D158', '#64D2FF'] },
    { name: 'Whoop Strain', backgrounds: { dark: '#0B1119', light: '#F5F7FA' }, primary: '#00BAFF', secondary: '#F5A623', accent: '#FF4757', surface: '#131B26', cardBg: '#1A2435', textPrimary: '#FFFFFF', textSecondary: '#7A8BA0', success: '#26D97F', error: '#FF4757', mood: 'data-dense, recovery-focused, scientific', gradientPair: ['#00BAFF', '#F5A623'] },
    { name: 'Garmin Outdoor', backgrounds: { dark: '#1A1A1A', light: '#FFFFFF' }, primary: '#007CC3', secondary: '#F0B323', accent: '#48A0DC', surface: '#242424', cardBg: '#2E2E2E', textPrimary: '#FFFFFF', textSecondary: '#999999', success: '#3CB371', error: '#E74C3C', mood: 'rugged, outdoor, adventure-ready' },
    { name: 'UA Performance', backgrounds: { dark: '#0A0A0A', light: '#FFFFFF' }, primary: '#EA1D2C', secondary: '#333333', accent: '#FF4444', surface: '#141414', cardBg: '#1E1E1E', textPrimary: '#FFFFFF', textSecondary: '#888888', success: '#00B67A', error: '#EA1D2C', mood: 'aggressive, performance, motivating' },
    { name: 'Samsung Vitals', backgrounds: { dark: '#121212', light: '#FFFFFF' }, primary: '#1259B8', secondary: '#FF6B00', accent: '#4FC3F7', surface: '#1E1E1E', cardBg: '#282828', textPrimary: '#FFFFFF', textSecondary: '#AAAAAA', success: '#00BFA5', error: '#FF5252', mood: 'clean, Samsung-ecosystem, data-first' },
    { name: 'Lime Kinetic', backgrounds: { dark: '#0A0A0A', light: '#F5FFF0' }, primary: '#CBFF00', secondary: '#00FF88', accent: '#B8FF00', surface: '#141414', cardBg: '#1C1C1C', textPrimary: '#FFFFFF', textSecondary: '#80806B', success: '#00FF88', error: '#FF3366', mood: 'electric, high-energy, rave-fitness', gradientPair: ['#CBFF00', '#00FF88'] },
  ],

  // =========================================================================
  // 2. FINANCE (10 palettes)
  // Robinhood, Cash App, Revolut, Stripe, Square, Groww, Zerodha, Angel One
  // =========================================================================
  finance: [
    { name: 'Market Green', backgrounds: { dark: '#1C1C1E', light: '#FFFFFF' }, primary: '#00C805', secondary: '#5AC53A', accent: '#FFB800', surface: '#F5F5F7', cardBg: '#FFFFFF', textPrimary: '#1C1C1E', textSecondary: '#6E6E73', success: '#00C805', error: '#FF6347', mood: 'approachable, optimistic, retail-friendly', gradientPair: ['#00C805', '#5AC53A'] },
    { name: 'Cash Flow', backgrounds: { dark: '#000000', light: '#F0FFF0' }, primary: '#00D54B', secondary: '#00A83A', accent: '#FFFFFF', surface: '#121212', cardBg: '#1A1A1A', textPrimary: '#FFFFFF', textSecondary: '#8C8C8C', success: '#00D54B', error: '#FF4444', mood: 'bold, modern, money-centric' },
    { name: 'Fintech Dark', backgrounds: { dark: '#191C1F', light: '#F5F6FA' }, primary: '#7F84F6', secondary: '#00D68F', accent: '#A78BFA', surface: '#21252A', cardBg: '#282D35', textPrimary: '#F0F1F5', textSecondary: '#8890A0', success: '#00D68F', error: '#F04848', mood: 'premium, dark fintech, sophisticated', gradientPair: ['#7F84F6', '#A78BFA'] },
    { name: 'Stripe Indigo', backgrounds: { dark: '#0A2540', light: '#FFFFFF' }, primary: '#635BFF', secondary: '#00D4FF', accent: '#80E9FF', surface: '#0E2F50', cardBg: '#123760', textPrimary: '#FFFFFF', textSecondary: '#7A98B5', success: '#09825D', error: '#DF1B41', mood: 'premium, developer-friendly, trustworthy', gradientPair: ['#635BFF', '#00D4FF'] },
    { name: 'Square Modern', backgrounds: { dark: '#1A1A1A', light: '#FFFFFF' }, primary: '#006AFF', secondary: '#000000', accent: '#3D5AFE', surface: '#242424', cardBg: '#2E2E2E', textPrimary: '#FFFFFF', textSecondary: '#999999', success: '#00C853', error: '#FF1744', mood: 'clean, merchant-focused, modern' },
    { name: 'Groww Green', backgrounds: { dark: '#0C1B2A', light: '#FFFFFF' }, primary: '#5367FF', secondary: '#00B386', accent: '#7C8CF5', surface: '#132238', cardBg: '#1A2D45', textPrimary: '#FFFFFF', textSecondary: '#8098B5', success: '#00B386', error: '#EB5757', mood: 'Indian fintech, youthful, investment-friendly', gradientPair: ['#5367FF', '#7C8CF5'] },
    { name: 'Zerodha Kite', backgrounds: { dark: '#1B1B28', light: '#FFFFFF' }, primary: '#387ED1', secondary: '#E25A5A', accent: '#48B685', surface: '#242434', cardBg: '#2C2C40', textPrimary: '#FFFFFF', textSecondary: '#8888AA', success: '#48B685', error: '#E25A5A', mood: 'trading-focused, minimal, data-rich' },
    { name: 'Venmo Blue', backgrounds: { dark: '#1A1A2E', light: '#FFFFFF' }, primary: '#008CFF', secondary: '#3DA6FF', accent: '#0070CC', surface: '#222236', cardBg: '#2A2A40', textPrimary: '#FFFFFF', textSecondary: '#8888AA', success: '#4CAF50', error: '#FF5252', mood: 'social, casual, peer-to-peer' },
    { name: 'Zelle Purple', backgrounds: { dark: '#1A0A2E', light: '#FFFFFF' }, primary: '#6D1ED4', secondary: '#8A4FE0', accent: '#B388FF', surface: '#241440', cardBg: '#2E1C50', textPrimary: '#FFFFFF', textSecondary: '#9988BB', success: '#00C853', error: '#FF5252', mood: 'instant, modern, bank-integrated', gradientPair: ['#6D1ED4', '#8A4FE0'] },
    { name: 'PayPal Navy', backgrounds: { dark: '#1A2040', light: '#FFFFFF' }, primary: '#253B80', secondary: '#169BD7', accent: '#009CDE', surface: '#222850', cardBg: '#2A3060', textPrimary: '#FFFFFF', textSecondary: '#8090B0', success: '#00A651', error: '#C40234', mood: 'trustworthy, global, established' },
  ],

  // =========================================================================
  // 3. INDIA FINTECH (5 palettes) — NEW
  // PhonePe, Google Pay, Paytm, CRED, Jupiter
  // =========================================================================
  india_fintech: [
    { name: 'PhonePe Purple', backgrounds: { dark: '#1C0A3C', light: '#F5F0FF' }, primary: '#5F259F', secondary: '#8B5CF6', accent: '#A78BFA', surface: '#261050', cardBg: '#301860', textPrimary: '#FFFFFF', textSecondary: '#B0A0CC', success: '#4CAF50', error: '#F44336', mood: 'Indian UPI, purple-dominant, mass-market', gradientPair: ['#5F259F', '#8B5CF6'] },
    { name: 'GPay Teal', backgrounds: { dark: '#0A1A20', light: '#FFFFFF' }, primary: '#2DA94F', secondary: '#4285F4', accent: '#34A853', surface: '#142830', cardBg: '#1C3240', textPrimary: '#FFFFFF', textSecondary: '#80A0B0', success: '#2DA94F', error: '#EA4335', mood: 'Google-clean, multi-color, trusted' },
    { name: 'Paytm Blue', backgrounds: { dark: '#00224F', light: '#FFFFFF' }, primary: '#00BAF2', secondary: '#002970', accent: '#00D4FF', surface: '#002C60', cardBg: '#003670', textPrimary: '#FFFFFF', textSecondary: '#80B0D0', success: '#4CAF50', error: '#F44336', mood: 'mass-market Indian, blue-dominant, utilitarian' },
    { name: 'CRED Dark', backgrounds: { dark: '#0A0A0A', light: '#F5F5F5' }, primary: '#C5A47E', secondary: '#8B7355', accent: '#E8C89E', surface: '#141414', cardBg: '#1C1C1C', textPrimary: '#FFFFFF', textSecondary: '#808080', success: '#4CAF50', error: '#CF6679', mood: 'premium, members-only, luxury dark', gradientPair: ['#C5A47E', '#8B7355'] },
    { name: 'Jupiter Orange', backgrounds: { dark: '#1A1018', light: '#FFFAF0' }, primary: '#FF6B2B', secondary: '#FF9500', accent: '#FFB800', surface: '#241820', cardBg: '#2E2028', textPrimary: '#FFFFFF', textSecondary: '#B0A098', success: '#34C759', error: '#FF3B30', mood: 'neobank, youthful, orange-warm', gradientPair: ['#FF6B2B', '#FF9500'] },
  ],

  // =========================================================================
  // 4. FOOD DELIVERY (8 palettes)
  // Uber Eats, DoorDash, Swiggy, Zomato, Rappi, iFood, FoodPanda, Grubhub
  // =========================================================================
  food_delivery: [
    { name: 'Fresh Market', backgrounds: { dark: '#1A1A1A', light: '#FFFFFF' }, primary: '#06C167', secondary: '#FFB800', accent: '#F5F5F5', surface: '#F7F7F7', cardBg: '#FFFFFF', textPrimary: '#1A1A1A', textSecondary: '#6B6B6B', success: '#06C167', error: '#E74C3C', mood: 'fresh, clean, appetizing' },
    { name: 'Flame Orange', backgrounds: { dark: '#1A0A0A', light: '#FFFAF6' }, primary: '#FF3008', secondary: '#FF7A00', accent: '#FFB800', surface: '#241414', cardBg: '#2E1A1A', textPrimary: '#FFFFFF', textSecondary: '#B08080', success: '#2ECC71', error: '#FF3008', mood: 'bold, urgent, craving-inducing', gradientPair: ['#FF3008', '#FF7A00'] },
    { name: 'Warm Spice', backgrounds: { dark: '#1A1008', light: '#FFF9F0' }, primary: '#FC8019', secondary: '#E23744', accent: '#FFD166', surface: '#241C10', cardBg: '#2E2418', textPrimary: '#FFFFFF', textSecondary: '#B0A090', success: '#27AE60', error: '#E23744', mood: 'warm, inviting, street-food vibes', gradientPair: ['#FC8019', '#FFD166'] },
    { name: 'Zomato Red', backgrounds: { dark: '#1A0808', light: '#FFFFFF' }, primary: '#E23744', secondary: '#FF7E8B', accent: '#CB202D', surface: '#241010', cardBg: '#2E1818', textPrimary: '#FFFFFF', textSecondary: '#B08888', success: '#48C479', error: '#E23744', mood: 'vibrant, food-centric, Indian delivery' },
    { name: 'Rappi Coral', backgrounds: { dark: '#1A1010', light: '#FFF5F2' }, primary: '#FF695C', secondary: '#FF441F', accent: '#FF8C7C', surface: '#241818', cardBg: '#2E2020', textPrimary: '#FFFFFF', textSecondary: '#B09090', success: '#00C853', error: '#FF695C', mood: 'Latin American, coral-warm, fast delivery', gradientPair: ['#FF695C', '#FF441F'] },
    { name: 'iFood Red', backgrounds: { dark: '#1A0808', light: '#FFFFFF' }, primary: '#EA1D2C', secondary: '#A10C1B', accent: '#FF4444', surface: '#241010', cardBg: '#2E1818', textPrimary: '#FFFFFF', textSecondary: '#B08888', success: '#00C853', error: '#EA1D2C', mood: 'Brazilian, bold red, food-first' },
    { name: 'FoodPanda Pink', backgrounds: { dark: '#1A0814', light: '#FFF0F5' }, primary: '#D70F64', secondary: '#FF2B85', accent: '#FF69B4', surface: '#24101C', cardBg: '#2E1826', textPrimary: '#FFFFFF', textSecondary: '#B08098', success: '#00C853', error: '#D70F64', mood: 'playful, pink-accent, Asian delivery' },
    { name: 'Grubhub Orange', backgrounds: { dark: '#1A1208', light: '#FFFFFF' }, primary: '#F63440', secondary: '#FF8C00', accent: '#FFD700', surface: '#241A10', cardBg: '#2E2218', textPrimary: '#FFFFFF', textSecondary: '#B0A088', success: '#4CAF50', error: '#F63440', mood: 'American, orange-red, convenience', gradientPair: ['#F63440', '#FF8C00'] },
  ],

  // =========================================================================
  // 5. GROCERY / QUICK COMMERCE (5 palettes) — NEW
  // Instacart, Blinkit, Zepto, Gorillas, Gopuff
  // =========================================================================
  grocery: [
    { name: 'Instacart Green', backgrounds: { dark: '#0A1A10', light: '#FFFFFF' }, primary: '#43B02A', secondary: '#003D29', accent: '#72D15B', surface: '#142820', cardBg: '#1C3228', textPrimary: '#FFFFFF', textSecondary: '#80A890', success: '#43B02A', error: '#E53935', mood: 'fresh, grocery-green, household' },
    { name: 'Blinkit Yellow', backgrounds: { dark: '#1A1A08', light: '#FFFDE7' }, primary: '#F5C700', secondary: '#E6B800', accent: '#FFD740', surface: '#24240E', cardBg: '#2E2E16', textPrimary: '#1A1A1A', textSecondary: '#666650', success: '#4CAF50', error: '#F44336', mood: 'Indian quick-commerce, yellow-speed, 10-min delivery' },
    { name: 'Zepto Purple', backgrounds: { dark: '#1A0A20', light: '#F8F0FF' }, primary: '#8B2FC9', secondary: '#A855F7', accent: '#C77DFF', surface: '#241430', cardBg: '#2E1C3C', textPrimary: '#FFFFFF', textSecondary: '#A090B8', success: '#4CAF50', error: '#E53935', mood: 'ultra-fast, purple-energy, Indian quick-commerce', gradientPair: ['#8B2FC9', '#A855F7'] },
    { name: 'Gorillas Dark', backgrounds: { dark: '#0A0A0A', light: '#FFFFFF' }, primary: '#000000', secondary: '#FFD700', accent: '#FFC107', surface: '#141414', cardBg: '#1E1E1E', textPrimary: '#FFFFFF', textSecondary: '#999999', success: '#4CAF50', error: '#F44336', mood: 'urban, dark minimal, speed-focused' },
    { name: 'Gopuff Blue', backgrounds: { dark: '#0A1020', light: '#F0F5FF' }, primary: '#0050DC', secondary: '#00C2FF', accent: '#4A90D9', surface: '#141828', cardBg: '#1C2235', textPrimary: '#FFFFFF', textSecondary: '#8098B8', success: '#00C853', error: '#FF5252', mood: 'convenience, blue-trust, instant delivery', gradientPair: ['#0050DC', '#00C2FF'] },
  ],

  // =========================================================================
  // 6. SOCIAL (8 palettes)
  // Instagram, TikTok, Twitter/X, LinkedIn, Reddit, Pinterest, Mastodon, Bluesky
  // =========================================================================
  social: [
    { name: 'Vibrant Social', backgrounds: { dark: '#000000', light: '#FFFFFF' }, primary: '#E1306C', secondary: '#833AB4', accent: '#F77737', surface: '#121212', cardBg: '#1A1A1A', textPrimary: '#FFFFFF', textSecondary: '#A0A0A0', success: '#4BB543', error: '#ED4956', mood: 'vibrant, expressive, visual-first', gradientPair: ['#833AB4', '#E1306C'] },
    { name: 'Electric Social', backgrounds: { dark: '#010101', light: '#FFFFFF' }, primary: '#FE2C55', secondary: '#25F4EE', accent: '#FFFFFF', surface: '#161823', cardBg: '#1E2030', textPrimary: '#FFFFFF', textSecondary: '#8A8B91', success: '#34C759', error: '#FE2C55', mood: 'high-energy, gen-z, trend-driven', gradientPair: ['#FE2C55', '#25F4EE'] },
    { name: 'Clean Pro', backgrounds: { dark: '#1B1F23', light: '#FFFFFF' }, primary: '#0A66C2', secondary: '#057642', accent: '#E7A33E', surface: '#252A30', cardBg: '#2C3238', textPrimary: '#F0F2F5', textSecondary: '#9BA3AE', success: '#057642', error: '#CC1016', mood: 'professional, trustworthy, corporate' },
    { name: 'Reddit Orange', backgrounds: { dark: '#1A1A1B', light: '#FFFFFF' }, primary: '#FF4500', secondary: '#0079D3', accent: '#FF8717', surface: '#272729', cardBg: '#2E2E30', textPrimary: '#D7DADC', textSecondary: '#818384', success: '#46D160', error: '#FF585B', mood: 'community, discussion, open-forum' },
    { name: 'Pinterest Red', backgrounds: { dark: '#1A0808', light: '#FFFFFF' }, primary: '#E60023', secondary: '#BD081C', accent: '#FF5C5C', surface: '#241010', cardBg: '#2E1818', textPrimary: '#FFFFFF', textSecondary: '#B08888', success: '#4CAF50', error: '#E60023', mood: 'inspirational, visual, aspirational' },
    { name: 'Snapchat Pop', backgrounds: { dark: '#000000', light: '#FFFC00' }, primary: '#FFFC00', secondary: '#000000', accent: '#FF6600', surface: '#1A1A1A', cardBg: '#242424', textPrimary: '#FFFFFF', textSecondary: '#999999', success: '#4CAF50', error: '#FF3B30', mood: 'playful, youthful, ephemeral' },
    { name: 'Mastodon Violet', backgrounds: { dark: '#191B22', light: '#F2F2F7' }, primary: '#6364FF', secondary: '#858AFA', accent: '#2B90D9', surface: '#232530', cardBg: '#2B2D3A', textPrimary: '#F0F0FF', textSecondary: '#9090A8', success: '#3DCB6E', error: '#DF405A', mood: 'decentralized, indie, community-owned' },
    { name: 'Bluesky Open', backgrounds: { dark: '#161E27', light: '#FFFFFF' }, primary: '#0085FF', secondary: '#0066CC', accent: '#4DA6FF', surface: '#1E2830', cardBg: '#263038', textPrimary: '#FFFFFF', textSecondary: '#8898A8', success: '#00C853', error: '#FF4444', mood: 'open, twitter-alternative, blue-sky vibes' },
  ],

  // =========================================================================
  // 7. ECOMMERCE (8 palettes)
  // Amazon, Nike, SHEIN, Etsy, Walmart, Target, Flipkart, Meesho, Nykaa, Myntra
  // =========================================================================
  ecommerce: [
    { name: 'Bold Commerce', backgrounds: { dark: '#111111', light: '#FFFFFF' }, primary: '#000000', secondary: '#FF9900', accent: '#232F3E', surface: '#1A1A1A', cardBg: '#222222', textPrimary: '#FFFFFF', textSecondary: '#999999', success: '#007600', error: '#B12704', mood: 'utilitarian, high-conversion, warm' },
    { name: 'Luxury Minimal', backgrounds: { dark: '#0A0A0A', light: '#FAFAF9' }, primary: '#1A1A1A', secondary: '#C4A35A', accent: '#8B7340', surface: '#141414', cardBg: '#1C1C1C', textPrimary: '#F5F5F0', textSecondary: '#8A8A80', success: '#4CAF50', error: '#D32F2F', mood: 'premium, luxury, curated', gradientPair: ['#C4A35A', '#8B7340'] },
    { name: 'Trend Flash', backgrounds: { dark: '#0D0D0D', light: '#FFFFFF' }, primary: '#000000', secondary: '#D50002', accent: '#FF4081', surface: '#1A1A1A', cardBg: '#242424', textPrimary: '#FFFFFF', textSecondary: '#9E9E9E', success: '#4CAF50', error: '#D50002', mood: 'trendy, fast-fashion, youthful' },
    { name: 'Etsy Craft', backgrounds: { dark: '#1A1410', light: '#FEFCF6' }, primary: '#F1641E', secondary: '#232347', accent: '#D35400', surface: '#241C14', cardBg: '#2E2418', textPrimary: '#FFFFFF', textSecondary: '#B0A088', success: '#4CAF50', error: '#D50002', mood: 'handmade, artisan, warm-craft' },
    { name: 'Walmart Value', backgrounds: { dark: '#001E3C', light: '#FFFFFF' }, primary: '#0071CE', secondary: '#FFC220', accent: '#007DC6', surface: '#002850', cardBg: '#003360', textPrimary: '#FFFFFF', textSecondary: '#80A0C0', success: '#4CAF50', error: '#E53935', mood: 'value, accessible, family-friendly' },
    { name: 'Target Bold', backgrounds: { dark: '#1A0808', light: '#FFFFFF' }, primary: '#CC0000', secondary: '#333333', accent: '#FF4444', surface: '#241010', cardBg: '#2E1818', textPrimary: '#FFFFFF', textSecondary: '#B08888', success: '#4CAF50', error: '#CC0000', mood: 'bold, clean, design-conscious' },
    { name: 'Flipkart Blue', backgrounds: { dark: '#002448', light: '#FFFFFF' }, primary: '#2874F0', secondary: '#FFE500', accent: '#4A90D9', surface: '#003060', cardBg: '#003C78', textPrimary: '#FFFFFF', textSecondary: '#80A8D0', success: '#26A541', error: '#FF6161', mood: 'Indian ecommerce, blue trust, deal-driven' },
    { name: 'Nykaa Pink', backgrounds: { dark: '#1A0814', light: '#FFF0F5' }, primary: '#FC2779', secondary: '#E91E8C', accent: '#FF69B4', surface: '#24101C', cardBg: '#2E1826', textPrimary: '#FFFFFF', textSecondary: '#B08098', success: '#4CAF50', error: '#FC2779', mood: 'beauty, pink-glam, Indian fashion', gradientPair: ['#FC2779', '#E91E8C'] },
  ],

  // =========================================================================
  // 8. CRYPTO (8 palettes)
  // Coinbase, Phantom, Binance, Kraken, Uniswap, OpenSea, Jupiter, Raydium
  // =========================================================================
  crypto: [
    { name: 'Trust Blue', backgrounds: { dark: '#050D1E', light: '#FFFFFF' }, primary: '#0052FF', secondary: '#00D395', accent: '#4B93FF', surface: '#0A1628', cardBg: '#0F1D32', textPrimary: '#FFFFFF', textSecondary: '#8899B0', success: '#00D395', error: '#F6465D', mood: 'trustworthy, institutional, clean', gradientPair: ['#0052FF', '#4B93FF'] },
    { name: 'Phantom Violet', backgrounds: { dark: '#13111C', light: '#F7F5FF' }, primary: '#AB9FF2', secondary: '#534BB1', accent: '#E8DFF8', surface: '#1C1928', cardBg: '#242030', textPrimary: '#F0ECFF', textSecondary: '#8880A0', success: '#4ADE80', error: '#FB7185', mood: 'web3-native, purple-tinted, defi', gradientPair: ['#AB9FF2', '#534BB1'] },
    { name: 'Chain Dark', backgrounds: { dark: '#0B0E11', light: '#FAFAFA' }, primary: '#F0B90B', secondary: '#FCD535', accent: '#F8D12F', surface: '#14171B', cardBg: '#1E2329', textPrimary: '#EAECEF', textSecondary: '#848E9C', success: '#0ECB81', error: '#F6465D', mood: 'crypto-native, exchange-style, data-dense' },
    { name: 'Kraken Purple', backgrounds: { dark: '#110A20', light: '#F5F0FF' }, primary: '#7132F5', secondary: '#5B21B6', accent: '#A78BFA', surface: '#1A1430', cardBg: '#221C3C', textPrimary: '#FFFFFF', textSecondary: '#9080B0', success: '#00D395', error: '#FF6B6B', mood: 'pro-trading, purple-deep, institutional', gradientPair: ['#7132F5', '#5B21B6'] },
    { name: 'Uniswap Pink', backgrounds: { dark: '#131313', light: '#FFF0F8' }, primary: '#FF007A', secondary: '#2172E5', accent: '#FF4DA0', surface: '#1C1C20', cardBg: '#24242C', textPrimary: '#FFFFFF', textSecondary: '#8888A0', success: '#27AE60', error: '#FF007A', mood: 'defi, pink-accent, swap-focused', gradientPair: ['#FF007A', '#2172E5'] },
    { name: 'OpenSea Blue', backgrounds: { dark: '#0C1A2C', light: '#FFFFFF' }, primary: '#2081E2', secondary: '#3B9FE7', accent: '#8ED1FC', surface: '#142438', cardBg: '#1C2E48', textPrimary: '#FFFFFF', textSecondary: '#8098B5', success: '#4CAF50', error: '#EB5757', mood: 'NFT marketplace, blue-ocean, collectibles' },
    { name: 'Jupiter Sol', backgrounds: { dark: '#0C1016', light: '#F0FFF8' }, primary: '#C7F284', secondary: '#24AE8F', accent: '#7FE0C0', surface: '#141820', cardBg: '#1C222C', textPrimary: '#FFFFFF', textSecondary: '#808C9C', success: '#C7F284', error: '#FF6B6B', mood: 'Solana-native, lime-green, swap-fast', gradientPair: ['#C7F284', '#24AE8F'] },
    { name: 'Raydium Glow', backgrounds: { dark: '#0A0C1A', light: '#F0F5FF' }, primary: '#2EE4F0', secondary: '#6F4BFF', accent: '#48DBFB', surface: '#12142A', cardBg: '#1A1C34', textPrimary: '#FFFFFF', textSecondary: '#8088B0', success: '#2EE4F0', error: '#FF4D6A', mood: 'Solana defi, neon-glow, liquidity-pool', gradientPair: ['#2EE4F0', '#6F4BFF'] },
  ],

  // =========================================================================
  // 9. TRAVEL (8 palettes)
  // Airbnb, Booking.com, TripAdvisor, Kayak, MakeMyTrip, Goibibo, Cleartrip
  // =========================================================================
  travel: [
    { name: 'Coral Escape', backgrounds: { dark: '#1A1A1A', light: '#FFFFFF' }, primary: '#FF385C', secondary: '#00A699', accent: '#FFB400', surface: '#F7F7F7', cardBg: '#FFFFFF', textPrimary: '#222222', textSecondary: '#717171', success: '#00A699', error: '#FF385C', mood: 'warm, exploratory, community-driven', gradientPair: ['#FF385C', '#FF7E82'] },
    { name: 'Deep Blue Travel', backgrounds: { dark: '#00224F', light: '#FFFFFF' }, primary: '#003580', secondary: '#FEBB02', accent: '#006CE4', surface: '#002A5C', cardBg: '#003670', textPrimary: '#FFFFFF', textSecondary: '#B0C4DE', success: '#008009', error: '#CC0000', mood: 'trustworthy, deals-focused, established' },
    { name: 'Sunset Journey', backgrounds: { dark: '#14100E', light: '#FFFBF5' }, primary: '#FF6F61', secondary: '#5B8C5A', accent: '#F4A261', surface: '#1E1816', cardBg: '#282220', textPrimary: '#FFF5EB', textSecondary: '#A09080', success: '#5B8C5A', error: '#E25555', mood: 'warm, adventure, wanderlust', gradientPair: ['#FF6F61', '#F4A261'] },
    { name: 'TripAdvisor Green', backgrounds: { dark: '#0A1A10', light: '#FFFFFF' }, primary: '#34E0A1', secondary: '#00AA6C', accent: '#000000', surface: '#142820', cardBg: '#1C3228', textPrimary: '#FFFFFF', textSecondary: '#80A890', success: '#34E0A1', error: '#E53935', mood: 'review-focused, green trust, global traveler' },
    { name: 'Kayak Orange', backgrounds: { dark: '#1A1008', light: '#FFFFFF' }, primary: '#FF690F', secondary: '#E35900', accent: '#FF8C42', surface: '#241A10', cardBg: '#2E2218', textPrimary: '#FFFFFF', textSecondary: '#B0A088', success: '#4CAF50', error: '#E53935', mood: 'comparison-shopping, bold orange, deal-hunter' },
    { name: 'MakeMyTrip Red', backgrounds: { dark: '#1A0808', light: '#FFFFFF' }, primary: '#E43C40', secondary: '#2A2A80', accent: '#FF6666', surface: '#241010', cardBg: '#2E1818', textPrimary: '#FFFFFF', textSecondary: '#B08888', success: '#00C853', error: '#E43C40', mood: 'Indian travel, red-bold, OTA-style', gradientPair: ['#E43C40', '#2A2A80'] },
    { name: 'Goibibo Blue', backgrounds: { dark: '#0A1020', light: '#F0F5FF' }, primary: '#EE5535', secondary: '#F77728', accent: '#FF8C00', surface: '#141828', cardBg: '#1C2238', textPrimary: '#FFFFFF', textSecondary: '#8098B8', success: '#4CAF50', error: '#EE5535', mood: 'budget travel, orange warmth, Indian OTA' },
    { name: 'Cleartrip Teal', backgrounds: { dark: '#0A1A1A', light: '#FFFFFF' }, primary: '#2196F3', secondary: '#E44D26', accent: '#42A5F5', surface: '#142828', cardBg: '#1C3232', textPrimary: '#FFFFFF', textSecondary: '#80A0A0', success: '#4CAF50', error: '#E44D26', mood: 'clean, minimal, Indian premium travel' },
  ],

  // =========================================================================
  // 10. MUSIC (8 palettes)
  // Spotify, Apple Music, Tidal, Deezer, Amazon Music, Gaana, JioSaavn
  // =========================================================================
  music: [
    { name: 'Spotify Dark', backgrounds: { dark: '#121212', light: '#FFFFFF' }, primary: '#1DB954', secondary: '#1ED760', accent: '#B3B3B3', surface: '#181818', cardBg: '#282828', textPrimary: '#FFFFFF', textSecondary: '#B3B3B3', success: '#1DB954', error: '#E91429', mood: 'immersive, dark, music-centric' },
    { name: 'Apple Sound', backgrounds: { dark: '#0A0A0A', light: '#FFFFFF' }, primary: '#FC3C44', secondary: '#FA57C1', accent: '#AF52DE', surface: '#1C1C1E', cardBg: '#2C2C2E', textPrimary: '#FFFFFF', textSecondary: '#8E8E93', success: '#34C759', error: '#FF3B30', mood: 'premium, clean, curated', gradientPair: ['#FC3C44', '#FA57C1'] },
    { name: 'Neon Beats', backgrounds: { dark: '#0D0D1A', light: '#F5F0FF' }, primary: '#8B5CF6', secondary: '#EC4899', accent: '#06B6D4', surface: '#16162A', cardBg: '#1E1E35', textPrimary: '#F0EEFF', textSecondary: '#8080A0', success: '#10B981', error: '#EF4444', mood: 'vibrant, nocturnal, club-inspired', gradientPair: ['#8B5CF6', '#EC4899'] },
    { name: 'Tidal HiFi', backgrounds: { dark: '#0A0A0A', light: '#FFFFFF' }, primary: '#000000', secondary: '#20BBFF', accent: '#00CCFF', surface: '#141414', cardBg: '#1E1E1E', textPrimary: '#FFFFFF', textSecondary: '#808080', success: '#00D68F', error: '#FF4444', mood: 'audiophile, premium, HiFi-focused' },
    { name: 'Deezer Flow', backgrounds: { dark: '#0C0C14', light: '#FFFFFF' }, primary: '#A238FF', secondary: '#EF5466', accent: '#32C8CD', surface: '#161620', cardBg: '#1E1E2C', textPrimary: '#FFFFFF', textSecondary: '#8888A0', success: '#32C8CD', error: '#EF5466', mood: 'European, multi-color, flow-discovery', gradientPair: ['#A238FF', '#EF5466'] },
    { name: 'Amazon Echo', backgrounds: { dark: '#0D1B2A', light: '#FFFFFF' }, primary: '#25D1DA', secondary: '#FF9900', accent: '#48D1CC', surface: '#142435', cardBg: '#1C2E45', textPrimary: '#FFFFFF', textSecondary: '#8098B0', success: '#25D1DA', error: '#FF5252', mood: 'Alexa-integrated, teal-accent, smart-home' },
    { name: 'Gaana Red', backgrounds: { dark: '#1A0808', light: '#FFFFFF' }, primary: '#E72C30', secondary: '#B71C1C', accent: '#FF5252', surface: '#241010', cardBg: '#2E1818', textPrimary: '#FFFFFF', textSecondary: '#B08888', success: '#4CAF50', error: '#E72C30', mood: 'Bollywood, red-vibrant, Indian music' },
    { name: 'JioSaavn Blue', backgrounds: { dark: '#0A1020', light: '#FFFFFF' }, primary: '#2BC5B4', secondary: '#169688', accent: '#4DD0C0', surface: '#141828', cardBg: '#1C2238', textPrimary: '#FFFFFF', textSecondary: '#80A0B8', success: '#2BC5B4', error: '#FF5252', mood: 'Indian streaming, teal, Bollywood+Global' },
  ],

  // =========================================================================
  // 11. EDUCATION (8 palettes)
  // Duolingo, Coursera, Udemy, Skillshare, edX, Unacademy, BYJU'S
  // =========================================================================
  education: [
    { name: 'Playful Learn', backgrounds: { dark: '#1B1B2F', light: '#FFFFFF' }, primary: '#58CC02', secondary: '#1CB0F6', accent: '#FF9600', surface: '#232342', cardBg: '#2A2A50', textPrimary: '#FFFFFF', textSecondary: '#AFAFC7', success: '#58CC02', error: '#FF4B4B', mood: 'playful, gamified, motivating', gradientPair: ['#58CC02', '#1CB0F6'] },
    { name: 'Academic Blue', backgrounds: { dark: '#0A1929', light: '#FFFFFF' }, primary: '#0056D2', secondary: '#008060', accent: '#7F56D9', surface: '#122240', cardBg: '#1A2D50', textPrimary: '#F0F4FF', textSecondary: '#8899B0', success: '#008060', error: '#D14343', mood: 'academic, structured, credible' },
    { name: 'Warm Campus', backgrounds: { dark: '#1A1610', light: '#FFF9F0' }, primary: '#E76F51', secondary: '#2A9D8F', accent: '#F4A261', surface: '#241E16', cardBg: '#2E2820', textPrimary: '#FFF5EB', textSecondary: '#A09888', success: '#2A9D8F', error: '#E76F51', mood: 'warm, inviting, campus-feel', gradientPair: ['#E76F51', '#F4A261'] },
    { name: 'Udemy Purple', backgrounds: { dark: '#1A1028', light: '#FFFFFF' }, primary: '#A435F0', secondary: '#5022ED', accent: '#C77DFF', surface: '#241838', cardBg: '#2E2048', textPrimary: '#FFFFFF', textSecondary: '#A090C0', success: '#4CAF50', error: '#E53935', mood: 'marketplace, purple-learn, skill-building', gradientPair: ['#A435F0', '#5022ED'] },
    { name: 'Skillshare Green', backgrounds: { dark: '#0A1A14', light: '#FFFFFF' }, primary: '#00FF84', secondary: '#002333', accent: '#33FF9C', surface: '#142822', cardBg: '#1C3228', textPrimary: '#FFFFFF', textSecondary: '#80A098', success: '#00FF84', error: '#FF5252', mood: 'creative, neon-green, community-learning' },
    { name: 'edX Dark', backgrounds: { dark: '#10182A', light: '#FFFFFF' }, primary: '#02262B', secondary: '#E1354C', accent: '#00838F', surface: '#182238', cardBg: '#202C45', textPrimary: '#FFFFFF', textSecondary: '#8898B0', success: '#00838F', error: '#E1354C', mood: 'Ivy-League, prestigious, research-backed' },
    { name: 'Unacademy Green', backgrounds: { dark: '#0A1A10', light: '#F0FFF4' }, primary: '#08BD80', secondary: '#065F46', accent: '#34D399', surface: '#142820', cardBg: '#1C3228', textPrimary: '#FFFFFF', textSecondary: '#80A890', success: '#08BD80', error: '#E53935', mood: 'Indian edtech, green-growth, exam-prep' },
    { name: 'BYJUS Purple', backgrounds: { dark: '#1A0828', light: '#F5F0FF' }, primary: '#7B2DBA', secondary: '#A855F7', accent: '#9333EA', surface: '#241040', cardBg: '#2E1850', textPrimary: '#FFFFFF', textSecondary: '#A090C0', success: '#4CAF50', error: '#E53935', mood: 'Indian edtech, purple-premium, K-12 focused', gradientPair: ['#7B2DBA', '#A855F7'] },
  ],

  // =========================================================================
  // 12. RIDE HAILING (8 palettes)
  // Uber, Lyft, Bolt, Rapido, InDrive, Careem, DiDi, Ola
  // =========================================================================
  ride_hailing: [
    { name: 'Urban Black', backgrounds: { dark: '#000000', light: '#FFFFFF' }, primary: '#000000', secondary: '#276EF1', accent: '#3AA76D', surface: '#F6F6F6', cardBg: '#FFFFFF', textPrimary: '#000000', textSecondary: '#545454', success: '#3AA76D', error: '#D44333', mood: 'sophisticated, efficient, urban' },
    { name: 'Pink Ride', backgrounds: { dark: '#11111F', light: '#FFFFFF' }, primary: '#FF00BF', secondary: '#352384', accent: '#00B2A9', surface: '#F3F3F5', cardBg: '#FFFFFF', textPrimary: '#11111F', textSecondary: '#6B6B76', success: '#00B2A9', error: '#FF0052', mood: 'fun, approachable, community-driven', gradientPair: ['#FF00BF', '#352384'] },
    { name: 'Metro Pulse', backgrounds: { dark: '#101820', light: '#F4F7FA' }, primary: '#34D186', secondary: '#2E3A59', accent: '#5B6EF5', surface: '#1A2335', cardBg: '#202D44', textPrimary: '#ECF0F5', textSecondary: '#7A8BA0', success: '#34D186', error: '#F04E4E', mood: 'sleek, european, tech-forward', gradientPair: ['#34D186', '#5B6EF5'] },
    { name: 'Rapido Yellow', backgrounds: { dark: '#1A1A08', light: '#FFFFFF' }, primary: '#FFD300', secondary: '#E6B800', accent: '#FFC107', surface: '#242410', cardBg: '#2E2E18', textPrimary: '#1A1A1A', textSecondary: '#666650', success: '#4CAF50', error: '#F44336', mood: 'Indian bike-taxi, yellow-speed, affordable' },
    { name: 'InDrive Green', backgrounds: { dark: '#0A1A10', light: '#FFFFFF' }, primary: '#00CC66', secondary: '#009E50', accent: '#33FF99', surface: '#142820', cardBg: '#1C3228', textPrimary: '#FFFFFF', textSecondary: '#80A890', success: '#00CC66', error: '#E53935', mood: 'price-negotiation, green, global ride-sharing' },
    { name: 'Careem Teal', backgrounds: { dark: '#0A1A18', light: '#FFFFFF' }, primary: '#2BC1AC', secondary: '#078C73', accent: '#4DD8C0', surface: '#142828', cardBg: '#1C3430', textPrimary: '#FFFFFF', textSecondary: '#80A8A0', success: '#2BC1AC', error: '#E53935', mood: 'Middle-East, teal, super-app' },
    { name: 'DiDi Orange', backgrounds: { dark: '#1A1008', light: '#FFFFFF' }, primary: '#FC6603', secondary: '#E55B00', accent: '#FF8533', surface: '#241810', cardBg: '#2E2218', textPrimary: '#FFFFFF', textSecondary: '#B0A088', success: '#4CAF50', error: '#E53935', mood: 'Chinese mega-app, orange-bold, global expansion' },
    { name: 'Ola Blue', backgrounds: { dark: '#0A1020', light: '#FFFFFF' }, primary: '#005F30', secondary: '#007A3D', accent: '#00A651', surface: '#141C28', cardBg: '#1C2835', textPrimary: '#FFFFFF', textSecondary: '#8098A8', success: '#00A651', error: '#E53935', mood: 'Indian ride-hailing, green-auto, mass-market' },
  ],

  // =========================================================================
  // 13. MESSAGING (8 palettes)
  // WhatsApp, Telegram, Signal, WeChat, LINE, Viber, KakaoTalk
  // =========================================================================
  messaging: [
    { name: 'Chat Green', backgrounds: { dark: '#111B21', light: '#FFFFFF' }, primary: '#25D366', secondary: '#075E54', accent: '#34B7F1', surface: '#202C33', cardBg: '#1F2C34', textPrimary: '#E9EDEF', textSecondary: '#8696A0', success: '#25D366', error: '#F15C6D', mood: 'trustworthy, familiar, utilitarian' },
    { name: 'Cloud Blue', backgrounds: { dark: '#17212B', light: '#FFFFFF' }, primary: '#0088CC', secondary: '#34AADF', accent: '#5EB5F7', surface: '#232E3C', cardBg: '#242F3D', textPrimary: '#F5F5F5', textSecondary: '#708499', success: '#4FAE4E', error: '#E53935', mood: 'fast, clean, cloud-native', gradientPair: ['#0088CC', '#34AADF'] },
    { name: 'Secure Minimal', backgrounds: { dark: '#1B1C1F', light: '#FFFFFF' }, primary: '#3A76F0', secondary: '#2C5DC9', accent: '#6B93F7', surface: '#252628', cardBg: '#2D2E31', textPrimary: '#FFFFFF', textSecondary: '#9098A0', success: '#4CAF50', error: '#E34040', mood: 'secure, minimal, private' },
    { name: 'WeChat Green', backgrounds: { dark: '#111111', light: '#EDEDED' }, primary: '#07C160', secondary: '#1AAD19', accent: '#51C332', surface: '#1A1A1A', cardBg: '#222222', textPrimary: '#FFFFFF', textSecondary: '#999999', success: '#07C160', error: '#E53935', mood: 'Chinese super-app, green-ecosystem, everything-app' },
    { name: 'LINE Green', backgrounds: { dark: '#111111', light: '#FFFFFF' }, primary: '#00B900', secondary: '#00E000', accent: '#4CD964', surface: '#1A1A1A', cardBg: '#222222', textPrimary: '#FFFFFF', textSecondary: '#999999', success: '#00B900', error: '#FF3B30', mood: 'Japanese, bright green, sticker-friendly' },
    { name: 'Viber Purple', backgrounds: { dark: '#1A0828', light: '#F5F0FF' }, primary: '#7360F2', secondary: '#665CA7', accent: '#9B8FFF', surface: '#241040', cardBg: '#2E1850', textPrimary: '#FFFFFF', textSecondary: '#A090C0', success: '#4CAF50', error: '#E53935', mood: 'purple-vibrant, international, voice-first', gradientPair: ['#7360F2', '#665CA7'] },
    { name: 'KakaoTalk Yellow', backgrounds: { dark: '#1A1A08', light: '#FFFFFF' }, primary: '#FEE500', secondary: '#3C1E1E', accent: '#FFD700', surface: '#242410', cardBg: '#2E2E18', textPrimary: '#1A1A1A', textSecondary: '#666650', success: '#4CAF50', error: '#E53935', mood: 'Korean, yellow-cheerful, chat-ecosystem' },
    { name: 'iMessage Blue', backgrounds: { dark: '#000000', light: '#FFFFFF' }, primary: '#007AFF', secondary: '#34C759', accent: '#5AC8FA', surface: '#1C1C1E', cardBg: '#2C2C2E', textPrimary: '#FFFFFF', textSecondary: '#8E8E93', success: '#34C759', error: '#FF3B30', mood: 'Apple-native, blue-bubble, premium' },
  ],

  // =========================================================================
  // 14. STREAMING (8 palettes)
  // Netflix, YouTube, Disney+, HBO, Hulu, Peacock, Paramount+, Crunchyroll, Hotstar
  // =========================================================================
  streaming: [
    { name: 'Cinematic Red', backgrounds: { dark: '#141414', light: '#FFFFFF' }, primary: '#E50914', secondary: '#831010', accent: '#FFFFFF', surface: '#1A1A1A', cardBg: '#242424', textPrimary: '#FFFFFF', textSecondary: '#808080', success: '#46D369', error: '#E50914', mood: 'cinematic, immersive, premium' },
    { name: 'Creator Red', backgrounds: { dark: '#0F0F0F', light: '#FFFFFF' }, primary: '#FF0000', secondary: '#282828', accent: '#3EA6FF', surface: '#212121', cardBg: '#272727', textPrimary: '#FFFFFF', textSecondary: '#AAAAAA', success: '#2BA640', error: '#FF4E45', mood: 'dynamic, creator-driven, bold' },
    { name: 'Deep Cinema', backgrounds: { dark: '#0C111B', light: '#F5F5FA' }, primary: '#142864', secondary: '#3C0050', accent: '#0FA5E9', surface: '#141E30', cardBg: '#1C2840', textPrimary: '#EAEAF0', textSecondary: '#8090A8', success: '#4AC694', error: '#E5475B', mood: 'magical, premium, sophisticated', gradientPair: ['#142864', '#3C0050'] },
    { name: 'Hulu Green', backgrounds: { dark: '#0B0C0F', light: '#FFFFFF' }, primary: '#1CE783', secondary: '#040405', accent: '#3FEF9E', surface: '#151618', cardBg: '#1E2022', textPrimary: '#FFFFFF', textSecondary: '#909090', success: '#1CE783', error: '#FF4444', mood: 'green-glow, entertainment, cord-cutting' },
    { name: 'Peacock Spectrum', backgrounds: { dark: '#0A0A14', light: '#FFFFFF' }, primary: '#000000', secondary: '#FFC61A', accent: '#0084FF', surface: '#141420', cardBg: '#1E1E2C', textPrimary: '#FFFFFF', textSecondary: '#8888A0', success: '#4CAF50', error: '#E53935', mood: 'NBC, multi-color spectrum, free+premium', gradientPair: ['#0084FF', '#FFC61A'] },
    { name: 'Paramount Blue', backgrounds: { dark: '#0A1628', light: '#FFFFFF' }, primary: '#0064FF', secondary: '#002DB3', accent: '#4B93FF', surface: '#122038', cardBg: '#1A2C48', textPrimary: '#FFFFFF', textSecondary: '#8098C0', success: '#4CAF50', error: '#E53935', mood: 'classic Hollywood, blue-mountain, premium' },
    { name: 'Crunchyroll Orange', backgrounds: { dark: '#141414', light: '#FFFFFF' }, primary: '#F47521', secondary: '#FF8C00', accent: '#FFA500', surface: '#1E1E1E', cardBg: '#282828', textPrimary: '#FFFFFF', textSecondary: '#999999', success: '#4CAF50', error: '#E53935', mood: 'anime, orange-energy, otaku-culture' },
    { name: 'Hotstar Navy', backgrounds: { dark: '#0A1628', light: '#FFFFFF' }, primary: '#1F80E0', secondary: '#0959B5', accent: '#4BA3FF', surface: '#122038', cardBg: '#1A2C48', textPrimary: '#FFFFFF', textSecondary: '#8098C0', success: '#4CAF50', error: '#E53935', mood: 'Indian streaming, cricket, Bollywood' },
  ],

  // =========================================================================
  // 15. DATING (7 palettes)
  // Tinder, Bumble, Hinge, OkCupid, Coffee Meets Bagel, Happn, Aisle
  // =========================================================================
  dating: [
    { name: 'Flame Match', backgrounds: { dark: '#111111', light: '#FFFFFF' }, primary: '#FD267A', secondary: '#FF7854', accent: '#FF4458', surface: '#1A1A1A', cardBg: '#FFFFFF', textPrimary: '#21262E', textSecondary: '#656E7B', success: '#21D07A', error: '#FF4458', mood: 'bold, exciting, swipe-first', gradientPair: ['#FD267A', '#FF7854'] },
    { name: 'Golden Hour', backgrounds: { dark: '#1A1A1A', light: '#FFFFFF' }, primary: '#FFE600', secondary: '#F5B800', accent: '#000000', surface: '#222222', cardBg: '#FFFFFF', textPrimary: '#1A1A1A', textSecondary: '#71757A', success: '#2DBB54', error: '#E5243F', mood: 'empowering, warm, friendly' },
    { name: 'Quiet Spark', backgrounds: { dark: '#14141A', light: '#FFFFFF' }, primary: '#000000', secondary: '#994EA8', accent: '#6A4C9C', surface: '#1E1E24', cardBg: '#F7F7F7', textPrimary: '#1A1A1A', textSecondary: '#7A7A85', success: '#3CB371', error: '#D94848', mood: 'intentional, refined, relationship-focused', gradientPair: ['#994EA8', '#6A4C9C'] },
    { name: 'OkCupid Blue', backgrounds: { dark: '#0A1020', light: '#FFFFFF' }, primary: '#0500FF', secondary: '#FF3399', accent: '#7C4DFF', surface: '#141828', cardBg: '#1C2238', textPrimary: '#FFFFFF', textSecondary: '#8098B8', success: '#4CAF50', error: '#FF3399', mood: 'quirky, personality-first, question-driven', gradientPair: ['#0500FF', '#FF3399'] },
    { name: 'CMB Warm', backgrounds: { dark: '#1A1410', light: '#FFF8F0' }, primary: '#D4A86C', secondary: '#8B6914', accent: '#E8C48C', surface: '#241E16', cardBg: '#2E2820', textPrimary: '#FFFFFF', textSecondary: '#B0A088', success: '#4CAF50', error: '#E53935', mood: 'warm, coffee-toned, bagel-themed' },
    { name: 'Happn Red', backgrounds: { dark: '#1A0808', light: '#FFFFFF' }, primary: '#FF6B6B', secondary: '#EE5A5A', accent: '#FF8C8C', surface: '#241010', cardBg: '#2E1818', textPrimary: '#FFFFFF', textSecondary: '#B08888', success: '#4CAF50', error: '#FF6B6B', mood: 'location-based, coral-red, serendipity' },
    { name: 'Aisle Gold', backgrounds: { dark: '#14100A', light: '#FFFBF0' }, primary: '#D4AF37', secondary: '#B8960F', accent: '#FFD700', surface: '#1E1810', cardBg: '#282218', textPrimary: '#FFFFFF', textSecondary: '#A09880', success: '#4CAF50', error: '#E53935', mood: 'Indian premium dating, gold-accent, curated', gradientPair: ['#D4AF37', '#B8960F'] },
  ],

  // =========================================================================
  // 16. WELLNESS (7 palettes)
  // Headspace, Calm, Insight Timer, Flo, Waking Up, Balance
  // =========================================================================
  wellness: [
    { name: 'Warm Breath', backgrounds: { dark: '#1A1220', light: '#FFF8F2' }, primary: '#FF7E1D', secondary: '#0C6FF9', accent: '#FFC13C', surface: '#23182E', cardBg: '#2E2038', textPrimary: '#FFFFFF', textSecondary: '#B0A3BE', success: '#4CD964', error: '#FF6B6B', mood: 'warm, friendly, approachable', gradientPair: ['#FF7E1D', '#FFC13C'] },
    { name: 'Night Sky', backgrounds: { dark: '#1B2250', light: '#F0F4FF' }, primary: '#6282E3', secondary: '#9BB5FF', accent: '#3A56C4', surface: '#232B5A', cardBg: '#2A3468', textPrimary: '#E8EDFF', textSecondary: '#8A98C8', success: '#52C7A0', error: '#E06070', mood: 'serene, peaceful, meditative', gradientPair: ['#1B2250', '#2A3468'] },
    { name: 'Forest Ground', backgrounds: { dark: '#141E17', light: '#F4F8F5' }, primary: '#5B8A72', secondary: '#3D6B52', accent: '#C4A35A', surface: '#1C2A20', cardBg: '#243028', textPrimary: '#E8F0EB', textSecondary: '#8FA898', success: '#5B8A72', error: '#D4695A', mood: 'grounding, natural, earthy', gradientPair: ['#3D6B52', '#5B8A72'] },
    { name: 'Insight Gold', backgrounds: { dark: '#14100A', light: '#FFFBF0' }, primary: '#C49A3C', secondary: '#E6B84C', accent: '#8B7025', surface: '#1E1810', cardBg: '#282218', textPrimary: '#FFF8E8', textSecondary: '#A09870', success: '#4CAF50', error: '#CF6679', mood: 'Buddhist-inspired, golden, timer-focused' },
    { name: 'Flo Pink', backgrounds: { dark: '#1A0A14', light: '#FFF0F5' }, primary: '#FF5B87', secondary: '#FF85A1', accent: '#FFB4C6', surface: '#24101C', cardBg: '#2E1826', textPrimary: '#FFFFFF', textSecondary: '#B08098', success: '#4CAF50', error: '#FF5B87', mood: 'feminine health, pink-soft, cycle-tracking' },
    { name: 'Waking Up', backgrounds: { dark: '#0D0D18', light: '#F5F5FA' }, primary: '#FFFFFF', secondary: '#A0A0B8', accent: '#6C6C90', surface: '#16162A', cardBg: '#1E1E35', textPrimary: '#FFFFFF', textSecondary: '#8080A0', success: '#4CAF50', error: '#CF6679', mood: 'philosophical, minimal, Sam Harris-esque' },
    { name: 'Balance Calm', backgrounds: { dark: '#0A1820', light: '#F0FAFA' }, primary: '#4ECDC4', secondary: '#2BA5A0', accent: '#7EDDD8', surface: '#142428', cardBg: '#1C3034', textPrimary: '#FFFFFF', textSecondary: '#80A8A8', success: '#4ECDC4', error: '#FF6B6B', mood: 'personalized, teal-calm, AI-meditation', gradientPair: ['#4ECDC4', '#2BA5A0'] },
  ],

  // =========================================================================
  // 17. PRODUCTIVITY (8 palettes)
  // Notion, Slack, Todoist, Linear, Asana, ClickUp, Monday, Obsidian, Bear
  // =========================================================================
  productivity: [
    { name: 'Blank Canvas', backgrounds: { dark: '#191919', light: '#FFFFFF' }, primary: '#000000', secondary: '#37352F', accent: '#2EAADC', surface: '#202020', cardBg: '#252525', textPrimary: '#FFFFFF', textSecondary: '#9B9A97', success: '#4DAB9A', error: '#E03E3E', mood: 'minimal, flexible, tool-like' },
    { name: 'Work Mode', backgrounds: { dark: '#1A1625', light: '#F8F7FC' }, primary: '#5E6AD2', secondary: '#4A154B', accent: '#36C5F0', surface: '#221E2E', cardBg: '#2A2538', textPrimary: '#F0EEF6', textSecondary: '#8A85A0', success: '#2EB67D', error: '#E01E5A', mood: 'focused, collaborative, multi-accent', gradientPair: ['#5E6AD2', '#8B5CF6'] },
    { name: 'Action Red', backgrounds: { dark: '#1A1A1A', light: '#FAFAFA' }, primary: '#DE483A', secondary: '#B8352C', accent: '#FF7F66', surface: '#242424', cardBg: '#2C2C2C', textPrimary: '#FFFFFF', textSecondary: '#888888', success: '#4073FF', error: '#DE483A', mood: 'focused, action-oriented, decisive' },
    { name: 'Asana Coral', backgrounds: { dark: '#151218', light: '#FFFFFF' }, primary: '#F06A6A', secondary: '#F1BD6C', accent: '#AA62E3', surface: '#1E1A22', cardBg: '#28242E', textPrimary: '#FFFFFF', textSecondary: '#9090A0', success: '#62D86A', error: '#F06A6A', mood: 'project management, coral-warm, team-focused', gradientPair: ['#F06A6A', '#F1BD6C'] },
    { name: 'ClickUp Purple', backgrounds: { dark: '#12101A', light: '#FFFFFF' }, primary: '#7B68EE', secondary: '#49CCF9', accent: '#FFC800', surface: '#1A1824', cardBg: '#22202E', textPrimary: '#FFFFFF', textSecondary: '#8888A8', success: '#6BC950', error: '#FF4767', mood: 'colorful, everything-app, customizable', gradientPair: ['#7B68EE', '#49CCF9'] },
    { name: 'Monday Red', backgrounds: { dark: '#181B34', light: '#FFFFFF' }, primary: '#FF3D57', secondary: '#00CA72', accent: '#FDAB3D', surface: '#202348', cardBg: '#282C58', textPrimary: '#FFFFFF', textSecondary: '#8890C0', success: '#00CA72', error: '#FF3D57', mood: 'work OS, multi-color status, board-view' },
    { name: 'Obsidian Graph', backgrounds: { dark: '#1E1E1E', light: '#FFFFFF' }, primary: '#A88BFA', secondary: '#483699', accent: '#7C3AED', surface: '#262626', cardBg: '#2E2E2E', textPrimary: '#DCDDDE', textSecondary: '#888888', success: '#4CAF50', error: '#E53935', mood: 'knowledge-graph, purple-dark, second-brain', gradientPair: ['#A88BFA', '#483699'] },
    { name: 'Bear Minimal', backgrounds: { dark: '#1C1C1C', light: '#FFFFFF' }, primary: '#E05B5B', secondary: '#CF4747', accent: '#FF8C8C', surface: '#262626', cardBg: '#2E2E2E', textPrimary: '#FFFFFF', textSecondary: '#999999', success: '#4CAF50', error: '#E05B5B', mood: 'Apple-native, writing-focused, warm minimal' },
  ],

  // =========================================================================
  // 18. NAVIGATION (6 palettes)
  // Google Maps, Waze, HERE, Sygic, TomTom, Mappls
  // =========================================================================
  navigation: [
    { name: 'Wayfinder', backgrounds: { dark: '#1D2027', light: '#FFFFFF' }, primary: '#4285F4', secondary: '#34A853', accent: '#FBBC04', surface: '#282C34', cardBg: '#2E333D', textPrimary: '#FFFFFF', textSecondary: '#9AA0A6', success: '#34A853', error: '#EA4335', mood: 'reliable, informational, utilitarian' },
    { name: 'Drive Social', backgrounds: { dark: '#1A1D2E', light: '#FFFFFF' }, primary: '#00CCFF', secondary: '#33DDFF', accent: '#FFD600', surface: '#232740', cardBg: '#2A2F4A', textPrimary: '#F0F4FF', textSecondary: '#8890A8', success: '#4CE0A0', error: '#FF4466', mood: 'community, playful, real-time', gradientPair: ['#00CCFF', '#33DDFF'] },
    { name: 'HERE Teal', backgrounds: { dark: '#0A1A1A', light: '#FFFFFF' }, primary: '#48DAD0', secondary: '#00AFA5', accent: '#7EEEEA', surface: '#142828', cardBg: '#1C3434', textPrimary: '#FFFFFF', textSecondary: '#80A8A8', success: '#48DAD0', error: '#E53935', mood: 'European, teal, enterprise navigation' },
    { name: 'Sygic Red', backgrounds: { dark: '#1A0808', light: '#FFFFFF' }, primary: '#E53935', secondary: '#C62828', accent: '#FF6659', surface: '#241010', cardBg: '#2E1818', textPrimary: '#FFFFFF', textSecondary: '#B08888', success: '#4CAF50', error: '#E53935', mood: 'European, offline-first, red-bold' },
    { name: 'TomTom Dark', backgrounds: { dark: '#14141E', light: '#FFFFFF' }, primary: '#FF0000', secondary: '#1A1A2E', accent: '#FF4444', surface: '#1E1E2C', cardBg: '#28283A', textPrimary: '#FFFFFF', textSecondary: '#8888A0', success: '#4CAF50', error: '#FF0000', mood: 'Dutch, dark-tech, automotive-integration' },
    { name: 'Mappls Blue', backgrounds: { dark: '#0A1020', light: '#FFFFFF' }, primary: '#3F51B5', secondary: '#FF5722', accent: '#7986CB', surface: '#141828', cardBg: '#1C2238', textPrimary: '#FFFFFF', textSecondary: '#8098B8', success: '#4CAF50', error: '#FF5722', mood: 'Indian mapping, blue-indigo, MapmyIndia' },
  ],

  // =========================================================================
  // 19. NEWS (7 palettes)
  // Apple News, Flipboard, Reuters, BBC, Guardian, Inshorts, DailyHunt
  // =========================================================================
  news: [
    { name: 'Editorial', backgrounds: { dark: '#111111', light: '#FFFFFF' }, primary: '#000000', secondary: '#FC3C44', accent: '#FF453A', surface: '#1C1C1E', cardBg: '#2C2C2E', textPrimary: '#FFFFFF', textSecondary: '#8E8E93', success: '#34C759', error: '#FF453A', mood: 'authoritative, clean, editorial' },
    { name: 'Magazine Red', backgrounds: { dark: '#1A1A1A', light: '#FFFFFF' }, primary: '#E12828', secondary: '#C42020', accent: '#1A1A1A', surface: '#242424', cardBg: '#2E2E2E', textPrimary: '#FFFFFF', textSecondary: '#999999', success: '#30B566', error: '#E12828', mood: 'bold, curated, magazine-style' },
    { name: 'Premium Ink', backgrounds: { dark: '#0D1117', light: '#F9F9FB' }, primary: '#C9A44C', secondary: '#8B7340', accent: '#E8D48C', surface: '#161B22', cardBg: '#1C2128', textPrimary: '#E6EDF3', textSecondary: '#768390', success: '#3FB950', error: '#F85149', mood: 'premium, sophisticated, subscriber-exclusive', gradientPair: ['#C9A44C', '#E8D48C'] },
    { name: 'Reuters Trust', backgrounds: { dark: '#0A1020', light: '#FFFFFF' }, primary: '#FF6600', secondary: '#1A1A1A', accent: '#FF8533', surface: '#141828', cardBg: '#1C2238', textPrimary: '#FFFFFF', textSecondary: '#8098B8', success: '#4CAF50', error: '#E53935', mood: 'wire-service, orange-accent, fact-first' },
    { name: 'BBC Red', backgrounds: { dark: '#111111', light: '#FFFFFF' }, primary: '#BB1919', secondary: '#1A1A1A', accent: '#E53935', surface: '#1A1A1A', cardBg: '#242424', textPrimary: '#FFFFFF', textSecondary: '#999999', success: '#4CAF50', error: '#BB1919', mood: 'British, authoritative, public-service' },
    { name: 'Guardian Blue', backgrounds: { dark: '#0A1628', light: '#FFFFFF' }, primary: '#052962', secondary: '#00B2FF', accent: '#1A4A8A', surface: '#122038', cardBg: '#1A2C48', textPrimary: '#FFFFFF', textSecondary: '#8098C0', success: '#4CAF50', error: '#C70000', mood: 'investigative, deep-blue, progressive' },
    { name: 'Inshorts Card', backgrounds: { dark: '#1A1A1A', light: '#FFFFFF' }, primary: '#007AFF', secondary: '#5856D6', accent: '#34C759', surface: '#242424', cardBg: '#2E2E2E', textPrimary: '#FFFFFF', textSecondary: '#999999', success: '#34C759', error: '#FF3B30', mood: 'Indian, 60-word cards, quick-read' },
  ],

  // =========================================================================
  // 20. WEATHER (5 palettes) — NEW
  // Dark Sky, Weather.com, Carrot Weather, AccuWeather, Apple Weather
  // =========================================================================
  weather: [
    { name: 'Sky Gradient', backgrounds: { dark: '#0A1628', light: '#87CEEB' }, primary: '#5AC8FA', secondary: '#FFD60A', accent: '#FF9F0A', surface: '#122038', cardBg: '#1A2C48', textPrimary: '#FFFFFF', textSecondary: '#B0C4DE', success: '#30D158', error: '#FF453A', mood: 'atmospheric, dynamic, Apple-weather', gradientPair: ['#5AC8FA', '#1B3A5C'] },
    { name: 'Storm Dark', backgrounds: { dark: '#0D1117', light: '#F0F4F8' }, primary: '#4A90D9', secondary: '#2C5282', accent: '#63B3ED', surface: '#161B22', cardBg: '#1C2128', textPrimary: '#E8F0FF', textSecondary: '#8098C0', success: '#48BB78', error: '#FC8181', mood: 'data-rich, dark forecast, hyperlocal' },
    { name: 'Carrot Playful', backgrounds: { dark: '#1A1A1A', light: '#FFFFFF' }, primary: '#FF6B35', secondary: '#FFD166', accent: '#FFA040', surface: '#242424', cardBg: '#2E2E2E', textPrimary: '#FFFFFF', textSecondary: '#999999', success: '#4CAF50', error: '#E53935', mood: 'snarky, playful, personality-driven' },
    { name: 'AccuWeather Blue', backgrounds: { dark: '#0A2040', light: '#FFFFFF' }, primary: '#F25D27', secondary: '#2196F3', accent: '#FF6D00', surface: '#142850', cardBg: '#1C3260', textPrimary: '#FFFFFF', textSecondary: '#80A0C8', success: '#4CAF50', error: '#F25D27', mood: 'precision, forecast-focused, orange+blue' },
    { name: 'Sunrise Warm', backgrounds: { dark: '#1A1008', light: '#FFF8E1' }, primary: '#FF8F00', secondary: '#FF6F00', accent: '#FFD54F', surface: '#241A10', cardBg: '#2E2218', textPrimary: '#FFFFFF', textSecondary: '#B0A080', success: '#66BB6A', error: '#EF5350', mood: 'warm, golden-hour, sunrise-to-sunset', gradientPair: ['#FF8F00', '#FFD54F'] },
  ],

  // =========================================================================
  // 21. REAL ESTATE (5 palettes) — NEW
  // Zillow, Trulia, Realtor.com, 99acres, MagicBricks, Housing.com
  // =========================================================================
  real_estate: [
    { name: 'Zillow Blue', backgrounds: { dark: '#0A1628', light: '#FFFFFF' }, primary: '#006AFF', secondary: '#1A4A8A', accent: '#4B93FF', surface: '#122038', cardBg: '#1A2C48', textPrimary: '#FFFFFF', textSecondary: '#8098C0', success: '#4CAF50', error: '#E53935', mood: 'American real-estate, blue trust, Zestimate' },
    { name: 'Trulia Green', backgrounds: { dark: '#0A1A10', light: '#FFFFFF' }, primary: '#3BB44A', secondary: '#2D8C3B', accent: '#66CC77', surface: '#142820', cardBg: '#1C3228', textPrimary: '#FFFFFF', textSecondary: '#80A890', success: '#3BB44A', error: '#E53935', mood: 'neighborhood-focused, green, family-friendly' },
    { name: 'Property Red', backgrounds: { dark: '#1A0808', light: '#FFFFFF' }, primary: '#D92228', secondary: '#B71C1C', accent: '#FF5252', surface: '#241010', cardBg: '#2E1818', textPrimary: '#FFFFFF', textSecondary: '#B08888', success: '#4CAF50', error: '#D92228', mood: 'American classic, red-bold, home-buying' },
    { name: '99acres Green', backgrounds: { dark: '#0A1A14', light: '#FFFFFF' }, primary: '#00A652', secondary: '#008040', accent: '#33CC77', surface: '#142824', cardBg: '#1C3430', textPrimary: '#FFFFFF', textSecondary: '#80A8A0', success: '#00A652', error: '#E53935', mood: 'Indian property, green-trust, listing-heavy' },
    { name: 'Housing Teal', backgrounds: { dark: '#0A1A1A', light: '#FFFFFF' }, primary: '#00B8A9', secondary: '#008578', accent: '#4DD8C8', surface: '#142828', cardBg: '#1C3434', textPrimary: '#FFFFFF', textSecondary: '#80A8A8', success: '#00B8A9', error: '#E53935', mood: 'modern Indian, teal, apartment-focused' },
  ],

  // =========================================================================
  // 22. GAMING (5 palettes) — NEW
  // Steam, Epic Games, Twitch, Discord
  // =========================================================================
  gaming: [
    { name: 'Steam Dark', backgrounds: { dark: '#171A21', light: '#E5E5E5' }, primary: '#1B2838', secondary: '#66C0F4', accent: '#C7D5E0', surface: '#1E2328', cardBg: '#2A3440', textPrimary: '#C7D5E0', textSecondary: '#8F98A0', success: '#5BA32B', error: '#CD381B', mood: 'PC gaming, dark blue-steel, library-focused' },
    { name: 'Epic Midnight', backgrounds: { dark: '#0A0A0A', light: '#F5F5F5' }, primary: '#000000', secondary: '#0074E4', accent: '#FFFFFF', surface: '#141414', cardBg: '#1E1E1E', textPrimary: '#FFFFFF', textSecondary: '#999999', success: '#4CAF50', error: '#E53935', mood: 'free-games, dark minimal, store-focused' },
    { name: 'Twitch Violet', backgrounds: { dark: '#0E0E10', light: '#F7F7F8' }, primary: '#9146FF', secondary: '#772CE8', accent: '#BF94FF', surface: '#18181B', cardBg: '#1F1F23', textPrimary: '#EFEFF1', textSecondary: '#ADADB8', success: '#00C853', error: '#EB0400', mood: 'live-streaming, purple-glow, creator-economy', gradientPair: ['#9146FF', '#772CE8'] },
    { name: 'Discord Blurple', backgrounds: { dark: '#313338', light: '#FFFFFF' }, primary: '#5865F2', secondary: '#4752C4', accent: '#EB459E', surface: '#2B2D31', cardBg: '#383A40', textPrimary: '#F2F3F5', textSecondary: '#B5BAC1', success: '#57F287', error: '#ED4245', mood: 'community, voice-chat, blurple-brand' },
    { name: 'Neon Arcade', backgrounds: { dark: '#0A0A14', light: '#F0F0FF' }, primary: '#FF00FF', secondary: '#00FFFF', accent: '#FFFF00', surface: '#141420', cardBg: '#1E1E30', textPrimary: '#FFFFFF', textSecondary: '#8080C0', success: '#00FF88', error: '#FF0044', mood: 'retro-neon, arcade, vaporwave', gradientPair: ['#FF00FF', '#00FFFF'] },
  ],

  // =========================================================================
  // 23. PHOTOGRAPHY (4 palettes) — NEW
  // VSCO, Snapseed, Lightroom, Camera+
  // =========================================================================
  photography: [
    { name: 'VSCO Minimal', backgrounds: { dark: '#1A1A1A', light: '#FFFFFF' }, primary: '#000000', secondary: '#666666', accent: '#FFFFFF', surface: '#242424', cardBg: '#2E2E2E', textPrimary: '#FFFFFF', textSecondary: '#999999', success: '#4CAF50', error: '#E53935', mood: 'minimal, creative, film-aesthetic' },
    { name: 'Lightroom Blue', backgrounds: { dark: '#1D1D1D', light: '#F5F5F5' }, primary: '#31A8FF', secondary: '#001E36', accent: '#5CC6FF', surface: '#272727', cardBg: '#303030', textPrimary: '#FFFFFF', textSecondary: '#B0B0B0', success: '#4CAF50', error: '#E53935', mood: 'Adobe professional, blue-tech, preset-driven', gradientPair: ['#31A8FF', '#001E36'] },
    { name: 'Snapseed Clean', backgrounds: { dark: '#212121', light: '#FFFFFF' }, primary: '#0F9D58', secondary: '#4285F4', accent: '#42A674', surface: '#2C2C2C', cardBg: '#353535', textPrimary: '#FFFFFF', textSecondary: '#AAAAAA', success: '#0F9D58', error: '#E53935', mood: 'Google-owned, green-accent, slider-based' },
    { name: 'Film Grain', backgrounds: { dark: '#141210', light: '#F5F0E8' }, primary: '#D4A574', secondary: '#8B7355', accent: '#E8C49E', surface: '#1E1C18', cardBg: '#282420', textPrimary: '#F0E8D8', textSecondary: '#A09880', success: '#88A060', error: '#C06050', mood: 'vintage, warm film, analog-inspired', gradientPair: ['#D4A574', '#8B7355'] },
  ],

  // =========================================================================
  // 24. PARKING / EV (4 palettes) — NEW
  // ParkMobile, ChargePoint, PlugShare, Electrify America
  // =========================================================================
  parking: [
    { name: 'ParkMobile Green', backgrounds: { dark: '#0A1A10', light: '#FFFFFF' }, primary: '#00C853', secondary: '#009624', accent: '#69F0AE', surface: '#142820', cardBg: '#1C3228', textPrimary: '#FFFFFF', textSecondary: '#80A890', success: '#00C853', error: '#E53935', mood: 'urban parking, green-go, meter-digital' },
    { name: 'ChargePoint Orange', backgrounds: { dark: '#1A1208', light: '#FFFFFF' }, primary: '#FF6D00', secondary: '#E65100', accent: '#FFA040', surface: '#241C10', cardBg: '#2E2418', textPrimary: '#FFFFFF', textSecondary: '#B0A088', success: '#4CAF50', error: '#E53935', mood: 'EV charging, orange-electric, station-finder' },
    { name: 'PlugShare Blue', backgrounds: { dark: '#0A1020', light: '#FFFFFF' }, primary: '#0099CC', secondary: '#006699', accent: '#33CCFF', surface: '#141828', cardBg: '#1C2238', textPrimary: '#FFFFFF', textSecondary: '#8098B8', success: '#4CAF50', error: '#E53935', mood: 'EV community, blue-electric, crowd-sourced' },
    { name: 'Electrify Green', backgrounds: { dark: '#0A1A0A', light: '#F0FFF0' }, primary: '#76FF03', secondary: '#64DD17', accent: '#B2FF59', surface: '#142814', cardBg: '#1C341C', textPrimary: '#FFFFFF', textSecondary: '#80A880', success: '#76FF03', error: '#E53935', mood: 'ultra-fast charging, neon-green, premium EV', gradientPair: ['#76FF03', '#64DD17'] },
  ],

  // =========================================================================
  // 25. HEALTHCARE (5 palettes) — NEW
  // Practo, Zocdoc, MyChart, Teladoc, Doctor On Demand
  // =========================================================================
  healthcare: [
    { name: 'Practo Blue', backgrounds: { dark: '#0A1628', light: '#FFFFFF' }, primary: '#1082C5', secondary: '#0A6EA4', accent: '#4BB3E0', surface: '#122038', cardBg: '#1A2C48', textPrimary: '#FFFFFF', textSecondary: '#8098C0', success: '#4CAF50', error: '#E53935', mood: 'Indian healthcare, blue-trust, doctor-booking' },
    { name: 'Zocdoc Teal', backgrounds: { dark: '#0A1A18', light: '#FFFFFF' }, primary: '#008B8B', secondary: '#006666', accent: '#20B2AA', surface: '#142828', cardBg: '#1C3430', textPrimary: '#FFFFFF', textSecondary: '#80A8A0', success: '#4CAF50', error: '#E53935', mood: 'American healthcare, teal-clean, appointment-focused' },
    { name: 'MyChart Blue', backgrounds: { dark: '#0A1428', light: '#FFFFFF' }, primary: '#1565C0', secondary: '#0D47A1', accent: '#42A5F5', surface: '#141E38', cardBg: '#1C2848', textPrimary: '#FFFFFF', textSecondary: '#8098B8', success: '#4CAF50', error: '#E53935', mood: 'hospital portal, deep blue, patient-records' },
    { name: 'Teladoc Purple', backgrounds: { dark: '#14081E', light: '#F8F0FF' }, primary: '#5B2D8E', secondary: '#7B4BAE', accent: '#9B6FCE', surface: '#1E1028', cardBg: '#281838', textPrimary: '#FFFFFF', textSecondary: '#A090B8', success: '#4CAF50', error: '#E53935', mood: 'telehealth, purple-care, virtual-visit', gradientPair: ['#5B2D8E', '#7B4BAE'] },
    { name: 'Clinical White', backgrounds: { dark: '#1A2030', light: '#FFFFFF' }, primary: '#1976D2', secondary: '#0D47A1', accent: '#90CAF9', surface: '#222840', cardBg: '#2A3250', textPrimary: '#FFFFFF', textSecondary: '#8898C0', success: '#4CAF50', error: '#E53935', mood: 'clinical, trustworthy, medical-grade' },
  ],

  // =========================================================================
  // 26. JOBS / CAREER (5 palettes) — NEW
  // Indeed, Glassdoor, Naukri, Monster, AngelList/Wellfound
  // =========================================================================
  jobs: [
    { name: 'Indeed Blue', backgrounds: { dark: '#0A1428', light: '#FFFFFF' }, primary: '#2164F3', secondary: '#003399', accent: '#4B93FF', surface: '#141E38', cardBg: '#1C2848', textPrimary: '#FFFFFF', textSecondary: '#8098B8', success: '#4CAF50', error: '#E53935', mood: 'job-search, blue-trust, apply-fast' },
    { name: 'Glassdoor Green', backgrounds: { dark: '#0A1A10', light: '#FFFFFF' }, primary: '#0CAA41', secondary: '#008830', accent: '#33CC66', surface: '#142820', cardBg: '#1C3228', textPrimary: '#FFFFFF', textSecondary: '#80A890', success: '#0CAA41', error: '#E53935', mood: 'reviews, salary-transparent, green-growth' },
    { name: 'Naukri Blue', backgrounds: { dark: '#0A1020', light: '#FFFFFF' }, primary: '#4A90D9', secondary: '#2962FF', accent: '#82B1FF', surface: '#141828', cardBg: '#1C2238', textPrimary: '#FFFFFF', textSecondary: '#8098B8', success: '#4CAF50', error: '#E53935', mood: 'Indian jobs, blue-professional, resume-focused' },
    { name: 'Monster Purple', backgrounds: { dark: '#14081E', light: '#FFFFFF' }, primary: '#6A1B9A', secondary: '#4A148C', accent: '#9C27B0', surface: '#1E1028', cardBg: '#281838', textPrimary: '#FFFFFF', textSecondary: '#A090B8', success: '#4CAF50', error: '#E53935', mood: 'purple-bold, career-beast, job-matching' },
    { name: 'Startup Fund', backgrounds: { dark: '#0A0A14', light: '#FFFFFF' }, primary: '#000000', secondary: '#FF6B35', accent: '#FF8C5A', surface: '#141420', cardBg: '#1E1E2C', textPrimary: '#FFFFFF', textSecondary: '#8888A0', success: '#4CAF50', error: '#FF6B35', mood: 'startup, minimal-dark, AngelList-style' },
  ],

  // =========================================================================
  // 27. KIDS / PARENTING (4 palettes) — NEW
  // YouTube Kids, Khan Academy Kids, BabyCenter, PBS Kids
  // =========================================================================
  kids: [
    { name: 'YouTube Kids', backgrounds: { dark: '#1A1A1A', light: '#FFFFFF' }, primary: '#FF0000', secondary: '#065FD4', accent: '#FFCC00', surface: '#F0F0F0', cardBg: '#FFFFFF', textPrimary: '#212121', textSecondary: '#606060', success: '#4CAF50', error: '#FF0000', mood: 'bright, child-safe, big-buttons' },
    { name: 'Khan Kids', backgrounds: { dark: '#14281E', light: '#E8F8F0' }, primary: '#14BF96', secondary: '#1865F2', accent: '#FFBC00', surface: '#1C3828', cardBg: '#244834', textPrimary: '#FFFFFF', textSecondary: '#80B8A0', success: '#14BF96', error: '#E53935', mood: 'educational, friendly, Khan-green', gradientPair: ['#14BF96', '#1865F2'] },
    { name: 'Crayon Pop', backgrounds: { dark: '#1A1A2E', light: '#FFFDE7' }, primary: '#FF6F00', secondary: '#2196F3', accent: '#E91E63', surface: '#222236', cardBg: '#2A2A42', textPrimary: '#FFFFFF', textSecondary: '#A0A0C0', success: '#66BB6A', error: '#E91E63', mood: 'playful, multi-color, toddler-friendly' },
    { name: 'PBS Green', backgrounds: { dark: '#0A2818', light: '#FFFFFF' }, primary: '#00933B', secondary: '#005F27', accent: '#4CAF50', surface: '#143820', cardBg: '#1C4828', textPrimary: '#FFFFFF', textSecondary: '#80A890', success: '#00933B', error: '#E53935', mood: 'public media, educational, parent-trusted' },
  ],
}

// ---------------------------------------------------------------------------
// 3 universal fallback palettes for unrecognized categories
// ---------------------------------------------------------------------------

const UNIVERSAL_PALETTES: ColorPalette[] = [
  { name: 'Modern Dark', backgrounds: { dark: '#0F0F14', light: '#FFFFFF' }, primary: '#6366F1', secondary: '#8B5CF6', accent: '#22D3EE', surface: '#18181F', cardBg: '#1E1E28', textPrimary: '#F0F0F5', textSecondary: '#8888A0', success: '#22C55E', error: '#EF4444', mood: 'modern, dark, versatile', gradientPair: ['#6366F1', '#8B5CF6'] },
  { name: 'Clean Light', backgrounds: { dark: '#1A1A2E', light: '#FFFFFF' }, primary: '#2563EB', secondary: '#7C3AED', accent: '#F59E0B', surface: '#F8FAFC', cardBg: '#FFFFFF', textPrimary: '#0F172A', textSecondary: '#64748B', success: '#10B981', error: '#EF4444', mood: 'clean, professional, approachable' },
  { name: 'Premium Minimal', backgrounds: { dark: '#0A0A0A', light: '#FAFAF9' }, primary: '#18181B', secondary: '#A1A1AA', accent: '#F97316', surface: '#141414', cardBg: '#1C1C1C', textPrimary: '#FAFAFA', textSecondary: '#71717A', success: '#22C55E', error: '#DC2626', mood: 'premium, minimal, editorial' },
]

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ThemeResult {
  palette: ColorPalette
  category: string
  isDarkMode: boolean
}

/**
 * Detect category from a user prompt and return an appropriate palette.
 */
export function resolveTheme(prompt: string, preferDark: boolean = true): ThemeResult {
  const lowerPrompt = prompt.toLowerCase()

  let detectedCategory = 'unknown'
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.test(lowerPrompt)) {
      detectedCategory = category
      break
    }
  }

  const wantsLight = /\b(light\s*(?:theme|mode)?|white\s*(?:background|theme|mode)?|bright|clean\s*white)\b/i.test(lowerPrompt)
  const wantsDark = /\b(dark\s*(?:theme|mode)?|black\s*(?:background|theme)?|night\s*mode|midnight)\b/i.test(lowerPrompt)
  const isDarkMode = wantsDark ? true : wantsLight ? false : preferDark

  const categoryPalettes = PALETTES[detectedCategory]
  let palette: ColorPalette

  if (categoryPalettes && categoryPalettes.length > 0) {
    const idx = Math.floor(Math.random() * categoryPalettes.length)
    palette = categoryPalettes[idx]
  } else {
    const idx = Math.floor(Math.random() * UNIVERSAL_PALETTES.length)
    palette = UNIVERSAL_PALETTES[idx]
  }

  return { palette, category: detectedCategory, isDarkMode }
}

/**
 * Format a palette as a prompt-ready string to inject into the system prompt.
 */
export function formatPaletteForPrompt(result: ThemeResult): string {
  const { palette, category, isDarkMode } = result
  const bg = isDarkMode ? palette.backgrounds.dark : palette.backgrounds.light

  return `
DESIGN PALETTE FOR THIS SCREEN (Category: ${category}, Theme: "${palette.name}"):
  Background: ${bg}
  Surface/Card: ${isDarkMode ? palette.surface : palette.cardBg}
  Card Background: ${isDarkMode ? palette.cardBg : palette.surface}
  Primary accent: ${palette.primary}
  Secondary accent: ${palette.secondary}
  Accent highlight: ${palette.accent}
  Text primary: ${isDarkMode ? palette.textPrimary : '#0F172A'}
  Text secondary: ${isDarkMode ? palette.textSecondary : '#64748B'}
  Text tertiary: ${isDarkMode ? palette.textSecondary + '88' : '#94A3B8'}
  Success: ${palette.success}
  Error: ${palette.error}
  Border/Divider: ${isDarkMode ? palette.surface : '#E2E8F0'}
${palette.gradientPair ? `  Gradient: ${palette.gradientPair[0]} → ${palette.gradientPair[1]}` : '  Gradient: none'}
  Mood: ${palette.mood}

USE THESE COLORS in the component tree. Do NOT use the old defaults (purple #6C5CE7, dark #0A0A1A, card #12121F). Use the palette above — it was selected to match the "${category}" app category based on real apps like ${getCategoryExamples(category)}.`
}

function getCategoryExamples(category: string): string {
  const examples: Record<string, string> = {
    fitness: 'Nike, Strava, Peloton, Apple Fitness+, Whoop',
    finance: 'Robinhood, Cash App, Revolut, Stripe, Square',
    india_fintech: 'PhonePe, Google Pay, Paytm, CRED, Jupiter',
    food_delivery: 'Uber Eats, DoorDash, Swiggy, Zomato, FoodPanda',
    grocery: 'Instacart, Blinkit, Zepto, Gorillas, Gopuff',
    social: 'Instagram, TikTok, Twitter/X, Reddit, Bluesky',
    ecommerce: 'Amazon, Nike Shop, SHEIN, Etsy, Flipkart',
    crypto: 'Coinbase, Phantom, Binance, Uniswap, Jupiter',
    travel: 'Airbnb, Booking.com, TripAdvisor, MakeMyTrip',
    music: 'Spotify, Apple Music, Tidal, Deezer',
    education: 'Duolingo, Coursera, Udemy, Unacademy',
    ride_hailing: 'Uber, Lyft, Rapido, DiDi, Ola',
    messaging: 'WhatsApp, Telegram, Signal, WeChat, LINE',
    streaming: 'Netflix, YouTube, Disney+, Hulu, Crunchyroll',
    dating: 'Tinder, Bumble, Hinge, OkCupid',
    wellness: 'Headspace, Calm, Insight Timer, Balance',
    productivity: 'Notion, Slack, Todoist, Asana, Linear',
    navigation: 'Google Maps, Waze, HERE WeGo, TomTom',
    news: 'Apple News, Flipboard, Reuters, BBC, Guardian',
    weather: 'Apple Weather, Dark Sky, AccuWeather, Carrot',
    real_estate: 'Zillow, Trulia, 99acres, Housing.com',
    gaming: 'Steam, Twitch, Discord, Epic Games',
    photography: 'VSCO, Lightroom, Snapseed',
    parking: 'ParkMobile, ChargePoint, PlugShare',
    healthcare: 'Practo, Zocdoc, MyChart, Teladoc',
    jobs: 'Indeed, Glassdoor, Naukri, AngelList',
    kids: 'YouTube Kids, Khan Academy Kids, PBS Kids',
  }
  return examples[category] || 'top-rated apps in this category'
}
