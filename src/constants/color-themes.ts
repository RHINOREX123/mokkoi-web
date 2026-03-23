/**
 * Data-driven color theming system for Mokkoi
 *
 * Each category includes 2-3 palette variations so the AI can pick
 * different ones for visual variety. Colors are sourced from real-world
 * apps via Mobbin.com brand pages, brand guidelines, and design system
 * documentation (Nike, Spotify, Coinbase, Airbnb, etc.).
 *
 * Reference apps per category:
 *   Fitness/Health  — Nike, Adidas, Strava, Peloton, Fitbit
 *   Finance         — Robinhood, Cash App, Revolut
 *   Food Delivery   — Uber Eats, DoorDash, Swiggy
 *   Social Media    — Instagram, TikTok
 *   E-Commerce      — Nike (shop), Adidas, Amazon, Shopify stores
 *   Crypto/Web3     — Coinbase, Phantom
 *   Travel          — Airbnb, Booking.com
 *   Music/Media     — Spotify, Apple Music
 *   Education       — Duolingo, Coursera
 *   Ride-Hailing    — Uber, Lyft
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColorPalette {
  /** Human-readable palette name, e.g. "Nike Dark" */
  name: string
  backgrounds: {
    dark: string
    light: string
  }
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

export interface CategoryTheme {
  category: string
  description: string
  palettes: ColorPalette[]
}

// ---------------------------------------------------------------------------
// 1. Fitness / Health
// ---------------------------------------------------------------------------
// Dominant patterns: dark backgrounds, neon/electric accents (green, orange,
// blue), high-contrast for readability during workouts. Gradients common on
// progress rings and CTAs. Mood is energetic and motivating.
// ---------------------------------------------------------------------------

const fitnessHealth: CategoryTheme = {
  category: 'fitness',
  description: 'Energetic, high-contrast palettes with neon accents on dark backgrounds',
  palettes: [
    {
      // Nike-inspired — black/white minimalism with bold pops
      name: 'Midnight Athlete',
      backgrounds: { dark: '#111111', light: '#F5F5F5' },
      primary: '#E5E5E5',
      secondary: '#FA5A5A',
      accent: '#3A80F8',
      surface: '#1A1A1A',
      cardBg: '#1E1E1E',
      textPrimary: '#FFFFFF',
      textSecondary: '#A0A0A0',
      success: '#34C759',
      error: '#FF3B30',
      mood: 'bold, minimal, premium athletic',
      gradientPair: ['#3A80F8', '#D859F7'],
    },
    {
      // Strava / energetic-orange inspired
      name: 'Neon Burn',
      backgrounds: { dark: '#0E0E0E', light: '#FFF8F5' },
      primary: '#FC4C02',
      secondary: '#FCE434',
      accent: '#FF6B2B',
      surface: '#1C1C1E',
      cardBg: '#2C2C2E',
      textPrimary: '#FFFFFF',
      textSecondary: '#8E8E93',
      success: '#30D158',
      error: '#FF453A',
      mood: 'energetic, competitive, outdoor',
      gradientPair: ['#FC4C02', '#FCE434'],
    },
    {
      // Electric green / tech-fitness inspired (Fitbod, JEFIT style)
      name: 'Electric Pulse',
      backgrounds: { dark: '#0A0A0A', light: '#F0FFF4' },
      primary: '#22C55E',
      secondary: '#06B6D4',
      accent: '#A855F7',
      surface: '#141414',
      cardBg: '#1E1E1E',
      textPrimary: '#F0F0F0',
      textSecondary: '#6B7280',
      success: '#22C55E',
      error: '#EF4444',
      mood: 'futuristic, tech-forward, intense',
      gradientPair: ['#22C55E', '#06B6D4'],
    },
  ],
}

// ---------------------------------------------------------------------------
// 2. Banking / Finance
// ---------------------------------------------------------------------------
// Dominant patterns: clean white or dark backgrounds, green for gains/money,
// muted blues for trust, minimal accent colors. Conservative typography.
// Mood is trustworthy, secure, professional.
// ---------------------------------------------------------------------------

const bankingFinance: CategoryTheme = {
  category: 'finance',
  description: 'Clean, trustworthy palettes with green-for-money and conservative blues',
  palettes: [
    {
      // Robinhood-inspired — bright green on white/dark
      name: 'Market Green',
      backgrounds: { dark: '#1C1C1E', light: '#FFFFFF' },
      primary: '#00C805',
      secondary: '#5AC53A',
      accent: '#FFB800',
      surface: '#F5F5F7',
      cardBg: '#FFFFFF',
      textPrimary: '#1C1C1E',
      textSecondary: '#6E6E73',
      success: '#00C805',
      error: '#FF6347',
      mood: 'approachable, optimistic, retail-friendly',
      gradientPair: ['#00C805', '#5AC53A'],
    },
    {
      // Cash App-inspired — bold green on black
      name: 'Cash Flow',
      backgrounds: { dark: '#000000', light: '#F0FFF0' },
      primary: '#00D54B',
      secondary: '#00A83A',
      accent: '#FFFFFF',
      surface: '#121212',
      cardBg: '#1A1A1A',
      textPrimary: '#FFFFFF',
      textSecondary: '#8C8C8C',
      success: '#00D54B',
      error: '#FF4444',
      mood: 'bold, modern, money-centric',
    },
    {
      // Revolut-inspired — dark fintech with purple/blue
      name: 'Neobank Pro',
      backgrounds: { dark: '#191C1F', light: '#F8F9FA' },
      primary: '#7F84F6',
      secondary: '#0B84F6',
      accent: '#F08389',
      surface: '#22262A',
      cardBg: '#2A2E33',
      textPrimary: '#FFFFFF',
      textSecondary: '#9CA3AF',
      success: '#34D399',
      error: '#F87171',
      mood: 'sophisticated, premium, tech-savvy',
      gradientPair: ['#7F84F6', '#0B84F6'],
    },
  ],
}

