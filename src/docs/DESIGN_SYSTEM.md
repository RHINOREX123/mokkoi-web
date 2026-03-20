# Mokkoi Design System

Complete design token reference for AI-generated mobile screens. All values are enforced by the normalizer — off-scale values are snapped to the nearest valid value.

## Spacing Scale

All padding, margin, and gap values must use these values:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Tight inner padding, icon-to-text gaps |
| sm | 8px | Compact spacing, related item gaps |
| md | 12px | List item padding, chip padding |
| base | 16px | Standard card padding, horizontal margins |
| lg | 20px | Section horizontal padding |
| xl | 24px | Between-section spacing |
| 2xl | 32px | Major section dividers |
| 3xl | 40px | Hero spacing, screen top padding |
| 4xl | 48px | Large hero gaps |
| 5xl | 64px | Maximum spacing |

## Typography

### Font Size Scale

| Size | Usage | Weight Pairing | Line Height |
|------|-------|----------------|-------------|
| 11 | Caption, timestamps | 400 | 16 |
| 12 | Labels, badges | 400-500 | 16 |
| 13 | Footnotes, section headers (uppercase) | 500 | 20 |
| 14 | Body secondary, descriptions | 400 | 20 |
| 16 | Body primary, button text | 400-700 | 24 |
| 17 | Nav bar titles, list item primary | 500-600 | 24 |
| 20 | Section headings, card titles | 600-700 | 28 |
| 24 | Screen subtitles, hero subtext | 600-700 | 32 |
| 28 | Screen titles | 700 | 36 |
| 34 | Large titles, hero headings | 700 | 44 |
| 40 | Display text | 700 | 52 |
| 48 | Hero display, decorative emoji | 400-700 | 60 |

### Font Weights

| Weight | Name | Usage |
|--------|------|-------|
| 400 | Regular | Body text, descriptions, long-form content |
| 500 | Medium | Labels, subtitles, UI controls, navigation |
| 600 | Semibold | Section headers, card titles, emphasis |
| 700 | Bold | Screen titles, primary headings, hero numbers |

### Letter Spacing

| Size Range | Spacing | Rationale |
|------------|---------|-----------|
| 11-13 | +0.4 | Open up small text for readability |
| 14-17 | 0 | Default, no adjustment |
| 20-28 | -0.2 | Tighten headings slightly |
| 34-48 | -0.5 | Tighten display text |

## Color System

### Dark Theme (Default)

#### Backgrounds
| Token | Hex | Usage |
|-------|-----|-------|
| surface-0 | #0A0A1A | Screen base |
| surface-1 | #12121F | Cards, list items |
| surface-2 | #1A1A2E | Elevated cards, modals |
| surface-3 | #222236 | Input backgrounds, hover states |

#### Text
| Token | Hex | Usage |
|-------|-----|-------|
| text-primary | #FFFFFF | Headings, primary content |
| text-secondary | #A0A0B8 | Descriptions, body text |
| text-tertiary | #6B6B80 | Hints, timestamps, labels |
| text-inverse | #0A0A1A | Text on colored backgrounds |

#### Brand/Accent
| Token | Hex | Usage |
|-------|-----|-------|
| primary | #6C5CE7 | Main actions, buttons, links |
| primary-light | #A29BFE | Badges, highlights |
| primary-dark | #5A4BD1 | Pressed states |
| primary-surface | rgba(108,92,231,0.1) | Tag backgrounds, tinted areas |

#### Semantic
| Token | Hex | Surface Variant |
|-------|-----|-----------------|
| success | #00B894 | rgba(0,184,148,0.1) |
| warning | #FDCB6E | rgba(253,203,110,0.1) |
| error | #E17055 | rgba(225,112,85,0.1) |
| info | #74B9FF | rgba(116,185,255,0.1) |

#### Utility
| Token | Hex | Usage |
|-------|-----|-------|
| border | #2A2A3E | Dividers, card borders |
| border-strong | #3A3A52 | Emphasized borders |
| overlay | rgba(0,0,0,0.5) | Modal overlays |

### Light Theme

| Token | Hex |
|-------|-----|
| surface-0 | #F5F5FA |
| surface-1 | #FFFFFF |
| surface-2 | #F0F0F5 |
| surface-3 | #E8E8F0 |
| text-primary | #1A1A2E |
| text-secondary | #5A5A72 |
| text-tertiary | #9090A8 |
| text-inverse | #FFFFFF |
| border | #E0E0EC |
| border-strong | #C8C8DA |

## Border Radius

| Value | Usage |
|-------|-------|
| 0 | Sharp edges |
| 4 | Subtle rounding |
| 8 | Chips, badges |
| 12 | Standard cards, inputs, modals |
| 16 | Hero cards, image containers |
| 24 | Pill buttons, selection chips |
| 9999 | Full circles (avatars, FABs) |

## Elevation

| Level | Shadow | Usage |
|-------|--------|-------|
| none | - | Default, flat surfaces |
| subtle | offset(0,1) opacity(0.08) radius(4) | Cards, list items |
| medium | offset(0,2) opacity(0.12) radius(8) | Modals, dropdowns |
| prominent | offset(0,4) opacity(0.16) radius(16) | FABs, toasts |

## Component Heights

| Component | Standard | Compact | Large |
|-----------|----------|---------|-------|
| Button | 48 | 40 | 56 |
| Input | 48 | 40 | - |
| List row | 56 | 48 | 72 |
| Tab bar | 49 (content) | - | - |
| Nav bar | 44 (content) | - | - |

## Platform Safe Areas

| Area | Value |
|------|-------|
| Status bar (Dynamic Island) | paddingTop: 54 |
| Home indicator | paddingBottom: 34 |
| Tab bar total | 49 + 34 = 83 |
| Touch target minimum | 44 x 44 |

## Supported Component Types

1. **View** — flex column container
2. **SafeAreaView** — safe area aware container
3. **ScrollView** — scrollable container (props: showsVerticalScrollIndicator, horizontal, contentContainerStyle)
4. **Text** — text content (styles: fontSize, fontWeight, color, textAlign, lineHeight, letterSpacing, textDecorationLine, textTransform)
5. **TextInput** — input field (props: placeholder, placeholderTextColor, secureTextEntry, keyboardType)
6. **TouchableOpacity** — tappable element (min 44px touch target)
7. **Image** — image display (props: source { uri })
8. **ActivityIndicator** — loading spinner (props: color, size)
9. **Switch** — toggle (props: value, trackColor, thumbColor)
10. **FlatList** — list container (props: contentContainerStyle)

## Content Guidelines

- Never use "Lorem ipsum", "John Doe", "Jane Smith", or "User"
- Match content to the app category
- Use realistic names, numbers, and labels
- 26 content categories available (see CONTENT_LIBRARY in design-system.ts)

## DESIGN.md Import

Mokkoi supports custom design tokens via DESIGN.md. Include a markdown block in your prompt with headers:
- `# Colors` — custom color palette
- `# Typography` — font families, sizes
- `# Spacing` — custom spacing scale
- `# Components` — component style overrides

Custom tokens override Mokkoi defaults; unspecified values use defaults.
