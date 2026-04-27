export interface DevicePreset {
  id: string
  name: string
  width: number
  height: number
  icon: string
  category: 'iOS' | 'Android'
}

/** Device presets ordered like Bolt: newest iPhone → older iPhone → SE →
 *  Pixel → Galaxy → iPad. The category drives PhoneFrame chrome (Android
 *  vs iOS notch). iPad uses iOS chrome — visually a phone-with-notch at
 *  tablet dimensions; close enough until we add a dedicated tablet chrome. */
export const DEVICE_PRESETS = [
  // iPhone 17 series
  { id: 'iphone-17',           name: 'iPhone 17',           width: 402, height: 874,  icon: '📱', category: 'iOS' },
  { id: 'iphone-17-air',       name: 'iPhone 17 Air',       width: 420, height: 912,  icon: '📱', category: 'iOS' },
  { id: 'iphone-17-pro',       name: 'iPhone 17 Pro',       width: 402, height: 873,  icon: '📱', category: 'iOS' },
  { id: 'iphone-17-pro-max',   name: 'iPhone 17 Pro Max',   width: 440, height: 956,  icon: '📱', category: 'iOS' },
  // iPhone 16 series
  { id: 'iphone-16',           name: 'iPhone 16',           width: 393, height: 852,  icon: '📱', category: 'iOS' },
  { id: 'iphone-16e',          name: 'iPhone 16e',          width: 390, height: 844,  icon: '📱', category: 'iOS' },
  { id: 'iphone-16-plus',      name: 'iPhone 16 Plus',      width: 430, height: 932,  icon: '📱', category: 'iOS' },
  { id: 'iphone-16-pro',       name: 'iPhone 16 Pro',       width: 402, height: 874,  icon: '📱', category: 'iOS' },
  { id: 'iphone-16-pro-max',   name: 'iPhone 16 Pro Max',   width: 440, height: 956,  icon: '📱', category: 'iOS' },
  // SE
  { id: 'iphone-se',           name: 'iPhone SE',           width: 375, height: 667,  icon: '📱', category: 'iOS' },
  // Pixel
  { id: 'pixel-10',            name: 'Pixel 10',            width: 412, height: 915,  icon: '🤖', category: 'Android' },
  { id: 'pixel-10-pro',        name: 'Pixel 10 Pro',        width: 427, height: 952,  icon: '🤖', category: 'Android' },
  // Galaxy
  { id: 'galaxy-25',           name: 'Galaxy 25',           width: 360, height: 780,  icon: '🤖', category: 'Android' },
  { id: 'galaxy-25-plus',      name: 'Galaxy 25+',          width: 480, height: 1040, icon: '🤖', category: 'Android' },
  // iPad
  { id: 'ipad',                name: 'iPad',                width: 820, height: 1180, icon: '📱', category: 'iOS' },
  { id: 'ipad-mini',           name: 'iPad Mini',           width: 744, height: 1133, icon: '📱', category: 'iOS' },
] as const

export type DeviceId = typeof DEVICE_PRESETS[number]['id']

/** Default device for new projects. iPhone 16 (393×852) keeps the same
 *  layout space as the previous default ("iphone-standard"), so existing
 *  designs render identically after the preset list expansion. */
export const DEFAULT_DEVICE: DeviceId = 'iphone-16'

/** Map old device IDs → closest new IDs. Existing projects in the DB store
 *  raw strings (e.g. "iphone-standard"); we resolve them on read so old
 *  projects keep rendering at the same/very-close dimensions:
 *
 *    iphone-standard (393×852) → iphone-16          (393×852)  exact
 *    iphone-max      (430×932) → iphone-16-plus     (430×932)  exact
 *    iphone-se       (375×667) → iphone-se          (375×667)  unchanged id
 *    android-standard (360×800) → galaxy-25         (360×780)  ~20px shorter
 *    android-large    (412×917) → pixel-10          (412×915)  ~2px shorter
 *
 *  Writes always use the canonical new IDs (typed via DeviceId), so new
 *  projects never produce legacy IDs. */
const LEGACY_DEVICE_ID_MAP: Record<string, string> = {
  'iphone-standard':  'iphone-16',
  'iphone-max':       'iphone-16-plus',
  'android-standard': 'galaxy-25',
  'android-large':    'pixel-10',
}

/** Resolve a (possibly legacy) device ID to its current canonical ID. */
function resolveDeviceId(deviceId: string): string {
  return LEGACY_DEVICE_ID_MAP[deviceId] ?? deviceId
}

/** Target visual width on canvas — stays constant across all devices */
const TARGET_CANVAS_W = 261

/** Get canvas dimensions for a given device */
export function getCanvasDimensions(deviceId: string) {
  const resolvedId = resolveDeviceId(deviceId)
  const device = DEVICE_PRESETS.find(d => d.id === resolvedId) || DEVICE_PRESETS[0]
  const scale = TARGET_CANVAS_W / device.width
  return {
    CANVAS_W: TARGET_CANVAS_W,
    CANVAS_H: Math.round(device.height * scale),
    CANVAS_SCALE: scale,
    DEVICE_W: device.width,
    DEVICE_H: device.height,
  }
}

/** Get device preset by ID, falling back to default. Resolves legacy IDs. */
export function getDevicePreset(deviceId: string): typeof DEVICE_PRESETS[number] {
  const resolvedId = resolveDeviceId(deviceId)
  return DEVICE_PRESETS.find(d => d.id === resolvedId) || DEVICE_PRESETS[0]
}