// ---------------------------------------------------------------------------
// 3. Food Delivery
// ---------------------------------------------------------------------------
// Dominant patterns: white/light backgrounds for browsing, red/orange accents
// (appetite-stimulating colors), card-heavy layouts. Clean with bold CTAs.
// Mood is warm, appetizing, fast.
// ---------------------------------------------------------------------------

const foodDelivery: CategoryTheme = {
  category: 'food_delivery',
  description: 'Warm, appetizing palettes with red/orange accents on clean backgrounds',
  palettes: [
    {
      // Uber Eats-inspired — green freshness on white
      name: 'Fresh Feast',
      backgrounds: { dark: '#1A1A1A', light: '#FFFFFF' },
      primary: '#06C167',
      secondary: '#000000',
      accent: '#276EF1',
      surface: '#F6F6F6',
      cardBg: '#FFFFFF',
      textPrimary: '#000000',
      textSecondary: '#545454',
      success: '#06C167',
      error: '#E11900',
      mood: 'fresh, reliable, modern',
    },
    {
      // DoorDash-inspired — bold red on white
      name: 'Rapid Red',
      backgrounds: { dark: '#191919', light: '#FFFFFF' },
      primary: '#FF3008',
      secondary: '#EB1700',
      accent: '#B71000',
      surface: '#F7F7F7',
      cardBg: '#FFFFFF',
      textPrimary: '#191919',
      textSecondary: '#767676',
      success: '#00AA4F',
      error: '#FF3008',
      mood: 'urgent, energetic, bold',
      gradientPair: ['#FF3008', '#EB1700'],
    },
    {
      // Swiggy-inspired — warm orange on white
      name: 'Spice Route',
      backgrounds: { dark: '#1E1E1E', light: '#FFFFFF' },
      primary: '#FC8019',
      secondary: '#E87000',
      accent: '#3D4152',
      surface: '#F8F8F8',
      cardBg: '#FFFFFF',
      textPrimary: '#3D4152',
      textSecondary: '#7E808C',
      success: '#60B246',
      error: '#E23744',
      mood: 'warm, appetizing, vibrant',
      gradientPair: ['#FC8019', '#FFA94D'],
    },
  ],
}

// ---------------------------------------------------------------------------
// 4. Social Media
// ---------------------------------------------------------------------------
// Dominant patterns: dark mode with vibrant multi-color accents, gradient
// branding, full-bleed media. High engagement colors.
// Mood is expressive, playful, dynamic.
// ---------------------------------------------------------------------------

const socialMedia: CategoryTheme = {
  category: 'social',
  description: 'Vibrant, expressive palettes with gradients and bold accent colors',
  palettes: [
    {
      // Instagram-inspired — gradient-rich, warm/cool spectrum
      name: 'Gram Glow',
      backgrounds: { dark: '#121212', light: '#FAFAFA' },
      primary: '#E1306C',
      secondary: '#833AB4',
      accent: '#F77737',
      surface: '#1E1E1E',
      cardBg: '#262626',
      textPrimary: '#FFFFFF',
      textSecondary: '#A8A8A8',
      success: '#58C322',
      error: '#ED4956',
      mood: 'creative, warm, visually rich',
      gradientPair: ['#833AB4', '#FD1D1D'],
    },
    {
      // TikTok-inspired — dark with neon pink+cyan
      name: 'Viral Neon',
      backgrounds: { dark: '#000000', light: '#FFFFFF' },
      primary: '#FE2C55',
      secondary: '#25F4EE',
      accent: '#FFFFFF',
      surface: '#121212',
      cardBg: '#1A1A1A',
      textPrimary: '#FFFFFF',
      textSecondary: '#8A8A8A',
      success: '#39E75F',
      error: '#FE2C55',
      mood: 'energetic, youthful, disruptive',
      gradientPair: ['#FE2C55', '#25F4EE'],
    },
    {
      // Twitter/X-inspired — clean blue on white/dark
      name: 'Feed Blue',
      backgrounds: { dark: '#15202B', light: '#FFFFFF' },
      primary: '#1D9BF0',
      secondary: '#8ECDF7',
      accent: '#FFD700',
      surface: '#192734',
      cardBg: '#1E2C3A',
      textPrimary: '#E7E9EA',
      textSecondary: '#71767B',
      success: '#00BA7C',
      error: '#F4212E',
      mood: 'conversational, direct, trustworthy',
    },
  ],
}

// ---------------------------------------------------------------------------
// 5. E-Commerce / Shopping
// ---------------------------------------------------------------------------
// Dominant patterns: white/neutral backgrounds, product-first, minimal color
// to let product photos shine. Bold CTA buttons (black, orange, or brand).
// Mood is clean, premium, aspirational.
// ---------------------------------------------------------------------------

const ecommerce: CategoryTheme = {
  category: 'ecommerce',
  description: 'Clean, product-focused palettes with strong CTAs on neutral backgrounds',
  palettes: [
    {
      // Nike/Adidas shop-inspired — black/white premium
      name: 'Mono Luxe',
      backgrounds: { dark: '#111111', light: '#FFFFFF' },
      primary: '#111111',
      secondary: '#E5E5E5',
      accent: '#FF5A00',
      surface: '#F5F5F5',
      cardBg: '#FFFFFF',
      textPrimary: '#111111',
      textSecondary: '#757575',
      success: '#4CAF50',
      error: '#F44336',
      mood: 'premium, minimal, brand-forward',
    },
    {
      // Amazon-inspired — warm accent on white
      name: 'Prime Cart',
      backgrounds: { dark: '#0F1111', light: '#EAEDED' },
      primary: '#FF9900',
      secondary: '#146EB4',
      accent: '#232F3E',
      surface: '#FFFFFF',
      cardBg: '#FFFFFF',
      textPrimary: '#0F1111',
      textSecondary: '#565959',
      success: '#067D62',
      error: '#B12704',
      mood: 'utilitarian, high-conversion, warm',
      gradientPair: ['#FF9900', '#FFAD33'],
    },
    {
      // Boutique / fashion e-commerce — ivory, camel, soft
      name: 'Atelier',
      backgrounds: { dark: '#1A1816', light: '#FAF8F5' },
      primary: '#2C2C2C',
      secondary: '#C4A882',
      accent: '#8B6F47',
      surface: '#F5F1EB',
      cardBg: '#FFFFFF',
      textPrimary: '#1A1816',
      textSecondary: '#8C8279',
      success: '#5E8C61',
      error: '#C14949',
      mood: 'elegant, editorial, boutique',
    },
  ],
}

