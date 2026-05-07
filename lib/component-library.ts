/**
 * Component Library — Macro component expansion for Mokkoi screen generation.
 *
 * The AI generates high-level components like {"type":"BottomNav","props":{...}}
 * and this module expands them into full ComponentNode subtrees before the
 * normalizer runs. This guarantees consistent, production-quality patterns
 * without relying on the AI to generate 30-50 raw nodes correctly each time.
 *
 * Pipeline: AI JSON → repairJSON() → expandComponents() → normalizeComponentTree()
 */

// --- Design tokens (must match design-system.ts) ---
const SURFACE_1 = '#12121F'
const SURFACE_2 = '#1A1A2E'
const TEXT_PRIMARY = '#FFFFFF'
const TEXT_SECONDARY = '#A0A0B8'
const TEXT_TERTIARY = '#6B6B80'
const ACCENT = '#6C5CE7'
const BORDER = '#2A2A3E'

// --- Component expansion functions ---

interface NavItem {
  icon: string
  label: string
  active?: boolean
}

function expandBottomNav(props: { items?: NavItem[] }): any {
  const items = props.items || [
    { icon: 'home', label: 'Home', active: true },
    { icon: 'search', label: 'Search' },
    { icon: 'favorite', label: 'Favorites' },
    { icon: 'person', label: 'Profile' },
  ]

  return {
    type: 'View',
    style: {
      flexDirection: 'row',
      paddingTop: 8,
      paddingBottom: 34,
      paddingHorizontal: 20,
      justifyContent: 'space-around',
      alignItems: 'center',
      borderTopWidth: 1,
      borderColor: BORDER,
      backgroundColor: SURFACE_1,
    },
    children: items.map((item: NavItem) => ({
      type: 'TouchableOpacity',
      style: { alignItems: 'center', minWidth: 44, minHeight: 44, justifyContent: 'center' },
      children: [
        { type: 'Icon', props: { name: item.icon, size: 20, color: item.active ? ACCENT : TEXT_TERTIARY } },
        { type: 'Text', style: { fontSize: 11, color: item.active ? ACCENT : TEXT_TERTIARY, marginTop: 4 }, children: [item.label] },
      ],
    })),
  }
}

function expandHeaderBar(props: { title?: string; showBack?: boolean; rightIcons?: string[] }): any {
  const children: any[] = []

  // Back button
  if (props.showBack !== false) {
    children.push({
      type: 'TouchableOpacity',
      style: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
      children: [{ type: 'Icon', props: { name: 'arrow-left', size: 20, color: TEXT_PRIMARY } }],
    })
  }

  // Title
  children.push({
    type: 'Text',
    style: {
      fontSize: 18,
      fontWeight: '700',
      color: TEXT_PRIMARY,
      flex: 1,
      ...(props.showBack !== false ? { marginLeft: 4 } : { marginLeft: 16 }),
    },
    children: [props.title || 'Screen'],
  })

  // Right icons
  if (props.rightIcons && props.rightIcons.length > 0) {
    for (const icon of props.rightIcons) {
      children.push({
        type: 'TouchableOpacity',
        style: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
        children: [{ type: 'Icon', props: { name: icon, size: 20, color: TEXT_PRIMARY } }],
      })
    }
  }

  return {
    type: 'View',
    style: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 44,
      paddingHorizontal: props.showBack !== false ? 4 : 0,
    },
    children,
  }
}

function expandStatCard(props: { icon?: string; iconColor?: string; value?: string; label?: string }): any {
  return {
    type: 'View',
    style: {
      flex: 1,
      backgroundColor: SURFACE_1,
      borderRadius: 12,
      padding: 12,
      height: 80,
      justifyContent: 'center',
      alignItems: 'center',
    },
    children: [
      { type: 'Icon', props: { name: props.icon || 'activity', size: 17, color: props.iconColor || ACCENT } },
      { type: 'Text', style: { fontSize: 20, fontWeight: '700', color: TEXT_PRIMARY, marginTop: 4 }, children: [props.value || '0'] },
      { type: 'Text', style: { fontSize: 11, color: TEXT_TERTIARY, marginTop: 2 }, children: [props.label || 'stat'] },
    ],
  }
}

