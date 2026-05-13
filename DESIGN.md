---
name: Focus & Utility
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#4c4546'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1b1b1b'
  on-tertiary-container: '#848484'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c6'
  on-tertiary-fixed: '#1b1b1b'
  on-tertiary-fixed-variant: '#474747'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  h1:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.02em
  mono-label:
    fontFamily: monospace
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-max: 768px
---

## Brand & Style

The design system is engineered for deep work and high productivity. It prioritizes information density and clarity over decorative elements, catering to a developer-centric audience that values efficiency and logical structure. The brand personality is disciplined, unobtrusive, and precise.

The aesthetic follows a **Minimalist** approach with a focus on **Utility**. It utilizes a strict typographic hierarchy and generous whitespace to reduce visual noise, allowing the user's tasks to remain the primary focus. Surfaces are defined by structural borders rather than heavy shadows, creating a layout that feels systematic and architectural.

## Colors

The palette is rooted in a neutral spectrum to maintain a professional, calm environment. Pure black (#000000) is reserved for primary text and high-contrast actions, while a range of cool grays provides structural definition and secondary information.

Colors are used sparingly and only for functional purposes:
- **Priority 1 (P1):** A sharp red for immediate attention.
- **Priority 2 (P2):** An amber-orange for moderate urgency.
- **Priority 3 (P3):** A bright blue for scheduled tasks.
- **Status/Success:** A vibrant green used exclusively for completion states and successful system feedback.
- **Backgrounds:** Off-white surfaces (#F8FAFC) distinguish the workspace from the primary application background, reducing eye strain during long sessions.

## Typography

This design system utilizes **Inter** for all interface elements. Inter was selected for its exceptional legibility in digital interfaces and its neutral, systematic character. 

The type system is built on a tight scale to ensure consistency across the task list and metadata labels. Body copy defaults to 14px for optimal density, while 16px is reserved for task entry and primary content. Metadata, such as due dates and priority tags, utilize the 12px label style. For developer-centric features like keyboard shortcuts or ID references, a monospaced font stack is permitted to distinguish system-level data from user-generated content.

## Layout & Spacing

The layout philosophy is a **two-column desktop grid** modeled on Slack and Obsidian: a fixed 240px sidebar on the left and a flexible main pane on the right that expands to fill the rest of the window. The top app bar spans the full window width above the grid. The default window opens at 1280×800 (min 800×600) and the workspace stretches to fill whatever horizontal space is available — no centered reading column at the workspace level. The `container-max` token remains available for future narrow components (e.g. a dialog or focused composer), but is not applied to the main pane.

A strict 4px/8px base-8 spacing rhythm is applied globally.
- **Margins:** Use 24px (lg) or 32px (xl) for outer container margins to create a sense of focus.
- **Guttering:** Task items and list elements use 8px (sm) vertical spacing to balance density and touch/click targets.
- **Alignment:** All elements should align to the left vertical axis to create a clear "line of sight" for rapid task scanning.

## Elevation & Depth

This design system utilizes **Low-contrast outlines** and **Tonal layers** rather than traditional drop shadows. This approach maintains the minimalist aesthetic and keeps the interface feeling "flat" and lightweight.

- **Surface 0:** The primary application background (#F8FAFC).
- **Surface 1:** The main workspace and cards (#FFFFFF), defined by a 1px solid border (#E2E8F0).
- **Active State:** Elements being dragged or interacted with may use a very subtle, diffused shadow (0px 4px 12px rgba(0,0,0,0.05)) to provide temporary depth.
- **Separators:** Use 1px borders (#F1F5F9) to divide list items, ensuring a clean horizontal rhythm without adding visual weight.

## Shapes

The shape language is **Soft**, utilizing a consistent 4px (0.25rem) corner radius for most UI elements. This subtle rounding softens the professional "technical" edge of the system without making it feel overly consumer-focused or playful.

- **Small elements (Checkboxes, Tags):** 4px radius.
- **Containers (Task Cards, Modals):** 8px (0.5rem) radius.
- **Inputs:** 4px radius to maintain a crisp, structured appearance.

## Components

### Buttons
Buttons are strictly functional. Primary buttons use a solid black background with white text. Secondary buttons use a white background with a 1px border. Icon-only buttons should be used for common actions like "delete" or "edit," appearing only on hover of a task item.

### Task Items
Each task is a horizontal row with a fixed height. It consists of a custom checkbox on the left, the task description in the center, and priority/metadata tags on the right. The row should highlight slightly on hover to indicate interactivity.

### Checkboxes
Checkboxes are custom-styled 18px squares with a 4px radius. When checked, they transition to a "success" green or black, and the associated task text should receive a strikethrough and a secondary gray color.

### Priority Chips
Chips are small, 12px label-based badges. They use a low-opacity background of the priority color (e.g., 10% red) with high-contrast text of the same hue to ensure readability without being distracting.

### Command Bar
A floating or fixed input bar at the bottom or top of the list, resembling a command-line interface. It should use a larger font size (16px) and include subtle "CMD+K" or "Press Enter" hints in a monospaced label style.

### Keyboard Shortcut Indicators
Small, outlined "keys" using the monospaced label style. These should be placed near actionable items to educate the developer-user on efficiency.