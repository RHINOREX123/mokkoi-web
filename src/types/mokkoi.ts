export interface Screen {
  id: string
  name: string
  component: string
  updatedAt: number
}

export interface DesignTokens {
  colors: Record<string, string>
  fonts: Record<string, string>
  spacing: Record<string, number>
}

export interface MokkoiMessage {
  type: 'screen_update' | 'token_update' | 'screen_list' | 'connected'
  payload: unknown
}

export interface ScreenUpdatePayload {
  screenId: string
  name: string
  component: string
}

export interface TokenUpdatePayload {
  tokens: DesignTokens
}

export interface ScreenListPayload {
  screens: Screen[]
}