// ---------------------------------------------------------------------------
// 6. Crypto / Web3
// ---------------------------------------------------------------------------
// Dominant patterns: dark backgrounds (near-black), neon/vivid accent colors
// (purple, blue, cyan, green). Gradients very common. Futuristic typography.
// Mood is cutting-edge, futuristic, premium.
// ---------------------------------------------------------------------------

const cryptoWeb3: CategoryTheme = {
  category: 'crypto',
  description: 'Dark, futuristic palettes with neon accents and vivid gradients',
  palettes: [
    {
      // Coinbase-inspired — trust blue on clean white/dark
      name: 'Blue Trust',
      backgrounds: { dark: '#0A0B0D', light: '#FFFFFF' },
      primary: '#0052FF',
      secondary: '#344AFB',
      accent: '#00D395',
      surface: '#16171A',
      cardBg: '#1E2025',
      textPrimary: '#FFFFFF',
      textSecondary: '#8A919E',
      success: '#00D395',
      error: '#CF202F',
      mood: 'trustworthy, institutional, approachable',
      gradientPair: ['#0052FF', '#344AFB'],
    },
    {
      // Phantom-inspired — deep purple/violet on dark
      name: 'Phantom Violet',
      backgrounds: { dark: '#121212', light: '#F5F3FF' },
      primary: '#AB9FF2',
      secondary: '#534BB1',
      accent: '#3DDAD7',
      surface: '#1B1B1F',
      cardBg: '#232328',
      textPrimary: '#FFFFFF',
      textSecondary: '#9090A0',
      success: '#3DDAD7',
      error: '#FF6B6B',
      mood: 'mystical, premium, web3-native',
      gradientPair: ['#534BB1', '#AB9FF2'],
    },
    {
      // Generic crypto / DeFi — neon green on near-black
      name: 'DeFi Matrix',
      backgrounds: { dark: '#0B0E11', light: '#F0FDF4' },
      primary: '#0ECB81',
      secondary: '#F0B90B',
      accent: '#1E80FF',
      surface: '#141821',
      cardBg: '#1C2230',
      textPrimary: '#EAECEF',
      textSecondary: '#6B7280',
      success: '#0ECB81',
      error: '#F6465D',
      mood: 'trading-focused, data-dense, futuristic',
      gradientPair: ['#0ECB81', '#1E80FF'],
    },
  ],
}

// ---------------------------------------------------------------------------
// 7. Travel
// ---------------------------------------------------------------------------
// Dominant patterns: white backgrounds with vibrant photography, coral/red or
// deep blue accents. Card-based browsing layouts. Warm and aspirational.
// Mood is wanderlust, warm, inviting.
// ---------------------------------------------------------------------------

const travel: CategoryTheme = {
  category: 'travel',
  description: 'Warm, inviting palettes with coral or blue accents for wanderlust',
  palettes: [
    {
      // Airbnb-inspired — coral-pink on white
      name: 'Coral Wanderlust',
      backgrounds: { dark: '#222222', light: '#FFFFFF' },
      primary: '#FF385C',
      secondary: '#00A699',
      accent: '#FC642D',
      surface: '#F7F7F7',
      cardBg: '#FFFFFF',
      textPrimary: '#222222',
      textSecondary: '#717171',
      success: '#008A05',
      error: '#C13515',
      mood: 'warm, welcoming, experiential',
      gradientPair: ['#FF385C', '#FC642D'],
    },
    {
      // Booking.com-inspired — deep blue on light
      name: 'Horizon Blue',
      backgrounds: { dark: '#00224F', light: '#F2F6FA' },
      primary: '#003580',
      secondary: '#009FE3',
      accent: '#FEBA02',
      surface: '#FFFFFF',
      cardBg: '#FFFFFF',
      textPrimary: '#1A1A2E',
      textSecondary: '#666666',
      success: '#008234',
      error: '#CC0000',
      mood: 'trustworthy, deal-oriented, global',
    },
    {
      // Premium travel / boutique — dark, gold accents
      name: 'First Class',
      backgrounds: { dark: '#0F1923', light: '#FBF9F6' },
      primary: '#C9A96E',
      secondary: '#1B4D89',
      accent: '#E8D5B7',
      surface: '#172A3A',
      cardBg: '#1E3448',
      textPrimary: '#F5F0E8',
      textSecondary: '#8A9BB0',
      success: '#5DB075',
      error: '#D94848',
      mood: 'luxurious, aspirational, premium',
      gradientPair: ['#C9A96E', '#E8D5B7'],
    },
  ],
}

// ---------------------------------------------------------------------------
// 8. Music / Media
// ---------------------------------------------------------------------------
// Dominant patterns: dark backgrounds for immersive media consumption,
// vibrant accent colors (green, pink/red), heavy use of album-art-derived
// dynamic colors. Gradients common in player UI.
// Mood is immersive, vibrant, expressive.
// ---------------------------------------------------------------------------

