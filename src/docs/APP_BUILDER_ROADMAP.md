# Mokkoi — AI Mobile App Builder: Complete Product Roadmap

> **Mission:** Make Mokkoi the definitive AI mobile app builder — from idea to App Store in minutes.
> **Current State:** AI screen generator with MCP, multi-screen canvas, Expo export.
> **Target State:** Full-stack AI mobile app builder with live preview, state management, backend integration, and one-click deployment.

---

## Competitive Landscape (March 2026)

### Direct Competitors

| Tool | Focus | Stack | Funding | Strengths | Key Weakness |
|------|-------|-------|---------|-----------|-------------|
| **Rork** | Mobile-only | React Native + Expo | $2.8M (a16z) | Only AI-first native mobile builder | Unreliable publishing, crashes, 2.9/5 Trustpilot |
| **Bolt.new** | Web + Mobile | React + WebContainers | $135M | 5M+ users, in-browser dev, Expo partnership | 1.4/5 Trustpilot, credit-burning loops |
| **Lovable** | Web-only | React + Supabase | $330M ($6.6B val) | Best funded, Agent Mode, $200M ARR | No mobile at all |
| **v0** | Web components | Next.js + Tailwind | Vercel-backed | Best code quality, Vercel ecosystem | No mobile, expensive per query |
| **FlutterFlow** | Mobile + Web | Flutter/Dart | Established | Most mature visual builder, App Store deploy | Not AI-first, steep learning curve, $39/mo |
| **Draftbit** | Mobile | React Native | Small | QR live preview, RN output | Buggy, limited AI, poor support |
| **Rocket** | Web + Mobile | Proprietary | Unknown | Broad scope | Severe reliability issues |
| **Replit** | General IDE | Multi-language | $1.16B | Most versatile, 50+ languages | Web-wrapped mobile, slow |

### Market Gaps Mokkoi Can Own

1. **AI-first + React Native + Expo** — Rork is the only competitor here, and they have 2.9/5 satisfaction
2. **MCP integration** — Zero competitors have IDE-native AI agent integration
3. **Visual canvas + AI chat** — Rork has no visual editor; FlutterFlow has no AI chat
4. **Web-to-mobile conversion** — No one else does HTML import → React Native
5. **Developer-friendly export** — Clean, readable code that devs actually want to use

### Industry-Wide Problems (Opportunity)

- **Credit-burning loops** — Every AI builder has this. First to solve it wins trust.
- **"Last mile" quality** — Gets 70% done, last 30% is painful. Better prompts + normalizer = advantage.
- **No live preview** — Only Draftbit has QR preview. Adding this to an AI-first builder is a moat.
- **Code quality** — Most builders generate unmaintainable code. Mokkoi's normalizer is already better.

---

## What Mokkoi Has Today (Completed)

### Core Platform
- [x] AI screen generation (Claude Haiku/Sonnet, streaming)
- [x] Multi-screen canvas with drag, zoom, pan
- [x] Flow connections (drag wires between screens)
- [x] Direct edit mode (click elements to edit inline)
- [x] Design system normalizer (spacing, typography, color tokens)
- [x] 200+ Lucide/Material icon support
- [x] Multi-device preview (iPhone SE/Standard/Max, Android, iPad)
- [x] Dark/light theme generation
- [x] Keyboard shortcuts (15+)
- [x] Command palette (Cmd+K)

### Generation
- [x] Text-to-screen (single screen from prompt)
- [x] Image-to-screen (screenshot → design recreation)
- [x] Multi-screen flow generation (3-5 connected screens)
- [x] Screen editing with conversation history (5 messages)
- [x] Intent detection (create vs edit)
- [x] Complexity routing (Haiku for simple, Sonnet for complex)
- [x] Design variations (A/B alternatives)
- [x] 30+ templates across 10 categories
- [x] HTML import (v0/Bolt/Stitch/Lovable → React Native)

### Export
- [x] PNG screenshot (@2x with phone frame)
- [x] TSX code export (standalone React Native component)
- [x] ZIP bundle (PNG + TSX + README)
- [x] Single-screen Expo project
- [x] Multi-screen Expo project (React Navigation + tab detection)
- [x] Screen picker for selective export
- [x] Connection → navigation.navigate() wiring
- [x] Smart screen naming (PascalCase, dedup, strip filler)

### MCP Server (9 Tools)
- [x] generate_screen, edit_screen, screenshot_to_screen
- [x] generate_flow, list_templates
- [x] sync_from_canvas, watch_canvas
- [x] import_html
- [x] export_project

