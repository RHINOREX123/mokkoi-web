import { type CSSProperties } from 'react'
import { Star } from 'lucide-react'
import { PhoneThumbnail } from './PhoneThumbnail'
import { ScaledScreenPreview } from './ScaledScreenPreview'
import { useFavorites } from './useFavorites'
import { useFirstScreen } from './useFirstScreen'

export interface RecentProject {
  id: string
  name: string
  updated_at: string
  screen_count?: number
}

export interface RecentProjectsStripProps {
  projects: RecentProject[]
  loading: boolean
  /** Open the full project list (existing sidebar drawer in V1, or future
   *  Projects page). Called from the "View all N →" button. */
  onOpenAll: () => void
  /** Open a project. Mokkoi already routes /app/:id — Wave 4 wires this to
   *  navigate(). Decoupled here so this component stays pure. */
  onOpenProject: (id: string) => void
  /** How many cards to render. Defaults to 4 (the design width). */
  limit?: number
}

function formatRelative(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const min = Math.round(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.round(d / 7)}w ago`
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * RecentProjectsStrip — horizontal grid of project cards under the dashboard
 * hero. Each card shows the project's actual first screen (rendered live via
 * ScaledScreenPreview) inside a phone-frame, name, last-edited time, and a
 * favorite-star toggle.
 *
 * Sort order: favorites first (preserves their internal updated_at order),
 * then everyone else by updated_at desc. Caller is responsible for passing
 * an already-sorted-by-updated_at list; this component just promotes
 * favorites to the front.
 *
 * Spec: docs/superpowers/specs/2026-05-06-dashboard-redesign.md (§7)
 */
export function RecentProjectsStrip({
  projects,
  loading,
  onOpenAll,
  onOpenProject,
  limit = 4,
}: RecentProjectsStripProps) {
  const { has: isFavorite, toggle: toggleFavorite } = useFavorites()

  // Don't reorder on favorite — clicking the star used to slide the card to
  // position 1, which read as a bug ("I clicked the 3rd card but the 1st one
  // got starred"). Now favorites stay where they are; the filled amber star
  // is the indicator. The dedicated Favourites tab in the sidebar is where
  // users go for the focused list.
  const visible = projects.slice(0, limit)
  const totalCount = projects.length

  if (loading) {
    return (
      <Section onOpenAll={onOpenAll} totalCount={totalCount} showViewAll={false}>
        <Grid>
          {Array.from({ length: limit }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </Grid>
      </Section>
    )
  }

  if (totalCount === 0) {
    // No projects → hide the strip entirely. The dashboard hero handles the
    // empty-state copy ("What will you build today?").
    return null
  }

  return (
    <Section
      onOpenAll={onOpenAll}
      totalCount={totalCount}
      showViewAll={totalCount > limit}
    >
      <Grid>
        {visible.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            isFavorite={isFavorite(p.id)}
            onToggleFavorite={() => toggleFavorite(p.id)}
            onOpen={() => onOpenProject(p.id)}
          />
        ))}
      </Grid>
    </Section>
  )
}

// ---- internals ----------------------------------------------------------

function Section({
  children,
  onOpenAll,
  totalCount,
  showViewAll,
}: {
  children: React.ReactNode
  onOpenAll: () => void
  totalCount: number
  showViewAll: boolean
}) {
  return (
    <section
      style={{
        width: '100%',
        maxWidth: 1080,
        margin: '24px auto 0',
        padding: '0 24px',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--dash-text-3)',
            fontWeight: 600,
          }}
        >
          Recent projects
        </h3>
        {showViewAll && (
          <button
            type="button"
            onClick={onOpenAll}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12.5,
              color: 'var(--dash-teal)',
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            View all {totalCount} →
          </button>
        )}
      </header>
      {children}
    </section>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 14,
      }}
    >
      {children}
    </div>
  )
}

function ProjectCard({
  project,
  isFavorite,
  onToggleFavorite,
  onOpen,
}: {
  project: RecentProject
  isFavorite: boolean
  onToggleFavorite: () => void
  onOpen: () => void
}) {
  const { tree, loading } = useFirstScreen(project.id)

  // While the first-screen request is in-flight, show calm pulse. When the
  // tree resolves, swap to the real ScreenRenderer view. If the project has
  // zero screens, calm pulse stays — same look as a "preview pending" state.
  const screenContent = !loading && tree ? <ScaledScreenPreview tree={tree} /> : null

  // We pass screenContent as the inner content. PhoneThumbnail's "ready"
  // state shows screenContent if provided, otherwise falls back to the
  // calm-pulse default (which is what we want when there's no screen yet).
  const phoneState =
    project.screen_count === 0 && !loading ? 'empty' : 'ready'

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 16,
        padding: 14,
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0))',
        border: '1px solid var(--dash-border)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onClick={onOpen}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(45,212,191,0.35)'
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow =
          '0 12px 30px rgba(0,0,0,0.3), 0 0 0 1px rgba(45,212,191,0.10)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--dash-border)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      aria-label={`Open ${project.name}`}
    >
      <FavoriteStar active={isFavorite} onToggle={onToggleFavorite} />

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <PhoneThumbnail
          projectName={project.name}
          screenContent={screenContent ?? undefined}
          state={phoneState}
        />
      </div>

      <h4
        style={{
          margin: '0 0 2px',
          fontSize: 13.5,
          fontWeight: 600,
          color: 'var(--dash-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        {project.name}
      </h4>
      <div
        style={{
          fontSize: 11.5,
          color: 'var(--dash-text-3)',
        }}
      >
        {project.screen_count != null
          ? `${project.screen_count} ${project.screen_count === 1 ? 'screen' : 'screens'} · `
          : ''}
        {formatRelative(project.updated_at)}
      </div>
    </div>
  )
}

function FavoriteStar({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: () => void
}) {
  // Always rendered. When unfavorited it sits at low opacity so the card
  // stays visually quiet; the card's hover handler bumps it to full opacity
  // (see ProjectCard's onMouseEnter/Leave which target this via className).
  const style: CSSProperties = {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 3,
    width: 28,
    height: 28,
    borderRadius: 8,
    border: 'none',
    background: active ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.04)',
    color: active ? 'var(--dash-accent-amber)' : 'var(--dash-text-3)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    opacity: active ? 1 : 0.45,
    transition: 'opacity 0.15s, background 0.15s, color 0.15s',
  }
  return (
    <button
      type="button"
      className="mokkoi-fav-star"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-label={active ? 'Unfavorite project' : 'Favorite project'}
      aria-pressed={active}
      data-active={active ? '1' : '0'}
      style={style}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '1'
        if (!active) e.currentTarget.style.background = 'rgba(251,191,36,0.10)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = active ? '1' : '0.45'
        if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
      }}
    >
      <Star size={15} fill={active ? 'currentColor' : 'transparent'} />
    </button>
  )
}

function SkeletonCard() {
  return (
    <div
      style={{
        borderRadius: 16,
        padding: 14,
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
        border: '1px solid var(--dash-border)',
        opacity: 0.7,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <PhoneThumbnail projectName="" state="generating" />
      </div>
      <div
        style={{
          height: 12,
          width: '60%',
          borderRadius: 4,
          background: 'rgba(255,255,255,0.06)',
          marginBottom: 6,
        }}
      />
      <div
        style={{
          height: 10,
          width: '40%',
          borderRadius: 4,
          background: 'rgba(255,255,255,0.04)',
        }}
      />
    </div>
  )
}
