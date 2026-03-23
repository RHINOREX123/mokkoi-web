/**
 * Dynamic color theming for Mokkoi screen generation.
 *
 * Provides category-appropriate color palettes based on the user prompt.
 * Data sourced from 50+ real apps via Mobbin.com and brand guidelines.
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
// Keyword → category mapping (200+ keywords from Mobbin research)
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Array<{ category: string; keywords: RegExp }> = [
  { category: 'fitness', keywords: /\b(fitness|health|workout|gym|exercise|training|yoga|running|sports|calories|steps|heart\s*rate|peloton|strava|weight\s*loss|hiit|crossfit|athletic)\b/i },
  { category: 'finance', keywords: /\b(finance|banking|bank|money|investment|stocks|trading|payments|wallet|fintech|budget|venmo|paypal|transfer|savings|portfolio|expense|loan)\b/i },
  { category: 'food_delivery', keywords: /\b(food|delivery|restaurant|ordering|takeout|groceries|recipe|cooking|meal|uber\s*eats|doordash|cuisine|meal\s*prep|swiggy|zomato)\b/i },
  { category: 'social', keywords: /\b(social|community|feed|stories|network|instagram|tiktok|twitter|linkedin|reddit|pinterest|snapchat|threads|followers|news\s*feed|timeline|reels)\b/i },
  { category: 'ecommerce', keywords: /\b(ecommerce|shopping|shop|store|marketplace|retail|fashion|clothing|products|cart|checkout|add\s*to\s*cart|amazon|price|buy\s*now|sneaker|shoe)\b/i },
  { category: 'crypto', keywords: /\b(crypto|web3|blockchain|nft|defi|token|bitcoin|ethereum|solana|coinbase|swap\s*token|metamask|phantom)\b/i },
  { category: 'travel', keywords: /\b(travel|hotel|flight|booking|vacation|trip|airbnb|tourism|resort|check\s*in|itinerary|destination|hostel)\b/i },
  { category: 'music', keywords: /\b(music|podcast|audio|player|radio|spotify|playlist|now\s*playing|album|song|apple\s*music)\b/i },
  { category: 'education', keywords: /\b(education|learning|course|study|school|tutorial|quiz|duolingo|lesson|homework|classroom|exam|coursera)\b/i },
  { category: 'ride_hailing', keywords: /\b(ride|taxi|uber|lyft|cab|transport|commute|carpool|book\s*a\s*ride|driver)\b/i },
  { category: 'messaging', keywords: /\b(messaging|chat|direct\s*message|whatsapp|telegram|signal|conversation|inbox|send\s*message|sms)\b/i },
  { category: 'streaming', keywords: /\b(streaming|video|netflix|youtube|disney|hbo|watch\s*now|movie|tv\s*show|series)\b/i },
  { category: 'dating', keywords: /\b(dating|tinder|bumble|hinge|match|swipe|love\s*interest)\b/i },
  { category: 'wellness', keywords: /\b(wellness|meditation|mindfulness|headspace|calm|mental\s*health|breathing|sleep|relaxation|self\s*care|journal)\b/i },
  { category: 'productivity', keywords: /\b(productivity|notion|todoist|slack|task|to\s*do|kanban|project|notes|calendar|planner|agenda|workspace)\b/i },
  { category: 'navigation', keywords: /\b(navigation|map|maps|directions|google\s*maps|waze|gps|route|find\s*nearby|location)\b/i },
  { category: 'news', keywords: /\b(news|breaking\s*news|article|headline|magazine|editorial|newspaper|blog|digest)\b/i },
]

// ---------------------------------------------------------------------------
// Palettes per category (2-3 variations each, from real app research)
// ---------------------------------------------------------------------------

const PALETTES: Record<string, ColorPalette[]> = {
  fitness: [
    { name: 'Midnight Athlete', backgrounds: { dark: '#111111', light: '#F5F5F5' }, primary: '#E5E5E5', secondary: '#FA5A5A', accent: '#3A80F8', surface: '#1A1A1A', cardBg: '#1E1E1E', textPrimary: '#FFFFFF', textSecondary: '#A0A0A0', success: '#34C759', error: '#FF3B30', mood: 'bold, minimal, premium athletic', gradientPair: ['#3A80F8', '#D859F7'] },
    { name: 'Neon Burn', backgrounds: { dark: '#0E0E0E', light: '#FFF8F5' }, primary: '#FC4C02', secondary: '#FCE434', accent: '#FF6B2B', surface: '#1C1C1E', cardBg: '#2C2C2E', textPrimary: '#FFFFFF', textSecondary: '#8E8E93', success: '#30D158', error: '#FF453A', mood: 'energetic, competitive, outdoor', gradientPair: ['#FC4C02', '#FCE434'] },
    { name: 'Electric Pulse', backgrounds: { dark: '#0A0A0A', light: '#F0FFF4' }, primary: '#22C55E', secondary: '#06B6D4', accent: '#A855F7', surface: '#141414', cardBg: '#1E1E1E', textPrimary: '#F0F0F0', textSecondary: '#6B7280', success: '#22C55E', error: '#EF4444', mood: 'futuristic, tech-forward, intense', gradientPair: ['#22C55E', '#06B6D4'] },
  ],
  finance: [
    { name: 'Market Green', backgrounds: { dark: '#1C1C1E', light: '#FFFFFF' }, primary: '#00C805', secondary: '#5AC53A', accent: '#FFB800', surface: '#F5F5F7', cardBg: '#FFFFFF', textPrimary: '#1C1C1E', textSecondary: '#6E6E73', success: '#00C805', error: '#FF6347', mood: 'approachable, optimistic, retail-friendly', gradientPair: ['#00C805', '#5AC53A'] },
    { name: 'Cash Flow', backgrounds: { dark: '#000000', light: '#F0FFF0' }, primary: '#00D54B', secondary: '#00A83A', accent: '#FFFFFF', surface: '#121212', cardBg: '#1A1A1A', textPrimary: '#FFFFFF', textSecondary: '#8C8C8C', success: '#00D54B', error: '#FF4444', mood: 'bold, modern, money-centric' },
    { name: 'Fintech Dark', backgrounds: { dark: '#191C1F', light: '#F5F6FA' }, primary: '#7F84F6', secondary: '#00D68F', accent: '#A78BFA', surface: '#21252A', cardBg: '#282D35', textPrimary: '#F0F1F5', textSecondary: '#8890A0', success: '#00D68F', error: '#F04848', mood: 'premium, dark fintech, sophisticated', gradientPair: ['#7F84F6', '#A78BFA'] },
  ],
  food_delivery: [
    { name: 'Fresh Market', backgrounds: { dark: '#1A1A1A', light: '#FFFFFF' }, primary: '#06C167', secondary: '#FFB800', accent: '#F5F5F5', surface: '#F7F7F7', cardBg: '#FFFFFF', textPrimary: '#1A1A1A', textSecondary: '#6B6B6B', success: '#06C167', error: '#E74C3C', mood: 'fresh, clean, appetizing' },
    { name: 'Flame Orange', backgrounds: { dark: '#1A0A0A', light: '#FFFAF6' }, primary: '#FF3008', secondary: '#FF7A00', accent: '#FFB800', surface: '#241414', cardBg: '#2E1A1A', textPrimary: '#FFFFFF', textSecondary: '#B08080', success: '#2ECC71', error: '#FF3008', mood: 'bold, urgent, craving-inducing', gradientPair: ['#FF3008', '#FF7A00'] },
    { name: 'Warm Spice', backgrounds: { dark: '#1A1008', light: '#FFF9F0' }, primary: '#FC8019', secondary: '#E23744', accent: '#FFD166', surface: '#241C10', cardBg: '#2E2418', textPrimary: '#FFFFFF', textSecondary: '#B0A090', success: '#27AE60', error: '#E23744', mood: 'warm, inviting, street-food vibes', gradientPair: ['#FC8019', '#FFD166'] },
  ],
  social: [
    { name: 'Vibrant Social', backgrounds: { dark: '#000000', light: '#FFFFFF' }, primary: '#E1306C', secondary: '#833AB4', accent: '#F77737', surface: '#121212', cardBg: '#1A1A1A', textPrimary: '#FFFFFF', textSecondary: '#A0A0A0', success: '#4BB543', error: '#ED4956', mood: 'vibrant, expressive, visual-first', gradientPair: ['#833AB4', '#E1306C'] },
    { name: 'Electric Social', backgrounds: { dark: '#010101', light: '#FFFFFF' }, primary: '#FE2C55', secondary: '#25F4EE', accent: '#FFFFFF', surface: '#161823', cardBg: '#1E2030', textPrimary: '#FFFFFF', textSecondary: '#8A8B91', success: '#34C759', error: '#FE2C55', mood: 'high-energy, gen-z, trend-driven', gradientPair: ['#FE2C55', '#25F4EE'] },
    { name: 'Clean Pro', backgrounds: { dark: '#1B1F23', light: '#FFFFFF' }, primary: '#0A66C2', secondary: '#057642', accent: '#E7A33E', surface: '#252A30', cardBg: '#2C3238', textPrimary: '#F0F2F5', textSecondary: '#9BA3AE', success: '#057642', error: '#CC1016', mood: 'professional, trustworthy, corporate' },
  ],
  ecommerce: [
    { name: 'Bold Commerce', backgrounds: { dark: '#111111', light: '#FFFFFF' }, primary: '#000000', secondary: '#FF9900', accent: '#232F3E', surface: '#1A1A1A', cardBg: '#222222', textPrimary: '#FFFFFF', textSecondary: '#999999', success: '#007600', error: '#B12704', mood: 'utilitarian, high-conversion, warm' },
    { name: 'Luxury Minimal', backgrounds: { dark: '#0A0A0A', light: '#FAFAF9' }, primary: '#1A1A1A', secondary: '#C4A35A', accent: '#8B7340', surface: '#141414', cardBg: '#1C1C1C', textPrimary: '#F5F5F0', textSecondary: '#8A8A80', success: '#4CAF50', error: '#D32F2F', mood: 'premium, luxury, curated', gradientPair: ['#C4A35A', '#8B7340'] },
    { name: 'Trend Flash', backgrounds: { dark: '#0D0D0D', light: '#FFFFFF' }, primary: '#000000', secondary: '#D50002', accent: '#FF4081', surface: '#1A1A1A', cardBg: '#242424', textPrimary: '#FFFFFF', textSecondary: '#9E9E9E', success: '#4CAF50', error: '#D50002', mood: 'trendy, fast-fashion, youthful' },
  ],
  crypto: [
    { name: 'Trust Blue', backgrounds: { dark: '#050D1E', light: '#FFFFFF' }, primary: '#0052FF', secondary: '#00D395', accent: '#4B93FF', surface: '#0A1628', cardBg: '#0F1D32', textPrimary: '#FFFFFF', textSecondary: '#8899B0', success: '#00D395', error: '#F6465D', mood: 'trustworthy, institutional, clean', gradientPair: ['#0052FF', '#4B93FF'] },
    { name: 'Phantom Violet', backgrounds: { dark: '#13111C', light: '#F7F5FF' }, primary: '#AB9FF2', secondary: '#534BB1', accent: '#E8DFF8', surface: '#1C1928', cardBg: '#242030', textPrimary: '#F0ECFF', textSecondary: '#8880A0', success: '#4ADE80', error: '#FB7185', mood: 'web3-native, purple-tinted, defi', gradientPair: ['#AB9FF2', '#534BB1'] },
    { name: 'Chain Dark', backgrounds: { dark: '#0B0E11', light: '#FAFAFA' }, primary: '#F0B90B', secondary: '#FCD535', accent: '#F8D12F', surface: '#14171B', cardBg: '#1E2329', textPrimary: '#EAECEF', textSecondary: '#848E9C', success: '#0ECB81', error: '#F6465D', mood: 'crypto-native, exchange-style, data-dense' },
  ],
  travel: [
    { name: 'Coral Escape', backgrounds: { dark: '#1A1A1A', light: '#FFFFFF' }, primary: '#FF385C', secondary: '#00A699', accent: '#FFB400', surface: '#F7F7F7', cardBg: '#FFFFFF', textPrimary: '#222222', textSecondary: '#717171', success: '#00A699', error: '#FF385C', mood: 'warm, exploratory, community-driven', gradientPair: ['#FF385C', '#FF7E82'] },
    { name: 'Deep Blue Travel', backgrounds: { dark: '#00224F', light: '#FFFFFF' }, primary: '#003580', secondary: '#FEBB02', accent: '#006CE4', surface: '#002A5C', cardBg: '#003670', textPrimary: '#FFFFFF', textSecondary: '#B0C4DE', success: '#008009', error: '#CC0000', mood: 'trustworthy, deals-focused, established' },
    { name: 'Sunset Journey', backgrounds: { dark: '#14100E', light: '#FFFBF5' }, primary: '#FF6F61', secondary: '#5B8C5A', accent: '#F4A261', surface: '#1E1816', cardBg: '#282220', textPrimary: '#FFF5EB', textSecondary: '#A09080', success: '#5B8C5A', error: '#E25555', mood: 'warm, adventure, wanderlust', gradientPair: ['#FF6F61', '#F4A261'] },
  ],
  music: [
    { name: 'Spotify Dark', backgrounds: { dark: '#121212', light: '#FFFFFF' }, primary: '#1DB954', secondary: '#1ED760', accent: '#B3B3B3', surface: '#181818', cardBg: '#282828', textPrimary: '#FFFFFF', textSecondary: '#B3B3B3', success: '#1DB954', error: '#E91429', mood: 'immersive, dark, music-centric' },
    { name: 'Apple Sound', backgrounds: { dark: '#0A0A0A', light: '#FFFFFF' }, primary: '#FC3C44', secondary: '#FA57C1', accent: '#AF52DE', surface: '#1C1C1E', cardBg: '#2C2C2E', textPrimary: '#FFFFFF', textSecondary: '#8E8E93', success: '#34C759', error: '#FF3B30', mood: 'premium, clean, curated', gradientPair: ['#FC3C44', '#FA57C1'] },
    { name: 'Neon Beats', backgrounds: { dark: '#0D0D1A', light: '#F5F0FF' }, primary: '#8B5CF6', secondary: '#EC4899', accent: '#06B6D4', surface: '#16162A', cardBg: '#1E1E35', textPrimary: '#F0EEFF', textSecondary: '#8080A0', success: '#10B981', error: '#EF4444', mood: 'vibrant, nocturnal, club-inspired', gradientPair: ['#8B5CF6', '#EC4899'] },
  ],
  education: [
    { name: 'Playful Learn', backgrounds: { dark: '#1B1B2F', light: '#FFFFFF' }, primary: '#58CC02', secondary: '#1CB0F6', accent: '#FF9600', surface: '#232342', cardBg: '#2A2A50', textPrimary: '#FFFFFF', textSecondary: '#AFAFC7', success: '#58CC02', error: '#FF4B4B', mood: 'playful, gamified, motivating', gradientPair: ['#58CC02', '#1CB0F6'] },
    { name: 'Academic Blue', backgrounds: { dark: '#0A1929', light: '#FFFFFF' }, primary: '#0056D2', secondary: '#008060', accent: '#7F56D9', surface: '#122240', cardBg: '#1A2D50', textPrimary: '#F0F4FF', textSecondary: '#8899B0', success: '#008060', error: '#D14343', mood: 'academic, structured, credible' },
    { name: 'Warm Campus', backgrounds: { dark: '#1A1610', light: '#FFF9F0' }, primary: '#E76F51', secondary: '#2A9D8F', accent: '#F4A261', surface: '#241E16', cardBg: '#2E2820', textPrimary: '#FFF5EB', textSecondary: '#A09888', success: '#2A9D8F', error: '#E76F51', mood: 'warm, inviting, campus-feel', gradientPair: ['#E76F51', '#F4A261'] },
  ],
  ride_hailing: [
    { name: 'Urban Black', backgrounds: { dark: '#000000', light: '#FFFFFF' }, primary: '#000000', secondary: '#276EF1', accent: '#3AA76D', surface: '#F6F6F6', cardBg: '#FFFFFF', textPrimary: '#000000', textSecondary: '#545454', success: '#3AA76D', error: '#D44333', mood: 'sophisticated, efficient, urban' },
    { name: 'Pink Ride', backgrounds: { dark: '#11111F', light: '#FFFFFF' }, primary: '#FF00BF', secondary: '#352384', accent: '#00B2A9', surface: '#F3F3F5', cardBg: '#FFFFFF', textPrimary: '#11111F', textSecondary: '#6B6B76', success: '#00B2A9', error: '#FF0052', mood: 'fun, approachable, community-driven', gradientPair: ['#FF00BF', '#352384'] },
    { name: 'Metro Pulse', backgrounds: { dark: '#101820', light: '#F4F7FA' }, primary: '#34D186', secondary: '#2E3A59', accent: '#5B6EF5', surface: '#1A2335', cardBg: '#202D44', textPrimary: '#ECF0F5', textSecondary: '#7A8BA0', success: '#34D186', error: '#F04E4E', mood: 'sleek, european, tech-forward', gradientPair: ['#34D186', '#5B6EF5'] },
  ],
  messaging: [
    { name: 'Chat Green', backgrounds: { dark: '#111B21', light: '#FFFFFF' }, primary: '#25D366', secondary: '#075E54', accent: '#34B7F1', surface: '#202C33', cardBg: '#1F2C34', textPrimary: '#E9EDEF', textSecondary: '#8696A0', success: '#25D366', error: '#F15C6D', mood: 'trustworthy, familiar, utilitarian' },
    { name: 'Cloud Blue', backgrounds: { dark: '#17212B', light: '#FFFFFF' }, primary: '#0088CC', secondary: '#34AADF', accent: '#5EB5F7', surface: '#232E3C', cardBg: '#242F3D', textPrimary: '#F5F5F5', textSecondary: '#708499', success: '#4FAE4E', error: '#E53935', mood: 'fast, clean, cloud-native', gradientPair: ['#0088CC', '#34AADF'] },
    { name: 'Secure Minimal', backgrounds: { dark: '#1B1C1F', light: '#FFFFFF' }, primary: '#3A76F0', secondary: '#2C5DC9', accent: '#6B93F7', surface: '#252628', cardBg: '#2D2E31', textPrimary: '#FFFFFF', textSecondary: '#9098A0', success: '#4CAF50', error: '#E34040', mood: 'secure, minimal, private' },
  ],
  streaming: [
    { name: 'Cinematic Red', backgrounds: { dark: '#141414', light: '#FFFFFF' }, primary: '#E50914', secondary: '#831010', accent: '#FFFFFF', surface: '#1A1A1A', cardBg: '#242424', textPrimary: '#FFFFFF', textSecondary: '#808080', success: '#46D369', error: '#E50914', mood: 'cinematic, immersive, premium' },
    { name: 'Creator Red', backgrounds: { dark: '#0F0F0F', light: '#FFFFFF' }, primary: '#FF0000', secondary: '#282828', accent: '#3EA6FF', surface: '#212121', cardBg: '#272727', textPrimary: '#FFFFFF', textSecondary: '#AAAAAA', success: '#2BA640', error: '#FF4E45', mood: 'dynamic, creator-driven, bold' },
    { name: 'Deep Cinema', backgrounds: { dark: '#0C111B', light: '#F5F5FA' }, primary: '#142864', secondary: '#3C0050', accent: '#0FA5E9', surface: '#141E30', cardBg: '#1C2840', textPrimary: '#EAEAF0', textSecondary: '#8090A8', success: '#4AC694', error: '#E5475B', mood: 'magical, premium, sophisticated', gradientPair: ['#142864', '#3C0050'] },
  ],
  dating: [
    { name: 'Flame Match', backgrounds: { dark: '#111111', light: '#FFFFFF' }, primary: '#FD267A', secondary: '#FF7854', accent: '#FF4458', surface: '#1A1A1A', cardBg: '#FFFFFF', textPrimary: '#21262E', textSecondary: '#656E7B', success: '#21D07A', error: '#FF4458', mood: 'bold, exciting, swipe-first', gradientPair: ['#FD267A', '#FF7854'] },
    { name: 'Golden Hour', backgrounds: { dark: '#1A1A1A', light: '#FFFFFF' }, primary: '#FFE600', secondary: '#F5B800', accent: '#000000', surface: '#222222', cardBg: '#FFFFFF', textPrimary: '#1A1A1A', textSecondary: '#71757A', success: '#2DBB54', error: '#E5243F', mood: 'empowering, warm, friendly' },
    { name: 'Quiet Spark', backgrounds: { dark: '#14141A', light: '#FFFFFF' }, primary: '#000000', secondary: '#994EA8', accent: '#6A4C9C', surface: '#1E1E24', cardBg: '#F7F7F7', textPrimary: '#1A1A1A', textSecondary: '#7A7A85', success: '#3CB371', error: '#D94848', mood: 'intentional, refined, relationship-focused', gradientPair: ['#994EA8', '#6A4C9C'] },
  ],
  wellness: [
    { name: 'Warm Breath', backgrounds: { dark: '#1A1220', light: '#FFF8F2' }, primary: '#FF7E1D', secondary: '#0C6FF9', accent: '#FFC13C', surface: '#23182E', cardBg: '#2E2038', textPrimary: '#FFFFFF', textSecondary: '#B0A3BE', success: '#4CD964', error: '#FF6B6B', mood: 'warm, friendly, approachable', gradientPair: ['#FF7E1D', '#FFC13C'] },
    { name: 'Night Sky', backgrounds: { dark: '#1B2250', light: '#F0F4FF' }, primary: '#6282E3', secondary: '#9BB5FF', accent: '#3A56C4', surface: '#232B5A', cardBg: '#2A3468', textPrimary: '#E8EDFF', textSecondary: '#8A98C8', success: '#52C7A0', error: '#E06070', mood: 'serene, peaceful, meditative', gradientPair: ['#1B2250', '#2A3468'] },
    { name: 'Forest Ground', backgrounds: { dark: '#141E17', light: '#F4F8F5' }, primary: '#5B8A72', secondary: '#3D6B52', accent: '#C4A35A', surface: '#1C2A20', cardBg: '#243028', textPrimary: '#E8F0EB', textSecondary: '#8FA898', success: '#5B8A72', error: '#D4695A', mood: 'grounding, natural, earthy', gradientPair: ['#3D6B52', '#5B8A72'] },
  ],
  productivity: [
    { name: 'Blank Canvas', backgrounds: { dark: '#191919', light: '#FFFFFF' }, primary: '#000000', secondary: '#37352F', accent: '#2EAADC', surface: '#202020', cardBg: '#252525', textPrimary: '#FFFFFF', textSecondary: '#9B9A97', success: '#4DAB9A', error: '#E03E3E', mood: 'minimal, flexible, tool-like' },
    { name: 'Work Mode', backgrounds: { dark: '#1A1625', light: '#F8F7FC' }, primary: '#5E6AD2', secondary: '#4A154B', accent: '#36C5F0', surface: '#221E2E', cardBg: '#2A2538', textPrimary: '#F0EEF6', textSecondary: '#8A85A0', success: '#2EB67D', error: '#E01E5A', mood: 'focused, collaborative, multi-accent', gradientPair: ['#5E6AD2', '#8B5CF6'] },
    { name: 'Action Red', backgrounds: { dark: '#1A1A1A', light: '#FAFAFA' }, primary: '#DE483A', secondary: '#B8352C', accent: '#FF7F66', surface: '#242424', cardBg: '#2C2C2C', textPrimary: '#FFFFFF', textSecondary: '#888888', success: '#4073FF', error: '#DE483A', mood: 'focused, action-oriented, decisive' },
  ],
  navigation: [
    { name: 'Wayfinder', backgrounds: { dark: '#1D2027', light: '#FFFFFF' }, primary: '#4285F4', secondary: '#34A853', accent: '#FBBC04', surface: '#282C34', cardBg: '#2E333D', textPrimary: '#FFFFFF', textSecondary: '#9AA0A6', success: '#34A853', error: '#EA4335', mood: 'reliable, informational, utilitarian' },
    { name: 'Drive Social', backgrounds: { dark: '#1A1D2E', light: '#FFFFFF' }, primary: '#00CCFF', secondary: '#33DDFF', accent: '#FFD600', surface: '#232740', cardBg: '#2A2F4A', textPrimary: '#F0F4FF', textSecondary: '#8890A8', success: '#4CE0A0', error: '#FF4466', mood: 'community, playful, real-time', gradientPair: ['#00CCFF', '#33DDFF'] },
  ],
  news: [
    { name: 'Editorial', backgrounds: { dark: '#111111', light: '#FFFFFF' }, primary: '#000000', secondary: '#FC3C44', accent: '#FF453A', surface: '#1C1C1E', cardBg: '#2C2C2E', textPrimary: '#FFFFFF', textSecondary: '#8E8E93', success: '#34C759', error: '#FF453A', mood: 'authoritative, clean, editorial' },
    { name: 'Magazine Red', backgrounds: { dark: '#1A1A1A', light: '#FFFFFF' }, primary: '#E12828', secondary: '#C42020', accent: '#1A1A1A', surface: '#242424', cardBg: '#2E2E2E', textPrimary: '#FFFFFF', textSecondary: '#999999', success: '#30B566', error: '#E12828', mood: 'bold, curated, magazine-style' },
    { name: 'Premium Ink', backgrounds: { dark: '#0D1117', light: '#F9F9FB' }, primary: '#C9A44C', secondary: '#8B7340', accent: '#E8D48C', surface: '#161B22', cardBg: '#1C2128', textPrimary: '#E6EDF3', textSecondary: '#768390', success: '#3FB950', error: '#F85149', mood: 'premium, sophisticated, subscriber-exclusive', gradientPair: ['#C9A44C', '#E8D48C'] },
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
 * If no category matches, returns a universal fallback palette.
 */
