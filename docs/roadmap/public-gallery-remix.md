# Public Gallery + Remix (`/gallery`)

**Status:** `idea`
**Estimated effort:** 2 weeks (gallery page + remix logic + view counts + moderation hooks)
**Priority:** Medium (network effect feature; valuable but not core)
**Owner:** unassigned

## Goal

A `/gallery` page showing all user projects marked `is_public = true`. Each card has a Remix button that forks the project into the viewer's account.

## Why

- Network effect: users want their apps remixed (social validation)
- Lowers barrier for new users (start from a working app, not blank prompt)
- Press-worthy: "Mokkoi users have built X apps; popular ones get remixed Y times"
- Differentiates from Bolt / Lovable / v0 — they have build, no public discovery
- Fits the YC story: "AI builders → public artifacts → community"

## Architecture

```
src/pages/GalleryPage.tsx          — /gallery route
src/components/gallery/
  GalleryCard.tsx                  — phone preview + remix count
  RemixModal.tsx                   — confirm + naming
src/hooks/useRemix.ts              — fork logic
api/remix.ts                       — server route to fork a project
src/main.tsx                       — add /gallery route
src/pages/Dashboard.tsx            — sidebar nav entry
```

## DB changes

```sql
-- already exists: projects.is_public boolean
-- new:
ALTER TABLE projects ADD COLUMN remix_count integer DEFAULT 0;
ALTER TABLE projects ADD COLUMN remixed_from uuid REFERENCES projects(id);
ALTER TABLE projects ADD COLUMN view_count integer DEFAULT 0;

-- index for sort by popularity
CREATE INDEX idx_projects_public_remix ON projects(is_public, remix_count DESC) WHERE is_public = true;
```

## Remix flow

1. User on `/gallery` clicks Remix on a card
2. Server-side `api/remix.ts`:
   - Verify source project is public
   - Insert new project for current user (status: 'remixed')
   - Set `remixed_from = sourceId`
   - Copy all screens + connections + tokens
   - Increment `source.remix_count`
3. Navigate to `/app/{newId}`

## Edge cases

- Source project deleted while remix is in progress: gracefully fail, suggest different template
- Source's screens contain user-specific data (auth tokens, real names): scrub on remix
- Free-tier user remixes a Pro-tier feature project: clamp to free-tier features
- Remix-of-remix loop: track lineage in `remixed_from` chain; consider depth cap

## Quality control

- Need moderation tooling for public projects (offensive content, copyright)
- For v1: simple admin flag/unflag. Real moderation pipeline = separate task.

## Privacy

- Projects default to `is_public = false`. User must explicitly toggle.
- "Make public" toggle in project settings (new UI piece in `/app/:id`)
- Show clear preview of what becomes visible (project name, screens, but NOT auth tokens, owner email, etc.)

## Out of scope

- Comments / likes / following
- Featured / curated projects on gallery (templates page handles curation)
- Template-style "starter" projects (different feature)

## Dependencies

- Templates page (`templates-page.md`) ideally ships first — provides initial curated content while user-generated content fills out
- `is_public` toggle UI inside project page

## Future expansion

- Trending / Newest / Most-Remixed sort tabs
- Tag system (food, fitness, productivity, etc.)
- "Made with Mokkoi" badge on remixed projects
