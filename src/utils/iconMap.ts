// Shared icon-name mappings for Mokkoi.
//
// The AI may output icon names in either naming convention:
//   - Lucide kebab-case:    heart, shopping-cart, chevron-right, arrow-left
//   - Material Symbols:     favorite, shopping_cart, chevron_right, arrow_back
//
// Canvas preview (ScreenRenderer) renders via Material Symbols font →
// needs Lucide→Material translation.
//
// Snack export (exportTsx) renders via lucide-react-native components →
// needs Material→Lucide translation, then kebab-case → PascalCase.

/** Lucide kebab-case → Google Material Symbols snake_case */
export const LUCIDE_TO_MATERIAL: Record<string, string> = {
  heart: 'favorite',
  home: 'home',
  search: 'search',
  settings: 'settings',
  bell: 'notifications',
  user: 'person',
  mail: 'mail',
  star: 'star',
  check: 'check',
  x: 'close',
  plus: 'add',
  minus: 'remove',
  'chevron-right': 'chevron_right',
  'chevron-left': 'chevron_left',
  'chevron-down': 'expand_more',
  'chevron-up': 'expand_less',
  'arrow-left': 'arrow_back',
  'arrow-right': 'arrow_forward',
  'arrow-up': 'arrow_upward',
  'arrow-down': 'arrow_downward',
  menu: 'menu',
  clock: 'schedule',
  calendar: 'calendar_today',
  camera: 'photo_camera',
  phone: 'phone',
  'map-pin': 'location_on',
  eye: 'visibility',
  lock: 'lock',
  unlock: 'lock_open',
  share: 'share',
  download: 'download',
  upload: 'upload',
  trash: 'delete',
  edit: 'edit',
  copy: 'content_copy',
  play: 'play_arrow',
  pause: 'pause',
  'skip-forward': 'skip_next',
  'skip-back': 'skip_previous',
  'volume-2': 'volume_up',
  wifi: 'wifi',
  battery: 'battery_full',
  send: 'send',
  image: 'image',
  'shopping-cart': 'shopping_cart',
  filter: 'filter_list',
  bookmark: 'bookmark',
  globe: 'language',
  'trending-up': 'trending_up',
  'trending-down': 'trending_down',
  zap: 'bolt',
  activity: 'monitoring',
  music: 'music_note',
  video: 'videocam',
  mic: 'mic',
  sun: 'light_mode',
  moon: 'dark_mode',
  cloud: 'cloud',
  droplet: 'water_drop',
  wind: 'air',
  thermometer: 'thermostat',
  navigation: 'navigation',
  refresh: 'refresh',
  info: 'info',
  help: 'help',
  alert: 'warning',
  shield: 'shield',
  'credit-card': 'credit_card',
  wallet: 'wallet',
  receipt: 'receipt',
  'bar-chart': 'bar_chart',
  'pie-chart': 'pie_chart',
  layers: 'layers',
  grid: 'grid_view',
  list: 'list',
  folder: 'folder',
  file: 'description',
  link: 'link',
  'qr-code': 'qr_code',
  fingerprint: 'fingerprint',
  flash: 'flash_on',
  gift: 'redeem',
  tag: 'label',
  flag: 'flag',
  pin: 'push_pin',
  compass: 'explore',
  target: 'track_changes',
  award: 'emoji_events',
  trophy: 'emoji_events',
  fire: 'local_fire_department',
  restaurant: 'restaurant',
  coffee: 'coffee',
  cart: 'shopping_cart',
  bag: 'shopping_bag',
  truck: 'local_shipping',
  airplane: 'flight',
  hotel: 'hotel',
  car: 'directions_car',
  bike: 'directions_bike',
  walk: 'directions_walk',
  run: 'directions_run',
  fitness: 'fitness_center',
  spa: 'spa',
  medical: 'medical_services',
  pill: 'medication',
  school: 'school',
  book: 'menu_book',
  graduation: 'school',
  work: 'work',
  briefcase: 'work',
  building: 'apartment',
  house: 'house',
  key: 'key',
  scan: 'qr_code_scanner',
  chat: 'chat',
  message: 'message',
  group: 'group',
  'add-user': 'person_add',
  'thumb-up': 'thumb_up',
  'thumb-down': 'thumb_down',
  'more-horizontal': 'more_horiz',
  'more-vertical': 'more_vert',
  'external-link': 'open_in_new',
  'log-out': 'logout',
  'log-in': 'login',
  power: 'power_settings_new',
  palette: 'palette',
  brush: 'brush',
  crop: 'crop',
  tune: 'tune',
  equalizer: 'equalizer',
  headphones: 'headphones',
  speaker: 'speaker',
  radio: 'radio',
  podcast: 'podcasts',
  gamepad: 'sports_esports',
  savings: 'savings',
  analytics: 'analytics',
  dashboard: 'dashboard',
  timeline: 'timeline',
  timer: 'timer',
  stopwatch: 'timer',
  alarm: 'alarm',
  code: 'code',
  terminal: 'terminal',
  database: 'storage',
  server: 'dns',
  percent: 'percent',
  attach: 'attach_file',
  paperclip: 'attach_file',
  // Extra Lucide names the AI commonly generates
  utensils: 'restaurant',
  droplets: 'water_drop',
  flame: 'local_fire_department',
  dumbbell: 'fitness_center',
  footprints: 'directions_walk',
  'glass-water': 'local_drink',
  'cloud-rain': 'rainy',
  'cloud-sun': 'partly_cloudy_day',
  snowflake: 'ac_unit',
  mountain: 'terrain',
  leaf: 'eco',
  sprout: 'yard',
  'circle-check': 'check_circle',
  'circle-x': 'cancel',
  'circle-alert': 'error',
  'circle-help': 'help',
  'circle-user': 'account_circle',
  'circle-plus': 'add_circle',
  'layout-dashboard': 'dashboard',
  'bar-chart-2': 'bar_chart',
  'trash-2': 'delete',
  'user-plus': 'person_add',
  users: 'group',
  'message-circle': 'chat_bubble',
  'message-square': 'chat',
  'thumbs-up': 'thumb_up',
  'thumbs-down': 'thumb_down',
  'building-2': 'apartment',
  plane: 'flight',
  'graduation-cap': 'school',
  'piggy-bank': 'savings',
  banknote: 'payments',
  coins: 'toll',
  package: 'inventory_2',
  box: 'inventory_2',
  map: 'map',
  'navigation-2': 'navigation',
  locate: 'my_location',
  crosshair: 'gps_fixed',
  baby: 'child_care',
  smile: 'sentiment_satisfied',
  frown: 'sentiment_dissatisfied',
  repeat: 'repeat',
  shuffle: 'shuffle',
  volume: 'volume_up',
  'volume-1': 'volume_down',
  'volume-x': 'volume_off',
  maximize: 'fullscreen',
  minimize: 'fullscreen_exit',
  external: 'open_in_new',
  'flower-2': 'spa',
  'heart-pulse': 'monitor_heart',
  stethoscope: 'stethoscope',
  syringe: 'vaccines',
  apple: 'nutrition',
  salad: 'restaurant',
  pizza: 'local_pizza',
  soup: 'soup_kitchen',
  beer: 'sports_bar',
  wine: 'wine_bar',
  candy: 'cake',
  cookie: 'cookie',
  shirt: 'checkroom',
  watch: 'watch',
  glasses: 'visibility',
  lamp: 'light',
  bed: 'bed',
  bath: 'bathtub',
  shower: 'shower',
  'wifi-off': 'wifi_off',
  bluetooth: 'bluetooth',
  'battery-charging': 'battery_charging_full',
  'battery-low': 'battery_alert',
  signal: 'signal_cellular_alt',
  rocket: 'rocket_launch',
  sparkles: 'auto_awesome',
  wand: 'auto_fix_high',
  brain: 'psychology',
  lightbulb: 'lightbulb',
  gem: 'diamond',
  crown: 'workspace_premium',
}

