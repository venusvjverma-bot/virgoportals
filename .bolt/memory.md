# Project memory

## Product intent & audience

- Virgo Portals Web App: restaurant menu portal web app with an admin dashboard.
- Admin Dashboard manages hosts, AI model integrations, default bot settings, and usage metrics.
- Host Dashboard lets individual hosts customize their AI Assistant behavior.

## Brand personality & voice

- Production-grade, clean, non-cookie-cutter UI; admin interface should feel polished and reliable.

## Visual design & UX direction

- React + Vite + Tailwind CSS + lucide-react icons; `@/` path alias maps to `src/`.
- Admin and Host dashboards share consistent layout/styling conventions.
- Established edit/save interaction pattern (reusable): read-only display → "Edit prompt" enters editing mode → "Save changes" (with saving indicator) / "Cancel" actions → unsaved-changes confirmation dialog on discard → "Saved" success indicator + error message on failure → "Reset changes" restores last saved value.
- "Use admin default" action belongs to the Host Dashboard only; intentionally omitted from Admin "Default bot text" section.

## Decisions, constraints & rationale

- Admin "Default bot text" section updated to mirror Host "AI Assistant System Prompt" edit/save behavior, including read-only initial state, Edit/Save/Cancel, unsaved-changes confirmation, success/error indicators, and existing Reset changes.
- Saves persist via existing admin storage path (`adminSaveBotText`); storage logic intentionally untouched.
- New-host default prompt provisioning and host customisation flows are out of scope and unchanged.
- Only minimal required changes were made; established Host pattern reused rather than reimplemented.

## Open questions & assumptions

- Assumes `adminSaveBotText` and Host system-prompt save handlers remain stable; future refactors should preserve the shared edit/save pattern contract.
- No explicit design tokens/theme details provided yet; current styling is inherited from existing dashboard components.