function expandAvatarCircle(props: { name?: string; size?: number }): any {
  const size = props.size || 40
  return {
    type: 'Image',
    style: { width: size, height: size, borderRadius: 9999 },
    props: { avatar: props.name || 'User' },
  }
}

function expandMessageBubble(props: { text?: string; sent?: boolean; time?: string }): any {
  const isSent = !!props.sent
  const bubbleChildren: any[] = [
    {
      type: 'Text',
      style: { fontSize: 14, color: isSent ? TEXT_PRIMARY : '#F1F5F9', lineHeight: 20 },
      children: [props.text || ''],
    },
  ]

  // Inline timestamp inside bubble
  if (props.time) {
    bubbleChildren.push({
      type: 'Text',
      style: {
        fontSize: 11,
        color: isSent ? 'rgba(255,255,255,0.6)' : TEXT_TERTIARY,
        marginTop: 4,
        alignSelf: isSent ? 'flex-end' : 'flex-start',
      },
      children: [props.time],
    })
  }

  return {
    type: 'View',
    style: {
      marginBottom: 8,
      flexDirection: 'row',
      justifyContent: isSent ? 'flex-end' : 'flex-start',
      alignItems: 'flex-start', // Prevent bubble from stretching to parent height
      flexShrink: 0, // Don't collapse in ScrollView
    },
    children: [
      {
        type: 'View',
        style: {
          maxWidth: '75%',
          backgroundColor: isSent ? ACCENT : SURFACE_2,
          borderRadius: 16,
          paddingHorizontal: 12,
          paddingVertical: 8,
          alignSelf: 'flex-start', // Size to content, don't stretch
          flexShrink: 0, // Don't collapse
        },
        children: bubbleChildren,
      },
    ],
  }
}

// =============================================
// NAVIGATION & LAYOUT
// =============================================

function expandTabBar(props: { tabs?: Array<{ label: string; active?: boolean }> }): any {
  const tabs = props.tabs || [{ label: 'Tab 1', active: true }, { label: 'Tab 2' }, { label: 'Tab 3' }]
  return {
    type: 'View',
    style: { flexDirection: 'row', borderBottomWidth: 1, borderColor: BORDER },
    children: tabs.map(tab => ({
      type: 'TouchableOpacity',
      style: {
        flex: 1, alignItems: 'center', paddingVertical: 12,
        borderBottomWidth: tab.active ? 2 : 0,
        borderColor: tab.active ? TEXT_PRIMARY : 'transparent',
      },
      children: [{ type: 'Text', style: { fontSize: 14, fontWeight: tab.active ? '600' : '400', color: tab.active ? TEXT_PRIMARY : TEXT_TERTIARY }, children: [tab.label] }],
    })),
  }
}

function expandSectionHeader(props: { title?: string; actionText?: string }): any {
  const children: any[] = [
    { type: 'Text', style: { fontSize: 16, fontWeight: '600', color: TEXT_PRIMARY }, children: [props.title || 'Section'] },
  ]
  if (props.actionText) {
    children.push({ type: 'TouchableOpacity', children: [{ type: 'Text', style: { fontSize: 13, color: ACCENT }, children: [props.actionText] }] })
  }
  return {
    type: 'View',
    style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    children,
  }
}

function expandDivider(_props: { color?: string }): any {
  return { type: 'View', style: { height: 1, backgroundColor: _props.color || BORDER, marginVertical: 16 } }
}

function expandSearchBar(props: { placeholder?: string }): any {
  return {
    type: 'View',
    style: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE_2, borderRadius: 12, paddingHorizontal: 12, height: 44 },
    children: [
      { type: 'Icon', props: { name: 'search', size: 18, color: TEXT_TERTIARY } },
      { type: 'TextInput', style: { flex: 1, fontSize: 14, color: TEXT_PRIMARY, marginLeft: 8 }, props: { placeholder: props.placeholder || 'Search...', placeholderTextColor: TEXT_TERTIARY } },
    ],
  }
}

// =============================================
// DATA DISPLAY
// =============================================