export function resolveTheme(prompt: string, preferDark: boolean = true): ThemeResult {
  const lowerPrompt = prompt.toLowerCase()

  // Detect category
  let detectedCategory = 'unknown'
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.test(lowerPrompt)) {
      detectedCategory = category
      break
    }
  }

  // Detect light/dark preference from prompt
  const wantsLight = /\b(light\s*(?:theme|mode)?|white\s*(?:background|theme|mode)?|bright|clean\s*white)\b/i.test(lowerPrompt)
  const wantsDark = /\b(dark\s*(?:theme|mode)?|black\s*(?:background|theme)?|night\s*mode|midnight)\b/i.test(lowerPrompt)
  const isDarkMode = wantsDark ? true : wantsLight ? false : preferDark

  // Pick palette
  const categoryPalettes = PALETTES[detectedCategory]
  let palette: ColorPalette

  if (categoryPalettes && categoryPalettes.length > 0) {
    // Random selection for variety
    const idx = Math.floor(Math.random() * categoryPalettes.length)
    palette = categoryPalettes[idx]
  } else {
    // Universal fallback
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
    fitness: 'Nike, Strava, Peloton',
    finance: 'Robinhood, Cash App, Revolut',
    food_delivery: 'Uber Eats, DoorDash, Swiggy',
    social: 'Instagram, TikTok, Twitter/X',
    ecommerce: 'Amazon, Nike Shop, SHEIN',
    crypto: 'Coinbase, Phantom, Binance',
    travel: 'Airbnb, Booking.com',
    music: 'Spotify, Apple Music',
    education: 'Duolingo, Coursera',
    ride_hailing: 'Uber, Lyft',
    messaging: 'WhatsApp, Telegram, Signal',
    streaming: 'Netflix, YouTube, Disney+',
    dating: 'Tinder, Bumble, Hinge',
    wellness: 'Headspace, Calm',
    productivity: 'Notion, Slack, Todoist',
    navigation: 'Google Maps, Waze',
    news: 'Apple News, Flipboard',
  }
  return examples[category] || 'top-rated apps in this category'
}
