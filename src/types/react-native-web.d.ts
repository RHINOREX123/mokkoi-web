declare module 'react-native-web' {
  import type { ComponentType } from 'react'

  interface ViewStyle {
    [key: string]: unknown
  }

  interface TextStyle {
    [key: string]: unknown
  }

  interface ImageStyle {
    [key: string]: unknown
  }

  export const View: ComponentType<{ style?: ViewStyle; children?: React.ReactNode; [key: string]: unknown }>
  export const Text: ComponentType<{ style?: TextStyle; children?: React.ReactNode; [key: string]: unknown }>
  export const TextInput: ComponentType<{
    style?: TextStyle
    placeholder?: string
    placeholderTextColor?: string
    secureTextEntry?: boolean
    keyboardType?: string
    autoCapitalize?: string
    value?: string
    onChangeText?: (text: string) => void
    [key: string]: unknown
  }>
  export const TouchableOpacity: ComponentType<{
    style?: ViewStyle
    onPress?: () => void
    activeOpacity?: number
    children?: React.ReactNode
    [key: string]: unknown
  }>
  export const ScrollView: ComponentType<{
    style?: ViewStyle
    contentContainerStyle?: ViewStyle
    children?: React.ReactNode
    [key: string]: unknown
  }>
  export const Image: ComponentType<{
    style?: ImageStyle
    source?: { uri: string } | number
    resizeMode?: string
    [key: string]: unknown
  }>
  export const SafeAreaView: ComponentType<{ style?: ViewStyle; children?: React.ReactNode; [key: string]: unknown }>

  export type { ViewStyle, TextStyle, ImageStyle }
}