### Infrastructure
- [x] Supabase (auth, database, realtime)
- [x] Stripe (payments, subscriptions)
- [x] Credits system (free/pro tiers)
- [x] Vercel (hosting, serverless functions)
- [x] PostHog (analytics)
- [x] Flow connections persisted to Supabase

---

## THE ROADMAP: Screen Generator → App Builder → Deployment Platform

---

## PHASE 1: "Generate App" (Weeks 1-2)
> **Goal:** One prompt → complete multi-screen app on canvas

### 1.1 AI App Planner
- [ ] **App planning agent** — AI analyzes prompt, decides: screen count, screen types, navigation structure (stack/tab/drawer), shared data models
- [ ] **App plan preview** — Show user the proposed app structure before generating (screen list, nav diagram)
- [ ] **Plan editing** — User can add/remove/rename screens in the plan before generation
- [ ] **Consistency enforcement** — Shared color palette, typography, spacing across all generated screens

### 1.2 "Generate App" UI
- [ ] **"New App" mode** — Landing state on empty canvas with app-level prompt input
- [ ] **Prompt suggestions** — "Build me a fitness app", "Food delivery app", "Social media app"
- [ ] **App templates** — Pre-built 5-screen app starters (fitness, ecommerce, social, finance, productivity)
- [ ] **Progress indicator** — "Planning app → Generating Home → Generating Profile → Wiring navigation"
- [ ] **Bulk generation** — Generate all screens in parallel (not sequential)

### 1.3 Screen Consistency
- [ ] **Shared design tokens per project** — Extract tokens from first screen, enforce on subsequent screens
- [ ] **Component library per project** — Reuse card styles, button styles, header styles across screens
- [ ] **Navigation bar consistency** — Same tab bar/header across all screens automatically

**Effort:** 10-14 days
**Impact:** Transforms Mokkoi from "screen tool" to "app tool" in one step

---

## PHASE 2: Live Phone Preview (Weeks 2-3)
> **Goal:** Scan QR → see your app running on your phone in real-time

### 2.1 Expo Snack Integration
- [ ] **Snack API integration** — Push generated TSX to Expo Snack, get embed URL + QR
- [ ] **Live preview panel** — Embedded Snack preview in Mokkoi UI (iframe or webview)
- [ ] **QR code modal** — Large QR for scanning with Expo Go app
- [ ] **Auto-refresh** — Edit screen on canvas → Snack updates automatically
- [ ] **Multi-screen preview** — All screens with working navigation in Snack

### 2.2 Preview UX
- [ ] **"Preview on Phone" button** — Prominent in toolbar, single click
- [ ] **Device frame in browser** — Interactive preview with clickable navigation (not just static render)
- [ ] **Preview sharing** — Share preview link with anyone (no Mokkoi account needed)
- [ ] **Preview history** — Previous versions accessible for comparison

### 2.3 Fallback Options
- [ ] **Web preview** — React Native Web rendering in browser (current PhoneFrame, enhanced)
- [ ] **Video export** — Record a walkthrough of all screens as MP4/GIF
- [ ] **Interactive prototype** — Clickable hotspots linking screens (Figma-style prototype mode)

**Effort:** 10-14 days
**Impact:** THE killer demo feature. "Scan → see your app" is the YC wow moment.

---

## PHASE 3: Interactive & Stateful Screens (Weeks 3-4)
> **Goal:** Generated apps have working forms, state, and real behavior

### 3.1 Working Form Elements
- [ ] **TextInput binding** — Generated TextInputs with useState hooks
- [ ] **Switch/Toggle state** — Toggles that actually toggle
- [ ] **Dropdown/Picker** — Selection state management
- [ ] **Form validation** — Basic required/email/password validation in generated code
- [ ] **Keyboard handling** — KeyboardAvoidingView, auto-dismiss on tap

### 3.2 Screen-Level State
- [ ] **useState generation** — AI generates appropriate local state for each screen
- [ ] **Counter/quantity controls** — +/- buttons that update numbers
- [ ] **Tab switching** — In-screen tab bars that show/hide content
- [ ] **Accordion/expandable** — Collapsible sections with state
- [ ] **Search/filter** — Working search bars that filter FlatList data

### 3.3 Cross-Screen State
- [ ] **Zustand store generation** — AI creates shared store for app-wide state
- [ ] **Cart/favorites** — Add item on one screen → see it on another
- [ ] **User profile** — Login screen → profile data available everywhere
- [ ] **Navigation params** — Pass data between screens (product list → product detail)
- [ ] **Auth state** — Logged in/out conditional rendering