function expandListRow(props: { icon?: string; iconColor?: string; title?: string; subtitle?: string; trailing?: string; showChevron?: boolean }): any {
  const children: any[] = []
  if (props.icon) {
    children.push({ type: 'Icon', props: { name: props.icon, size: 20, color: props.iconColor || TEXT_SECONDARY }, style: { marginRight: 12 } })
  }
  children.push({
    type: 'View', style: { flex: 1 }, children: [
      { type: 'Text', style: { fontSize: 16, color: TEXT_PRIMARY }, children: [props.title || 'Item'] },
      ...(props.subtitle ? [{ type: 'Text', style: { fontSize: 13, color: TEXT_TERTIARY, marginTop: 2 }, children: [props.subtitle] }] : []),
    ],
  })
  if (props.trailing) {
    children.push({ type: 'Text', style: { fontSize: 14, color: TEXT_TERTIARY, marginRight: 4 }, children: [props.trailing] })
  }
  if (props.showChevron !== false) {
    children.push({ type: 'Icon', props: { name: 'chevron-right', size: 18, color: TEXT_TERTIARY } })
  }
  return {
    type: 'TouchableOpacity',
    style: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 52, backgroundColor: SURFACE_1, borderRadius: 12 },
    children,
  }
}

function expandProductCard(props: { image?: string; title?: string; price?: string; rating?: string; badge?: string }): any {
  const children: any[] = [
    { type: 'Image', style: { width: '100%', height: 120, borderRadius: 12 }, props: { searchQuery: props.image || 'product photo studio lighting' } },
    { type: 'Text', style: { fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY, marginTop: 8 }, children: [props.title || 'Product'] },
  ]
  if (props.rating) {
    children.push({
      type: 'View', style: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }, children: [
        { type: 'Icon', props: { name: 'star', size: 14, color: '#FBBF24' } },
        { type: 'Text', style: { fontSize: 12, color: TEXT_SECONDARY }, children: [props.rating] },
      ],
    })
  }
  if (props.price) {
    children.push({ type: 'Text', style: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, marginTop: 4 }, children: [props.price] })
  }
  if (props.badge) {
    children.push({
      type: 'View', style: { position: 'absolute', top: 8, left: 8, backgroundColor: '#EF4444', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
      children: [{ type: 'Text', style: { fontSize: 11, fontWeight: '600', color: TEXT_PRIMARY }, children: [props.badge] }],
    })
  }
  return { type: 'View', style: { flex: 1 }, children }
}

