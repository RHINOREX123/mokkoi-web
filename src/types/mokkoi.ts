export type NavIntent =
  | { kind: 'push'; target: string; params?: Record<string, string> }
  | { kind: 'openSheet'; target: string; params?: Record<string, string> }
  | { kind: 'noop' }

export interface ComponentNode {
  type: string
  props?: Record<string, unknown>
  style?: Record<string, unknown>
  children?: (ComponentNode | string)[]
  navIntent?: NavIntent
}

export interface Screen {
  id: string
  name: string
  component: string
  updatedAt: number
  componentTree?: ComponentNode
  presentation?: 'screen' | 'modal'
  params?: string[]
}

export interface DesignTokens {
  colors: Record<string, string>
  fonts: Record<string, string>
  spacing: Record<string, number>
}

export interface MokkoiMessage {
  type: 'screen_update' | 'token_update' | 'screen_list' | 'connected'
    | 'screen_list_response' | 'screen_update_response' | 'token_update_response'
    | 'resource_updated'
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