const musicMedia: CategoryTheme = {
  category: 'music',
  description: 'Dark, immersive palettes with vibrant accents for media consumption',
  palettes: [
    {
      // Spotify-inspired — green on near-black
      name: 'Stream Green',
      backgrounds: { dark: '#191414', light: '#F8F8F8' },
      primary: '#1DB954',
      secondary: '#1ED760',
      accent: '#B3B3B3',
      surface: '#212121',
      cardBg: '#282828',
      textPrimary: '#FFFFFF',
      textSecondary: '#B3B3B3',
      success: '#1DB954',
      error: '#E22134',
      mood: 'immersive, energetic, music-forward',
      gradientPair: ['#1DB954', '#1ED760'],
    },
    {
      // Apple Music-inspired — pink/red gradient on white/dark
      name: 'Crimson Beat',
      backgrounds: { dark: '#1C1C1E', light: '#FFFFFF' },
      primary: '#FC3C44',
      secondary: '#FA57C1',
      accent: '#AF52DE',
      surface: '#2C2C2E',
      cardBg: '#3A3A3C',
      textPrimary: '#FFFFFF',
      textSecondary: '#98989D',
      success: '#34C759',
      error: '#FF3B30',
      mood: 'warm, polished, Apple-ecosystem',
      gradientPair: ['#FC3C44', '#FA57C1'],
    },
    {
      // SoundCloud / indie-media — orange energy
      name: 'Audio Wave',
      backgrounds: { dark: '#111111', light: '#FFFFFF' },
      primary: '#FF5500',
      secondary: '#FF7700',
      accent: '#333333',
      surface: '#1A1A1A',
      cardBg: '#242424',
      textPrimary: '#FFFFFF',
      textSecondary: '#999999',
      success: '#2DC76D',
      error: '#FF3333',
      mood: 'underground, creator-focused, energetic',
      gradientPair: ['#FF5500', '#FF7700'],
    },
  ],
}

// ---------------------------------------------------------------------------
// 9. Education
// ---------------------------------------------------------------------------
// Dominant patterns: bright, playful colors (green, blue, yellow), white
// backgrounds, friendly/rounded UI, progress indicators. Some use gamification
// palettes.
// Mood is encouraging, accessible, friendly.
// ---------------------------------------------------------------------------

const education: CategoryTheme = {
  category: 'education',
  description: 'Bright, encouraging palettes with green/blue accents for learning',
  palettes: [
    {
      // Duolingo-inspired — bright green + playful multi-color
      name: 'Learn & Play',
      backgrounds: { dark: '#1B1B1B', light: '#FFFFFF' },
      primary: '#58CC02',
      secondary: '#1CB0F6',
      accent: '#FFC800',
      surface: '#F7F7F7',
      cardBg: '#FFFFFF',
      textPrimary: '#4B4B4B',
      textSecondary: '#AFAFAF',
      success: '#58CC02',
      error: '#FF4B4B',
      mood: 'playful, gamified, encouraging',
      gradientPair: ['#58CC02', '#89E219'],
    },
    {
      // Coursera-inspired — professional blue + purple
      name: 'Scholar Blue',
      backgrounds: { dark: '#1A1A2E', light: '#FFFFFF' },
      primary: '#0056D2',
      secondary: '#271066',
      accent: '#2A73CC',
      surface: '#F5F5F5',
      cardBg: '#FFFFFF',
      textPrimary: '#1F1F1F',
      textSecondary: '#636363',
      success: '#198754',
      error: '#DC3545',
      mood: 'professional, credible, academic',
      gradientPair: ['#0056D2', '#271066'],
    },
    {
      // Khan Academy / warm education — teal + friendly
      name: 'Chalkboard',
      backgrounds: { dark: '#14213D', light: '#F8FAFC' },
      primary: '#14BF96',
      secondary: '#1865F2',
      accent: '#FF914D',
      surface: '#E8F5E9',
      cardBg: '#FFFFFF',
      textPrimary: '#21242C',
      textSecondary: '#6B7B8D',
      success: '#14BF96',
      error: '#E84D39',
      mood: 'warm, accessible, knowledge-focused',
      gradientPair: ['#14BF96', '#1865F2'],
    },
  ],
}

// ---------------------------------------------------------------------------
// 10. Ride-Hailing
// ---------------------------------------------------------------------------
// Dominant patterns: black/white minimalism, map-centric UI, clean sans-serif
// typography. Accent colors used sparingly for CTAs (blue, green, pink).
// Mood is efficient, reliable, urban.
// ---------------------------------------------------------------------------

const rideHailing: CategoryTheme = {
  category: 'ride_hailing',
  description: 'Clean, efficient palettes with black/white bases and focused accent colors',
  palettes: [
    {
      // Uber-inspired — black + white with blue accent
      name: 'Urban Black',
      backgrounds: { dark: '#000000', light: '#FFFFFF' },
      primary: '#000000',
      secondary: '#276EF1',
      accent: '#3AA76D',
      surface: '#F6F6F6',
      cardBg: '#FFFFFF',
      textPrimary: '#000000',
      textSecondary: '#545454',
      success: '#3AA76D',
      error: '#D44333',
      mood: 'sophisticated, efficient, urban',
    },
    {
      // Lyft-inspired — magenta pink on white/dark
      name: 'Pink Ride',
      backgrounds: { dark: '#11111F', light: '#FFFFFF' },
      primary: '#FF00BF',
      secondary: '#352384',
      accent: '#00B2A9',
      surface: '#F3F3F5',
      cardBg: '#FFFFFF',
      textPrimary: '#11111F',
      textSecondary: '#6B6B76',
      success: '#00B2A9',
      error: '#FF0052',
      mood: 'fun, approachable, community-driven',
      gradientPair: ['#FF00BF', '#352384'],
    },
    {
      // Premium car service / Bolt-style — sleek dark green
      name: 'Metro Pulse',
      backgrounds: { dark: '#101820', light: '#F4F7FA' },
      primary: '#34D186',
      secondary: '#2E3A59',
      accent: '#5B6EF5',
      surface: '#1A2335',
      cardBg: '#202D44',
      textPrimary: '#ECF0F5',
      textSecondary: '#7A8BA0',
      success: '#34D186',
      error: '#F04E4E',
      mood: 'sleek, european, tech-forward',
      gradientPair: ['#34D186', '#5B6EF5'],
    },
  ],
}