function expandTransactionRow(props: { icon?: string; iconColor?: string; iconBg?: string; merchant?: string; date?: string; amount?: string; positive?: boolean }): any {
  return {
    type: 'View',
    style: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    children: [
      { type: 'View', style: { width: 40, height: 40, borderRadius: 12, backgroundColor: props.iconBg || SURFACE_2, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, children: [
        { type: 'Icon', props: { name: props.icon || 'receipt', size: 18, color: props.iconColor || TEXT_SECONDARY } },
      ]},
      { type: 'View', style: { flex: 1 }, children: [
        { type: 'Text', style: { fontSize: 14, fontWeight: '500', color: TEXT_PRIMARY }, children: [props.merchant || 'Transaction'] },
        { type: 'Text', style: { fontSize: 12, color: TEXT_TERTIARY, marginTop: 2 }, children: [props.date || 'Today'] },
      ]},
      { type: 'Text', style: { fontSize: 15, fontWeight: '600', color: props.positive ? '#22C55E' : TEXT_PRIMARY }, children: [props.amount || '$0.00'] },
    ],
  }
}

function expandFeatureCard(props: { icon?: string; iconColor?: string; title?: string; subtitle?: string }): any {
  return {
    type: 'View',
    style: { backgroundColor: SURFACE_1, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
    children: [
      { type: 'View', style: { width: 36, height: 36, borderRadius: 10, backgroundColor: SURFACE_2, alignItems: 'center', justifyContent: 'center' }, children: [
        { type: 'Icon', props: { name: props.icon || 'check_circle', size: 18, color: props.iconColor || ACCENT } },
      ]},
      { type: 'View', style: { flex: 1 }, children: [
        { type: 'Text', style: { fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY }, children: [props.title || 'Feature'] },
        ...(props.subtitle ? [{ type: 'Text', style: { fontSize: 12, color: TEXT_TERTIARY, marginTop: 2 }, children: [props.subtitle] }] : []),
      ]},
    ],
  }
}

function expandPriceBreakdown(props: { items?: Array<{ label: string; value: string; bold?: boolean }> }): any {
  const items = props.items || [
    { label: 'Subtotal', value: '$24.99' },
    { label: 'Shipping', value: '$4.99' },
    { label: 'Tax', value: '$2.40' },
    { label: 'Total', value: '$32.38', bold: true },
  ]
  return {
    type: 'View',
    style: { backgroundColor: SURFACE_1, borderRadius: 12, padding: 16, gap: 8 },
    children: items.map(item => ({
      type: 'View', style: { flexDirection: 'row', justifyContent: 'space-between', ...(item.bold ? { borderTopWidth: 1, borderColor: BORDER, paddingTop: 8, marginTop: 4 } : {}) },
      children: [
        { type: 'Text', style: { fontSize: item.bold ? 16 : 14, fontWeight: item.bold ? '700' : '400', color: item.bold ? TEXT_PRIMARY : TEXT_SECONDARY }, children: [item.label] },
        { type: 'Text', style: { fontSize: item.bold ? 16 : 14, fontWeight: item.bold ? '700' : '400', color: TEXT_PRIMARY }, children: [item.value] },
      ],
    })),
  }
}

function expandRatingStars(props: { rating?: number; count?: string }): any {
  const rating = props.rating ?? 4.5
  const fullStars = Math.floor(rating)
  const children: any[] = []
  for (let i = 0; i < 5; i++) {
    children.push({ type: 'Icon', props: { name: i < fullStars ? 'star' : 'star_border', size: 16, color: '#FBBF24' } })
  }
  if (props.count) {
    children.push({ type: 'Text', style: { fontSize: 12, color: TEXT_TERTIARY, marginLeft: 4 }, children: [props.count] })
  }
  return { type: 'View', style: { flexDirection: 'row', alignItems: 'center', gap: 2 }, children }
}

function expandStatusBadge(props: { text?: string; color?: string; bgColor?: string }): any {
  const color = props.color || '#22C55E'
  return {
    type: 'View',
    style: { backgroundColor: props.bgColor || `${color}20`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
    children: [{ type: 'Text', style: { fontSize: 11, fontWeight: '600', color }, children: [props.text || 'Active'] }],
  }
}

// =============================================
// USER IDENTITY
// =============================================

function expandProfileStats(props: { stats?: Array<{ value: string; label: string }> }): any {
  const stats = props.stats || [
    { value: '284', label: 'Posts' },
    { value: '12.5K', label: 'Followers' },
    { value: '891', label: 'Following' },
  ]
  return {
    type: 'View',
    style: { flexDirection: 'row', justifyContent: 'space-around' },
    children: stats.map(stat => ({
      type: 'View', style: { alignItems: 'center' }, children: [
        { type: 'Text', style: { fontSize: 17, fontWeight: '700', color: TEXT_PRIMARY }, children: [stat.value] },
        { type: 'Text', style: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 }, children: [stat.label] },
      ],
    })),
  }
}

// =============================================
// FORM & INPUT
// =============================================

function expandFormInput(props: { label?: string; placeholder?: string; secureTextEntry?: boolean; error?: string; icon?: string; id?: string; action?: string }): any {
  const children: any[] = []
  if (props.label) {
    children.push({ type: 'Text', style: { fontSize: 13, fontWeight: '500', color: TEXT_SECONDARY, marginBottom: 6 }, children: [props.label] })
  }
  const inputChildren: any[] = []
  if (props.icon) {
    inputChildren.push({ type: 'Icon', props: { name: props.icon, size: 18, color: TEXT_TERTIARY }, style: { marginRight: 8 } })
  }
  // Thread through `id` (e.g. "email", "password") and `action` props so the
  // exporter can wire useState bindings to TextInputs by id. Track B BYO-Backend.
  inputChildren.push({
    type: 'TextInput',
    style: { flex: 1, fontSize: 16, color: TEXT_PRIMARY },
    props: {
      placeholder: props.placeholder || '',
      placeholderTextColor: TEXT_TERTIARY,
      ...(props.secureTextEntry ? { secureTextEntry: true } : {}),
      ...(props.id ? { id: props.id } : {}),
      ...(props.action ? { action: props.action } : {}),
    },
  })
  children.push({
    type: 'View',
    style: { flexDirection: 'row', alignItems: 'center', height: 48, backgroundColor: SURFACE_2, borderRadius: 12, paddingHorizontal: 16, ...(props.error ? { borderWidth: 1, borderColor: '#E17055' } : {}) },
    children: inputChildren,
  })
  if (props.error) {
    children.push({ type: 'Text', style: { fontSize: 12, color: '#E17055', marginTop: 4 }, children: [props.error] })
  }
  return { type: 'View', style: { marginBottom: 12 }, children }
}

function expandButton(props: { text?: string; variant?: 'primary' | 'secondary' | 'outline'; size?: 'sm' | 'md' | 'lg'; icon?: string; color?: string; id?: string; action?: string }): any {
  const variant = props.variant || 'primary'
  const size = props.size || 'md'
  const color = props.color || ACCENT
  const heights = { sm: 36, md: 48, lg: 56 }
  const fontSizes = { sm: 13, md: 15, lg: 17 }
  const styles: any = {
    primary: { backgroundColor: color, borderRadius: 24 },
    secondary: { backgroundColor: SURFACE_2, borderRadius: 12 },
    outline: { borderWidth: 1.5, borderColor: color, borderRadius: 12, backgroundColor: 'transparent' },
  }
  const textColors: any = { primary: TEXT_PRIMARY, secondary: TEXT_PRIMARY, outline: color }
  const children: any[] = []
  if (props.icon) children.push({ type: 'Icon', props: { name: props.icon, size: fontSizes[size], color: textColors[variant] }, style: { marginRight: 8 } })
  children.push({ type: 'Text', style: { fontSize: fontSizes[size], fontWeight: '600', color: textColors[variant] }, children: [props.text || 'Button'] })
  // Thread through `id` and `action` so the exporter can wire onPress handlers
  // (auth.signInWithPassword, etc.) to the right button. Track B BYO-Backend.
  const buttonProps: Record<string, unknown> = {}
  if (props.id) buttonProps.id = props.id
  if (props.action) buttonProps.action = props.action
  return {
    type: 'TouchableOpacity',
    style: { height: heights[size], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, ...styles[variant] },
    ...(Object.keys(buttonProps).length > 0 ? { props: buttonProps } : {}),
    children,
  }
}

function expandSocialButton(props: { provider?: 'google' | 'apple'; text?: string }): any {
  const provider = props.provider || 'google'
  const label = props.text || (provider === 'google' ? 'Continue with Google' : 'Continue with Apple')
  const icon = provider === 'google' ? 'G' : '🍎'
  return {
    type: 'TouchableOpacity',
    style: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: SURFACE_2, borderRadius: 12, gap: 8 },
    children: [
      { type: 'Text', style: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY }, children: [icon] },
      { type: 'Text', style: { fontSize: 14, fontWeight: '500', color: TEXT_PRIMARY }, children: [label] },
    ],
  }
}

