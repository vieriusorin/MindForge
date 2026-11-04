# Diagrams are graphs, drawn with React Flow

Decided 2026-11-04 by the user, in MF-0010's DESIGN stage. Replaces the Mermaid format MF-0006 set
(MINDFORGE §2.5 "Format: Mermaid").

A diagram item (`packs/<slug>/diagrams/<skill>.yaml`) is a **graph**: a `direction` (`LR` or
`TB`), `nodes` (`id`, `label`, optional `shape: step | decision`) and `edges` (`from`, `to`,
optional `label`). The engine schema (`src/engine/content/schema.ts`) rejects a duplicate node id,
an edge to an unknown node and an unknown direction, each with a path-named error. Positions are
never written by hand: `dagre` lays the graph out at render time.

The app draws it with **React Flow** (`@xyflow/react`) in `src/components/flow-diagram/`, nodes
built on the shadcn-registry `BaseNode` from React Flow UI
(`pnpm dlx shadcn@latest add https://ui.reactflow.dev/base-node`, kept in `src/components/ui/`).
Screens never import it directly: they render `DiagramFigure` (`src/components/diagram-figure/`),
which loads the drawing through `flow-diagram-lazy.tsx` (`next/dynamic`, `ssr: false`) and puts the
words in front of assistive tech: the title names the figure, and the steps and every connection
are lists. The drawing is `aria-hidden` and fully non-interactive (no drag, pan, zoom, focus).

**Why:** the user asked for a professional look that matches the design system. React Flow draws
nodes as our own components with our tokens (light and dark without overrides) and is the tool the
Diagram Builder (drag nodes and arrows, W3) needs anyway, so one format and one renderer serve both
the read-only diagram and the game. A graph in YAML is as diffable and reviewable as Mermaid text,
validates in plain Node (Mermaid needed jsdom just to parse, MF-0006 C-1), and gives the Diagram
Builder its edges directly instead of parsing them out of Mermaid.

**Consequences:**
- `mermaid` is removed from the dependencies, with its jsdom parse check
  (`mf-0006-mermaid.acceptance.test.ts`, retired in MF-0006 FROZEN.json history).
- Sequence diagrams (client ↔ MCP server ↔ tool) are out of v1: they are not a node graph. A
  process flow, decision tree, state flow or concept map is.
- Writers (MF-0014 DiagramWriter) output this YAML; the Verifier's "Mermaid parses" becomes "passes
  the diagram schema".
- A new diagram kind or node shape is a schema change: add it to `DIAGRAM_NODE_SHAPES` /
  `DIAGRAM_DIRECTIONS`, the node view and this ADR.