// ---------------------------------------------------------------------------
// 11. Messaging
// ---------------------------------------------------------------------------
// Dominant patterns: clean white/light backgrounds, green or blue brand colors,
// minimal UI that gets out of the way of conversation. Chat bubbles are the hero.
// Reference apps: WhatsApp, Telegram, Signal
// ---------------------------------------------------------------------------

const messaging: CategoryTheme = {
  category: 'messaging',
  description: 'Clean, utilitarian palettes with green/blue trust tones on light backgrounds',
  palettes: [
    {
      // WhatsApp-inspired — green on light, trustworthy
      name: 'Chat Green',
      backgrounds: { dark: '#111B21', light: '#FFFFFF' },
      primary: '#25D366',
      secondary: '#075E54',
      accent: '#34B7F1',
      surface: '#202C33',
      cardBg: '#1F2C34',
      textPrimary: '#E9EDEF',
      textSecondary: '#8696A0',
      success: '#25D366',
      error: '#F15C6D',
      mood: 'trustworthy, familiar, utilitarian',
    },
    {
      // Telegram-inspired — sky blue on white, fast and clean
      name: 'Cloud Blue',
      backgrounds: { dark: '#17212B', light: '#FFFFFF' },
      primary: '#0088CC',
      secondary: '#34AADF',
      accent: '#5EB5F7',
      surface: '#232E3C',
      cardBg: '#242F3D',
      textPrimary: '#F5F5F5',
      textSecondary: '#708499',
      success: '#4FAE4E',
      error: '#E53935',
      mood: 'fast, clean, cloud-native',
      gradientPair: ['#0088CC', '#34AADF'],
    },
    {
      // Signal-inspired — minimal blue, privacy-first
      name: 'Secure Minimal',
      backgrounds: { dark: '#1B1C1F', light: '#FFFFFF' },
      primary: '#3A76F0',
      secondary: '#2C5DC9',
      accent: '#6B93F7',
      surface: '#252628',
      cardBg: '#2D2E31',
      textPrimary: '#FFFFFF',
      textSecondary: '#9098A0',
      success: '#4CAF50',
      error: '#E34040',
      mood: 'secure, minimal, private',
    },
  ],
}

// ---------------------------------------------------------------------------
// 12. Streaming / Video
// ---------------------------------------------------------------------------
// Dominant patterns: dark backgrounds (immersive for content), bold brand reds/purples,
// minimal chrome so content is hero. Large thumbnails, auto-play previews.
// Reference apps: YouTube, Netflix, Disney+, HBO Max
// ---------------------------------------------------------------------------

const streaming: CategoryTheme = {
  category: 'streaming',
  description: 'Dark, immersive palettes with bold brand colors for content-first experiences',
  palettes: [
    {
      // Netflix-inspired — cinematic red on black
      name: 'Cinematic Red',
      backgrounds: { dark: '#141414', light: '#FFFFFF' },
      primary: '#E50914',
      secondary: '#831010',
      accent: '#FFFFFF',
      surface: '#1A1A1A',
      cardBg: '#242424',
      textPrimary: '#FFFFFF',
      textSecondary: '#808080',
      success: '#46D369',
      error: '#E50914',
      mood: 'cinematic, immersive, premium',
    },
    {
      // YouTube-inspired — red on white/dark, creator-driven
      name: 'Creator Red',
      backgrounds: { dark: '#0F0F0F', light: '#FFFFFF' },
      primary: '#FF0000',
      secondary: '#282828',
      accent: '#3EA6FF',
      surface: '#212121',
      cardBg: '#272727',
      textPrimary: '#FFFFFF',
      textSecondary: '#AAAAAA',
      success: '#2BA640',
      error: '#FF4E45',
      mood: 'dynamic, creator-driven, bold',
    },
    {
      // Disney+/HBO-inspired — deep navy/purple, magical
      name: 'Deep Cinema',
      backgrounds: { dark: '#0C111B', light: '#F5F5FA' },
      primary: '#142864',
      secondary: '#3C0050',
      accent: '#0FA5E9',
      surface: '#141E30',
      cardBg: '#1C2840',
      textPrimary: '#EAEAF0',
      textSecondary: '#8090A8',
      success: '#4AC694',
      error: '#E5475B',
      mood: 'magical, premium, sophisticated',
      gradientPair: ['#142864', '#3C0050'],
    },
  ],
}

// ---------------------------------------------------------------------------
// 13. Dating
// ---------------------------------------------------------------------------
// Dominant patterns: warm, bold colors (pink, coral, yellow), light backgrounds,
// card-swipe UI, personality-driven. Gradients are very common.
// Reference apps: Tinder, Bumble, Hinge
// ---------------------------------------------------------------------------

const dating: CategoryTheme = {
  category: 'dating',
  description: 'Warm, bold palettes with personality-driven pinks, corals, and golds',
  palettes: [
    {
      // Tinder-inspired — hot pink/coral gradient
      name: 'Flame Match',
      backgrounds: { dark: '#111111', light: '#FFFFFF' },
      primary: '#FD267A',
      secondary: '#FF7854',
      accent: '#FF4458',
      surface: '#1A1A1A',
      cardBg: '#FFFFFF',
      textPrimary: '#21262E',
      textSecondary: '#656E7B',
      success: '#21D07A',
      error: '#FF4458',
      mood: 'bold, exciting, swipe-first',
      gradientPair: ['#FD267A', '#FF7854'],
    },
    {
      // Bumble-inspired — warm yellow, empowering
      name: 'Golden Hour',
      backgrounds: { dark: '#1A1A1A', light: '#FFFFFF' },
      primary: '#FFE600',
      secondary: '#F5B800',
      accent: '#000000',
      surface: '#222222',
      cardBg: '#FFFFFF',
      textPrimary: '#1A1A1A',
      textSecondary: '#71757A',
      success: '#2DBB54',
      error: '#E5243F',
      mood: 'empowering, warm, friendly',
    },
    {
      // Hinge-inspired — refined, intentional, muted purple
      name: 'Quiet Spark',
      backgrounds: { dark: '#14141A', light: '#FFFFFF' },
      primary: '#000000',
      secondary: '#994EA8',
      accent: '#6A4C9C',
      surface: '#1E1E24',
      cardBg: '#F7F7F7',
      textPrimary: '#1A1A1A',
      textSecondary: '#7A7A85',
      success: '#3CB371',
      error: '#D94848',
      mood: 'intentional, refined, relationship-focused',
      gradientPair: ['#994EA8', '#6A4C9C'],
    },
  ],
}