function expandChipSelector(props: { chips?: Array<{ label: string; active?: boolean }> }): any {
  const chips = props.chips || [{ label: 'All', active: true }, { label: 'Option 1' }, { label: 'Option 2' }, { label: 'Option 3' }]
  return {
    type: 'ScrollView',
    style: { flexShrink: 0 },
    props: { horizontal: true, showsHorizontalScrollIndicator: false },
    children: [{
      type: 'View', style: { flexDirection: 'row', gap: 8 }, children: chips.map(chip => ({
        type: 'TouchableOpacity',
        style: {
          height: 36, paddingHorizontal: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
          backgroundColor: chip.active ? ACCENT : SURFACE_2,
        },
        children: [{ type: 'Text', style: { fontSize: 13, fontWeight: '500', color: chip.active ? TEXT_PRIMARY : TEXT_SECONDARY }, children: [chip.label] }],
      })),
    }],
  }
}

// =============================================
// CHAT
// =============================================

function expandChatInputBar(props: { placeholder?: string }): any {
  return {
    type: 'View',
    style: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderColor: SURFACE_2, gap: 8 },
    children: [
      { type: 'TouchableOpacity', style: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, children: [
        { type: 'Icon', props: { name: 'smile', size: 20, color: TEXT_TERTIARY } },
      ]},
      { type: 'TextInput', style: { flex: 1, height: 40, backgroundColor: SURFACE_2, borderRadius: 20, paddingHorizontal: 16, fontSize: 14, color: TEXT_PRIMARY }, props: { placeholder: props.placeholder || 'Message...', placeholderTextColor: TEXT_TERTIARY } },
      { type: 'TouchableOpacity', style: { width: 40, height: 40, borderRadius: 20, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' }, children: [
        { type: 'Icon', props: { name: 'send', size: 18, color: TEXT_PRIMARY } },
      ]},
    ],
  }
}

