export interface DevicePreset {
  id: string
  name: string
  width: number
  height: number
  icon: string
  category: 'iOS' | 'Android'
}

export const DEVICE_PRESETS = [
  { id: 'iphone-standard', name: 'iPhone Standard', width: 393, height: 852, icon: '📱', category: 'iOS' },
  { id: 'iphone-max', name: 'iPhone Max', width: 430, height: 932, icon: '📱', category: 'iOS' },
  { id: 'iphone-se', name: 'iPhone SE', width: 375, height: 667, icon: '📱', category: 'iOS' },
  { id: 'android-standard', name: 'Android', width: 360, height: 800, icon: '🤖', category: 'Android' },
  { id: 'android-large', name: 'Android Large', width: 412, height: 917, icon: '🤖', category: 'Android' },
] as const

export type DeviceId = typeof DEVICE_PRESETS[number]['id']

export const DEFAULT_DEVICE: DeviceId = 'iphone-standard'

/** Target visual width on canvas — stays constant across all devices */
const TARGET_CANVAS_W = 261

/** Get canvas dimensions for a given device */
export function getCanvasDimensions(deviceId: string) {
  const device = DEVICE_PRESETS.find(d => d.id === deviceId) || DEVICE_PRESETS[0]
  const scale = TARGET_CANVAS_W / device.width
  return {
    CANVAS_W: TARGET_CANVAS_W,
    CANVAS_H: Math.round(device.height * scale),
    CANVAS_SCALE: scale,
    DEVICE_W: device.width,
    DEVICE_H: device.height,
  }
}

/** Get device preset by ID, falling back to default */
export function getDevicePreset(deviceId: string): typeof DEVICE_PRESETS[number] {
  return DEVICE_PRESETS.find(d => d.id === deviceId) || DEVICE_PRESETS[0]
}