### 3.4 Data & Lists
- [ ] **Realistic mock data** — AI generates 10-20 items per list (not 3)
- [ ] **FlatList optimization** — Proper keyExtractor, renderItem, pagination structure
- [ ] **Pull-to-refresh** — RefreshControl integration
- [ ] **Empty states** — Generated empty state UI when lists have no data
- [ ] **Loading states** — Skeleton/shimmer placeholders

**Effort:** 14-20 days
**Impact:** Apps feel real, not just pretty mockups

---

## PHASE 4: App Polish & Real-World Features (Weeks 5-8)
> **Goal:** Generated apps are production-quality, not just prototypes

### 4.1 Navigation Sophistication
- [ ] **Bottom tab navigator** — Auto-detected and properly configured (already started)
- [ ] **Drawer navigator** — Side menu for settings/profile apps
- [ ] **Nested navigators** — Tab → Stack nesting (e.g., Home tab with detail screens)
- [ ] **Deep linking** — URL scheme configuration in generated apps
- [ ] **Navigation transitions** — Custom animations between screens
- [ ] **Back button handling** — Proper Android back behavior
- [ ] **Modal screens** — Present screens as modals (bottom sheets, popups)

### 4.2 Animations & Gestures
- [ ] **React Native Reanimated** — Smooth, 60fps animations in generated code
- [ ] **Gesture handler** — Swipe-to-delete, pull-to-refresh, drag-to-reorder
- [ ] **Shared element transitions** — Image zoom between list → detail screens
- [ ] **Lottie animations** — Loading states, success animations, onboarding
- [ ] **Parallax scrolling** — Collapsible headers with scroll-driven animation
- [ ] **Spring physics** — Bouncy, natural-feeling interactions

### 4.3 Native Device Features
- [ ] **Camera integration** — Photo capture for profile pictures, receipts
- [ ] **Image picker** — Gallery selection with crop/resize
- [ ] **Push notifications** — Expo Notifications setup + registration flow
- [ ] **Location services** — Map view, location picker, distance calculations
- [ ] **Haptic feedback** — Tactile responses on button presses
- [ ] **Biometric auth** — Face ID / Touch ID login flow
- [ ] **Share sheet** — Native sharing (text, images, links)
- [ ] **Clipboard** — Copy/paste functionality
- [ ] **AsyncStorage** — Persistent local data

### 4.4 Theming & Styling
- [ ] **Theme provider** — Centralized theme with useTheme hook
- [ ] **Dark/light mode toggle** — Working in-app theme switcher
- [ ] **Custom fonts** — Google Fonts integration (Inter, Poppins, etc.)
- [ ] **Gradient support** — LinearGradient backgrounds and overlays
- [ ] **Blur/glassmorphism** — BlurView for modern glass effects
- [ ] **Shadow system** — Platform-aware shadows (elevation on Android, shadow on iOS)
- [ ] **Safe area handling** — Proper SafeAreaView on all screens
- [ ] **Responsive scaling** — Dimensions API for different screen sizes

**Effort:** 20-30 days
**Impact:** Generated apps feel like they were built by a senior RN developer

---

## PHASE 5: Backend & Data Integration (Weeks 9-14)
> **Goal:** Apps connect to real data, auth, and APIs

### 5.1 Supabase Backend Generation
- [ ] **Database schema generation** — AI designs tables based on app description
- [ ] **Row Level Security** — Auto-generated RLS policies
- [ ] **CRUD operations** — Generated API calls for create/read/update/delete
- [ ] **Real-time subscriptions** — Live data updates (chat, notifications)
- [ ] **File storage** — Image upload to Supabase Storage
- [ ] **Edge functions** — Serverless backend logic

### 5.2 Authentication
- [ ] **Email/password auth** — Full signup/login/reset flow
- [ ] **OAuth providers** — Google, Apple, GitHub sign-in
- [ ] **Auth state management** — Protected routes, auth context
- [ ] **Profile management** — User profile CRUD
- [ ] **Session handling** — Token refresh, logout

### 5.3 API Integration
- [ ] **REST API client** — Generated fetch/axios service layer
- [ ] **API key management** — Secure storage (not hardcoded)
- [ ] **Loading/error states** — Proper UX for API calls
- [ ] **Offline support** — Cache-first with sync-when-online
- [ ] **Pagination** — Cursor/offset pagination for large datasets