/** Material Symbols snake_case → Lucide kebab-case (auto-generated) */
export const MATERIAL_TO_LUCIDE: Record<string, string> = Object.fromEntries(
  Object.entries(LUCIDE_TO_MATERIAL).map(([lucide, material]) => [material, lucide])
)

// Canonical Material→Lucide overrides (where the auto-reverse picked a weird name)
Object.assign(MATERIAL_TO_LUCIDE, {
  local_fire_department: 'flame',
  directions_run: 'activity',
  directions_walk: 'activity',
  directions_bike: 'bike',
  directions_car: 'car',
  monitoring: 'activity',
  fitness_center: 'dumbbell',
  water_drop: 'droplets',
  bolt: 'zap',
  notifications: 'bell',
  person: 'user',
  favorite: 'heart',
  play_arrow: 'play',
  skip_next: 'skip-forward',
  skip_previous: 'skip-back',
  volume_up: 'volume-2',
  shopping_cart: 'shopping-cart',
  trending_up: 'trending-up',
  trending_down: 'trending-down',
  arrow_back: 'arrow-left',
  arrow_forward: 'arrow-right',
  arrow_upward: 'arrow-up',
  arrow_downward: 'arrow-down',
  chevron_right: 'chevron-right',
  chevron_left: 'chevron-left',
  expand_more: 'chevron-down',
  expand_less: 'chevron-up',
  schedule: 'clock',
  calendar_today: 'calendar',
  photo_camera: 'camera',
  location_on: 'map-pin',
  visibility: 'eye',
  lock_open: 'unlock',
  content_copy: 'copy',
  delete: 'trash-2',
  filter_list: 'filter',
  language: 'globe',
  more_horiz: 'more-horizontal',
  more_vert: 'more-vertical',
  open_in_new: 'external-link',
  credit_card: 'credit-card',
  attach_file: 'paperclip',
  music_note: 'music',
  light_mode: 'sun',
  dark_mode: 'moon',
  local_shipping: 'truck',
  bar_chart: 'bar-chart-2',
  pie_chart: 'pie-chart',
  emoji_events: 'trophy',
  menu_book: 'book',
  medical_services: 'pill',
  sports_esports: 'gamepad',
  spa: 'flower-2',
  apartment: 'building-2',
  qr_code: 'qr-code',
  qr_code_scanner: 'scan',
  power_settings_new: 'power',
  message: 'message-circle',
  thumb_up: 'thumbs-up',
  thumb_down: 'thumbs-down',
  person_add: 'user-plus',
  shopping_bag: 'shopping-bag',
  account_circle: 'circle-user',
  check_circle: 'circle-check',
  chat_bubble: 'message-circle',
})