// =============================================
// MEDIA & VISUALIZATION
// =============================================

function expandProgressRing(props: { progress?: number; size?: number; color?: string; label?: string }): any {
  const progress = Math.min(1, Math.max(0, props.progress ?? 0.75))
  const sz = props.size || 56
  const r = (sz / 2) - 4
  const circumference = Math.round(2 * Math.PI * r)
  const offset = Math.round(circumference * (1 - progress))
  const color = props.color || ACCENT
  return {
    type: 'View', style: { alignItems: 'center', gap: 4 }, children: [
      { type: 'Svg', style: { width: sz, height: sz }, props: { viewBox: `0 0 ${sz} ${sz}` }, children: [
        { type: 'Circle', props: { cx: sz / 2, cy: sz / 2, r, stroke: SURFACE_2, strokeWidth: 4, fill: 'none' } },
        { type: 'Circle', props: { cx: sz / 2, cy: sz / 2, r, stroke: color, strokeWidth: 4, fill: 'none', strokeDasharray: String(circumference), strokeDashoffset: String(offset), strokeLinecap: 'round' } },
      ]},
      ...(props.label ? [{ type: 'Text', style: { fontSize: 11, color: TEXT_TERTIARY }, children: [props.label] }] : []),
    ],
  }
}

function expandProgressBar(props: { progress?: number; color?: string; label?: string; value?: string }): any {
  const progress = Math.min(1, Math.max(0, props.progress ?? 0.5))
  const color = props.color || ACCENT
  const children: any[] = []
  if (props.label || props.value) {
    children.push({
      type: 'View', style: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }, children: [
        ...(props.label ? [{ type: 'Text', style: { fontSize: 12, color: TEXT_SECONDARY }, children: [props.label] }] : []),
        ...(props.value ? [{ type: 'Text', style: { fontSize: 12, fontWeight: '600', color: TEXT_PRIMARY }, children: [props.value] }] : []),
      ],
    })
  }
  children.push({
    type: 'View', style: { height: 6, backgroundColor: SURFACE_2, borderRadius: 4, overflow: 'hidden' }, children: [
      { type: 'View', style: { width: `${Math.round(progress * 100)}%`, height: '100%', backgroundColor: color, borderRadius: 4 } },
    ],
  })
  return { type: 'View', children }
}

function expandImageCarousel(props: { images?: string[]; height?: number }): any {
  const images = props.images || ['product photography studio lighting', 'product detail closeup', 'product lifestyle shot']
  const h = props.height || 200
  return {
    type: 'View', children: [
      { type: 'ScrollView', style: { height: h }, props: { horizontal: true, showsHorizontalScrollIndicator: false }, children: [{
        type: 'View', style: { flexDirection: 'row' }, children: images.map(img => ({
          type: 'Image', style: { width: 360, height: h }, props: { searchQuery: img },
        })),
      }]},
      { type: 'View', style: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 }, children: images.map((_, i) => ({
        type: 'View', style: { width: i === 0 ? 16 : 6, height: 6, borderRadius: 4, backgroundColor: i === 0 ? ACCENT : SURFACE_2 },
      }))},
    ],
  }
}

// =============================================
// CONTENT
// =============================================