### 5.4 Third-Party Integrations
- [ ] **Stripe payments** — In-app purchases, subscriptions
- [ ] **Firebase** — Alternative to Supabase for existing users
- [ ] **Analytics** — PostHog/Mixpanel event tracking
- [ ] **Crash reporting** — Sentry integration
- [ ] **Maps** — Google Maps / Mapbox integration

**Effort:** 30-40 days
**Impact:** Apps are actually functional with real data — not just UI

---

## PHASE 6: Deployment Pipeline (Weeks 15-20)
> **Goal:** One-click from Mokkoi canvas to App Store / Play Store

### 6.1 Build Pipeline
- [ ] **EAS Build integration** — Cloud builds for iOS and Android from Mokkoi UI
- [ ] **Build configuration** — App icon, splash screen, bundle ID setup
- [ ] **Build status dashboard** — Monitor build progress in Mokkoi
- [ ] **Build artifacts** — Download .ipa and .apk directly
- [ ] **Build caching** — Faster subsequent builds

### 6.2 App Store Deployment
- [ ] **EAS Submit integration** — Automated submission to App Store and Play Store
- [ ] **App Store metadata** — Generated descriptions, keywords, screenshots
- [ ] **Screenshot generation** — Auto-generate App Store screenshots from Mokkoi screens
- [ ] **Privacy policy generation** — AI-written privacy policy based on app features
- [ ] **Review guidelines check** — Pre-submission validation against Apple/Google rules

### 6.3 Over-the-Air Updates
- [ ] **EAS Update** — Push updates without App Store review
- [ ] **Version management** — Track published versions, rollback capability
- [ ] **A/B testing** — Deploy variants to different user segments
- [ ] **Update channels** — Production, staging, preview channels

### 6.4 CI/CD
- [ ] **GitHub integration** — Push generated code to repo
- [ ] **Auto-build on push** — Git push triggers EAS Build
- [ ] **Preview deploys** — PR preview builds on Expo Go
- [ ] **Environment management** — Dev/staging/prod configurations

**Effort:** 30-40 days
**Impact:** Complete the loop — idea → build → deploy → update. This is the MOAT.

---

## PHASE 7: Collaboration & Team Features (Weeks 21-26)
> **Goal:** Teams can build apps together

### 7.1 Real-Time Collaboration
- [ ] **Multiplayer canvas** — Multiple users editing simultaneously (Supabase Realtime)
- [ ] **Cursor presence** — See other users' cursors on canvas
- [ ] **Screen locking** — Prevent conflicts on same screen
- [ ] **Live chat** — Team chat within project context

### 7.2 Review & Feedback
- [ ] **Comment system** — Pin comments on specific screen elements
- [ ] **Design review mode** — Side-by-side before/after comparison
- [ ] **Approval workflow** — Request review → approve → merge to production
- [ ] **Change history** — Full audit trail of every edit

### 7.3 Version Control
- [ ] **Screen versioning** — Git-like history per screen
- [ ] **Branch/fork projects** — Experiment without affecting main
- [ ] **Merge changes** — Combine branches with conflict resolution
- [ ] **Restore previous versions** — One-click rollback

### 7.4 Team Management
- [ ] **Team workspaces** — Shared projects, shared design tokens
- [ ] **Role-based access** — Owner, editor, viewer, commenter
- [ ] **SSO** — SAML/OIDC for enterprise teams
- [ ] **Audit logs** — Track all team actions

**Effort:** 30-40 days
**Impact:** Enterprise readiness, team plan revenue

---

## PHASE 8: Advanced AI Capabilities (Weeks 27-36)
> **Goal:** AI that understands apps, not just screens

### 8.1 AI App Understanding
- [ ] **App-level context** — AI understands the entire app, not just current screen
- [ ] **Cross-screen consistency** — AI ensures design/behavior consistency across edits
- [ ] **Intent prediction** — AI suggests next screens to build based on app type
- [ ] **Code review agent** — AI reviews generated code for bugs, performance, accessibility

### 8.2 Advanced Generation
- [ ] **Voice-to-app** — Describe app verbally → generate complete app
- [ ] **Sketch-to-app** — Hand-drawn wireframe → polished app
- [ ] **Clone-an-app** — Screenshot of existing app → recreated in Mokkoi
- [ ] **Style transfer** — "Make it look like Spotify" / "Airbnb style"
- [ ] **Responsive variants** — Phone + tablet + foldable from one design

