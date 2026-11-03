---
name: accessibility
description: Accessibility guidelines for web UIs — covers WCAG compliance, semantic HTML, ARIA roles/labels/states, keyboard navigation, focus management, live region announcements, accessible forms, color contrast, and screen reader compatibility. Applies to both new interactive UI surfaces and updates to existing features. Use when creating new UI or updating existing UI features.
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

When adding or modifying any **interactive UI surface** — a dialog, form, widget, panel, navigation, dropdown, or any component the user interacts with — you must ensure it meets **WCAG 2.1 Level AA** requirements at minimum.

The sections below cover the key areas. Sections 1–4 are required for new interactive components. Sections 5–8 apply broadly to any UI change.

---

## 1. Semantic HTML — Use Native Elements First

Always prefer native HTML elements over custom elements with ARIA. Native elements come with built-in keyboard support, roles, and states at no extra cost.

```html
<!-- ✅ Native button — keyboard accessible, role="button" built in -->
<button type="button" onClick={handleClick}>Save</button>

<!-- ❌ Custom div button — requires manual ARIA and keyboard handling -->
<div onClick={handleClick}>Save</div>

<!-- ✅ Native checkbox -->
<input type="checkbox" id="agree" name="agree" />
<label for="agree">I agree to the terms</label>

<!-- ✅ Native select -->
<select aria-label="Country">
  <option value="ro">Romania</option>
  <option value="uk">United Kingdom</option>
</select>
```

**Native element checklist:**
- Use `<button>` for actions, `<a href>` for navigation
- Use `<input>`, `<textarea>`, `<select>` for form controls
- Use `<nav>`, `<main>`, `<header>`, `<footer>`, `<aside>`, `<section>`, `<article>` as landmark regions
- Use `<h1>`–`<h6>` for headings in logical order (never skip levels)
- Use `<ul>` / `<ol>` for lists, `<table>` for tabular data

---

## 2. ARIA Labels, Roles, and States

Use ARIA only when native HTML semantics are insufficient. ARIA does not add behavior — it only communicates information to assistive technology.

### `aria-label` and `aria-labelledby`

Every interactive element must have an accessible name.

```tsx
// ✅ Icon-only button — no visible text, needs aria-label
<button type="button" aria-label="Close dialog">
  <XIcon aria-hidden="true" />
</button>

// ✅ Associate with visible heading using aria-labelledby
<section aria-labelledby="section-title">
  <h2 id="section-title">Energy Summary</h2>
  {/* content */}
</section>

// ✅ Add additional context with aria-describedby
<input
  type="password"
  id="password"
  aria-describedby="password-hint"
/>
<p id="password-hint">Must be at least 8 characters.</p>
```

### `aria-expanded`, `aria-selected`, `aria-checked`

Communicate toggle/selection state explicitly.

```tsx
// ✅ Accordion trigger
<button
  type="button"
  aria-expanded={isOpen}
  aria-controls="panel-id"
>
  Section Title
</button>
<div id="panel-id" hidden={!isOpen}>
  {/* content */}
</div>

// ✅ Custom tab
<div role="tab" aria-selected={isActive} tabIndex={isActive ? 0 : -1}>
  Overview
</div>

// ✅ Custom checkbox
<div
  role="checkbox"
  aria-checked={isChecked}
  tabIndex={0}
  onKeyDown={handleKeyDown}
>
  Accept terms
</div>
```

### `aria-hidden`

Hide decorative or redundant elements from the accessibility tree.

```tsx
// ✅ Decorative icon next to text label
<button type="button">
  <StarIcon aria-hidden="true" />
  Add to favourites
</button>

// ✅ Decorative illustration
<img src="/illustration.svg" alt="" aria-hidden="true" />

// ❌ Never hide interactive elements
<button aria-hidden="true">Submit</button>
```

### ARIA Roles

Use roles only when you cannot use a native element.

```tsx
// ✅ Custom toolbar
<div role="toolbar" aria-label="Text formatting">
  <button type="button" aria-pressed={isBold}>Bold</button>
  <button type="button" aria-pressed={isItalic}>Italic</button>
</div>

// ✅ Custom list when ul/ol is not appropriate
<div role="list">
  <div role="listitem">Item 1</div>
  <div role="listitem">Item 2</div>
</div>
```

**Avoid generic labels.** Instead of `aria-label="button"` or `aria-label="icon"`, describe the action: `"Close dialog"`, `"Delete file"`, `"Toggle sidebar"`.

---

## 3. Keyboard Navigation

Every interactive element must be fully operable via keyboard without requiring a mouse.

### Focus Order

Tab order must follow the visual reading order (top-to-bottom, left-to-right). Avoid `tabIndex` values greater than `0` — they create unexpected tab order.