function expandPromoCard(props: { title?: string; subtitle?: string; buttonText?: string; color?: string }): any {
  const color = props.color || ACCENT
  return {
    type: 'View',
    style: { backgroundColor: SURFACE_2, borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    children: [
      { type: 'View', style: { flex: 1, marginRight: 12 }, children: [
        { type: 'Text', style: { fontSize: 17, fontWeight: '700', color: TEXT_PRIMARY }, children: [props.title || '50% Off Today'] },
        ...(props.subtitle ? [{ type: 'Text', style: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 }, children: [props.subtitle] }] : []),
      ]},
      { type: 'TouchableOpacity', style: { paddingHorizontal: 16, height: 36, borderRadius: 8, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }, children: [
        { type: 'Text', style: { fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY }, children: [props.buttonText || 'Get Deal'] },
      ]},
    ],
  }
}

// --- Expansion registry ---
const COMPONENT_EXPANSIONS: Record<string, (props: any) => any> = {
  // Navigation & Layout
  BottomNav: expandBottomNav,
  HeaderBar: expandHeaderBar,
  TabBar: expandTabBar,
  SectionHeader: expandSectionHeader,
  Divider: expandDivider,
  SearchBar: expandSearchBar,
  // Data Display
  StatCard: expandStatCard,
  ListRow: expandListRow,
  ProductCard: expandProductCard,
  TransactionRow: expandTransactionRow,
  FeatureCard: expandFeatureCard,
  PriceBreakdown: expandPriceBreakdown,
  RatingStars: expandRatingStars,
  StatusBadge: expandStatusBadge,
  // User Identity
  AvatarCircle: expandAvatarCircle,
  ProfileStats: expandProfileStats,
  // Form & Input
  FormInput: expandFormInput,
  Button: expandButton,
  SocialButton: expandSocialButton,
  ChipSelector: expandChipSelector,
  // Chat
  MessageBubble: expandMessageBubble,
  ChatInputBar: expandChatInputBar,
  // Media & Visualization
  ProgressRing: expandProgressRing,
  ProgressBar: expandProgressBar,
  ImageCarousel: expandImageCarousel,
  // Content
  PromoCard: expandPromoCard,
}

// --- Recursive tree expander ---
function expandNode(node: any): any {
  if (!node || typeof node !== 'object') return node

  // If this node is a macro component, expand it
  if (node.type && node.type in COMPONENT_EXPANSIONS) {
    const expander = COMPONENT_EXPANSIONS[node.type]
    const expanded = expander(node.props || {})
    // Recursively expand the result (macros can contain other macros)
    return expandNode(expanded)
  }

  // Otherwise, recurse into children
  if (Array.isArray(node.children)) {
    node.children = node.children
      .filter((child: any) => child != null)
      .map((child: any) => {
        if (typeof child === 'string') return child
        return expandNode(child)
      })
  }

  return node
}

// =============================================
// AUTO-CONVERSION: Raw bubble Views → MessageBubble
// =============================================

/**
 * Detect if a View looks like a chat message bubble.
 * Broad detection — catches all common AI patterns:
 * - Has backgroundColor set (any non-transparent color)
 * - Has borderRadius >= 8 (rounded corners)
 * - Contains at least one Text child with actual content
 * - NOT a full-width card (must have maxWidth OR padding suggesting a bubble)
 */
function looksLikeBubble(node: any): boolean {
  if (!node || node.type !== 'View' || !node.style) return false
  const s = node.style
  const hasBorderRadius = typeof s.borderRadius === 'number' && s.borderRadius >= 8
  const hasBg = typeof s.backgroundColor === 'string' && s.backgroundColor !== 'transparent'
  if (!hasBorderRadius || !hasBg) return false
  // Must contain at least one Text child with text content
  if (!Array.isArray(node.children)) return false
  const hasTextChild = node.children.some((c: any) =>
    c?.type === 'Text' && Array.isArray(c.children) && c.children.some((t: any) => typeof t === 'string' && t.length > 0)
  )
  if (!hasTextChild) return false
  // Exclude full-screen containers (surface-0 background, flex:1)
  const bg = (s.backgroundColor || '').toLowerCase()
  if (bg === '#0a0a1a' || bg === '#0f172a' || bg === '#000000' || s.flex === 1) return false
  // Exclude nav bars, headers (flexDirection: row with multiple non-text children)
  if (s.flexDirection === 'row' && Array.isArray(node.children) && node.children.filter((c: any) => c?.type !== 'Text').length > 1) return false
  return true
}

