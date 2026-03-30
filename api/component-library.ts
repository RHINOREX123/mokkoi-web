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
const SURFACE_0 = '#0A0A1A'
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
      children: [{ type: 'Icon', props: { name: 'arrow_back', size: 20, color: TEXT_PRIMARY } }],
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
      { type: 'Icon', props: { name: props.icon || 'monitoring', size: 17, color: props.iconColor || ACCENT } },
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
        },
        children: bubbleChildren,
      },
    ],
  }
}

// --- Expansion registry ---
const COMPONENT_EXPANSIONS: Record<string, (props: any) => any> = {
  BottomNav: expandBottomNav,
  HeaderBar: expandHeaderBar,
  StatCard: expandStatCard,
  AvatarCircle: expandAvatarCircle,
  MessageBubble: expandMessageBubble,
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

/**
 * Expand high-level macro components into full ComponentNode subtrees.
 * Call this BEFORE normalizeComponentTree() in the generation pipeline.
 */
export function expandComponents(tree: any): any {
  if (!tree) return tree
  return expandNode(tree)
}