```tsx
// ✅ Natural DOM order — no tabIndex needed
<nav>
  <a href="/dashboard">Dashboard</a>
  <a href="/settings">Settings</a>
</nav>

// ✅ Remove from tab order (still focusable programmatically)
<div tabIndex={-1} ref={panelRef}>

// ❌ Avoid positive tabIndex — breaks natural tab order
<button tabIndex={3}>Submit</button>
```

### Arrow Key Navigation

Composite widgets (menus, listboxes, tabs, toolbars, grids) must support arrow key navigation internally. Only one item in the composite should be in the tab stop at a time (roving `tabIndex` pattern).

```tsx
// Roving tabIndex pattern for a tab list
const [activeTab, setActiveTab] = useState(0);

tabs.map((tab, index) => (
  <button
    key={tab.id}
    role="tab"
    aria-selected={index === activeTab}
    tabIndex={index === activeTab ? 0 : -1}
    onKeyDown={(e) => {
      if (e.key === 'ArrowRight') setActiveTab((i) => (i + 1) % tabs.length);
      if (e.key === 'ArrowLeft') setActiveTab((i) => (i - 1 + tabs.length) % tabs.length);
    }}
  >
    {tab.label}
  </button>
))
```

### Escape to Dismiss

Overlays, dialogs, drawers, and popups must close on `Escape` and return focus to the trigger element.

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [onClose]);
```

---

## 4. Focus Management

Manage focus deliberately when UI changes dynamically (dialogs open/close, steps change, errors appear).

### Modal Dialogs — Focus Trap

When a modal opens, focus must move into it and remain trapped inside until it is dismissed.

```tsx
// Use a library like focus-trap-react or @radix-ui/react-dialog
// which handles focus trapping automatically.

// Manual pattern:
useEffect(() => {
  if (isOpen) {
    previousFocusRef.current = document.activeElement as HTMLElement;
    firstFocusableRef.current?.focus();
  } else {
    previousFocusRef.current?.focus(); // restore focus on close
  }
}, [isOpen]);
```

**Requirements:**
- Focus moves to the first focusable element (or the dialog container) when it opens
- `Tab` and `Shift+Tab` cycle only within the dialog
- `Escape` closes the dialog and returns focus to the trigger
- Scrollable content behind the dialog must be inert (`inert` attribute or `aria-hidden="true"` on the root)

### Multi-step Forms and Dynamic Content

When the user advances to a new step or content loads dynamically, move focus to the new context.

```tsx
const stepRef = useRef<HTMLHeadingElement>(null);

useEffect(() => {
  stepRef.current?.focus();
}, [currentStep]);

// In JSX
<h2 ref={stepRef} tabIndex={-1}>Step {currentStep}: Personal Details</h2>
```

### Skip Links

Long pages with repetitive navigation must provide a skip link as the first focusable element.

```html
<a href="#main-content" class="sr-only focus:not-sr-only">
  Skip to main content
</a>
<main id="main-content">
  <!-- page content -->
</main>
```

---

## 5. Live Region Announcements

Announce dynamic content changes to screen readers using ARIA live regions.

### `aria-live="assertive"` — Urgent / Errors

Interrupts the screen reader immediately. Use sparingly.

```tsx
// Error message that must be communicated right away
<div role="alert" aria-live="assertive">
  {error && <p>{error.message}</p>}
</div>
```

### `aria-live="polite"` — Informational / Status

Announced when the screen reader is idle. Preferred for most updates.

```tsx
// Status update after a background operation
<div aria-live="polite" aria-atomic="true">
  {statusMessage && <p>{statusMessage}</p>}
</div>
```

### Guidelines

- **Prefer polite** unless the information is time-sensitive or directly caused by a user action
- **Keep messages concise** — screen readers read the entire message
- **Do not duplicate** — if a visual state change is already obvious, avoid double-announcing
- Mount live region elements in the DOM before populating them — inserting a live region and its content at the same time may not be announced
- Use `aria-atomic="true"` when the entire region should be read as a unit on any change

---

## 6. Accessible Forms

Forms are a common source of accessibility failures. Apply these patterns consistently.

### Label Every Control

```tsx
// ✅ Explicit label with htmlFor
<label htmlFor="email">Email address</label>
<input type="email" id="email" name="email" />

// ✅ Wrapped label
<label>
  Phone number
  <input type="tel" name="phone" />
</label>

// ❌ Placeholder is not a label — it disappears on input
<input type="email" placeholder="Email address" />
```

### Error Messages

Link error messages to their input using `aria-describedby`. Add `aria-invalid` to mark invalid fields.

```tsx
<input
  type="email"
  id="email"
  aria-invalid={!!errors.email}
  aria-describedby={errors.email ? 'email-error' : undefined}
