# Mokkoi Product Roadmap

Prioritized feature roadmap based on competitive analysis and user needs.

## P0: Must Have Before YC Application (by May 4, 2026)

### Design Quality Parity
- [x] Comprehensive token system (spacing, typography, color, elevation)
- [x] 26-category content library with realistic data
- [x] Post-generation normalizer (snaps values to grid, validates structure)
- [x] 5 high-quality few-shot examples (login, dashboard, profile, settings, product)
- [x] Dark + light theme support
- [x] DESIGN.md import (custom token override)

### Core Features
- [x] Single screen generation with streaming
- [x] Multi-screen flow generation (3-5 screens)
- [x] MCP server (generate_screen, edit_screen, screenshot_to_screen, generate_flow)
- [x] Screenshot-to-screen (image input)
- [x] Screen editing with conversation history
- [x] Credit system with free/pro tiers

### Differentiators
- [x] React Native component tree output (unique vs Stitch/v0/Lovable)
- [x] MCP server for Claude Code / Cursor integration
- [x] Live phone frame preview
- [x] Design system enforcement via normalizer

## P1: Within 2 Weeks of Launch

### DESIGN.md Ecosystem
- [ ] DESIGN.md export (generate DESIGN.md from any screen's token usage)
- [ ] Stitch DESIGN.md format compatibility (import Stitch designs → generate RN code)
- [ ] Design system extraction from URL (crawl an existing app's design patterns)

### Quality Improvements
- [ ] Gradient support (LinearGradient component in ScreenRenderer)
- [ ] Blur/glassmorphism effects (backdrop-filter in web renderer)
- [ ] Better image placeholder system (Unsplash API integration for placeholder images)
- [ ] Animation token system (duration, easing curves for transitions)

### Developer Experience
- [ ] React Native .tsx code export (not just JSON tree — full component file)
- [ ] Expo-compatible export with proper imports
- [ ] Copy-paste ready code snippets per component
- [ ] TypeScript prop types in exported code

## P2: Within 1 Month

### Interactive Prototyping
- [ ] Screen linking (tap button → navigate to another screen in the flow)
- [ ] Transition animations between screens
- [ ] Interactive form inputs in preview
- [ ] Scroll behavior preview

### Team Features
- [ ] Shared projects with team members
- [ ] Design review comments on screens
- [ ] Version history per screen
- [ ] Branch/fork a project

### Advanced Generation
- [ ] Voice-to-screen (describe a screen verbally, get it generated)
- [ ] Multi-turn conversation with screen context
- [ ] "Redesign this section" — targeted area editing
- [ ] Style transfer ("make this look like Spotify/Airbnb")

## P3: Future

### Platform Expansion
- [ ] SwiftUI output option (alongside React Native)
- [ ] Flutter/Dart output option
- [ ] Figma plugin (generate screens directly in Figma)
- [ ] VS Code extension (preview generated screens inline)

### Enterprise
- [ ] Custom design system training (fine-tune on company's design system)
- [ ] Design system governance (enforce company tokens across all generated screens)
- [ ] API access for CI/CD integration
- [ ] SSO and team management

### AI Capabilities
- [ ] Multi-modal input (sketch + text → screen)
- [ ] Design critique agent (score and suggest improvements)
- [ ] Accessibility audit agent (WCAG compliance check)
- [ ] Responsive variants (phone, tablet, foldable)

## Competitive Response Plan

### If Google Stitch adds React Native output:
- Deepen MCP integration (more tools, better context awareness)
- Focus on design system enforcement (normalizer quality)
- Build Expo/RN ecosystem integrations Stitch won't prioritize

### If Rork adds MCP server:
- Emphasize per-screen iteration speed (Rork does full apps, slow for single screens)
- Build design system import/export pipeline (Rork has no design system support)
- Price competitively (Rork starts at $25/month)

### If v0 adds mobile output:
- React Native depth (v0 would likely add React Native Web, not true RN)
- Component tree JSON format (enables programmatic manipulation)
- MCP server advantage (v0 has no agentic integration)
