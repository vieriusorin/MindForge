# UI Design Guideline — MindForge

**Normative from 2026-11-03.** Every screen, component and restyle follows this file. The
reference screenshots are in `docs/design/refs/` (`dashboard-overview.png`, `list-table.png`),
and the palette was sampled from their pixels. When something here doesn't settle a
question, match the references, not your default taste.

**The look:** a white work area framed by a deep-indigo inset sidebar, with rounded cards. A deep-indigo sidebar and
briefing banner give it weight, violet is the single action colour, and status shows as small
badges.

## 1. shadcn/ui only — no hand-made components

- **Every UI element is a shadcn component installed with the CLI**
  (`pnpm dlx shadcn@latest add <name>`; config in `components.json`, style `radix-nova`).
  If a screen needs a primitive that isn't installed, **add it with the CLI**. Don't build a
  look-alike (a custom nav link, skeleton, avatar, tooltip, pill or chart).
- Installed: `avatar badge base-node button card chart checkbox dropdown-menu field input label
  radio-group select separator sheet sidebar skeleton tooltip` (`base-node` from the React Flow UI
  registry, `https://ui.reactflow.dev/base-node`). Check `src/components/ui/` before adding.
- `src/components/ui/**` is shadcn-owned. It's formatted, not linted (`biome.json` override).
  Customise a screen through `className` and tokens. Edit the primitive only to change it
  project-wide.
- Icons come from `lucide-react` only. **No emoji in the UI.** Forest stages use `STAGE_ICON` (Bean, Sprout, Leaf, TreeDeciduous, TreePine), rendered through the shared `StageIcon` (`src/components/stage-icon/`, a tinted shadcn `Avatar` tile).
- Charts use shadcn `Chart` (`ChartContainer`, `ChartTooltip`, `ChartLegend`) over Recharts,
  and colours come from `ChartConfig` → `var(--chart-n)`. Set `isAnimationActive={false}`
  and keep legend order with `itemSorter={null}`.
- **Diagrams** (ADR 0003): render `DiagramFigure` (`src/components/diagram-figure/`) and nothing
  else. It draws the graph with React Flow (`src/components/flow-diagram/`, nodes on the
  shadcn-registry `BaseNode` in `src/components/ui/base-node.tsx`), loads it lazily through
  `flow-diagram-lazy.tsx`, hides the drawing from assistive tech and reads the steps and connections
  as lists. No Mermaid, no hand-positioned nodes: dagre lays the graph out. The drawing is
  read-only (no drag, pan, zoom or focus); interactive diagrams belong to the Diagram Builder.
- Forms use the `Field` family (`Field`, `FieldLabel htmlFor`, `FieldError errors=[…]`) plus
  `Input` and `Select`. See the `ui-shadcn` skill.
- Known trap: `SidebarMenuSkeleton` calls `Math.random()`, which fails the Cache
  Components prerender. Use `Skeleton` inside `SidebarMenuItem` instead.

## 2. Theme — tokens only

The palette lives in **shadcn's own variables** in `src/app/globals.css` (`:root` and `.dark`).
Components use the semantic classes (`bg-card`, `text-muted-foreground`, `bg-primary`,
`bg-sidebar`, `fill-chart-4`…). **Never use raw palette classes** (`emerald-700`, `zinc-500`)
or hex values in components. The one exception is white text and `bg-white/10` glass
*inside* `bg-hero`.

| Token | Light | Used for |
|---|---|---|
| `background` | `#ffffff` | white work area inside the inset frame (lavender lives in `muted`/`secondary`) |
| `card` | `#f7f6fc` | lavender cards on the white work area |
| `popover` | `#ffffff` | menus, tooltips |
| `foreground` | `#17143a` | navy ink |
| `muted-foreground` | `#6a6788` | meta text, ≥ 4.5:1 on white, card and muted (sampled `#8a88a3` failed AA; don't restore it) |
| `primary` | `#7259d6` | violet actions, active bar, focus ring |
| `secondary` / `accent` | `#e9e4fb` / `#ebe7fb`, text `#4a36b0` | soft badges, icon tiles, hover |
| `destructive` | `#b02e3e` | errors, "Fading" |
| `chart-1 … chart-5` | `#d9d3f5 → #4a36b0` | one violet hue, light → dark. Forest stages seed → ancient. "Not yet" = chart-1, "Growing" = chart-4 |
| `sidebar*` | `#2a1f6e`, accent `white/12%` | deep-indigo sidebar |

Two brand utilities exist, and only these two:
- `bg-hero`: indigo with a violet/pink glow, for the briefing banner card and the wordmark
  tile.
- `bg-backdrop`: violet → pink → cream, for the sign-in and join pages only.

**Theming is on from day one:** `next-themes` (`src/components/theme-provider.tsx`,
`attribute="class"`, default `system`), with the `ModeToggle` (light / dark / system) in both
headers.
- The dark tokens are derived, because the references are light-only. Keep three distinct dark layers (canvas `#0f0c27` < card `#1b1742` < indigo sidebar `#1d1658`) and a chart ramp bright enough to read on a card.
- Every new token needs a value in both `:root` and `.dark`.
- Never write per-component `dark:` colour overrides. The tokens switch.

## 3. Layout patterns

1. **Signed-in shell:** `SidebarProvider` → `Sidebar variant="inset" collapsible="icon"` +
   `SidebarRail` + `SidebarInset`.
   - The header holds `SidebarTrigger` (⌘/Ctrl+B) and `ModeToggle`.
   - Every `SidebarMenuButton` carries a `tooltip`, so the icon-only mode stays usable.
   - Groups: Workspace, Play ("Soon" badges until a mode exists), Pinned (≤ 3 groups), and a
     footer with the user `Avatar` and sign-out.
   - On mobile the sidebar becomes a `Sheet` automatically.
2. **Full width:** page content fills `SidebarInset` (`w-full px-4 md:px-8`). There's no `max-w-*` container on app screens. The dashboard grid is `items-start`, so cards size to their content.
3. **Page header:** a small uppercase muted context line, then `h1` (Work Sans semibold,
   `text-3xl md:text-4xl`).
4. **Briefing banner:** a `Card` with `bg-hero` holding up to three `Card size="sm"`
   glass tiles. Use one per page at most.
5. **Lists:** a `Card` with rows split by `Separator`. Each row has an `Avatar`, a bold title,
   a muted meta line with a `Badge`, and a right-aligned figure.
6. **People are avatars, never name chips:** an `AvatarGroup` of `Avatar` + `AvatarFallback`
   (initials from `src/lib/initials.ts`), with the name in a `Tooltip` and `aria-label`, and
   `AvatarBadge` for admins.
7. **Charts:** stacked bars (grown on chart-4, rest on chart-1) and a donut with the centred
   figure. Below it, every stage is listed with its icon, its meaning (`STAGE_HINT`, built from `FOREST_THRESHOLDS`) and its count, and a 0% state says why it is 0. Every number on screen comes from
   `summarizeForest` in `src/engine/forest`. Never do arithmetic in a component.

## 4. Type

**Work Sans** for everything (`--font-work-sans` → `font-sans`). Geist Mono for code and
links. Use `tabular-nums` on every figure.

## 5. Accessibility (non-negotiable)

- Text contrast is ≥ 4.5:1 for every token pair.
- Never rely on colour alone: badges carry words, and charts carry legends and tooltips.
- Keep shadcn's focus rings. Interactive targets are ≥ 40px on touch layouts.
