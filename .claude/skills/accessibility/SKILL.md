---
name: accessibility
description: Accessibility guidelines for web UIs — covers WCAG compliance, semantic HTML, ARIA roles/labels/states, keyboard navigation, focus management, live region announcements, accessible forms, color contrast, and screen reader compatibility. Use when creating new UI or updating existing UI features.
triggers:
  - "accessibility guidelines"
  - "wcag compliance"
  - "semantic html and aria"
  - "keyboard navigation best practices"
  - "focus management patterns"
  - "accessible forms and error handling"
  - "color contrast requirements"
  - "screen reader compatibility"
allowed-tools: [Read, Write, Edit, Bash]
---

# Accessibility — Quick Checklist

Target: WCAG 2.1 Level AA minimum for all interactive UI surfaces.

For detailed WCAG rules and code examples: read `references/full-guide.md`

---

## Semantic HTML
- [ ] Use native elements first: `<button>` for actions, `<a href>` for navigation, `<input>`/`<select>` for form controls
- [ ] Landmark regions present: `<main>`, `<nav>`, `<header>`, `<footer>`
- [ ] Heading hierarchy logical, no skipped levels (`h1` → `h2` → `h3`)
- [ ] Lists use `<ul>`/`<ol>`, tables use `<table>` for tabular data

## ARIA Labels & Roles
- [ ] Every interactive element without visible text has `aria-label` (e.g. icon-only buttons)
- [ ] Visible text associated via `aria-labelledby` or `aria-describedby` where possible
- [ ] Toggle/selection state communicated: `aria-expanded`, `aria-selected`, `aria-checked`
- [ ] Decorative elements hidden: `aria-hidden="true"` and `focusable="false"` on SVGs
- [ ] Custom widgets declare correct ARIA `role` only when native element unavailable

## Keyboard Navigation
- [ ] All interactive elements reachable via `Tab` / `Shift+Tab`
- [ ] No positive `tabIndex` values (breaks natural order)
- [ ] Composite widgets (tabs, menus, grids) use arrow key navigation + roving `tabIndex`
- [ ] Overlays and dialogs close on `Escape` and return focus to trigger

## Focus Management
- [ ] Modal dialogs trap focus inside and restore it on close
- [ ] Dynamic step/page changes move focus to the new context heading
- [ ] Long pages have a skip link as first focusable element targeting `#main-content`

## Forms
- [ ] Every input has a visible `<label>` linked via `for`/`id` (not just placeholder)
- [ ] Error messages linked with `aria-describedby`; field marked `aria-invalid={true}`
- [ ] Required fields use `required` + `aria-required="true"`
- [ ] Related fields grouped with `<fieldset>` + `<legend>`

## Color & Visual
- [ ] Text contrast ≥ 4.5:1 (normal text), ≥ 3:1 (large text and UI components)
- [ ] Information not conveyed by color alone (add icon or text)
- [ ] Focus indicators visible — never `outline: none` without a custom replacement

## Images & Media
- [ ] Informative images have descriptive `alt` text
- [ ] Decorative images use `alt=""`
- [ ] Decorative SVGs use `aria-hidden="true"` and `focusable="false"`

## Live Regions
- [ ] Dynamic errors use `role="alert"` or `aria-live="assertive"`
- [ ] Status / progress updates use `aria-live="polite"`
- [ ] Live region elements mounted in DOM before content is inserted
