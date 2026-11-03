# Accessibility Reference

Detailed patterns for focus management, live regions, accessible forms, color contrast, screen reader compatibility, and images/media.

---

## Focus Management

### Modal Dialogs — Focus Trap

When a modal opens, focus must move into it and remain trapped inside until dismissed.

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
- Focus moves to the first focusable element (or dialog container) when it opens
- `Tab` and `Shift+Tab` cycle only within the dialog
- `Escape` closes the dialog and returns focus to the trigger
- Background content must be inert (`inert` attribute or `aria-hidden="true"` on the root)

### Multi-step Forms and Dynamic Content

When the user advances to a new step or content loads dynamically, move focus to the new context.

```tsx
const stepRef = useRef<HTMLHeadingElement>(null);

useEffect(() => {
  stepRef.current?.focus();
}, [currentStep]);

// In JSX — tabIndex={-1} makes non-interactive elements programmatically focusable
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

## Live Region Announcements

Announce dynamic content changes to screen readers using ARIA live regions.

### `aria-live="assertive"` — Urgent / Errors

Interrupts the screen reader immediately. Use sparingly — only for errors directly caused by user action.

```tsx
<div role="alert" aria-live="assertive">
  {error && <p>{error.message}</p>}
</div>
```

### `aria-live="polite"` — Informational / Status

Announced when the screen reader is idle. Preferred for most updates.

```tsx
<div aria-live="polite" aria-atomic="true">
  {statusMessage && <p>{statusMessage}</p>}
</div>
```

### Guidelines

- Prefer `polite` unless information is time-sensitive or directly caused by a user action
- Keep messages concise — screen readers read the entire message
- Do not duplicate — if a visual state change is already obvious, avoid double-announcing
- Mount live region elements in the DOM **before** populating them — inserting a region and its content simultaneously may not trigger announcement
- Use `aria-atomic="true"` when the entire region should be read as a unit on any change

---

## Accessible Forms

Forms are a common source of accessibility failures. Apply these patterns consistently.

### Label Every Control

```tsx
// Explicit label with htmlFor
<label htmlFor="email">Email address</label>
<input type="email" id="email" name="email" />

// Wrapped label
<label>
  Phone number
  <input type="tel" name="phone" />
</label>

// Placeholder alone is not a label — it disappears on input
// <input type="email" placeholder="Email address" />  — wrong
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

## Color Contrast Requirements

### WCAG AA Minimums

| Content type | Minimum contrast ratio |
|---|---|
| Normal text (< 18pt / 14pt bold) | 4.5 : 1 |
| Large text (>= 18pt / 14pt bold) | 3 : 1 |
| UI components and graphical objects | 3 : 1 |

Tools: browser DevTools accessibility panel, [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/).

### Never Use Color Alone to Convey Information

```tsx
// Color-only error indicator — wrong
<input style={{ borderColor: isError ? 'red' : 'gray' }} />

// Color + icon + text — correct
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
/* Do not do this */
:focus { outline: none; }

/* Replace with a custom visible indicator */
:focus-visible {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}
```

---

## Screen Reader Compatibility

### Toolbar Pattern

```tsx
<div role="toolbar" aria-label="Text formatting">
  <button type="button" aria-pressed={isBold}>Bold</button>
  <button type="button" aria-pressed={isItalic}>Italic</button>
</div>
```

### Custom List

```tsx
<div role="list">
  <div role="listitem">Item 1</div>
  <div role="listitem">Item 2</div>
</div>
```

### Testing with Screen Readers

- **macOS**: VoiceOver (`Cmd + F5`)
- **Windows**: NVDA (free) or JAWS
- **iOS**: VoiceOver (triple-click home/side button)
- **Android**: TalkBack

Common test scenarios:
1. Tab through all interactive elements — confirm each has a meaningful name
2. Open and close dialogs — confirm focus moves in and is restored on close
3. Submit a form with errors — confirm errors are announced
4. Trigger status updates — confirm live regions announce changes
5. Navigate headings — confirm heading hierarchy is logical

---

## Images and Media

### Images

```tsx
// Informative image — describe what it conveys
<img src="/chart.png" alt="Energy consumption rose 12% in January compared to December" />

// Decorative image — empty alt suppresses announcement
<img src="/decoration.svg" alt="" />

// Functional image (link/button) — describe the destination/action
<a href="/dashboard">
  <img src="/logo.png" alt="Acme — go to dashboard" />
</a>
```

### SVG Icons

```tsx
// Decorative SVG — hidden from screen readers
<svg aria-hidden="true" focusable="false">
  <use href="#icon-star" />
</svg>

// Standalone meaningful SVG — needs a title
<svg role="img" aria-labelledby="chart-title">
  <title id="chart-title">Monthly energy consumption</title>
  {/* chart paths */}
</svg>
```

### Video and Audio

- Provide captions for all video content with speech
- Provide transcripts for audio-only content
- Do not autoplay media with sound
- Ensure media player controls are keyboard accessible