// ---------------------------------------------------------------------------
// 14. Wellness / Mindfulness
// ---------------------------------------------------------------------------
// Dominant patterns: calming colors, soft gradients, nature-inspired (deep blue,
// warm orange, sage green). Both dark (sleep/night) and light (day) modes.
// Reference apps: Headspace, Calm, Insight Timer
// ---------------------------------------------------------------------------

const wellness: CategoryTheme = {
  category: 'wellness',
  description: 'Calming, nature-inspired palettes with soft gradients and warm tones',
  palettes: [
    {
      // Headspace-inspired — warm orange on light, playful
      name: 'Warm Breath',
      backgrounds: { dark: '#1A1220', light: '#FFF8F2' },
      primary: '#FF7E1D',
      secondary: '#0C6FF9',
      accent: '#FFC13C',
      surface: '#23182E',
      cardBg: '#2E2038',
      textPrimary: '#FFFFFF',
      textSecondary: '#B0A3BE',
      success: '#4CD964',
      error: '#FF6B6B',
      mood: 'warm, friendly, approachable',
      gradientPair: ['#FF7E1D', '#FFC13C'],
    },
    {
      // Calm-inspired — deep navy, serene night sky
      name: 'Night Sky',
      backgrounds: { dark: '#1B2250', light: '#F0F4FF' },
      primary: '#6282E3',
      secondary: '#9BB5FF',
      accent: '#3A56C4',
      surface: '#232B5A',
      cardBg: '#2A3468',
      textPrimary: '#E8EDFF',
      textSecondary: '#8A98C8',
      success: '#52C7A0',
      error: '#E06070',
      mood: 'serene, peaceful, meditative',
      gradientPair: ['#1B2250', '#2A3468'],
    },
    {
      // Nature/sage — earthy greens, grounding
      name: 'Forest Ground',
      backgrounds: { dark: '#141E17', light: '#F4F8F5' },
      primary: '#5B8A72',
      secondary: '#3D6B52',
      accent: '#C4A35A',
      surface: '#1C2A20',
      cardBg: '#243028',
      textPrimary: '#E8F0EB',
      textSecondary: '#8FA898',
      success: '#5B8A72',
      error: '#D4695A',
      mood: 'grounding, natural, earthy',
      gradientPair: ['#3D6B52', '#5B8A72'],
    },
  ],
}

// ---------------------------------------------------------------------------
// 15. Productivity
// ---------------------------------------------------------------------------
// Dominant patterns: minimal, functional, lots of white space. Monochrome base
// with a single bold accent. Tools over aesthetics. Clean type hierarchy.
// Reference apps: Notion, Todoist, Slack, Linear
// ---------------------------------------------------------------------------

const productivity: CategoryTheme = {
  category: 'productivity',
  description: 'Minimal, functional palettes with monochrome bases and focused accents',
  palettes: [
    {
      // Notion-inspired — pure monochrome, ultra-clean
      name: 'Blank Canvas',
      backgrounds: { dark: '#191919', light: '#FFFFFF' },
      primary: '#000000',
      secondary: '#37352F',
      accent: '#2EAADC',
      surface: '#202020',
      cardBg: '#252525',
      textPrimary: '#FFFFFF',
      textSecondary: '#9B9A97',
      success: '#4DAB9A',
      error: '#E03E3E',
      mood: 'minimal, flexible, tool-like',
    },
    {
      // Linear/Slack-inspired — purple-tinted dark, multi-accent
      name: 'Work Mode',
      backgrounds: { dark: '#1A1625', light: '#F8F7FC' },
      primary: '#5E6AD2',
      secondary: '#4A154B',
      accent: '#36C5F0',
      surface: '#221E2E',
      cardBg: '#2A2538',
      textPrimary: '#F0EEF6',
      textSecondary: '#8A85A0',
      success: '#2EB67D',
      error: '#E01E5A',
      mood: 'focused, collaborative, multi-accent',
      gradientPair: ['#5E6AD2', '#8B5CF6'],
    },
    {
      // Todoist-inspired — clean red accent on white
      name: 'Action Red',
      backgrounds: { dark: '#1A1A1A', light: '#FAFAFA' },
      primary: '#DE483A',
      secondary: '#B8352C',
      accent: '#FF7F66',
      surface: '#242424',
      cardBg: '#2C2C2C',
      textPrimary: '#FFFFFF',
      textSecondary: '#888888',
      success: '#4073FF',
      error: '#DE483A',
      mood: 'focused, action-oriented, decisive',
    },
  ],
}

// ---------------------------------------------------------------------------
// 16. Navigation / Maps
// ---------------------------------------------------------------------------
// Dominant patterns: blue/green (wayfinding), light backgrounds for map readability,
// minimal UI that doesn't compete with map content. Status indicators prominent.
// Reference apps: Google Maps, Waze, Apple Maps
// ---------------------------------------------------------------------------