/** Extract text and determine if sent/received from a raw bubble View */
function extractBubbleData(node: any): { text: string; sent: boolean } | null {
  if (!Array.isArray(node.children)) return null
  const textNode = node.children.find((c: any) =>
    c?.type === 'Text' && Array.isArray(c.children) && c.children.some((t: any) => typeof t === 'string')
  )
  if (!textNode) return null
  const text = textNode.children.filter((t: any) => typeof t === 'string').join('')
  if (!text) return null
  // Heuristic: accent/bright colors = sent, dark/muted = received
  const bg = (node.style?.backgroundColor || '').toLowerCase()
  const sent = !bg.includes('1e') && !bg.includes('2a') && !bg.includes('1a') && !bg.includes('33') && bg !== '#0f172a'
  return { text, sent }
}

/**
 * Walk the tree and convert raw bubble Views into MessageBubble macros.
 * This catches cases where the AI ignores the macro instruction and generates raw nodes.
 */
/** Check if a tree looks like a chat screen (has ChatInputBar, TextInput at bottom, or 3+ sequential bubble siblings) */
function isChatContext(tree: any): boolean {
  if (!tree || typeof tree !== 'object') return false
  if (tree.type === 'ChatInputBar') return true
  if (Array.isArray(tree.children)) {
    let consecutiveBubbles = 0
    for (const child of tree.children) {
      if (typeof child === 'object' && (child?.type === 'MessageBubble' || looksLikeBubble(child))) {
        consecutiveBubbles++
      } else {
        consecutiveBubbles = 0
      }
      if (consecutiveBubbles >= 3) return true
    }
    for (const child of tree.children) {
      if (typeof child === 'object' && isChatContext(child)) return true
    }
  }
  return false
}

function convertRawBubbles(node: any): any {
  if (!node || typeof node !== 'object') return node

  // Check if this node is a wrapper containing a bubble
  // Pattern 1: View wrapper with 1 child that's a bubble
  if (node.type === 'View' && Array.isArray(node.children) && node.children.length === 1) {
    const inner = node.children[0]
    if (inner && typeof inner === 'object' && looksLikeBubble(inner)) {
      const data = extractBubbleData(inner)
      if (data) {
        return { type: 'MessageBubble', props: { text: data.text, sent: data.sent } }
      }
    }
  }

  // Pattern 2: View wrapper with 1 bubble + 1 timestamp Text
  if (node.type === 'View' && Array.isArray(node.children) && node.children.length === 2) {
    const [first, second] = node.children
    if (first && typeof first === 'object' && looksLikeBubble(first) && second?.type === 'Text') {
      const data = extractBubbleData(first)
      const time = second.children?.find((t: any) => typeof t === 'string')
      if (data) {
        return { type: 'MessageBubble', props: { text: data.text, sent: data.sent, ...(time ? { time } : {}) } }
      }
    }
  }

  // Pattern 3: Direct bubble (no wrapper)
  if (looksLikeBubble(node)) {
    const data = extractBubbleData(node)
    if (data) {
      return { type: 'MessageBubble', props: { text: data.text, sent: data.sent } }
    }
  }

  // Recurse children
  if (Array.isArray(node.children)) {
    node.children = node.children
      .filter((child: any) => child != null)
      .map((child: any) => {
        if (typeof child === 'string') return child
        return convertRawBubbles(child)
      })
  }

  return node
}

/**
 * Expand high-level macro components into full ComponentNode subtrees.
 * Only auto-converts raw bubble Views into MessageBubble macros if the tree looks like a chat screen.
 * Call this BEFORE normalizeComponentTree() in the generation pipeline.
 */
export function expandComponents(tree: any): any {
  if (!tree) return tree
  // Only convert raw bubbles if the tree is a chat screen — prevents false positives on product pages, reviews, etc.
  if (isChatContext(tree)) {
    tree = convertRawBubbles(tree)
  }
  // Then: expand all macros (including the newly converted ones)
  return expandNode(tree)
}