/**
 * Normalize any icon name (Lucide or Material) to a canonical
 * Material Symbols identifier suitable for the Material Symbols font.
 * Falls back to the input (with hyphens converted to underscores).
 */
export function toMaterialSymbol(raw: string): string {
  const normalized = raw.toLowerCase().trim()
  return LUCIDE_TO_MATERIAL[normalized] ?? normalized.replace(/-/g, '_')
}

/**
 * Normalize any icon name (Lucide or Material) to a lucide-react-native
 * component name (PascalCase).
 *
 * Examples:
 *   'heart'         → 'Heart'
 *   'shopping-cart' → 'ShoppingCart'
 *   'favorite'      → 'Heart'     (via Material→Lucide reverse)
 *   'shopping_cart' → 'ShoppingCart'
 *   'unknown'       → 'Circle'    (safe fallback — never silently drop)
 */
export function toLucidePascal(raw: string): string {
  const normalized = raw.toLowerCase().trim()

  // Start as Lucide kebab-case. If input was Material snake_case, reverse-map.
  let lucide: string
  if (LUCIDE_TO_MATERIAL[normalized]) {
    // Already a known Lucide name
    lucide = normalized
  } else if (MATERIAL_TO_LUCIDE[normalized]) {
    // A Material name we know how to reverse
    lucide = MATERIAL_TO_LUCIDE[normalized]
  } else {
    // Unknown — try both kebab and snake forms as-is, or fall back
    lucide = normalized.includes('_') ? normalized.replace(/_/g, '-') : normalized
  }

  // kebab-case → PascalCase. Empty segments are dropped.
  const pascal = lucide
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')

  // lucide-react-native ships ~1500 icons but unknown names would fail to import.
  // Clamp to a known-safe set of common icons. Anything else → Circle fallback.
  return KNOWN_LUCIDE_ICONS.has(pascal) ? pascal : 'Circle'
}

/**
 * Whitelist of lucide-react-native component names we emit.
 * Generated by converting every value of MATERIAL_TO_LUCIDE (plus every key
 * of LUCIDE_TO_MATERIAL) to PascalCase. Anything outside this set falls back
 * to `Circle` so the generated code always compiles.
 */
export const KNOWN_LUCIDE_ICONS: Set<string> = (() => {
  const toPascal = (kebab: string) =>
    kebab
      .split('-')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('')
  const set = new Set<string>()
  for (const k of Object.keys(LUCIDE_TO_MATERIAL)) set.add(toPascal(k))
  for (const v of Object.values(MATERIAL_TO_LUCIDE)) set.add(toPascal(v))
  // Guarantee the fallback is present
  set.add('Circle')
  return set
})()
