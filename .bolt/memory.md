# Project memory

## Product intent & audience

- Virgo Portals Web App: restaurant menu portal web app with an admin dashboard.
- Admin Dashboard manages hosts, AI model integrations, default bot settings, and usage metrics.
- Host Dashboard lets individual hosts customize their AI Assistant behavior.

## Brand personality & voice

- Production-grade, clean, non-cookie-cutter UI; admin interface should feel polished and reliable.
- Navigation strips are pure navigation — do not clutter with action/utility icons that belong elsewhere.

## Visual design & UX direction

- React + Vite + Tailwind CSS + lucide-react icons; `@/` path alias maps to `src/`.
- Admin and Host dashboards share consistent layout/styling conventions.
- Host Department and Event navigation strip contains exactly: Details | Menu | Bot | QR | Theme | Printer. No basket, reset, or other action icons belong here.
- Established edit/save interaction pattern (reusable): read-only display → "Edit prompt" enters editing mode → "Save changes" (with saving indicator) / "Cancel" actions → unsaved-changes confirmation dialog on discard → "Saved" success indicator + error message on failure → "Reset changes" restores last saved value.
- "Use admin default" action belongs to the Host Dashboard only; intentionally omitted from Admin "Default bot text" section.

## Decisions, constraints & rationale

- Removed ShoppingBasket and RotateCcw icons from Host Department and Event navigation strip; restored strip to original six navigation buttons only.
- Navigation strips must remain navigation-only; action controls should live in their appropriate sections, not mixed into nav bars.
- Admin "Default bot text" section mirrors Host "AI Assistant System Prompt" edit/save behavior, including read-only initial state, Edit/Save/Cancel, unsaved-changes confirmation, success/error indicators, and existing Reset changes.
- Saves persist via existing admin storage path (`adminSaveBotText`); storage logic intentionally untouched.
- New-host default prompt provisioning and host customisation flows are out of scope and unchanged.

## Open questions & assumptions

- Assumes `adminSaveBotText` and Host system-prompt save handlers remain stable; future refactors should preserve the shared edit/save pattern contract.
- No explicit design tokens/theme details provided yet; current styling is inherited from existing dashboard components.
- Future feature additions to navigation strips should be confirmed before adding icons — user does not want unexpected controls in nav bars.