const navigation: CategoryTheme = {
  category: 'navigation',
  description: 'Map-friendly palettes with blue/green wayfinding colors and light bases',
  palettes: [
    {
      // Google Maps-inspired — blue + green on white
      name: 'Wayfinder',
      backgrounds: { dark: '#1D2027', light: '#FFFFFF' },
      primary: '#4285F4',
      secondary: '#34A853',
      accent: '#FBBC04',
      surface: '#282C34',
      cardBg: '#2E333D',
      textPrimary: '#FFFFFF',
      textSecondary: '#9AA0A6',
      success: '#34A853',
      error: '#EA4335',
      mood: 'reliable, informational, utilitarian',
    },
    {
      // Waze-inspired — playful cyan, community-driven
      name: 'Drive Social',
      backgrounds: { dark: '#1A1D2E', light: '#FFFFFF' },
      primary: '#00CCFF',
      secondary: '#33DDFF',
      accent: '#FFD600',
      surface: '#232740',
      cardBg: '#2A2F4A',
      textPrimary: '#F0F4FF',
      textSecondary: '#8890A8',
      success: '#4CE0A0',
      error: '#FF4466',
      mood: 'community, playful, real-time',
      gradientPair: ['#00CCFF', '#33DDFF'],
    },
  ],
}

// ---------------------------------------------------------------------------
// 17. News / Editorial
// ---------------------------------------------------------------------------
// Dominant patterns: high-contrast, editorial typography, red accents for urgency,
// clean white backgrounds with strong type hierarchy. Magazine-style layout.
// Reference apps: Apple News, Flipboard, NYT, The Athletic
// ---------------------------------------------------------------------------