/>
{errors.email && (
  <p id="email-error" role="alert">
    {errors.email.message}
  </p>
)}
```

### Required Fields

```tsx
<label htmlFor="name">
  Full name <span aria-hidden="true">*</span>
</label>
<input
  type="text"
  id="name"
  required
  aria-required="true"
/>
```

### Grouping Related Fields

```tsx
<fieldset>
  <legend>Delivery address</legend>
  <label htmlFor="street">Street</label>
  <input type="text" id="street" name="street" />
  <label htmlFor="city">City</label>
  <input type="text" id="city" name="city" />
</fieldset>
```

---

## 7. Color and Visual Design

### Color Contrast — WCAG AA Minimums

| Content type | Minimum contrast ratio |
|---|---|
| Normal text (< 18pt / 14pt bold) | 4.5 : 1 |
| Large text (≥ 18pt / 14pt bold) | 3 : 1 |
| UI components and graphical objects | 3 : 1 |

Tools to check: browser DevTools accessibility panel, [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/).

### Never Use Color Alone to Convey Information

```tsx
// ❌ Color-only error indicator
<input style={{ borderColor: isError ? 'red' : 'gray' }} />

// ✅ Color + icon + text
<input
  className={isError ? 'border-red-500' : 'border-gray-300'}
  aria-invalid={isError}
/>
{isError && (
  <p className="text-red-600 flex items-center gap-1">
    <ErrorIcon aria-hidden="true" />
    This field is required
  </p>
)}
```

### Focus Indicators

Never remove the default browser focus outline without providing a custom visible replacement.

```css
/* ❌ Do not do this */
:focus { outline: none; }

/* ✅ Replace with a custom visible indicator */
:focus-visible {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}
```

---

## 8. Images and Media

### Images

```tsx
// ✅ Informative image — describe what it conveys
<img src="/chart.png" alt="Energy consumption rose 12% in January compared to December" />

// ✅ Decorative image — empty alt suppresses announcement
<img src="/decoration.svg" alt="" />

// ✅ Functional image (link/button) — describe the destination/action
<a href="/dashboard">
  <img src="/logo.png" alt="Acme — go to dashboard" />
</a>
```

### SVG Icons

```tsx
// ✅ Decorative SVG — hidden from screen readers
<svg aria-hidden="true" focusable="false">
  <use href="#icon-star" />
</svg>

// ✅ Standalone meaningful SVG — needs a title
<svg role="img" aria-labelledby="chart-title">
  <title id="chart-title">Monthly energy consumption</title>
  {/* chart paths */}
</svg>
```

---

## Checklist for Every New Feature

### Semantic structure
- [ ] Native HTML elements used wherever possible (`<button>`, `<a>`, `<input>`, `<select>`)
- [ ] Heading hierarchy is logical and does not skip levels
- [ ] Landmark regions present (`<main>`, `<nav>`, `<header>`, `<footer>`)

### ARIA
- [ ] Every interactive element without visible text has a descriptive `aria-label`
- [ ] `aria-labelledby` / `aria-describedby` used to associate existing visible text
- [ ] Custom widgets declare the correct ARIA `role`
- [ ] Toggle/selection state communicated via `aria-expanded`, `aria-selected`, `aria-checked`
- [ ] Decorative and redundant elements hidden with `aria-hidden="true"`

### Keyboard navigation
- [ ] All interactive elements reachable and operable via `Tab` / `Shift+Tab`
- [ ] Composite widgets (menus, tabs, grids) use arrow key navigation with roving `tabIndex`
- [ ] No positive `tabIndex` values
- [ ] `Escape` dismisses overlays and returns focus to the trigger

### Focus management
- [ ] Modal dialogs trap focus and restore it on close
- [ ] Dynamic step/page changes move focus to the new context
- [ ] Long pages have a skip link targeting `#main-content`

### Forms
- [ ] Every input has a visible `<label>` associated via `for` / `id`
- [ ] Error messages linked with `aria-describedby` and field marked `aria-invalid`
- [ ] Required fields use `required` + `aria-required="true"`
- [ ] Related fields grouped with `<fieldset>` + `<legend>`

### Visual
- [ ] Color contrast meets WCAG AA (4.5:1 for text, 3:1 for UI components)
- [ ] Information is not conveyed by color alone
- [ ] Focus indicators are visible (never `outline: none` without a replacement)

### Images and media
- [ ] Informative images have descriptive `alt` text
- [ ] Decorative images use `alt=""`
- [ ] Decorative SVGs use `aria-hidden="true"` and `focusable="false"`

### Live regions
- [ ] Dynamic error messages use `role="alert"` or `aria-live="assertive"`
- [ ] Status/progress updates use `aria-live="polite"`
- [ ] Live region elements are present in DOM before content is inserted