### 8.3 AI Debugging
- [ ] **Build error fixing** — AI detects and fixes Expo build errors
- [ ] **Runtime crash fixing** — AI analyzes crash logs and patches code
- [ ] **Performance optimization** — AI profiles and optimizes slow screens
- [ ] **Accessibility audit** — WCAG compliance checking and auto-fix

### 8.4 Learning & Personalization
- [ ] **User style learning** — AI adapts to user's design preferences over time
- [ ] **Company design system training** — Fine-tune on organization's design system
- [ ] **Community templates** — User-submitted app templates
- [ ] **Prompt library** — Curated prompts for common app patterns

**Effort:** 40-60 days
**Impact:** Mokkoi becomes genuinely intelligent, not just a prompt wrapper

---

## PHASE 9: Platform & Ecosystem (Weeks 37-52)
> **Goal:** Mokkoi becomes a platform, not just a tool

### 9.1 Plugin System
- [ ] **Plugin marketplace** — Third-party extensions (payment providers, analytics, etc.)
- [ ] **Custom component library** — Users publish reusable components
- [ ] **Theme marketplace** — Buy/sell app themes and design systems
- [ ] **Integration plugins** — Connect to any API via plugin

### 9.2 Multi-Platform Output
- [ ] **React Native (current)** — iOS + Android via Expo
- [ ] **React Native Web** — Same code → web app
- [ ] **SwiftUI output** — Native iOS alternative
- [ ] **Kotlin Compose** — Native Android alternative
- [ ] **Flutter/Dart** — Cross-platform alternative
- [ ] **Progressive Web App** — PWA export option

### 9.3 App Analytics & Monitoring
- [ ] **Built-in analytics** — Usage tracking in generated apps
- [ ] **Crash monitoring** — Real-time error tracking dashboard
- [ ] **Performance metrics** — App speed, load times, frame rates
- [ ] **User behavior** — Screen flow analytics, drop-off points
- [ ] **A/B testing** — Test different versions of screens

### 9.4 Monetization for Users
- [ ] **In-app purchases** — Setup and manage IAP from Mokkoi
- [ ] **Subscription management** — RevenueCat integration
- [ ] **Ad integration** — AdMob setup for ad-supported apps
- [ ] **Analytics dashboard** — Revenue tracking per app

### 9.5 Enterprise Features
- [ ] **White-label** — Custom branded Mokkoi for agencies
- [ ] **On-premise deployment** — Self-hosted option for enterprises
- [ ] **API access** — Programmatic app generation
- [ ] **SLA & support** — Dedicated support for enterprise clients
- [ ] **Custom AI models** — Fine-tuned models for specific industries

**Effort:** 60-90 days
**Impact:** Platform moat — network effects, marketplace revenue, lock-in

---

## Architecture Requirements

### Current Architecture (Good Foundation)
```
Frontend:  React 19 + Vite + Tailwind
Backend:   Vercel Functions (serverless)
Database:  Supabase (PostgreSQL + Auth + Realtime)
AI:        Anthropic Claude API (Haiku/Sonnet)
Payments:  Stripe
MCP:       Custom server (9 tools)
Export:    JSZip + html2canvas
```

### Target Architecture (App Builder)
```
Frontend:  React 19 + Vite + Tailwind (no change)
Backend:   Vercel Functions + Supabase Edge Functions
Database:  Supabase (PostgreSQL + Auth + Realtime + Storage)
AI:        Claude API + Prompt Cache + Multi-agent pipeline
Preview:   Expo Snack API + Expo Go QR
Build:     EAS Build API (cloud builds)
Deploy:    EAS Submit API (App Store/Play Store)
Updates:   EAS Update API (OTA updates)
Payments:  Stripe (Mokkoi) + RevenueCat (user apps)
MCP:       Extended server (15+ tools)
Export:    JSZip + EAS + GitHub API
Collab:    Supabase Realtime (multiplayer)
Analytics: PostHog (Mokkoi) + Built-in (user apps)
```

### New Infrastructure Needed
| Component | Purpose | When |
|-----------|---------|------|
| **Expo Snack API** | Live phone preview | Phase 2 |
| **Zustand code generation** | Cross-screen state | Phase 3 |
| **EAS Build API** | Cloud builds | Phase 6 |
| **EAS Submit API** | App Store deployment | Phase 6 |
| **Supabase Realtime channels** | Multiplayer canvas | Phase 7 |
| **RevenueCat API** | User app monetization | Phase 9 |

---

## Competitive Moat Strategy