const news: CategoryTheme = {
  category: 'news',
  description: 'Editorial palettes with strong type hierarchy, red accents, and clean bases',
  palettes: [
    {
      // Apple News-inspired — clean black + red accent
      name: 'Editorial',
      backgrounds: { dark: '#111111', light: '#FFFFFF' },
      primary: '#000000',
      secondary: '#FC3C44',
      accent: '#FF453A',
      surface: '#1C1C1E',
      cardBg: '#2C2C2E',
      textPrimary: '#FFFFFF',
      textSecondary: '#8E8E93',
      success: '#34C759',
      error: '#FF453A',
      mood: 'authoritative, clean, editorial',
    },
    {
      // Flipboard-inspired — bold red, magazine feel
      name: 'Magazine Red',
      backgrounds: { dark: '#1A1A1A', light: '#FFFFFF' },
      primary: '#E12828',
      secondary: '#C42020',
      accent: '#1A1A1A',
      surface: '#242424',
      cardBg: '#2E2E2E',
      textPrimary: '#FFFFFF',
      textSecondary: '#999999',
      success: '#30B566',
      error: '#E12828',
      mood: 'bold, curated, magazine-style',
    },
    {
      // The Athletic / premium news — dark sophisticated
      name: 'Premium Ink',
      backgrounds: { dark: '#0D1117', light: '#F9F9FB' },
      primary: '#C9A44C',
      secondary: '#8B7340',
      accent: '#E8D48C',
      surface: '#161B22',
      cardBg: '#1C2128',
      textPrimary: '#E6EDF3',
      textSecondary: '#768390',
      success: '#3FB950',
      error: '#F85149',
      mood: 'premium, sophisticated, subscriber-exclusive',
      gradientPair: ['#C9A44C', '#E8D48C'],
    },
  ],
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const COLOR_THEMES: CategoryTheme[] = [
  fitnessHealth,
  bankingFinance,
  foodDelivery,
  socialMedia,
  ecommerce,
  cryptoWeb3,
  travel,
  musicMedia,
  education,
  rideHailing,
  messaging,
  streaming,
  dating,
  wellness,
  productivity,
  navigation,
  news,
]

/** Quick lookup by category key */
export const THEME_BY_CATEGORY: Record<string, CategoryTheme> = Object.fromEntries(
  COLOR_THEMES.map(t => [t.category, t])
)

/** All category keys for iteration */
export const CATEGORY_KEYS = COLOR_THEMES.map(t => t.category)

/**
 * Get a random palette for a given category.
 * Useful for giving the AI variety across generations.
 */
export function getRandomPalette(category: string): ColorPalette | undefined {
  const theme = THEME_BY_CATEGORY[category]
  if (!theme) return undefined
  const idx = Math.floor(Math.random() * theme.palettes.length)
  return theme.palettes[idx]
}

/**
 * Get a specific palette by category and palette name.
 */
export function getPaletteByName(category: string, name: string): ColorPalette | undefined {
  const theme = THEME_BY_CATEGORY[category]
  if (!theme) return undefined
  return theme.palettes.find(p => p.name === name)
}

/**
 * Category keyword mapping — helps the AI match prompt keywords
 * to the right category. Keys are lowercase search terms.
 */
export const CATEGORY_KEYWORDS: Record<string, string> = {
  // Fitness / Health (Nike, Adidas, Strava, Peloton, MyFitnessPal, Fitbit)
  fitness: 'fitness',
  health: 'fitness',
  workout: 'fitness',
  gym: 'fitness',
  exercise: 'fitness',
  training: 'fitness',
  yoga: 'fitness',
  running: 'fitness',
  sports: 'fitness',
  calories: 'fitness',
  steps: 'fitness',
  'heart rate': 'fitness',
  peloton: 'fitness',
  strava: 'fitness',
  'weight loss': 'fitness',

  // Finance (Robinhood, Cash App, Revolut, Venmo, PayPal, Zelle)
  finance: 'finance',
  banking: 'finance',
  bank: 'finance',
  money: 'finance',
  investment: 'finance',
  stocks: 'finance',
  trading: 'finance',
  payments: 'finance',
  wallet: 'finance',
  fintech: 'finance',
  budget: 'finance',
  venmo: 'finance',
  paypal: 'finance',
  transfer: 'finance',
  savings: 'finance',
  portfolio: 'finance',

  // Food Delivery (Uber Eats, DoorDash, Swiggy, Zomato)
  food: 'food_delivery',
  delivery: 'food_delivery',
  restaurant: 'food_delivery',
  ordering: 'food_delivery',
  takeout: 'food_delivery',
  groceries: 'food_delivery',
  recipe: 'food_delivery',
  cooking: 'food_delivery',
  meal: 'food_delivery',
  'uber eats': 'food_delivery',
  doordash: 'food_delivery',
  cuisine: 'food_delivery',
  'meal prep': 'food_delivery',

  // Social Media (Instagram, TikTok, Twitter/X, LinkedIn, Reddit, Pinterest, Snapchat, Threads)
  social: 'social',
  community: 'social',
  feed: 'social',
  stories: 'social',
  network: 'social',
  instagram: 'social',
  tiktok: 'social',
  twitter: 'social',
  linkedin: 'social',
  reddit: 'social',
  pinterest: 'social',
  snapchat: 'social',
  threads: 'social',
  followers: 'social',
  'news feed': 'social',
  timeline: 'social',
  post: 'social',
  reels: 'social',

  // E-Commerce (Amazon, Walmart, Target, SHEIN, Nike Shop, Adidas)
  ecommerce: 'ecommerce',
  shopping: 'ecommerce',
  shop: 'ecommerce',
  store: 'ecommerce',
  marketplace: 'ecommerce',
  retail: 'ecommerce',
  fashion: 'ecommerce',
  clothing: 'ecommerce',
  products: 'ecommerce',
  cart: 'ecommerce',
  checkout: 'ecommerce',
  'add to cart': 'ecommerce',
  amazon: 'ecommerce',
  price: 'ecommerce',
  'buy now': 'ecommerce',
  sneaker: 'ecommerce',
  shoe: 'ecommerce',

  // Crypto / Web3 (Coinbase, Phantom, MetaMask)
  crypto: 'crypto',
  web3: 'crypto',
  blockchain: 'crypto',
  nft: 'crypto',
  defi: 'crypto',
  token: 'crypto',
  bitcoin: 'crypto',
  ethereum: 'crypto',
  solana: 'crypto',
  coinbase: 'crypto',
  'swap token': 'crypto',

  // Travel (Airbnb, Booking.com, Expedia, TripAdvisor)
  travel: 'travel',
  hotel: 'travel',
  flight: 'travel',
  booking: 'travel',
  vacation: 'travel',
  trip: 'travel',
  airbnb: 'travel',
  tourism: 'travel',
  resort: 'travel',
  'check in': 'travel',
  itinerary: 'travel',
  destination: 'travel',

  // Music / Media (Spotify, Apple Music)
  music: 'music',
  podcast: 'music',
  audio: 'music',
  player: 'music',
  radio: 'music',
  spotify: 'music',
  playlist: 'music',
  'now playing': 'music',
  album: 'music',
  song: 'music',

  // Education (Duolingo, Coursera, Khan Academy)
  education: 'education',
  learning: 'education',
  course: 'education',
  study: 'education',
  school: 'education',
  tutorial: 'education',
  quiz: 'education',
  duolingo: 'education',
  lesson: 'education',
  homework: 'education',
  classroom: 'education',
  exam: 'education',

  // Ride-Hailing (Uber, Lyft, Bolt, Grab)
  ride: 'ride_hailing',
  taxi: 'ride_hailing',
  uber: 'ride_hailing',
  lyft: 'ride_hailing',
  cab: 'ride_hailing',
  transport: 'ride_hailing',
  commute: 'ride_hailing',
  carpool: 'ride_hailing',
  'book a ride': 'ride_hailing',
  driver: 'ride_hailing',

  // Messaging (WhatsApp, Telegram, Signal)
  messaging: 'messaging',
  chat: 'messaging',
  'direct message': 'messaging',
  whatsapp: 'messaging',
  telegram: 'messaging',
  signal: 'messaging',
  conversation: 'messaging',
  inbox: 'messaging',
  'send message': 'messaging',
  sms: 'messaging',

  // Streaming / Video (Netflix, YouTube, Disney+, HBO Max)
  streaming: 'streaming',
  video: 'streaming',
  netflix: 'streaming',
  youtube: 'streaming',
  'disney+': 'streaming',
  hbo: 'streaming',
  'watch now': 'streaming',
  movie: 'streaming',
  'tv show': 'streaming',
  series: 'streaming',
  media: 'streaming',

  // Dating (Tinder, Bumble, Hinge)
  dating: 'dating',
  tinder: 'dating',
  bumble: 'dating',
  hinge: 'dating',
  match: 'dating',
  swipe: 'dating',
  'love interest': 'dating',
  profile: 'dating',

  // Wellness / Mindfulness (Headspace, Calm, Insight Timer)
  wellness: 'wellness',
  meditation: 'wellness',
  mindfulness: 'wellness',
  headspace: 'wellness',
  calm: 'wellness',
  'mental health': 'wellness',
  breathing: 'wellness',
  sleep: 'wellness',
  relaxation: 'wellness',
  'self care': 'wellness',
  journal: 'wellness',

  // Productivity (Notion, Todoist, Slack, Linear)
  productivity: 'productivity',
  notion: 'productivity',
  todoist: 'productivity',
  slack: 'productivity',
  task: 'productivity',
  'to do': 'productivity',
  kanban: 'productivity',
  project: 'productivity',
  notes: 'productivity',
  calendar: 'productivity',
  planner: 'productivity',
  agenda: 'productivity',
  workspace: 'productivity',

  // Navigation / Maps (Google Maps, Waze, Apple Maps)
  navigation: 'navigation',
  map: 'navigation',
  maps: 'navigation',
  directions: 'navigation',
  'google maps': 'navigation',
  waze: 'navigation',
  gps: 'navigation',
  route: 'navigation',
  'find nearby': 'navigation',
  location: 'navigation',

  // News / Editorial (Apple News, Flipboard, NYT)
  news: 'news',
  'breaking news': 'news',
  article: 'news',
  headline: 'news',
  magazine: 'news',
  editorial: 'news',
  newspaper: 'news',
  blog: 'news',
  digest: 'news',
}
