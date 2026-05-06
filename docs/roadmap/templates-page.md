# Templates page (`/templates`)

**Status:** `idea`
**Estimated effort:** 1 week (build templates library + page + sidebar entry)
**Priority:** Medium (lowers barrier for new users; secondary to core flow)
**Owner:** unassigned

## Goal

A `/templates` route showing a curated library of pre-built Mokkoi apps users can fork as a starting point. Reachable from a sidebar nav entry. One-click "Use this template" → forks into the user's account.

## Why

- New users staring at an empty prompt sometimes don't know what to type
- "Start from a template" is a known good empty-state nudge
- Builds a content library that doubles as marketing surface (each template = SEO page)
- Validates the AI's quality bar (template apps = the showcase)

## What it isn't

- NOT user-generated (that's the public Gallery + Remix task; see `public-gallery-remix.md`)
- NOT a directory of every Mokkoi project — curated only

## Architecture

```
src/pages/TemplatesPage.tsx       — new route
src/components/templates/
  TemplateCard.tsx                — preview card
  TemplateGrid.tsx                — grid layout
  templates/                      — JSON or TS data files, one per
                                    template, with screens + metadata
src/main.tsx                      — add /templates route
src/pages/Dashboard.tsx           — add "Templates" sidebar entry
```

## Initial template set (proposed 8)

1. Meal planner
2. Fitness tracker
3. Recipe browser
4. Habit tracker
5. Chat / messaging
6. Music player
7. Shopping / e-commerce
8. Personal finance

Each template = full multi-screen app (4–8 screens) with realistic content. We build them by prompting Mokkoi itself, then locking the output as canonical.

## "Use this template" flow

1. User clicks template card
2. Modal: "Use this template? It'll create a copy in your account."
3. Confirm → server-side: create new project, copy all screens + connections + design tokens
4. Navigate to `/app/{newId}` — user can edit freely

## Out of scope

- User-submitted templates
- Template categories / search (start with 8 in a single grid)
- Template ratings / popularity

## Dependencies

- None hard. Can build standalone.

## Future expansion

- Once shipped, templates become the seed for the Public Gallery (when we open that). Public Gallery = user-generated; Templates = curated.