### Short-term Moats (0-6 months)
1. **MCP integration** — Only mobile app builder that works inside Claude Code/Cursor
2. **React Native + Expo** — Clean, exportable, standard code (vs Rork's opaque builds)
3. **Web-to-mobile conversion** — HTML import is unique to Mokkoi
4. **Design quality** — Normalizer + token system produces better-looking output

### Medium-term Moats (6-12 months)
5. **Live phone preview** — Expo Snack QR → instant gratification
6. **AI app planning** — Multi-agent pipeline that plans before generating
7. **Stateful code generation** — Working apps, not just mockups
8. **One-click deployment** — EAS Build/Submit from Mokkoi UI

### Long-term Moats (12+ months)
9. **User learning** — AI that knows your design preferences
10. **Plugin ecosystem** — Third-party extensions create lock-in
11. **Template marketplace** — Community-generated content
12. **Enterprise design systems** — Company-specific AI training

---

## Pricing Strategy (Post-App Builder)

| Tier | Price | Target | Features |
|------|-------|--------|----------|
| **Free** | $0 | Explorers | 3 apps, 5 screens each, watermark on export |
| **Starter** | $19/mo | Indie hackers | 10 apps, unlimited screens, Expo export, QR preview |
| **Pro** | $39/mo | Developers | Unlimited apps, EAS Build (5/month), GitHub sync, priority generation |
| **Team** | $29/user/mo | Startups | Collaboration, shared design systems, team management |
| **Enterprise** | Custom | Companies | SSO, on-premise, custom AI, dedicated support, SLA |

### Revenue Multipliers
- **Build minutes** — Charge per EAS Build beyond tier limit ($1/build)
- **App Store submissions** — $5 per submission assist
- **Template marketplace** — 30% cut on community template sales
- **Plugin marketplace** — 30% cut on third-party plugin revenue

---

## Key Metrics to Track

### Product Metrics
| Metric | Current | Target (YC) | Target (6 months) |
|--------|---------|-------------|-------------------|
| Apps generated | ? | 500+ | 10,000+ |
| Screens generated | ? | 5,000+ | 100,000+ |
| Expo exports | New | 200+ | 5,000+ |
| QR preview scans | 0 | 500+ | 10,000+ |
| MCP installs | ? | 100+ | 1,000+ |
| App Store submissions | 0 | 0 | 100+ |

### Business Metrics
| Metric | Current | Target (YC) | Target (6 months) |
|--------|---------|-------------|-------------------|
| MAU | ? | 1,000+ | 10,000+ |
| Paid subscribers | ? | 50+ | 500+ |
| MRR | ? | $1,000+ | $15,000+ |
| Retention (D7) | ? | 30%+ | 40%+ |

---

## YC Application Timeline (40 Days to May 4, 2026)

### Priority: Build the 3 features that make the YC demo unforgettable

| Week | Focus | Deliverable |
|------|-------|-------------|
| **Week 1** (Mar 25-31) | "Generate App" flow | One prompt → 5 connected screens on canvas |
| **Week 2** (Apr 1-7) | Expo Snack / QR Preview | Scan QR → app on phone → navigate screens |
| **Week 3** (Apr 8-14) | Interactive screens | Working forms, state, navigation |
| **Week 4** (Apr 15-21) | Polish + Demo apps | 5 showcase apps, landing page update |
| **Week 5** (Apr 22-28) | Demo prep + Application | Video, written app, practice pitch |
| **Week 6** (Apr 29-May 4) | Buffer + Submit | Final polish, submit application |

### The 3 YC-Critical Features

1. **"Generate App" (one prompt → complete app)** — Proves the vision
2. **Live Phone Preview (QR → Expo Go)** — Creates the wow moment
3. **Interactive Screens (working state)** — Proves it's real, not a mockup

Everything else can wait until after funding.

---

## Summary: The Mokkoi Journey

```
TODAY (March 2026):
  AI Screen Generator + MCP + Expo Export
  "Create screens for your mobile app"

YC DEMO (May 2026):
  AI App Builder with Live Preview
  "Describe an app → see it on your phone in 60 seconds"

6 MONTHS (November 2026):
  Full App Builder with Backend + Deployment
  "Build, test, and deploy mobile apps without code"

12 MONTHS (March 2027):
  App Builder Platform with Ecosystem
  "The Vercel for mobile apps — from idea to App Store"

24 MONTHS (March 2028):
  Enterprise App Builder Platform
  "Every company builds mobile apps with Mokkoi"
```

---

*Last updated: March 25, 2026*
*Document owner: Mokkoi Core Team*
