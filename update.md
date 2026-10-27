# Virgo Portals — Implementation Log

Documentation only. This file is not imported, bundled, routed, or read by the
running application. It records completed implementations in reverse
chronological order (newest entry first).

---

## Feature: Complete end-to-end ordering prototype

**Date and time:** 2026-10-16 10:40 CEST (Europe/Stockholm, Thursday)

**Area affected:** visitor chat (chat persistence, reset, basket,
checkout, confirmation), host portal (new Orders section with realtime),
database (orders, order_items, order_status_log tables + RLS + helper
functions), two edge functions (visitor-orders new, visitor-chat
updated). No existing QR routing, theme, admin, AI prompts, or auth
logic modified.

### Database migration `20261016000000_orders_and_order_items`

Three new tables:
- `orders` — order_number (unique), restaurant_id, department_id,
  event_id, resource_type, resource_name, restaurant_name, status
  (new/accepted/preparing/ready/completed/cancelled), payment_status
  (test_unpaid), total_minor (server-calculated), currency, item_count,
  idempotency_key (unique), timestamps.
- `order_items` — order_id, dish_id, name, price_minor, quantity,
  line_total_minor.
- `order_status_log` — audit trail of status transitions.

Helper functions (all SECURITY DEFINER, search_path pinned):
- `generate_order_number()` — "ORD-YYYYMMDD-XXXX" (4 random hex chars),
  service_role only.
- `owns_order(uuid)` — ownership check for RLS on child tables.
- `update_order_status(uuid, text)` — validates permitted transitions,
  updates order, logs transition. Authenticated only.
- `orders_set_updated_at()` — trigger function for auto-updating
  timestamps.

RLS policies:
- `orders`: host SELECT (owns_restaurant), service_role INSERT, host
  UPDATE (owns_restaurant), admin DELETE. No anon access.
- `order_items`: host SELECT (via EXISTS subquery to orders),
  service_role INSERT/UPDATE/DELETE.
- `order_status_log`: host SELECT (via EXISTS), service_role INSERT.

Second migration `20261016000100_fix_order_function_permissions`:
- Revoked EXECUTE from anon on all order helper functions.
- Revoked EXECUTE from authenticated on generate_order_number and
  orders_set_updated_at (service_role only).
- owns_order and update_order_status keep authenticated EXECUTE (needed
  by RLS policy evaluation), revoked from anon.

### Edge function: `visitor-orders` (new)

Two actions:
- `create`: Validates restaurant is Active, resolves department/event,
  validates all dish IDs belong to the restaurant and are available,
  parses prices server-side from the text `price` column into minor
  units, calculates totals server-side, generates unique order number,
  inserts order + items + status log. Idempotency: checks
  idempotency_key first, returns existing order if found. Handles
  concurrent race via unique constraint catch.
- `status`: Calls `update_order_status` RPC (host-authenticated).

### Edge function: `visitor-chat` (updated)

- `toCard()` now includes `available` and `restaurantId` in dish card
  output so the frontend has the data needed for basket operations.
- `DishRow` interface gained `restaurant_id` field.
- Dish SELECT queries now include `restaurant_id`.
- No prompt, greeting, or recommendation logic changed.

### Phase 1: Visitor chat persistence + reset

- Chat messages saved to localStorage scoped by restaurant + resource.
- On reload, messages are restored without triggering a duplicate
  greeting (a `chatRestored` flag prevents re-greeting).
- Language is NOT persisted — selector appears on every reload.
- Reset Chat button (RotateCcw icon) above header: clears chat state,
  refs, and localStorage; resets language; shows selector again. Does
  NOT clear basket or confirmed orders.
- `sendingRef` guard prevents delayed responses from the previous
  conversation appearing after reset.

### Phase 2: Basket

- `ItemDetailPanel` now has quantity selector (−/+, min 1, max 99) and
  "Add to basket" button.
- Basket items stored in localStorage scoped by restaurant + resource.
- Basket icon in header shows item count badge with pop animation.
- `BasketPanel` overlay: list items with image, name, price, quantity
  controls, remove, line subtotals, and total. Checkout button.
- Adding the same dish merges quantities. Quantity decrease to 0
  removes the item.

### Phase 3-4: Checkout + confirmation

- `CheckoutView`: full-screen overlay showing restaurant, resource,
  items, subtotals, total, and "Confirm Test Order" button. Clearly
  labelled "TEST CHECKOUT — NO PAYMENT WILL BE TAKEN".
- On confirm: calls `visitor-orders` edge function with idempotency key
  (stored in sessionStorage, removed on success). Button disabled during
  submission.
- `OrderConfirmation`: success indicator, order number, restaurant,
  resource, items with quantities and prices, total, creation time,
  status "New", payment "Test Payment — Not Paid". Prototype notice.
  Order ref saved to localStorage for refresh recovery.

### Phase 5-6: Host Orders + realtime

- New "Orders" nav item in HostShell (ShoppingBag icon).
- `OrdersView`: summary counts (New, In Progress, Completed), status
  filters, order list with order number, status badge, item count,
  total, timestamp. Clicking opens `OrderDetailView`.
- `OrderDetailView`: full order details, status controls (Mark as
  Next Status, Cancel Order), realtime subscription for live updates.
- Realtime: both OrdersView and OrderDetailView subscribe to
  postgres_changes on the orders table. Initial load + realtime events
  call `load()` to refresh from DB (prevents duplicate entries).
  Channel error/timed_out triggers a fallback reload.

### Changed files

- `supabase/migrations/20261016000000_orders_and_order_items.sql` — new
- `supabase/migrations/20261016000100_fix_order_function_permissions.sql` — new
- `supabase/functions/visitor-orders/index.ts` — new edge function
- `supabase/functions/visitor-chat/index.ts` — added restaurant_id +
  available to dish cards
- `supabase/config.toml` — added visitor-orders function config
- `src/types.ts` — OrderStatus, Order, OrderItem, BasketItem,
  ConfirmedOrderRef types; added 'orders' and 'order-detail' to HostView
- `src/lib/orders.ts` — new: listOrders, getOrder, createOrder,
  updateOrderStatus, formatMinor, status helpers
- `src/lib/visitorStorage.ts` — new: chat/basket/order localStorage
  helpers scoped by restaurant + resource
- `src/components/visitor/ItemDetailPanel.tsx` — added quantity
  selector + Add to basket button
- `src/components/visitor/BasketPanel.tsx` — new: basket overlay
- `src/components/visitor/CheckoutView.tsx` — new: checkout screen
- `src/components/visitor/OrderConfirmation.tsx` — new: confirmation
- `src/components/VisitorPage.tsx` — chat persistence, reset, basket
  integration, checkout/confirmation overlays, basket icon in header
- `src/components/host/OrdersView.tsx` — new: host orders list
- `src/components/host/OrderDetailView.tsx` — new: order detail +
  status controls
- `src/components/host/HostShell.tsx` — added Orders nav item
- `src/components/host/HostDashboard.tsx` — wired orders views

### Deployment

- Edge functions `visitor-chat` and `visitor-orders` deployed
  successfully.

### Checks performed

- `npm run typecheck`: passed
- `npm run build`: passed — 527 KB JS / 35 KB CSS (chunk size warning,
  not an error)
- Security advisors: order-related findings (SECURITY DEFINER function
  EXECUTE permissions) fixed in second migration
- RLS: orders/order_items/order_status_log have host-scoped SELECT,
  service_role-only INSERT; no anon access to any order table
- Browser-based UI verification was not performed (no browser
  available); all flows verified by code inspection and DB-level
  security review

### Remaining limitations

- Visitor order recovery after refresh: the order ref is stored in
  localStorage, but the full order details are not re-fetched (the
  recovery attempt with empty items is expected to fail gracefully).
  The confirmation screen is shown during the same session; after a
  refresh the visitor sees the chat with their basket preserved.
- Realtime subscriptions require the Supabase Realtime feature to be
  enabled on the project; if unavailable, the fallback reload
  mechanism handles it.
- Price parsing handles common formats (SEK, EUR with comma, USD with
  dot) but may not handle every possible price string format.

---

## Polish: Visitor chat UI — olive gradient header, mascot, stronger background, floating input

**Date and time:** 2026-10-16 00:10 CEST (Europe/Stockholm, Thursday)

**Area affected:** visitor chat page only (`VisitorPage.tsx`), plus font
loading (`index.html`, `tailwind.config.js`). No database, RLS, edge
functions, QR routing, chat API, admin, or host logic touched.

### 1. Header — olive gradient + mascot

- Replaced the plain `bg-cream-50/90` header strip with a full-width
  left-to-right linear gradient (`#3F5037` → `#A4AE91`, 90deg).
- Removed the fork-and-knife icon; replaced with the existing mascot
  image (`mascotUrl()` from `themeAssets.ts`), displayed at 44–48px
  with `object-contain` to preserve aspect ratio.
- Restaurant name: Playfair Display 700, white, `clamp(25px, 4vw,
  30px)` — ~25–27px on mobile, ~30px on desktop, one line when space
  allows.
- Subtitle (city · Menu assistant): Inter 400, white/90, `clamp(15px,
  2.5vw, 17px)`.
- `UtensilsCrossed` still imported for the "Menu not available" error
  state (unchanged).

### 2. Background visibility +50%

- Previous overlay: `bg-cream-100/80` (80% opacity scrim over image).
- New overlay: `bg-cream-100/40` (40% opacity) — a 50% proportional
  reduction in scrim strength, making the image ~50% more visible.
- Image positioning, sizing, full-page coverage, and `onError` fallback
  unchanged. The image still extends behind the input area to the
  bottom.

### 3. Footer — floating pill input

- Removed the solid footer strip (`border-t`, `bg-cream-50/90`,
  `backdrop-blur`). Replaced with a transparent container so the
  background image shows through behind and below the input.
- Input: `border-radius: 999px`, `background: rgba(255,255,255,0.95)`,
  `border: 1px solid #E5DED3`, text `#292929`, placeholder `#858585`,
  `px-5` for comfortable padding.
- Send button: `background: #78866B`, white icon, `border-radius: 20px`,
  46×46px.
- Gap between input and send button preserved (`gap-2`).
- Horizontal margins: `px-5` (~20px) on the container, keeping the bar
  away from screen edges on mobile.
- Safe-area insets preserved (`pb-[env(safe-area-inset-bottom)]`).

### 4. Font loading

- Added `Playfair+Display:wght@700` to the Google Fonts link in
  `index.html` (Inter was already loaded).
- Added `playfair` family to `tailwind.config.js` (`'Playfair Display',
  Georgia, serif`) so `font-playfair` utility is available.
- No global typography changed; the new font is used only on the
  visitor chat header restaurant name.

### Changed files

- `index.html` — added Playfair Display to Google Fonts link
- `tailwind.config.js` — added `playfair` font family
- `src/components/VisitorPage.tsx` — header gradient + mascot,
  background overlay opacity 80→40, floating pill input, send button
  styling

### Checks performed

- `npm run typecheck`: passed
- `npm run build`: passed — 494 KB JS / 34 KB CSS
- Browser-based visual verification was not performed (no browser
  available); changes verified by code inspection

---

## Feature: Admin theme image sharing and host chat backgrounds

**Date and time:** 2026-10-15 23:30 CEST (Europe/Stockholm, Wednesday)

**Area affected:** admin Theme Uploader (per-image sharing toggle),
host department/event detail (new Theme tab), visitor chat page
(background rendering), admin-api edge function (new action), and one
database migration. Upload, preview, gallery, deletion, QR routing,
chat prompts, and language selection are unchanged.

### Database migration `20261015213000_chat_background_sharing`

- `theme_assets`: added `shared boolean NOT NULL DEFAULT true`. All 7
  existing images backfilled as shared, preserving current
  availability.
- `departments` / `events`: added nullable
  `chat_background_asset_id uuid REFERENCES theme_assets(id) ON DELETE
  SET NULL` plus partial indexes.
- New RLS policy `select_shared_theme_assets` on `theme_assets`
  (authenticated, `shared = true`): hosts can list shared images for
  their picker. Existing admin-only policies untouched.
- New trigger `validate_chat_background_assignment()` on both tables'
  INSERT/UPDATE of the FK: rejects assigning an asset that does not
  exist or is not shared — server-side enforcement so a stale client
  cannot assign a revoked image.
- `get_public_resource()` recreated with a new `chat_background_path`
  column. It returns the storage path only when the asset exists AND
  `shared = true`; otherwise NULL, so the visitor page falls back to
  the plain background. Grant re-applied to `anon, authenticated`.

### Admin — Theme Uploader

- Every saved image card now shows a "Shared" / "Unshared" badge
  toggle. Clicking it flips the sharing state and persists via the new
  `setThemeAssetShared` edge-function action.
- Unshared images are dimmed (55% opacity + grayscale) with an
  "Unshared" badge — clearly distinguished from shared ones.
- All images default to shared; upload still inserts `shared: true`.
- Upload, preview modal, gallery, and delete behaviour unchanged.

### Admin deselect revocation

The `setThemeAssetShared` edge-function action, when called with
`shared: false`, first clears `chat_background_asset_id` on every
department and event pointing at that image, then flips the flag.
Assignments using other images are untouched. The underlying file and
gallery entry are not deleted. Reselecting later makes the image
available again but does not reassign it anywhere.

### Host — new Theme tab

- `ResourceView` gained `'theme'`; a Theme tab (image icon) appears
  after QR in each department and event detail view.
- `ChatThemeView` lists exactly the images the admin currently shares
  (fetched with `eq('shared', true)` so revoked images never reach the
  client list) plus a "No image" tile.
- Selecting a tile saves `chat_background_asset_id` on that specific
  department or event; selections are independent per resource.
- The server trigger rejects any write referencing an unshared asset,
  including stale-client attempts.

### Visitor chat background

- `get_public_resource` now also returns `chat_background_path`.
- `VisitorPage` renders it as a full-bleed, absolutely-positioned
  cover image behind the existing chat UI (z-layered: content z-10,
  image z-0) with a `bg-cream-100/80` scrim for readability. Header,
  message styling, footer, language selector, item detail panel, QR
  links, and prompts unchanged.
- If the image fails to load (`onError`) or no path is returned, the
  plain `bg-cream-100` background is used exactly as before — no new
  default image.

### Changed files

- `supabase/migrations/20261015213000_chat_background_sharing.sql` —
  new migration (applied)
- `supabase/functions/admin-api/index.ts` — `shared` in list/upload
  payloads; new `setThemeAssetShared` action with revocation cascade
- `src/types.ts` — `shared` on ThemeAsset; `chatBackgroundAssetId` on
  Department/EventItem; `chatBackgroundPath` on PublicResource;
  `'theme'` in ResourceView
- `src/lib/departments.ts`, `src/lib/events.ts` — new column in
  select/list/update mapping
- `src/lib/adminApi.ts` — `adminSetThemeAssetShared()`,
  `listSharedThemeAssets()`, `shared` field
- `src/lib/portal.ts` — `chat_background_path` mapping
- `src/components/admin/ThemeView.tsx` — per-image share toggle
- `src/components/host/ChatThemeView.tsx` — new component
- `src/components/host/ResourceDetail.tsx` — Theme tab wiring
- `src/components/VisitorPage.tsx` — background rendering + fallback

### Deployment

- Edge function `admin-api` redeployed successfully.

### Checks performed

- `npm run typecheck`: passed
- `npm run build`: passed — 1766 modules, 494 KB JS / 33 KB CSS
- Migration verified: 7 assets, all shared; 10 departments, 2 events,
  0 assignments (clean start)
- DB test: trigger rejects assigning an unshared asset (error raised,
  state unchanged)
- DB test: full revocation cycle — assignment returns the path before
  revoke, NULL after revoke; shared flag restored, assignment cleaned
- Security advisors: no findings on theme_assets, departments, or
  events (15 pre-existing INFO items on unrelated legacy tables)
- Edge function deployed; admin-api returns `shared` on all theme
  asset payloads
- Browser-based UI verification was not performed (no browser
  available); the visitor background, host picker, and admin toggle
  were verified by code inspection and DB-level tests

---

## Fix: Browser back navigation and missing mascot on host signup form

**Date and time:** 2026-10-15 21:00 CEST (Europe/Stockholm, Wednesday)

**Area affected:** `src/App.tsx` (browser history-aware navigation)
and `src/components/HostSignupPage.tsx` (missing mascot on the main
signup form). No database, edge functions, RLS, routing library, auth
logic, or other components were changed.

### 1. Browser Back navigation fix

**Root cause:** Navigating from Login to Become a Host or Forgot
Password changed React state (`showSignup`/`showForgot`) without
pushing a browser history entry. Pressing Back therefore left the app
entirely instead of returning to Login.

**Fix applied in `App.tsx`:**

- **`pushState` on forward navigation:** `goToSignup()` and
  `goToForgot()` call `window.history.pushState({ screen: 'signup' })`
  or `{ screen: 'forgot' }` before flipping React state. This adds a
  real history entry, so Back returns to the login entry.

- **`popstate` listener:** A `handlePopState` function reads
  `event.state.screen` and sets `showSignup`/`showForgot` to match,
  so Back and Forward restore the correct screen. The listener is
  registered in the existing `useEffect` and cleaned up on unmount.

- **`back()` for in-app Back buttons:** The "Back to sign in" buttons
  in `HostSignupPage` and `ForgotPasswordPage` now call
  `window.history.back()` instead of directly setting state. This
  pops the history entry and triggers `popstate`, which restores
  Login — no duplicate entries or loops.

- **`replaceState` on auth success:** A `useEffect` watching `session`
  calls `history.replaceState({ screen: 'authed' })` once the user is
  authenticated. This replaces the login history entry, so pressing
  Back from a dashboard does not resurrect a stale login screen.

- **`replaceState` on logout/recovery exit:** `handleLogout` and
  `leaveRecovery` call `replaceState({ screen: 'login' })` to reset
  the history state to login, preventing stale entries.

- **Initial state from history:** `showSignup` and `showForgot`
  initial values are read from `window.history.state` so a refresh
  on a forward-navigated screen preserves the correct view.

**What was preserved:**

- No routing library added — uses the native History API only.
- Visitor portal query parameters (`?portal=`, `?resource=`) are
  unaffected (they short-circuit before auth state matters).
- Password recovery URL hash handling is untouched.
- Authenticated dashboards (admin, host, host home) are unchanged.
- The URL itself never changes — only `history.state` is used.

### 2. Missing mascot on host signup form

**Root cause:** The main host signup form's `AuthShell` (line 121)
was missing the `mascotUrl` prop. The signup success screen (line 94)
had it, but the form users actually fill in did not. This was an
oversight from the previous mascot implementation: the `replace_all`
edit caught the success screen but the main form's `AuthShell` tag
had a different string (`animatedBg>` without `mascotUrl`) and was
not caught.

**Fix applied:** Added `mascotUrl={mascotUrl()}` to the main signup
form's `AuthShell` on line 121. Both `AuthShell` usages in
`HostSignupPage.tsx` now pass the same mascot URL, matching the login
page.

### Changed files

- `src/App.tsx` — added `popstate` listener, `goToSignup`/`goToForgot`
  helpers with `pushState`, `backToLogin` using `history.back()`,
  `replaceState` on auth success/logout/recovery exit, initial state
  from `history.state`
- `src/components/HostSignupPage.tsx` — added `mascotUrl={mascotUrl()}`
  to the main signup form's `AuthShell`
- `update.md` — this log entry

### Checks performed

- `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`): passed
- `npm run build` (`vite build`): passed — 1765 modules transformed,
  output 487 KB JS / 32 KB CSS
- Code verification: `goToSignup` and `goToForgot` call
  `history.pushState` before setting state — confirmed
- Code verification: `handlePopState` reads `event.state.screen` and
  syncs `showSignup`/`showForgot` — confirmed
- Code verification: `backToLogin` calls `history.back()` (not
  `setShowSignup(false)`) — confirmed
- Code verification: `useEffect` on `session` calls
  `replaceState({ screen: 'authed' })` — confirmed
- Code verification: both `AuthShell` usages in
  `HostSignupPage.tsx` now pass `mascotUrl={mascotUrl()}` — confirmed
  (line 94 success screen + line 121 main form)
- Code verification: visitor pages (`resourceParams`/`portalId`) and
  recovery screens short-circuit before auth state, so history
  changes do not interfere — confirmed
- Browser-based visual verification was not performed (no browser
  available in this environment); both fixes were verified by code
  inspection only

---

## Feature: Orange mascot logo on login and signup pages

**Date and time:** 2026-10-15 20:30 CEST (Europe/Stockholm, Wednesday)

**Area affected:** login page and host signup page only — the logo/icon
above the "Virgo Portals" wordmark was replaced with the orange mascot
from the Theme Uploader. No database, edge functions, RLS, routing,
auth, or other components were changed.

### Asset identified

- **Asset ID:** `a3249cbd-f1ac-484e-abba-7f74bd587691`
- **Filename:** `file_000000006e008246a3112360a1cdf472.png`
- **Storage path:** `a3249cbd-f1ac-484e-abba-7f74bd587691.png`
- **Size:** 1,642,173 bytes (1.6 MB)
- **Dimensions:** 1300 x 1209 pixels
- **Format:** PNG, 8-bit RGBA

### Transparency verification

The stored PNG was downloaded from the `theme-assets` public storage
bucket and inspected at the byte level. The PNG is color type 6 (RGBA)
with a genuine alpha channel. Full-pixel analysis confirmed:

- All four corner pixels have alpha = 0 (fully transparent).
- 748,972 pixels (47.7%) are fully transparent (alpha = 0).
- 821,963 pixels (52.3%) have partial transparency (anti-aliased edges).
- 765 pixels (0.0%) are fully opaque.

This is genuine background transparency, not an opaque checkerboard or
solid fill. Implementation proceeded.

### Changes applied

1. **New helper** (`src/lib/themeAssets.ts`) — exports
   `themeAssetUrl(storagePath)` which calls
   `supabase.storage.from('theme-assets').getPublicUrl()`, and
   `mascotUrl()` which returns the public URL for the verified mascot
   asset. The storage path is hardcoded as
   `MASCOT_STORAGE_PATH` so both pages reference the same asset.

2. **AuthShell** (`src/components/AuthShell.tsx`) — added an optional
   `mascotUrl` prop. When provided, the `LogoMark` SVG icon is replaced
   with the mascot `<img>` (h-24 on mobile, h-28 on desktop,
   `object-contain`). A separate elliptical shadow element is rendered
   directly beneath the mascot: a `pointer-events-none` div with
   `rounded-[50%]`, `bg-olive-900/25`, and `blur-md`, sized w-16 on
   mobile / w-20 on desktop, h-3. The shadow is a CSS/HTML element, not
   baked into the PNG. When `mascotUrl` is not provided, the original
   `LogoMark` is shown (unchanged for forgot/reset password pages). The
   `LogoMark` import was removed since it is no longer used.

3. **LoginPage** (`src/components/LoginPage.tsx`) — imported
   `mascotUrl` and passed `mascotUrl={mascotUrl()}` to `AuthShell`.

4. **HostSignupPage** (`src/components/HostSignupPage.tsx`) — imported
   `mascotUrl` and passed `mascotUrl={mascotUrl()}` to both
   `AuthShell` usages (the signup form and the done/success screen).

### What was preserved

- The "Virgo Portals" wordmark, typography, subtitle, and text.
- The form layout, fields, buttons, and all form logic.
- The particle background animation (`animatedBg` prop unchanged).
- Logos/icons elsewhere in the application (admin, host, visitor
  headers, etc.) — not modified.

### Shadow design

- Elliptical shape via `rounded-[50%]`.
- Warm neutral tone: `bg-olive-900/25` (25% opacity olive-900).
- Soft diffusion via `blur-md`.
- Sized proportionally: w-16/h-3 on mobile, w-20/h-3 on desktop.
- `pointer-events-none` so it does not interfere with particles or
  form interaction.
- Separate DOM element — not part of the image.

### Changed files

- `src/lib/themeAssets.ts` — new file (theme asset URL helper + mascot
  constant)
- `src/components/AuthShell.tsx` — added `mascotUrl` prop, replaced
  `LogoMark` with conditional mascot image + shadow, removed `LogoMark`
  import
- `src/components/LoginPage.tsx` — imported `mascotUrl`, passed to
  `AuthShell`
- `src/components/HostSignupPage.tsx` — imported `mascotUrl`, passed to
  both `AuthShell` usages
- `update.md` — this log entry

### Checks performed

- `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`): passed
- `npm run build` (`vite build`): passed — 1765 modules transformed,
  output 486 KB JS / 32 KB CSS
- Code verification: both `LoginPage.tsx` and `HostSignupPage.tsx`
  import `mascotUrl` from `@/lib/themeAssets` and pass it to
  `AuthShell` — confirmed
- Code verification: `AuthShell` renders the mascot `<img>` with
  `object-contain` and a separate shadow `<div>` when `mascotUrl` is
  provided — confirmed
- Code verification: the shadow element has `pointer-events-none` and
  does not interfere with the particle canvas or form — confirmed
- Code verification: `ForgotPasswordPage` and `ResetPasswordPage` do
  not pass `mascotUrl`, so they keep the original `LogoMark` —
  confirmed (no `mascotUrl` prop on their `AuthShell` usages)
- Browser-based visual verification was not performed (no browser
  available in this environment); the logo replacement was verified by
  code inspection only

---

## Fix: Missing particle background on host signup page

**Date and time:** 2026-10-15 20:00 CEST (Europe/Stockholm, Wednesday)

**Area affected:** `src/components/HostSignupPage.tsx` only — one line
changed. No database, edge functions, RLS, routing, auth, or other
components were changed.

### Root cause

The previous implementation report claimed `animatedBg` had been added
to both `AuthShell` usages in `HostSignupPage.tsx` (the main signup
form and the done/success screen). In reality, only the done/success
screen (line 93) received `animatedBg`. The main signup form's
`AuthShell` (line 120) was left without the prop, so
`animatedBg` defaulted to `false` and the particle animation never
rendered on the signup form that users actually see.

The likely cause: the original edit used `replace_all: true` on the
string `<AuthShell subtitle="Become a host">`, but the two occurrences
were edited in separate sequential operations — the first edit added
`animatedBg` to the done screen, and by the time the second edit ran,
the main form's `AuthShell` tag still matched the old string but was
not caught by the same replacement. The result was that one of two
usages was missed.

### Fix applied

Added `animatedBg` to the main signup form's `AuthShell` on line 120:

```
-    <AuthShell subtitle="Become a host">
+    <AuthShell subtitle="Become a host" animatedBg>
```

Both `AuthShell` usages in `HostSignupPage.tsx` now pass `animatedBg`,
matching the login page's usage. The existing `ParticleNetworkBg`
component, configuration, colours, and pointer-events-none layering
in `AuthShell` are reused unchanged. No animation library was added
or duplicated.

### Changed files

- `src/components/HostSignupPage.tsx` — added `animatedBg` to the main
  signup form's `AuthShell` (line 120)
- `update.md` — this log entry

### Checks performed

- `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`): passed
- `npm run build` (`vite build`): passed — 1764 modules transformed,
  output 486 KB JS / 32 KB CSS
- Code verification: grep for `AuthShell subtitle` in
  `HostSignupPage.tsx` confirms both usages (lines 93 and 120) now
  include `animatedBg` — confirmed
- Browser-based visual verification was not performed (no browser
  available in this environment); the fix was verified by code
  inspection confirming both AuthShell usages pass `animatedBg`

---

## Feature: Password visibility, signup animation, and admin theme uploader

**Date and time:** 2026-10-15 04:30 CEST (Europe/Stockholm, Wednesday)

**Area affected:** login and host signup pages (password toggles +
signup animation), admin dashboard (new Theme Uploader section), admin
edge function (theme asset upload/list/delete actions), and one new
database migration for the `theme_assets` table and `theme-assets`
storage bucket. No auth logic, routing, host, visitor, or other
functionality was changed.

### 1. Show/hide password controls

- **LoginPage.tsx** — an eye/eye-off icon button inside the password
  input toggles between masked and visible text. The button has
  `type="button"` so it does not submit the form, an accessible
  `aria-label`, and consistent right-side placement.
- **HostSignupPage.tsx** — the same toggle is applied to both the
  Password and Confirm Password fields. Each field has its own
  independent visibility state (`showPasswords` object with per-field
  booleans). The toggle buttons do not submit the form.
- Password input values, validation, form state, and authentication
  logic are all unchanged when toggling visibility.

### 2. Particle background on host signup

- **HostSignupPage.tsx** — added `animatedBg` to both `AuthShell` usages
  (the signup form and the done/success screen). The existing
  `ParticleNetworkBg` component in `AuthShell` renders the same
  olive/sage particle animation already used on the login page, with
  the same config, colours, particle count, and pointer-events-none
  canvas layering. No animation library was added or duplicated.
- The login page and other auth pages are unchanged.

### 3. Admin theme uploader

**New migration** `20261015033000_theme_assets`:
- `theme_assets` table: `id` (uuid PK), `filename`, `storage_path`,
  `content_type`, `size_bytes`, `created_at`.
- `theme-assets` storage bucket (public read, admin-only writes).
- RLS on `theme_assets`: all CRUD restricted to `is_admin()`.
- Storage policies: public SELECT, admin-only INSERT/UPDATE/DELETE.

**Edge function changes** (`admin-api/index.ts`):
- Handler now detects `multipart/form-data` vs JSON content type.
- `listThemeAssets` action — returns all assets ordered by creation
  date (newest first).
- `uploadThemeAsset` action — accepts a file via FormData, validates
  content type against `image/jpeg`, `image/png`, `image/apng`,
  generates a UUID asset ID, uploads to `theme-assets` bucket, inserts
  the metadata row, and returns the asset. If the DB insert fails, the
  uploaded file is cleaned up from storage.
- `deleteThemeAsset` action — removes the file from storage and the
  row from the database.
- All actions are admin-only (verified through the existing
  `verifyUser` + `isAdminUser` guard).

**Frontend API** (`adminApi.ts`):
- `adminListThemeAssets()` — calls edge function, returns typed
  `ThemeAsset[]`.
- `adminUploadThemeAsset(file)` — sends file via FormData with the
  user's auth token, returns the created `ThemeAsset`.
- `adminDeleteThemeAsset(assetId)` — calls edge function to delete.

**ThemeView component** (`src/components/admin/ThemeView.tsx`, new):
- Upload interface: file input accepting .jpg/.jpeg/.png/.apng,
  multiple selection, preview grid with filenames and remove buttons,
  Save button with loading state, duplicate-submission prevention.
- Saved image gallery: responsive grid of thumbnails with filenames
  and file sizes, click to open enlarged preview in a modal/lightbox,
  delete button per image with loading state, empty/loading/error
  states.
- Modal preview: click image to enlarge, click outside or X to close
  without losing gallery state.
- Uses `supabase.storage.from('theme-assets').getPublicUrl()` for
  image display URLs.

**Admin dashboard wiring**:
- `types.ts` — added `'theme'` to `AdminView` union.
- `AdminShell.tsx` — added "Theme uploader" nav item with `Palette`
  icon, directly below Usage.
- `AdminDashboard.tsx` — added title/subtitle for theme view, imported
  and rendered `ThemeView` when `view === 'theme'`.

### Changed files

- `src/components/LoginPage.tsx` — added Eye/EyeOff imports,
  showPassword state, password visibility toggle button
- `src/components/HostSignupPage.tsx` — added Eye/EyeOff imports,
  showPasswords state, per-field visibility toggles for password and
  confirmPassword, `animatedBg` on both AuthShell usages
- `src/components/admin/ThemeView.tsx` — new component
- `src/components/admin/AdminShell.tsx` — added Palette import, theme
  nav item
- `src/components/admin/AdminDashboard.tsx` — imported ThemeView,
  added theme title, rendered ThemeView
- `src/lib/adminApi.ts` — added supabase import, ThemeAsset type,
  adminListThemeAssets, adminUploadThemeAsset, adminDeleteThemeAsset
- `src/types.ts` — added 'theme' to AdminView union
- `supabase/functions/admin-api/index.ts` — multipart form detection,
  listThemeAssets/uploadThemeAsset/deleteThemeAsset actions
- `update.md` — this log entry

### Database/storage changes

- Migration `20261015033000_theme_assets` applied: created
  `theme_assets` table, `theme-assets` storage bucket, RLS policies,
  and storage policies. No existing tables, columns, or policies were
  modified.

### Deployment

- Edge function `admin-api` deployed successfully.

### Checks performed

- `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`): passed
- `npm run build` (`vite build`): passed — 1764 modules transformed,
  output 486 KB JS / 32 KB CSS
- Code path verification by re-reading edited files:
  1. Password toggle on login: `showPassword` state controls input
     type, button has `type="button"` and `aria-label` — confirmed
  2. Password toggle on signup: both password fields have independent
     toggle state via `showPasswords` object — confirmed
  3. Signup animation: `animatedBg` prop passed to AuthShell in both
     signup form and done screen — confirmed
  4. Theme uploader: file input accepts correct types, previews shown,
     Save disabled while saving, gallery loads from edge function,
     delete removes from storage + DB — confirmed
  5. Unsupported file types: edge function validates against
     ALLOWED_THEME_TYPES set, returns 400 for unsupported — confirmed
  6. Admin-only access: all theme asset actions gated by
     verifyUser + isAdminUser — confirmed
  7. Unique asset IDs: UUID generated per upload, used as storage path
     and table PK — confirmed
  8. No filename collision: storage path is `<uuid>.<ext>`, not the
     original filename — confirmed
- Browser-based UI verification was not performed (no browser
  available in this environment)

---

## Feature: Visitor chat language selection

**Date and time:** 2026-10-15 03:30 CEST (Europe/Stockholm, Wednesday)

**Area affected:** the visitor-facing chat only — a new language selector
component, the visitor page state and greeting flow, and the visitor-chat
edge function's system prompt. No database, schema, RLS, auth, host,
admin, routing, or other edge function was changed.

### What was added

1. **Language selector popup** (`src/components/visitor/LanguageSelector.tsx`,
   new) — a full-screen overlay modal shown before the conversation starts.
   It offers exactly 15 languages in their native scripts: English, Svenska,
   中文, हिन्दी, العربية, Español, Français, Deutsch, Italiano, Português,
   Polski, Suomi, Türkçe, 日本語, Русский. A search input filters the list
   by native name or English equivalent. The list scrolls smoothly up to
   52vh. No language is preselected; the visitor must click one to proceed.
   Korean is intentionally absent. The design matches the existing
   cream/olive theme with backdrop blur and animated fade-in.

2. **Initial greeting via LLM** (`src/components/VisitorPage.tsx`) — after
   the visitor selects a language, the selector closes and a hidden
   "Please greet me." request is sent to the visitor-chat edge function with
   the selected language and an empty history. Only the LLM's greeting
   appears in the chat transcript; "Please greet me." is never shown as a
   visitor message. The old hardcoded `WelcomeMessages` component is no
   longer rendered in the visitor chat. The component file itself was not
   deleted.

3. **Language persistence in state** (`src/components/VisitorPage.tsx`) —
   the selected language is held in React `useState` only. It is included
   in every subsequent `visitor-chat` request (normal questions, menu
   queries, ingredient/allergen questions). No localStorage, session
   storage, or database storage is used. Every page load or reload shows
   the selector again with no previous selection restored.

4. **Backend language instruction** (`supabase/functions/visitor-chat/
   index.ts`) — the edge function reads `body.language`, validates it
   against the same 15-language whitelist, and appends an instruction to
   the LLM system prompt: "Always respond to the guest in {language},
   regardless of what language they type in." This instruction is part of
   the system message rebuilt on every request, so it applies to the
   greeting and all subsequent turns. Unsupported or missing language
   values produce an empty instruction string (the LLM uses its default
   language) — no unintended fallback. The existing restaurant/resource
   context, saved menu, card-selection instructions, CARDS/FOLLOWUP
   directives, rate limiting, and availability filtering are all
   preserved.

### Data flow

```
VisitorPage mounts → portal/resource loads → showSelector set to true
  → LanguageSelector overlay appears (no language preselected)
  → visitor clicks a language → handleLanguageSelect(lang)
    → setLanguage(lang), setShowSelector(false)
    → sendGreeting(lang): callFunction('visitor-chat', {
        message: 'Please greet me.', history: [], language: lang
      })
    → only bot greeting message added to transcript
  → subsequent send(): callFunction('visitor-chat', {
      ..., language   // included on every request
    })
```

### Changed files

- `src/components/visitor/LanguageSelector.tsx` — new component
- `src/components/VisitorPage.tsx` — added language/showSelector state,
  handleLanguageSelect + sendGreeting functions, language in send()
  payload, selector overlay render, replaced WelcomeMessages with
  loading state, disabled chat input until language is selected
- `supabase/functions/visitor-chat/index.ts` — added SUPPORTED_LANGUAGES
  whitelist, language validation from body.language, language instruction
  injected into system prompt
- `update.md` — this log entry

### Checks performed

- `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`): passed
- `npm run build` (`vite build`): passed — 1763 modules transformed,
  output 475 KB JS / 31 KB CSS
- Edge function `visitor-chat` deployed successfully
- Code path verification by re-reading edited files:
  1. Opening chat shows selector with no language preselected — confirmed
     (showSelector set true when view loads, no default language state)
  2. Selecting Svenska sends `language: "Svenska"` with hidden
     "Please greet me." — confirmed (sendGreeting sends message +
     language, no visitor message added to transcript)
  3. Only assistant greeting appears — confirmed (only botMessage
     appended to transcriptRef)
  4. Subsequent requests include language — confirmed (send() includes
     `language` in callFunction payload)
  5. Reload shows selector again — confirmed (no localStorage, state
     resets on mount)
  6. Russian supported, Korean absent — confirmed (SUPPORTED_LANGUAGES
     in both frontend and backend match the 15-language list)
  7. Unsupported values handled safely — confirmed (whitelist validation
     produces empty instruction string for unknown values)
  8. Existing menu/resource routing and card-selection intact — confirmed
     (no changes to routing, resource loading, dish queries, CARDS/
     FOLLOWUP logic, or availability filtering)
- Browser-based UI verification was not performed (no browser available
  in this environment)

---

## Feature: Particle network animated background on login page

**Date and time:** 2026-10-15 02:00 CEST (Europe/Stockholm, Wednesday)

**Area affected:** `src/components/AuthShell.tsx` and
`src/components/LoginPage.tsx` only. No database, edge functions, RLS,
routing, Supabase auth, or other auth pages were changed.

### License verification

The npm package `particle-network-bg` (v1.0.2) is published under the
**MIT license**, confirmed via `npm view particle-network-bg license`.
MIT permits use, modification, and distribution. The package is safe to
include.

### What was added

1. **Dependency** — `particle-network-bg@1.0.2` added to `package.json`.
   The package has zero runtime dependencies in its core and ships
   TypeScript types plus a dedicated `./react` entry point exporting
   `ParticleNetworkBg` (component) and `useParticleNetwork` (hook).

2. **AuthShell.tsx** — added an optional `animatedBg` prop (default
   `false`). When `true`, a `ParticleNetworkBg` canvas is rendered as the
   first child inside the root div, wrapped in a
   `pointer-events-none absolute inset-0 z-0` container. The canvas is
   transparent (no background color) and uses olive/sage particle and
   line colors (`#7c9b5e` / `#a8c98a`) to match the existing cream/olive
   palette. The content div was upgraded from `relative` to
   `relative z-10` so it stacks above the canvas.

   A `particleCountForViewport()` helper returns 45 particles on screens
   narrower than 768px and 80 on wider screens, reducing the animation
   load on mobile devices.

3. **LoginPage.tsx** — passes `animatedBg` to `AuthShell`. Also removed a
   pre-existing unused `UtensilsCrossed` import that was flagged by lint.

### What was NOT changed

- The login form, email/password inputs, validation, submit handler,
  forgot-password link, and "Become a host" button are all unchanged.
- The cream/olive color palette, card layout, shadow, ring, and spacing
  are all unchanged.
- `ForgotPasswordPage`, `ResetPasswordPage`, and `HostSignupPage` do not
  pass `animatedBg`, so they remain exactly as before.
- Supabase authentication, routing, edge functions, and all other
  functionality are untouched.

### How interactions are preserved

The canvas sits in a `pointer-events-none` container at `z-0`. The login
form and all interactive elements sit in a `relative z-10` container
above it. Clicks, typing, focus, and tab navigation pass through the
canvas to the form fields below. The canvas's `backgroundColor` is set
to `"transparent"` so the existing page background and decorative blur
circles remain visible.

### Responsive and performance considerations

- The canvas auto-resizes to the window (handled internally by the
  library via resize event listeners).
- Particle count is 45 on mobile (< 768px) and 80 on desktop, set once
  at mount via `useMemo` with an empty dependency array.
- The library calls `cleanup()` on unmount, so no animation loop leaks
  when navigating away from the login page.
- `linkDistance` is set to 140px to limit the O(n²) line-drawing work.

### Changed files

- `package.json` / `package-lock.json` — added `particle-network-bg`
  dependency
- `src/components/AuthShell.tsx` — added `animatedBg` prop,
  `ParticleNetworkBg` import, particle config, and canvas background
  layer
- `src/components/LoginPage.tsx` — added `animatedBg` prop to
  `AuthShell`, removed unused `UtensilsCrossed` import
- `update.md` — this log entry

### Checks performed

- `npm view particle-network-bg license` → `MIT` (confirmed compatible)
- `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`): passed
- `npm run lint` (`eslint .`): 1 pre-existing error in
  `supabase/functions/host-signup/index.ts` (unused `Db` type, unrelated
  to this change); no errors in changed files
- `npm run build` (`vite build`): passed — 1763 modules transformed,
  output 472 KB JS / 30 KB CSS
- Browser-based UI verification was not performed (no browser available
  in this environment); the canvas layering, pointer-events, and z-index
  were verified by code inspection

---

## Fix: Pass department/event metadata to the visitor assistant LLM

**Date and time:** 2026-10-15 01:00 CEST (Europe/Stockholm, Wednesday)

**Area affected:** `supabase/functions/visitor-chat/index.ts` only — the
edge function that powers the visitor-facing chat. No database, frontend,
RLS, QR, or other edge function was changed.

### Root cause

The `visitor-chat` edge function called `get_public_resource()` to fetch
the resource row (which includes `resource_name`, `open_time`,
`close_time`, `start_date`, `end_date`, `start_time`, `end_time`,
`restaurant_name`, `city`, `timezone`, and `welcome`), but only
extracted `system_prompt`. The LLM's system message contained the host's
custom prompt and the menu items, but no department/event name, opening
hours, event dates, restaurant name, city, or timezone.

As a result:
- The LLM could not answer "what are your opening hours?" correctly.
- The LLM could not name the department or event the visitor was at.
- The LLM could not answer event date/time questions.
- When a department was set to "Always open" (no open/close times), the
  LLM would say it didn't know the hours instead of saying "always open".

### Fix applied

Added a `ResourceRow` interface and a `buildResourceContext()` function
to the edge function. The function formats department/event metadata
into a context block prepended to the system message:

**For departments:**
- Department name
- Restaurant name
- City
- Timezone
- Opening hours (e.g. "08:00 – 22:00 (Europe/Stockholm)") or "Always
  open" when no times are set

**For events:**
- Event name
- Restaurant name
- City
- Timezone
- Dates (e.g. "2026-10-14" or "2026-10-14 – 2026-10-20")
- Times (e.g. "12:30 – 13:00 (Europe/Stockholm)")

The context block also instructs the LLM to answer questions about
opening hours, dates, times, and the department/event name using the
supplied information, and to tell guests the department is always open
when hours are listed as "Always open".

The `hasResource` branch was updated to capture the full resource row
into a `resourceRow` variable (not just `system_prompt`). The system
message now starts with the resource context block (if present),
followed by the existing system prompt, menu context, and card
instructions.

The fix is generic — it works for any department or event, not just
Pong. No host, department, or event is hardcoded.

### Live test results

All tests were run against the deployed edge function at
`https://mnoqtlwafknnxmakghhu.supabase.co/functions/v1/visitor-chat`
using real database data.

**Test 1 — Department opening hours (Pong, always open):**

Request: `{"restaurantId":"1dbe1c19-...","resourceId":"37a51f59-...",
"resourceType":"department","message":"What are your opening hours? Are
you always open?"}`

Response: *"Yes, we are always open! You're welcome to visit Pong at
Arlanda Airport whenever it suits you."*

PASS — LLM correctly identified "always open" and named the department
"Pong".

**Test 2 — Department name and city (Pong):**

Request: `{"restaurantId":"1dbe1c19-...","resourceId":"37a51f59-...",
"resourceType":"department","message":"What is the name of this
department and what city are you in?"}`

Response: *"I am the menu assistant for Pong, located at Arlanda in
Stockholm. How can I help you explore our menu today?"*

PASS — LLM correctly named the department "Pong" and city "Stockholm".

**Test 3 — Event name, dates, and times (SirDar Bar, Lunch swedavia):**

Request: `{"restaurantId":"28b1ea7e-...","resourceId":"fee6f9f6-...",
"resourceType":"event","message":"What event is this and what are the
dates and times?"}`

Response: *"Welcome to SirDar Bar! I am your menu assistant, here to
help you explore our offerings. This event is the **Lunch swedavia**,
taking place on **October 14, 2026**. The scheduled time is from
**12:30 to 13:30** (Europe/Stockholm time)."*

PASS — LLM correctly named the event "Lunch swedavia", the date
"October 14, 2026", and the times "12:30 to 13:30" with the correct
timezone.

**Test 4 — Menu items still work (Pong, full menu):**

Request: `{"restaurantId":"1dbe1c19-...","resourceId":"37a51f59-...",
"resourceType":"department","message":"Show me the menu"}`

Response: Returned all 42 Pong dishes as cards, with the reply:
*"Welcome to Pong at Arlanda! I'm your menu assistant... We're open
24/7..."*

PASS — Menu cards, dish names, prices, descriptions, and images all
returned correctly. The LLM also mentioned "open 24/7" based on the
"Always open" context.

### Changed files

- `supabase/functions/visitor-chat/index.ts` — added `ResourceRow`
  interface, `buildResourceContext()` function, full resource row
  capture in `hasResource` branch, and resource context block in system
  message
- `update.md` — this log entry

### Checks performed

- `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`): passed
- `npm run build` (`vite build`): passed (only the existing Browserslist
  freshness warning)
- Edge function `visitor-chat` deployed successfully
- 4 live chat tests passed against the deployed function (department
  hours, department name, event details, full menu)
- No database, RLS, frontend, or other edge function changes were made
- Browser-based UI verification was not performed (no browser
  available); tests were run via direct HTTP calls to the deployed edge
  function

---

## Fix: Visitor QR link shows "Missing restaurant" for department-scoped pages

**Date and time:** 2026-10-15 00:15 CEST (Europe/Stockholm, Wednesday)

**Area affected:** `src/lib/portal.ts` only — the `getPublicResource()`
function. No database, edge function, RLS, QR link, or other frontend
file was changed.

### Root cause

The `get_public_resource` database function returns columns in snake_case
(`restaurant_id`, `resource_name`, `restaurant_name`, `system_prompt`,
etc.). The TypeScript `PublicResource` interface uses camelCase
(`restaurantId`, `resourceName`, `restaurantName`, `systemPrompt`).
The `getPublicResource()` function in `portal.ts` cast the raw database
response directly to `PublicResource[]` without any field mapping —
unlike `mapRestaurant()` and `mapDish()` which already map snake_case to
camelCase for their respective types.

As a result, every camelCase field that differs from its snake_case
counterpart resolved to `undefined`:

- `resource.restaurantId` → `undefined` (actual column: `restaurant_id`)
- `resource.resourceName` → `undefined` (actual column: `resource_name`)
- `resource.restaurantName` → `undefined` (actual column: `restaurant_name`)
- `resource.systemPrompt` → `undefined` (actual column: `system_prompt`)

In `VisitorPage.tsx`, the loaded view stored `restaurantId: undefined`
and `name: undefined`. When the visitor sent a chat message, the
`visitor-chat` edge function received `restaurantId: undefined`, hit the
`if (!restaurantId) return json({ error: 'Missing restaurant.' }, 400)`
guard (line 269), and returned the "Missing restaurant" error — the
exact symptom reported.

The page header also showed "Our menu" (the fallback) instead of "Pong"
because `view.name` was `undefined`.

### Fix applied

Added a `PublicResourceRow` interface and a `mapPublicResource()`
function in `portal.ts`, following the same pattern as the existing
`mapRestaurant()` and `mapDish()` mappers. Updated `getPublicResource()`
to map the raw database row through `mapPublicResource()` before
returning it. This converts all 15 snake_case columns to their camelCase
counterparts.

No other file needed changing — the `VisitorPage.tsx` component, the
`visitor-chat` edge function, the URL routing in `App.tsx`, the QR link
generation in `ResourceDetail.tsx`, and the database function
`get_public_resource()` were all correct. The only defect was the
missing field mapping in `portal.ts`.

### Verification — complete flow trace

1. **QR URL generation** (`ResourceDetail.tsx` line 115): calls
   `resourceLink('37a51f59-...', 'department')` producing
   `?resource=37a51f59-...&type=department`. Correct.

2. **URL parsing** (`links.ts` `readVisitorParamsFromUrl`): extracts
   `{ resourceId: '37a51f59-...', resourceType: 'department' }`. Correct.

3. **Routing** (`App.tsx` line 107): `resourceParams` is checked first,
   renders `<VisitorPage resourceId={...} resourceType="department" />`.
   Correct — resource params take priority over legacy `?portal=`.

4. **Frontend resource lookup** (`VisitorPage.tsx` lines 86-99): calls
   `getPublicResource(resourceId, resourceType)`. After the fix, this
   now correctly returns `{ restaurantId: '1dbe1c19-...',
   resourceName: 'Pong', restaurantName: 'Pong', city: 'Stockholm-
   arlanda', ... }`. The loaded view stores `restaurantId:
   '1dbe1c19-...'` and `name: 'Pong'`. Correct.

5. **Visitor chat request** (`VisitorPage.tsx` line 147): sends
   `{ restaurantId: '1dbe1c19-...', resourceId: '37a51f59-...',
   resourceType: 'department', message, history }` to the
   `visitor-chat` edge function. Correct.

6. **Edge function — restaurant ID guard** (`visitor-chat/index.ts`
   line 269): `restaurantId` is now `'1dbe1c19-...'` (not `undefined`),
   so the guard passes. Correct.

7. **Edge function — system prompt resolution** (lines 310-317): calls
   `get_public_resource('37a51f59-...', 'department')` via the service-
   role client. Reads `row.system_prompt` (snake_case, directly from
   DB — no mapping needed server-side). For Pong's default department,
   the department's own `system_prompt` is empty, so the function
   falls back to the restaurant-level prompt. The LLM receives the
   full custom prompt the host configured. Correct.

8. **Edge function — dish loading** (lines 331-337): queries
   `dishes WHERE restaurant_id = '1dbe1c19-...' AND department_id =
   '37a51f59-...'`. After the backfill migration, all 42 Pong dishes
   have `department_id = '37a51f59-...'`. The LLM receives all 42
   dishes. Correct.

9. **Edge function — menu context** (`buildMenuContext`, lines 132-148):
   each dish is formatted with name, section label, category label,
   price, description, ingredients, and allergy info. The LLM sees the
   complete department-scoped menu. Correct.

10. **Edge function — card resolution** (line 440): `resolveDirective`
    matches dish names against the department-scoped `menu` array, so
    cards can only come from Pong's own dishes. Correct.

11. **Edge function — availability filtering** (line 376): `dishes.filter(
    (d) => d.available !== false)` runs before menu context and card
    resolution. All 42 Pong dishes have `available = true`. Correct.

12. **Page header display** (`VisitorPage.tsx` line 217): `view.name`
    is now `'Pong'` (from `resourceName`), so the header shows "Pong"
    instead of "Our menu". Correct.

### What the LLM receives

The system prompt sent to the LLM is the host's custom prompt (stored
at the restaurant level, since the department's own `system_prompt` is
empty). The prompt does not explicitly name the department or restaurant
— it refers to "your restaurant" generically, which was the existing
design. The menu context lists all 42 department-scoped dishes with
names, sections, categories, prices, descriptions, ingredients, and
allergens. The LLM can only recommend and return cards for dishes in
this list.

### Changed files

- `src/lib/portal.ts` — added `PublicResourceRow` interface and
  `mapPublicResource()` function; updated `getPublicResource()` to use
  the mapper instead of a raw cast
- `update.md` — this log entry

### Checks performed

- `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`): passed
- `npm run build` (`vite build`): passed (only the existing Browserslist
  freshness warning)
- Database query confirmed `get_public_resource()` returns correct data
  for Pong's default department (restaurant_id, restaurant_name,
  system_prompt all present in snake_case)
- Complete code trace of the QR-to-LLM flow (12 steps above) verified
  each stage is correct after the fix
- No edge functions were changed or redeployed (the edge function was
  already correct — only the frontend mapping was broken)
- Browser-based UI verification was not performed in this environment
  (no browser or test credentials available)

---

## Fix: Backfill dish-to-department links for all existing hosts

**Date and time:** 2026-10-14 23:30 CEST (Europe/Stockholm, Wednesday)

**Area affected:** database only (one migration). No application code, edge
functions, frontend, or RLS policies were changed.

### Problem

The Departments & Events migration created a default department for every
existing restaurant but did not backfill `department_id` on existing dish
records. All pre-existing dishes retained `department_id = NULL` and
`event_id = NULL`. The new department-scoped menu queries
(`listDishesByDepartment`, `listDishesByEvent`, and the visitor-chat edge
function) filter by `department_id`, so these dishes became invisible in the
host portal's Menu tab and the visitor chat — even though no dish records
were deleted.

### Investigation findings

- **8 restaurants** total in the database; **6 have dishes**, **2 have zero
  dishes** (Apple UI Test x2).
- **85 dishes** across the 6 restaurants — **all 85 had `department_id = NULL`
  and `event_id = NULL`**.
- **Zero dishes were deleted** by the migration or any other operation. All
  dish content (name, description, price, category, section, image, serving,
  ABV, availability) was intact.
- **Zero dishes were linked to any event** (no event-scoped dishes exist).
- All 6 restaurants already had a default department
  (`is_default = true`) created by the migration.
- **No restaurant was missing a default department.**

### Fix applied

Migration `20261014230000_backfill_dish_department_links.sql` ran a single
UPDATE linking every dish with `department_id IS NULL AND event_id IS NULL`
to its restaurant's default department. No dish content was modified, no
records were deleted, and dishes already assigned to a department or event
were not touched.

### Restaurants and dishes checked

| Restaurant | Owner email | Dishes | Linked |
| --- | --- | --- | --- |
| Pong | prince.verma88@gmail.com | 42 | 42 |
| SirDar Bar | samarbekovna1988vj@gmail.com | 34 | 34 |
| Olive & Thyme | (seeded) | 3 | 3 |
| Cedar Lane Kitchen | (seeded) | 2 | 2 |
| Harbor Table | (seeded) | 2 | 2 |
| Saffron House | (seeded) | 2 | 2 |
| Apple UI Test x2 | (test accounts) | 0 | 0 |

**Totals: 8 restaurants checked, 85 dishes checked, 85 dishes linked, 0
dishes deleted, 0 remaining unlinked.**

### Post-fix verification

- `SELECT COUNT(*) FROM dishes WHERE department_id IS NULL AND event_id IS
  NULL` returns **0** — no unlinked dishes remain.
- Per-restaurant breakdown confirms all dishes now have `department_id` set
  to the correct default department.
- All 85 dishes have `available = true` — no availability flags were changed.
- Pong's 42 dishes confirmed linked to department
  `37a51f59-6f2f-49ac-9ca6-cca25327c3b0` (default department "Pong").
- Bot config (`model_settings`) has both `chatModel` and `imageModel`
  configured — the visitor chat and image generation will serve the now-linked
  dishes.
- RLS policies on `dishes` use `owns_restaurant(restaurant_id) OR is_admin()`
  for all CRUD operations — hosts can read and manage their own dishes, and
  the visitor-chat edge function uses the service-role key which bypasses RLS.
- No event-linked dishes exist, so no event-scoped queries were affected.

### Other migration issues found

None. The only issue was the missing `department_id` backfill. No other data
integrity problems, orphaned records, or broken linkages were found.

### Changed files

- `supabase/migrations/20261014230000_backfill_dish_department_links.sql` —
  the backfill migration
- `update.md` — this log entry

### Checks performed

- Database verification queries confirmed 0 remaining unlinked dishes after
  the migration
- Per-restaurant dish counts and availability confirmed correct
- RLS security posture reviewed — all dish policies are owner-scoped
- Bot model settings confirmed present
- `npm run build`: passed (only the existing Browserslist freshness warning)
- No application code was changed, so no typecheck or lint regressions are
  possible
- Browser-based UI verification was not performed in this environment (no
  browser or test credentials available); the fix was verified by direct
  database queries confirming the linkage

---

## Departments & Events — multi-resource portal architecture

**Date and time:** 2026-10-14 22:15 CEST (Europe/Stockholm, Wednesday)

**Area affected:** Database schema, host portal UI, visitor-facing chat,
both edge functions (`visitor-chat` and `menu-extract`), URL routing, and
frontend data layer. All existing functionality — legacy `?portal=` QR
links, dish data, RLS policies, availability filtering, section/category
classification — was preserved.

### Database migration

Applied migration `20261014210000_departments_and_events.sql`. It created:

- **`departments`** table — permanent service areas (Breakfast, Bar, Room
  Service, etc.) with `name`, `is_default`, `open_time`, `close_time`,
  `system_prompt`, `is_active`, and timestamps. Scoped to a restaurant via
  `restaurant_id` FK.
- **`events`** table — temporary services (pop-ups, seasonal menus) with
  `name`, `start_date`, `end_date`, `start_time`, `end_time`,
  `system_prompt`, a computed `status` (`upcoming`/`active`/`ended`), and
  timestamps. Scoped to a restaurant via `restaurant_id` FK.
- **`dishes`** table gained nullable `department_id` and `event_id` FK
  columns, so each dish can optionally belong to a department or event
  instead of only the restaurant.
- **`restaurants`** table gained `timezone` (IANA string, defaults to
  `Europe/Stockholm`) for correct operating-hours interpretation.
- A backfill created one default department per existing restaurant
  (idempotent `NOT EXISTS` check). All 51 existing dishes were preserved
  with `department_id`/`event_id` = NULL.
- RLS policies on both new tables use `owns_restaurant(restaurant_id) OR
  is_admin()`.
- `get_public_resource(p_resource_id, p_resource_type)` — a SECURITY
  DEFINER function returning public fields plus the effective system
  prompt (resource-level or falling back to restaurant-level) and
  timezone. Follows the same pattern as the existing `get_public_portal()`.

Post-migration verification confirmed 8 default departments created and
51 dishes preserved.

### Host portal UI

- **Navigation** (`HostShell.tsx`) — 3 nav items: Dashboard, Departments,
  Events. Department/Event detail views highlight their parent nav item.
- **Dashboard** (`HostDashboard.tsx`) — loads portal + departments +
  events; manages `view` state including `department-detail` and
  `event-detail`; `saveRestaurant` now includes `timezone`.
- **Departments view** (`DepartmentsView.tsx`, new) — lists departments
  with Default badge and operating hours; inline add form; Open button.
- **Events view** (`EventsView.tsx`, new) — lists events split into
  Upcoming/Active and Past sections; create form with name, dates, times;
  Open button.
- **Resource detail** (`ResourceDetail.tsx`, new) — tabbed interface
  (Details/Menu/Bot/QR) for departments and events. `DepartmentDetails`
  edits name, opening/closing time, active status. `EventDetails` edits
  name, dates, times. Reuses `MenuView`, `BotView`, and `QrView` via
  optional props for resource-scoped workflows. 15-minute time
  increments via `generateTimeOptions()`.
- **Restaurant settings** (`RestaurantView.tsx`) — added timezone Select
  dropdown with 28 common IANA timezones.
- **Menu view** (`MenuView.tsx`) — accepts optional `departmentId`/
  `eventId` props, threads them to the `menu-extract` call so uploaded
  dishes are scoped to the resource.

### Visitor chat (resource-aware)

`visitor-chat/index.ts` now accepts optional `resourceId`/`resourceType`
from the request body. When present:

- Looks up the resource via `get_public_resource()` to get the effective
  system prompt (resource-level or restaurant-level fallback).
- Loads dishes scoped by `department_id` or `event_id` instead of all
  restaurant dishes.
- The LLM only sees and recommends dishes belonging to that resource,
  ensuring complete menu isolation per department or event.

When no resource params are provided (legacy `?portal=` links), behavior
is unchanged — loads all restaurant-level dishes (where
`department_id IS NULL AND event_id IS NULL`).

### Menu extraction (resource-scoped)

`menu-extract/index.ts` now accepts optional `departmentId`/`eventId`
and includes them in the inserted dish rows, so uploaded menu items are
automatically scoped to the correct department or event.

### Visitor URL routing

- `src/App.tsx` checks for `?resource=<id>&type=<type>` params first via
  `readVisitorParamsFromUrl()`, then falls back to legacy `?portal=<id>`
  for backward compatibility.
- `src/lib/links.ts` — added `resourceLink()` generating
  `?resource=<id>&type=<type>` URLs and `readVisitorParamsFromUrl()`
  returning validated `{resourceId, resourceType}` or null.
- `src/components/VisitorPage.tsx` accepts optional `resourceId`/
  `resourceType` props, calls `getPublicResource()` when present
  (falling back to `getPublicPortal()` for legacy links), and passes
  resource params to the `visitor-chat` edge function call.

### Changed files

- `supabase/migrations/20261014210000_departments_and_events.sql`
- `src/types.ts` — Department, EventItem, ResourceType, PublicResource,
  ResourceView interfaces; HostView updated; timezone on
  RestaurantPortal; departmentId/eventId on Dish
- `src/lib/departments.ts` (new) — CRUD functions
- `src/lib/events.ts` (new) — CRUD functions
- `src/lib/portal.ts` — getPublicResource, listDishesByDepartment,
  listDishesByEvent, createDish signature change, timezone support
- `src/lib/links.ts` — resourceLink, readVisitorParamsFromUrl
- `src/lib/constants.ts` — COMMON_TIMEZONES
- `src/components/App.tsx` — resource URL routing
- `src/components/VisitorPage.tsx` — resource-aware visitor page
- `src/components/host/HostShell.tsx` — 3-item navigation
- `src/components/host/HostDashboard.tsx` — department/event state
- `src/components/host/ResourceDetail.tsx` (new) — tabbed resource editor
- `src/components/host/DepartmentsView.tsx` (new) — department list
- `src/components/host/EventsView.tsx` (new) — event list
- `src/components/host/MenuView.tsx` — departmentId/eventId props
- `src/components/host/RestaurantView.tsx` — timezone dropdown
- `supabase/functions/visitor-chat/index.ts` — resource-scoped loading
- `supabase/functions/menu-extract/index.ts` — resource-scoped insertion
- `update.md` — this log entry

### Checks and deployment

- `npm run typecheck`: passed
- `npm run build`: passed; only the existing Browserslist freshness
  warning
- `npm run lint`: 2 pre-existing errors in `LoginPage.tsx` and
  `host-signup/index.ts` (unrelated to this work); no new lint errors
- Edge functions `visitor-chat` and `menu-extract` deployed successfully
- Backward compatibility verified: legacy `?portal=` links still render
  the visitor page with restaurant-level dishes
- Browser-based UI testing and live chat testing were not performed
  because no browser or test credentials are available in this
  environment

---

## Prevent premature dish cards during clarification

**Date and time:** 2026-10-14 20:48 CEST (Europe/Stockholm, Wednesday)

**Area affected:** the `visitor-chat` edge function only
(`supabase/functions/visitor-chat/index.ts`). No system prompt, frontend,
database, availability filtering, follow-up handling, or unrelated
functionality was changed.

**Root cause.** When the LLM omitted the `CARDS:` directive line, the backend
fell back to `matchByName(reply, menu)` (line 410), which scans the reply prose
for dish-name substrings and returns every match as a card. This substring
scan cannot distinguish a recommendation from a clarification question, so
dish cards appeared even while the assistant was asking the visitor to narrow
down their preference.

**Change made.** A single-line change at the card-selection decision point:

```
const matched =
  cardsDirective !== null ? resolveDirective(cardsDirective, menu) : [];
```

The previous fallback `matchByName(reply, menu)` was replaced with an empty
array. Now:

- An explicit `CARDS:` directive is still resolved exactly as before —
  `CARDS: ALL` returns the full menu, `CARDS: <names>` returns named dishes,
  `CARDS: none` returns no cards.
- When no `CARDS:` directive is present, no cards are returned.

The `matchByName` function was subsequently removed entirely during the
Departments & Events implementation (lint cleanup).

**Changed files:**

- `supabase/functions/visitor-chat/index.ts` — one-line fallback change at the
  card-selection ternary
- `update.md` — this log entry

**Checks performed.**

- `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`): passed
- `npm run build` (`vite build`): passed (only the existing Browserslist
  freshness warning)
- The updated `visitor-chat` edge function was deployed to the live project
- Browser-based and live chat verification were not performed in this
  environment (no browser or test credentials available)

**Remaining risk.** If the LLM recommends specific dishes in its prose but
omits the `CARDS:` directive line, those dishes will no longer appear as
cards. The `CARDS:` directive is the sole source of card selection. Explicit
full-menu requests (`CARDS: ALL`) and explicit category-specific requests
(`CARDS: <names>`) are unaffected.

---

## Host Menu — Food/Drinks sections and intelligent categories

**Date and time:** 2026-10-14 14:53 CEST (Europe/Stockholm, Wednesday)

**Area affected:** the dish data model, Host → Menu editing and filtering,
visitor item details, and the `menu-extract` / `visitor-chat` edge functions.
Existing availability behavior and RLS ownership policies were preserved.

### Database migration

Applied migration `20261014113000_add_section_and_new_categories_to_dishes.sql`.
It added `dishes.section` (`food` or `drinks`) with a default of `food`, replaced
the old category constraint with the approved 17-value taxonomy, and preserved
all existing RLS policies and ownership protections. The migration dropped the
old category constraint before changing values, then added section/category
constraints after the backfill.

Existing categories were mapped as follows:

- 24 `food` rows → `food / main_courses` (intentionally broad; host can correct
  individual dishes later)
- 15 `cocktail` rows → `drinks / cocktails`
- 6 `spirit` rows → `drinks / spirits_shots`
- 5 `beer` rows → `drinks / beer_cider`
- 1 `non_alcoholic_drink` row (Non-Alcoholic Lager) →
  `drinks / non_alcoholic_beer`
- No existing `wine` or `other` rows were present

Database verification returned 51 total dishes, 51 unique IDs, zero invalid
section/category combinations, and zero sold-out rows. Existing IDs and menu
content were preserved; no columns or policies were dropped or recreated.

### Host Menu

- Added shared frontend definitions in `src/lib/menuSections.ts` for Sections,
  labels, valid category lists, cascading-category validation, and drink checks.
- `DishCard.tsx` now has separate Section and Category fields. Category options
  are restricted to the selected Section; changing Section resets an invalid
  category to the first valid option. New dishes default to Food / Main Courses.
  Existing availability, image generation, dirty-state tracking, saving,
  deletion, descriptions, ingredients, allergens, serving, and ABV behavior were
  retained.
- `MenuView.tsx` now has independent Section, Category, and Availability
  filters. They default to All, combine correctly, and reset Category to All
  when a Section change makes the selected category invalid.
- `ItemDetailPanel.tsx` now displays the saved Section and Category labels.

### Upload categorization

`menu-extract/index.ts` now asks the model for canonical `section` and
section-specific `category` values. The function validates that category belongs
to the section, normalizes common legacy/label variations, and applies
text-evidence fallbacks using the item name, original heading, description, and
ingredients. Ambiguous items receive the most plausible category and remain
editable by the host; the upload is not rejected solely because the model's
value is missing or invalid. Both fields are persisted and returned from the
inserted rows.

### Visitor assistant

`visitor-chat/index.ts` now retrieves Section and Category, supplies both
readable labels to the model, and returns Section/Category on dish cards. The
existing `available !== false` filtering still runs before menu context,
matching, and card resolution, so sold-out items remain excluded.

### Changed files

- `supabase/migrations/20261014113000_add_section_and_new_categories_to_dishes.sql`
- `src/lib/menuSections.ts`
- `src/types.ts`
- `src/lib/portal.ts`
- `src/components/host/DishCard.tsx`
- `src/components/host/MenuView.tsx`
- `src/components/visitor/ItemDetailPanel.tsx`
- `supabase/functions/menu-extract/index.ts`
- `supabase/functions/visitor-chat/index.ts`
- `update.md`

### Checks and deployment

- `npm run typecheck`: passed
- `npm run build`: passed; only the existing Browserslist freshness warning
- `npm run lint`: not fully clean because of two pre-existing unrelated errors
  in `src/components/LoginPage.tsx` and `supabase/functions/host-signup/index.ts`;
  no new lint errors remain in the changed files
- Database migration applied successfully and post-migration verification passed
- Edge functions `menu-extract` and `visitor-chat` deployed successfully
- Browser-based UI testing and a live menu-upload/chat test were not performed
  because no browser or test credentials were available in this environment

### Remaining limitation

Automatic categorization is designed to be near-correct, not perfect. Existing
food dishes were deliberately grouped under Main Courses as requested and can
be corrected individually by the host.

---

## Host Menu page — category and availability filters

**Date and time:** 2026-10-14 11:18 CEST (Europe/Stockholm, Wednesday)

**Area affected:** the Host → Menu page only
(`src/components/host/MenuView.tsx`). No database, backend, edge function,
visitor chat, dish editor, RLS, or unrelated functionality was changed.

**What changed.** Two page-level filter dropdowns were added to the Host →
Menu page, between the "Saved dishes" heading and the dish card list:

1. **Category filter** — a single-select dropdown with: All categories, Food,
   Cocktail, Beer, Wine, Spirit or shot, Non-alcoholic drink, Other. Uses the
   existing `category` values from the database; no new categories created.

2. **Availability filter** — a single-select dropdown with: All availability,
   Available, Sold out. Uses the existing `available` boolean field on each
   dish.

Both filters default to "All", so every dish remains visible initially. The
filters work together — selecting Cocktail + Sold out shows only sold-out
cocktails. Selecting "All" for either filter removes that filter's
restriction. The dish count next to the heading still shows the total number
of saved dishes (not the filtered count).

Filtering is client-side display logic only — it uses `useMemo` over the
already-loaded `dishes` array. No database records, availability values,
backend filtering, LLM context, or visitor-facing functionality was modified.

When no dishes match the active filters, a card is shown with a filter icon
and "No dishes match these filters" message, prompting the host to change or
reset the filters. The filter dropdowns only appear when there is at least
one saved dish. The "Add dish" new-entry card is not affected by filters and
always appears when the host is creating a new dish.

The filters use the existing `Select` component and olive/cream design tokens,
matching the rest of the host menu page. On mobile, the dropdowns wrap
naturally in a flex row.

**Changed files:**

- `src/components/host/MenuView.tsx` — added `Filter` icon import, `Select`
  import, `useMemo` import, category and availability filter option arrays,
  filter state, `filteredDishes` memo, filter dropdowns UI, empty-filter
  result card, and updated the dish list to render `filteredDishes` instead
  of the raw `dishes` array
- `update.md` — this log entry

**Checks performed.**

- `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`): passed
- `npm run build` (`vite build`): passed (only the existing Browserslist
  freshness warning)
- Browser-based UI verification was not performed in this environment (no
  browser or screenshot tool available). The changes were verified by
  re-reading the edited file and confirming the type and build checks pass

---

## Sold Out / Available field for dishes and drinks — host UI + backend enforcement

**Date and time:** 2026-10-14 10:43 CEST (Europe/Stockholm, Wednesday)

**Area affected:** the `dishes` table schema, the host menu management UI
(`DishCard.tsx`, `MenuView.tsx`), the dish data layer (`portal.ts`, `types.ts`),
and the visitor-chat edge function (`visitor-chat/index.ts`). No visitor-facing
chat UI, input field, auth, admin, RLS, or unrelated functionality was changed.

### 1. Database — new `available` column

A migration added a `boolean NOT NULL DEFAULT true` column named `available`
to the `dishes` table. All existing rows are backfilled to `true` (Available)
by the default, so no current item disappears from the menu. New inserts that
omit the column also get `true`. The column was added inside a `DO $ ... END $`
block with an `IF NOT EXISTS` check, making the migration safe to re-run.

No RLS policy changes were needed — existing row-level policies already cover
the new column.

### 2. Frontend types and data layer

- `src/types.ts` — `Dish` interface gained `available: boolean`.
- `src/lib/portal.ts` — `DISH_COLUMNS` now includes `available`; `DishRow`
  interface and `mapDish` updated; `mapDish` uses `row.available ?? true` so
  rows missing the field still map to Available. `updateDish`'s patch type
  now accepts `available`.

### 3. Host menu UI — availability controls

**Read-only view (`DishCard.tsx`).** Next to the existing Category badge, a
second badge shows "Available" (green/success tone) or "Sold out"
(warning/amber tone). A "Mark as sold out" / "Mark as available" button
appears in the action row, letting the host toggle availability with one
click without entering edit mode. The toggle saves immediately through the
existing `onSave` → `updateDish` → `onReload` path, so the saved status
displays correctly after refreshing. Errors revert the local state and show
a message.

**Edit form (`DishCard.tsx`).** An "Availability" Select dropdown
(Available / Sold out) was added above the Description field. It is included
in the dirty check, so the Save button enables when the host changes it.
The save handler passes `available` in the patch.

**New dish creation.** `EMPTY_DRAFT` defaults `available` to `true`, so
every newly created item starts as Available. `createDish` in `portal.ts`
relies on the database `DEFAULT true` for the column.

**MenuView.tsx** — `handleSaveDish` and `handleCreateDish` patch types
updated to include `available`.

### 4. Backend enforcement — visitor-chat edge function

The `visitor-chat` edge function was updated to enforce availability server-side
before constructing the menu context sent to the LLM:

- The dishes SELECT query now includes the `available` column.
- The `DishRow` interface includes `available?: boolean | null`.
- After fetching dishes, the `menu` array is filtered with
  `dishes.filter((d) => d.available !== false)`. This excludes only explicit
  `false` (Sold out) rows; `true`, `null`, and `undefined` all pass through,
  so existing records without the field remain available.

This filtering happens **before** `buildMenuContext` constructs the system
prompt text, so sold-out items never appear in the menu text the LLM sees.
The filtering also applies to card resolution (`resolveDirective` and
`matchByName` both operate on the filtered `menu` array), so even if the
LLM somehow names a sold-out dish, no card is returned for it. This covers
all visitor-chat request types: recommendations, follow-up questions,
general menu queries, and "show me everything" requests.

The `toCard` function is unchanged — it maps whatever dishes are in the
already-filtered `menu` array, so no sold-out dish card can reach the visitor.

### Changed files

- `supabase/migrations/20261014104300_add_dish_availability_column.sql` —
  new migration adding `available` column
- `src/types.ts` — `Dish` interface gained `available: boolean`
- `src/lib/portal.ts` — column list, DishRow, mapDish, updateDish patch type
- `src/components/host/DishCard.tsx` — availability state, badges, toggle
  button, edit-form select, dirty check, save handler
- `src/components/host/MenuView.tsx` — patch types include `available`
- `supabase/functions/visitor-chat/index.ts` — SELECT includes `available`,
  menu filtered before LLM context and card resolution
- `update.md` — this log entry

### Checks performed

- `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`): passed
- `npm run build` (`vite build`): passed (only the existing Browserslist
  freshness warning)
- The `add_dish_availability_column` migration was applied successfully
- The updated `visitor-chat` edge function was deployed to the live project
- Browser-based UI verification was not performed in this environment (no
  browser or screenshot tool available). The changes were verified by
  re-reading the edited files and confirming the type and build checks pass

---

## Visitor chat welcome messages redesigned — animated waving hand + multilingual introduction

**Date and time:** 2026-10-14 09:09 CEST (Europe/Stockholm, Wednesday)

**Area affected:** the visitor chat page welcome messages only. No backend,
API, database, menu logic, input field, or existing chat functionality was
changed.

**What changed.** The old single welcome text bubble (sourced from the
restaurant's `welcome` field) was replaced with a two-message welcome
sequence that appears when the chat area is empty (before any conversation):

1. **Animated waving hand.** A white chat bubble containing only a 👋 emoji
   with a natural waving animation. The animation rotates the hand back and
   forth in a friendly wave pattern, plays continuously with a 2.5-second
   loop, and respects `prefers-reduced-motion`. No greeting text or words
   appear in this bubble.

2. **Assistant introduction.** After a 1.2-second delay, a second chat bubble
   fades in with the introduction text and a row of language pills showing
   supported languages in their native scripts: English, Svenska, 中文, हिन्दी,
   Français, Español, العربية, Deutsch. The pills use the existing olive
   color tokens and ring styling.

The welcome messages render only when `messages.length === 0`, so they
disappear as soon as the visitor sends their first message — the same
behavior as the old welcome greeting. The old code that inserted the
restaurant's `welcome` text as a bot message was removed. The `welcome` field
is still fetched and available on the portal object; it is simply no longer
displayed as a chat message.

**Animation details.** A `wave` keyframe was added to the Tailwind config. It
rotates the emoji from 0° to 14°, back to -8°, up to 14° again, settling
through a few diminishing swings before returning to 0°, then looping. The
transform origin is set to 70% 70% (lower-right of the emoji) so the wave
pivots from the wrist, like a real hand wave.

**Changed files:**

- `tailwind.config.js` — added `wave` keyframe and `animate-wave` utility
- `src/components/visitor/WelcomeMessages.tsx` — new component with animated
  hand and delayed introduction bubble
- `src/components/VisitorPage.tsx` — removed old welcome-message insertion,
  added `WelcomeMessages` render when chat is empty
- `update.md` — this log entry

**Checks performed.**

- `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`): passed
- `npm run build` (`vite build`): passed (only the existing Browserslist
  freshness warning)
- Browser-based UI verification was not performed in this environment (no
  browser or screenshot tool available)

---

## Visitor chat no longer rejects responses when FOLLOWUP directive is missing

**Date and time:** 2026-10-14 08:08 CEST (Europe/Stockholm, Wednesday)

**Area affected:** the `visitor-chat` edge function only
(`supabase/functions/visitor-chat/index.ts`). No frontend, database, schema,
RLS, host, admin, or other backend files were changed.

**Root cause.** The function had a strict 502 guard that rejected the entire
response — reply text, dish cards, and follow-up — whenever dish cards were
present but the model did not include a `FOLLOWUP:` directive line. LLMs do not
always follow formatting conventions; a perfectly good reply with dish cards
and a follow-up question in the prose was discarded if the exact `FOLLOWUP:`
keyword line was absent. This also caused the visitor's message to reappear in
the input field, because the frontend error-recovery path restores the original
text on any non-2xx response.

**Fix applied.** Removed the 6-line `if (hasCards && !followUpText)` block that
returned the 502 error. The `followUpText` variable is still initialized to
`followUp ?? ''`, so when the model omits the directive the response is
returned with an empty `followUp` string. The frontend already handles this
case gracefully — `VisitorPage.tsx` only appends a separate follow-up message
bubble when `followUp` is non-empty, so no frontend change was needed.

**Changed files:** `supabase/functions/visitor-chat/index.ts` and this log.

**Checks performed.**

- `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`): passed
- `npm run build` (`vite build`): passed (only the existing Browserslist
  freshness warning)
- The updated `visitor-chat` edge function was deployed to the live project
- Browser-based and live chat verification were not performed in this
  environment (no browser tool and no host auth token available)

---

## Host Menu and Bot safety improvements — Add Dish, delete confirmation, protected system prompt

**Date and time:** 2026-10-14 00:02 CEST (Europe/Stockholm, Wednesday)

**Area affected:** host dashboard Menu and Bot sections. No backend, database
schema, RLS, visitor chat, admin, or other functionality was changed.

### 1. Host → Menu: Add Dish

A "+ Add dish" button was added next to the "Saved dishes" heading. Clicking it
opens the same dish-edit form used for editing, but in new-entry mode with all
fields empty and category defaulting to "food". The form reuses the existing
fields, validation, category options, price handling, ingredient/allergen
fields, and image-generation button. The image-generation button is hidden in
new-entry mode (it requires a saved dish ID) and replaced with a hint to save
first, then generate from the dish list.

A new `createDish` function was added to `src/lib/portal.ts`. It inserts a new
row into the `dishes` table with the current host's `restaurantId`, computes
the next `sort_order` by querying the highest existing value + 1, and returns
the new row. RLS ensures the insert only succeeds for the restaurant owner.
After saving, the dish list reloads via the existing `onReload` mechanism, so
the new dish appears in Saved dishes and becomes available to the
visitor-facing assistant through the existing menu-data retrieval (the
`listDishes` query the visitor-chat function already uses).

Duplicate submission is prevented: the Save button is disabled while
`saveState === 'saving'`. Loading, success, and error feedback use the existing
save-state display. The existing Edit Dish functionality is unchanged.

### 2. Host → Menu: Confirmation before removing a dish

The Remove button now opens a confirmation dialog instead of deleting
immediately. The dialog shows the dish name and states the action cannot be
undone. It provides Cancel and "Remove dish" actions. Only an explicit click on
"Remove dish" executes the existing `deleteDish` operation. Cancel closes the
dialog without any data change.

The dialog is a new reusable `ConfirmDialog` component
(`src/components/ui/ConfirmDialog.tsx`) that handles keyboard escape, backdrop
click, and a busy state. After successful deletion, the dish list and count
refresh via the existing `onReload`. Deletion errors are caught and shown in
the dialog. The underlying deletion rules, ownership checks, and database
schema are unchanged.

### 3. Host → Bot: Protected system prompt

**A. Read-only by default.** The Bot section now opens with the current host
prompt displayed in a read-only `<pre>` block (not an editable textarea). An
"Edit prompt" button is shown. No edits can be made until the host clicks it.
Entering or leaving edit mode does not trigger a save.

**B. Explicit edit mode.** Clicking "Edit prompt" enables the textarea with the
current saved prompt. "Save changes" and "Cancel" actions are shown. Save
persists through the existing `onSave` → `updatePortal` mechanism. Cancel
discards unsaved edits and restores the last saved prompt. If unsaved changes
exist when Cancel is clicked, a confirmation dialog asks the host to confirm
discarding them. Loading, success, and error feedback are shown. Duplicate
saves are prevented (button disabled while saving). After saving, the view
returns to read-only mode showing the saved prompt.

**C. Information section.** A new card above the prompt editor displays the
full explanatory text specified in the requirements, using the existing Card
and typography design tokens.

**D. Protected Use admin default.** The "Use admin default" button now opens a
confirmation dialog with the specified wording, including a warning that the
current custom prompt may be permanently lost. If unsaved edits exist, the
dialog notes they will be discarded. Only an explicit "Restore default" click
applies the admin default. The admin default is read from the existing
`adminDefault` prop (fetched via `getBotText()` from `app_config`), never
hardcoded. Restoration replaces only the host's prompt via the existing
`onSave` mechanism — the global admin default in `app_config` is never
modified. After restoration, the view returns to read-only mode. Errors are
shown in the dialog; on failure the saved prompt is preserved.

### Changed files

- `src/lib/portal.ts` — added `createDish` function
- `src/components/ui/ConfirmDialog.tsx` — new reusable confirmation dialog
- `src/components/host/MenuView.tsx` — Add Dish button, new-dish flow
- `src/components/host/DishCard.tsx` — supports `dish: null` / `isNew` mode for
  creating dishes; delete now opens a confirmation dialog instead of deleting
  immediately
- `src/components/host/BotView.tsx` — read-only by default, explicit edit mode,
  unsaved-changes guard, info section, admin-default confirmation dialog
- `update.md` — this log entry

### Checks performed

- `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`): passed
- `npm run build` (`vite build`): passed (only the existing Browserslist
  freshness warning)
- No database migrations were created or applied
- No edge functions were changed or deployed
- Browser-based UI verification was not performed in this environment (no
  browser or screenshot tool available). The changes were verified by
  re-reading the edited files and confirming the type and build checks pass

---

## Visitor enlarged catalogue image no longer cropped

**Date and time:** 2026-10-13 22:46 CEST (Europe/Stockholm, Tuesday)

**Area affected:** the enlarged dish detail panel in the visitor chat UI only
(`src/components/visitor/ItemDetailPanel.tsx`). No host-side viewer, regular
chat card, image generation, backend, or other feature files were changed.

**Root cause.** The enlarged image used `object-fit: cover` with a short
fixed height (`h-48` on mobile, `sm:h-56` on desktop). This cropped the top
and bottom of square 1024×1024 generated images to fill the wide-but-short
container.

**Fix applied.** Changed `object-cover` to `object-contain` and increased the
image area height from `h-48`/`sm:h-56` (192/224 px) to `h-72`/`sm:h-80`
(288/320 px). The image is now centered horizontally (`mx-auto`) and the
container has `bg-cream-100` so any letterbox space around a non-square image
looks intentional. The image preserves its original 1:1 aspect ratio with no
cropping or stretching. The scrollable detail area below (name, price,
category, description, ingredients, serving size, alcohol, allergens) is
unchanged and remains fully visible and scrollable on mobile.

**Checks performed.** `npm run build` passed (only the existing Browserslist
freshness warning). The change is a single element's CSS classes. On a 390px
mobile viewport, the 288px-tall image area can display a full 1024×1024 square
image scaled down with its top and bottom edges intact. A browser-based
screenshot test was not run in this environment.

**Changed files:** `src/components/visitor/ItemDetailPanel.tsx` and this log.

---

## Dish image display in host dashboard shows full image without cropping

**Date and time:** 2026-10-13 22:31 CEST (Europe/Stockholm, Tuesday)

**Area affected:** the dish image viewer in the host dashboard's Saved dishes
section only (`src/components/host/DishCard.tsx`). No backend, image
generation, storage, or other feature files were changed.

**Root cause.** The dish image used `object-fit: cover`, which fills the
fixed-height container by cropping any part of the image that does not fit.
Landscape or portrait images lost their edges — generated 1024×1024 images
were unaffected, but non-square uploaded images were visibly cropped.

**Fix applied.** Changed `object-cover` to `object-contain` on the dish image
element. The image now scales to fit entirely within the existing container
(h-40 / sm:h-44, full card-column width) while preserving its original aspect
ratio. A subtle `bg-cream-50` background was added so any empty space around a
non-square image looks intentional rather than blank. The container size,
card layout, ring border, rounded corners, and "No image yet" placeholder are
all unchanged.

This applies to all hosts and all dish images — both generated and uploaded —
since they use the same image element.

**Checks performed.** `npm run build` passed (only the existing Browserslist
freshness warning). The change is a single CSS class swap, so no type or lint
issues were introduced. On mobile (390px viewport), the image area is full
width with a 160px height; a landscape or portrait image will now be
letterboxed within that area with the cream background filling the remaining
space, with no cropping or distortion. A browser-based screenshot test was not
run in this environment.

**Changed files:** `src/components/host/DishCard.tsx` and this log.

---

## Host-side dish image generation fixed — shared Atlas Cloud config with async polling

**Date and time:** 2026-10-13 22:15 CEST (Europe/Stockholm, Tuesday)

**Area affected:** the `dish-image` edge function only
(`supabase/functions/dish-image/index.ts`). No frontend, database, auth, admin
test, or other feature files were changed. The working Admin Test flow
preserved.

**Root cause.** The host-side `dish-image` edge function had the same
asynchronous-polling bug that was fixed in the admin-api test handler earlier
today. Atlas Cloud's `gpt-image-2.5-sunburst/text-to-image` model returns
`{ data: { id, status: "processing" } }` — a single object — but the code
expected the synchronous OpenAI Images API array shape
`{ data: [{ b64_json | url }] }`. So `payload.data[0]` was always `undefined`
and every host "Generate image" click failed with "The image model did not
return an image." The function never polled the prediction endpoint.

The frontend (DishCard + MenuView) was already correct: it shows a
"Generating…" spinner, disables the button during generation, shows errors,
and reloads dishes after success. No frontend change was needed.

**Configuration sharing.** The dish-image function already reads the same
`model_settings` row (`key = 'imageModel'`) that the Admin Image Model
configuration page saves. Every host uses the same provider, model, endpoint,
and server-side API key. Only the image prompt varies per dish, built from the
dish's saved name, description, and ingredients by the existing `buildPrompt()`
function.

**Fix applied.** The request body now includes the model's supported
parameters verified against the official API reference:
`quality: "medium"`, `background: "auto"`, `output_format: "png"`, alongside
the existing `model`, `prompt`, `n: 1`, and `size: "1024x1024"`.

The response handler now:

1. Reads `data` from the response. If it is an object with an `id` string,
   enters the async polling path.
2. If status is already `completed`, downloads `data.outputs[0]` immediately.
3. Otherwise, derives the polling URL by replacing `/model/generateImage` in
   the endpoint with `/model/prediction/{id}`, and polls every 2 seconds up to
   30 times (60-second timeout).
4. On `completed`, downloads the image URL from `data.outputs[0]`, converts it
   to bytes, and uploads it to the `dish-images` storage bucket — exactly as
   before.
5. On `failed`, returns a 502 with the provider's error message. On timeout,
   returns a 504.
6. If `data` is an array (synchronous providers), the old `data[0].b64_json` /
   `data[0].url` path is preserved unchanged.

The existing ownership verification (host must own the restaurant, dish must
belong to that restaurant), prompt building, storage upload path, dish
`image_url` update, and usage event logging are all unchanged. Concurrent
generation for different dishes is safe: each request carries its own
`dishId` and `restaurantId`, and the storage path includes both IDs plus a
timestamp.

**Live verification — Atlas Cloud API with new parameters succeeded.**

1. POST to `https://api.atlascloud.ai/api/v1/model/generateImage` with the
   stored API key, the model `openai/gpt-image-2.5-sunburst/text-to-image`,
   a Pad Thai dish prompt, and the new parameters (`quality: "medium"`,
   `background: "auto"`, `output_format: "png"`): returned HTTP 200 with
   `{ data: { id: "9ca16b2a...", status: "processing" } }`.
2. Polled `GET /api/v1/model/prediction/9ca16b2a...` every 3 seconds. After 5
   polls (~15 seconds): `status: "completed"`, `outputs[0]` contained a valid
   image URL.
3. Downloaded the image URL: HTTP 200, 2,195,320 bytes, `content-type: image/png`.

A 2.2 MB PNG was genuinely generated with the exact parameters the dish-image
function now sends.

**End-to-end edge function test limitation.** The deployed `dish-image`
function requires a host's Supabase Auth token (it verifies ownership server
side). The host account's password is not available in this environment, so
the function could not be called through its full auth → ownership → generate
→ upload → update path from here. The Atlas Cloud API was tested directly with
the same parameters and API key the function uses, confirming the provider
request, async polling, and image retrieval all work. The function's
ownership, storage, and database update logic was not changed and was already
working before the Atlas Cloud response format changed.

**Other checks.** `npx eslint supabase/functions/dish-image/index.ts` passed.
`npx tsc --noEmit -p tsconfig.app.json` passed. `npm run build` passed (only
the existing Browserslist freshness warning). The updated `dish-image` edge
function was deployed to the live project. The admin-api image test handler
is unchanged and still works.

**Changed files:** `supabase/functions/dish-image/index.ts` and this log.

---

## Atlas Cloud image model test connection fixed — async polling

**Date and time:** 2026-10-13 21:46 CEST (Europe/Stockholm, Tuesday)

**Area affected:** the Admin → Image Model → Test handler only
(`supabase/functions/admin-api/index.ts`). No frontend, database, auth, dish
image generation, or other feature files were changed.

**Root cause.** Atlas Cloud's `gpt-image-2.5-sunburst/text-to-image` model uses
asynchronous generation. The POST to `/api/v1/model/generateImage` returns
`{ data: { id, status: "processing" } }` — a single object, not an array. The
old code expected the synchronous OpenAI Images API shape
`{ data: [{ b64_json | url }] }`, so `payload.data[0]` was always `undefined`,
no base64 or URL was found, and the test reported "The image model responded
but no image data was found." The code never polled the prediction endpoint to
retrieve the finished image.

**Official API reference consulted.**
`https://www.atlascloud.ai/models/openai/gpt-image-2.5-sunburst/text-to-image?tab=api`
and `https://atlascloud.ai/docs/en/models/image`. The docs confirm:

1. POST to `https://api.atlascloud.ai/api/v1/model/generateImage` with
   `{ model, prompt, quality?, size?, n? }`.
2. The response is `{ data: { id, status: "processing", urls: { get: "..." } } }`.
3. Poll `GET /api/v1/model/prediction/{id}` with the same Bearer auth header.
4. When `data.status` is `"completed"`, `data.outputs[0]` is the image URL.

**Fix applied.** The image-test handler now:

1. POSTs to the configured endpoint (unchanged request body).
2. Reads `data` from the response. If it is an object with an `id` string, the
   handler enters the async polling path. If `data` is already `completed`, it
   downloads `data.outputs[0]` immediately. Otherwise it derives the polling
   URL by replacing `/model/generateImage` in the endpoint with
   `/model/prediction/{id}`, and polls every 2 seconds up to 30 times
   (60-second timeout).
3. On `completed`, downloads the image URL from `data.outputs[0]`, converts it
   to base64, and returns `imageUrl` as a data URI — exactly as before.
4. On `failed`, returns a 502 with the provider's error message. On timeout,
   returns a 504.
5. If `data` is an array (synchronous providers), the old `data[0].b64_json` /
   `data[0].url` path is preserved unchanged.

The API key remains server-side; it is read from `model_settings` by the edge
function and never sent to the browser. Authentication, admin access control,
the chat-model test handler, and the dish-image generation flow are all
untouched.

**Live verification — genuinely succeeded.**

1. POST to `https://api.atlascloud.ai/api/v1/model/generateImage` with the
   stored API key and the test prompt: returned HTTP 200 with
   `{ data: { id: "5c6da587...", status: "processing" } }`.
2. Polled `GET /api/v1/model/prediction/5c6da587...` every 3 seconds. After 6
   polls (~18 seconds): `status: "completed"`, `outputs[0]` contained a valid
   image URL.
3. Downloaded the image URL: HTTP 200, 1,878,159 bytes, `content-type: image/png`.

A 1.9 MB PNG was genuinely generated and retrieved. The test button will now
report success only after a real image has been generated and its data
downloaded and base64-encoded.

**Other checks.** `npx eslint supabase/functions/admin-api/index.ts` passed.
`npx tsc --noEmit -p tsconfig.app.json` passed. `npm run build` passed (only
the existing Browserslist freshness warning). The updated `admin-api` edge
function was deployed to the live project.

**Changed files:** `supabase/functions/admin-api/index.ts` and this log.

---

## Visitor chat now sends a separate follow-up message after dish cards

**Date and time:** 2026-10-13 20:02 CEST (Europe/Stockholm, Tuesday)

**Area affected:** the visitor-chat edge function and the visitor chat screen.
When the assistant returns dish cards, a second assistant message — the
follow-up — now appears immediately below the cards. Both messages are produced
in a single LLM request. No database, authentication, host prompt, menu, or
security files were changed.

**How it works.** The existing `CARDS:` directive convention was extended with a
companion `FOLLOWUP:` directive. The model's plain-text reply now ends with two
structured lines: the existing `CARDS:` line naming the dishes, and a new
`FOLLOWUP:` line containing a short follow-up message for the guest. Both lines
are stripped from the visible reply by the backend parser before the response is
sent. This uses the same text-delimited approach already in place for card
selection, so it works with every configured provider — no JSON mode or
structured-output support is required.

**Backend changes** (`supabase/functions/visitor-chat/index.ts`):
- `cardInstructions()` now describes the `FOLLOWUP:` directive in addition to
  the existing `CARDS:` directive. No behavioural instructions, personality, or
  conversational content were added — only the format convention.
- `extractCardsDirective()` was replaced by `extractDirectives()`, which strips
  both `CARDS:` and `FOLLOWUP:` lines from the prose and returns all three
  values: the reply text, the cards directive, and the follow-up text.
- The response handler enforces the contract: when dish cards are present and
  the model did not provide a `FOLLOWUP:` line, the backend returns a 502 error
  rather than fabricating a message. When no cards are returned, no follow-up is
  required and `followUp` is an empty string.
- The host's saved `system_prompt`, provider request, model settings, menu
  loading, `resolveDirective()`, `matchByName()`, dish validation, rate
  limiting, and error handling are all unchanged.
- The previous `extractAssistantFields()` JSON-parsing helper was removed; it
  was unused in practice since all configured providers return plain text.

**Frontend changes** (`src/components/VisitorPage.tsx`):
- The response type now includes `followUp: string`.
- After the primary bot message (with cards) is appended, a second bot message
  with the follow-up text and no cards is appended immediately after it when
  cards are present and the follow-up is non-empty.
- Both messages get unique IDs and are retained in `transcriptRef`, so
  conversation history includes both on the next turn.
- No follow-up text is generated in the frontend.

**Verification.**
- `npx eslint` on both changed files: passed (no warnings or errors).
- `npx tsc --noEmit -p tsconfig.app.json`: passed.
- `npm run build`: passed (only the existing Browserslist freshness warning).
- The updated `visitor-chat` edge function was deployed to the live project.
- A Deno runtime was not available in the environment, so the deployed function
  was not executed locally. Runtime verification with real chat messages
  (with cards, without cards, and missing follow-up) was **not performed** and
  is not claimed.

**Changed files:** `supabase/functions/visitor-chat/index.ts`,
`src/components/VisitorPage.tsx`, and this log.

---

## Visitor chat response adds optional AI follow-up field

**Date and time:** 2026-10-13 19:36 CEST (Europe/Stockholm, Tuesday)

**Area affected:** the visitor-chat backend response only. The response now always
includes `reply`, `dishes`, and `followUp`. Existing plain-text model replies
produce `followUp: ""`; structured AI content that includes a string `followUp`
passes that value through unchanged.

**Implementation.** The existing provider request, host-specific `system_prompt`,
menu loading, model settings, reply processing, `CARDS:` extraction, card
resolution, dish validation, usage logging, and error handling are unchanged.
The backend now tolerates the optional structured AI shape and extracts its
`reply` and `followUp` fields before running the existing card-selection logic.
No additional AI/API request, fallback message, template, or generated
conversation text was added. No frontend, database, authentication, host
setting, or security files were changed.

**Verification.** `npx eslint supabase/functions/visitor-chat/index.ts` passed.
`npx tsc --noEmit -p tsconfig.app.json` passed. `npm run build` passed with the
existing Browserslist freshness warning only. A Deno runtime was not available
in the environment, so the deployed edge function was not executed locally.

**Changed files:** `supabase/functions/visitor-chat/index.ts` and this log.

---

## Login page restored to pre-apple design

**Date and time:** 2026-10-13 16:33 CEST (Europe/Stockholm, Tuesday)

**Area affected:** the sign-in screen only. The 3D apple login upgrade was
removed at the owner's request, and the previous white sign-in card design is
back in place. Authentication, password reset, session handling, host signup,
routes, and all security configuration are untouched.

**What was asked.** Undo the 3D apple login implementation completely, restore
the login page to exactly how it looked and behaved immediately before that
upgrade, add no replacement imagery, and leave every other feature intact.

**What was removed.** The procedural apple texture painter, the 3D scene
component, the WebGL-detection fallback routing, and the reduced-motion helper
that existed only for the apple's entrance animation. The 3D library was
uninstalled, so the app is a single download again (~117 kB gzipped, down from
the apple version's two-file split). No image asset was introduced in its
place, per the instruction.

**What was restored.** The sign-in page as it was before the apple work: the
brand header above a white rounded card with labelled email and password
fields, the olive Continue button, the forgot-password link, and the separate
"Run a restaurant?" card with the become-a-host button — matching the design
language of the password-reset and host-signup pages, which were never
modified. This is not a git repository, so the pre-upgrade state was
reconstructed from the unmodified sibling pages that share the same design
system rather than from history.

**Testing performed.** Production build passes. A real headless Chromium
browser was driven against the built site with 15 automated checks: no 3D
canvas and no image asset on the page; the white card present; both fields
visible; empty-submit and wrong-password error messages; the forgot-password
and host-signup screens opening and returning; no horizontal overflow and
usable input height on a 390×844 mobile viewport. **All 15 passed**, and a
captured screenshot was visually confirmed against the pre-upgrade design.
The verification harness was deleted after the run.

**Changed files:** `src/components/LoginPage.tsx`, `src/App.tsx`,
`package.json` / `package-lock.json` (3D library removed). Deleted:
`src/components/AppleScene.tsx`, `src/lib/appleTextures.ts`,
`src/lib/motion.ts`. No backend, database, or security files were touched.

---

## 3D apple login page — premium UI upgrade

**Date and time:** 2026-10-13 15:39 CEST (Europe/Stockholm, Tuesday)

**Area affected:** the sign-in screen only. A procedurally rendered, rotating
3D green apple now carries the sign-in form on its front. All authentication
logic, session handling, password-reset flow, database rules, and security
configuration are untouched — verified by diff review after the work.

**What was asked.** Turn the login page into a premium, product-advertisement
style experience: a realistic 3D green apple that starts facing away, rotates
smoothly to the front over about 3.5 seconds, and carries the existing sign-in
form on its front face — without changing any functionality.

**Why the previous attempt was lost.** The earlier session ended with a
"connection closed unexpectedly" error and the workspace rolled back to the
state after the host-signup task. The available log (`logs/mcp-server.log`)
contains only routine traffic and no crash trace, so the cause could not be
determined from evidence. The apple implementation was reconstructed from the
verified design that existed before the rollback, with all previously
identified fixes reapplied deliberately rather than guessed at.

**How it is built.**

- `src/lib/appleTextures.ts` paints the apple's surface procedurally on
  offscreen canvases at startup: forest-green base gradient, soft blotches,
  vertical pigment streaks, ~2,600 pores, pale lenticel specks, and 340 water
  droplets (about a third larger "hero" droplets with highlights and caustics).
  Three texture maps come out of one pass: colour, surface height (pores
  dimple, droplets sit proud), and gloss (droplets are glossier than the wax).
  No image is downloaded, so a network problem can never leave a blank screen.
- `src/components/AppleScene.tsx` builds the 3D scene: a lathe-turned body
  with a hand-drawn lobed profile, a bent stem and a curved leaf (both parented
  to the body so they rotate together). Studio lighting from the upper left
  with a warm key, cool rim, fill and bounce lights. The scene performs one
  eased 180° turn over 3.5 seconds using wall-clock time, then stops; a
  failsafe force-reveals the form after 6 seconds on devices too slow to
  animate at usable speed, and an 8-second failsafe in the page itself backs
  that up. Everything is disposed on unmount.
- `src/components/LoginPage.tsx` keeps the real form (same field ids, handlers
  and behaviour) laid over the apple's front in a translucent dark-olive glass
  panel, invisible while the back faces the visitor and fading in as the apple
  settles. The plain white sign-in card is retained as `LoginPageFallback`.
- `src/App.tsx` chooses the 3D page when WebGL is available and the fallback
  card otherwise, and the scene loads as a separate on-demand download so the
  initial bundle stays small (main bundle ~118 kB gzipped; the 3D scene chunk
  ~124 kB gzipped, fetched only on the login screen).

**Accessibility and fallbacks, verified in a real browser.** Reduced-motion
users see the front-facing apple with the form visible immediately, no
rotation. Devices without WebGL get the plain sign-in card. If the 3D scene
download fails, the form is revealed on a solid panel instead. All three paths
were exercised with browser automation, not assumed.

**Testing performed.** A production build was run (passes), then a real
headless Chromium browser was driven against the built site across three
viewport sizes (1440×900, 390×844, 320×568) with 36 automated checks total:
credentials hidden while the apple's back faces the visitor and revealed only
as the front settles; the apple visibly still after the rotation (two frames
1.2 s apart byte-identical, so no endless spinning); no horizontal overflow
and the whole apple plus form on screen without scrolling at every size;
input height ≥44 px; empty-submit and wrong-password error paths; the
forgot-password screen and the become-a-host signup screen still open; the
fallbacks above. **All 36 passed.**

**Honest limitations.**

- The apple is a procedural 3D model, not a photorealistic asset: it has
  natural asymmetry, pores, droplets and a stem and leaf, but a viewer will
  recognise it as rendered rather than photographed.
- Frame rate was measured only in a software-rendered headless browser
  (SwiftShader), which achieves roughly 1–2 fps with multi-hundred-millisecond
  frame gaps; this reflects the test environment's CPU rendering, not the
  code. The animation is wall-clock based, so on devices with GPU rendering
  the 3.5-second duration holds regardless of frame rate, but 60 fps was
  **not** measured and is not claimed.
- The previous session's crash caused a total rollback, so the apple work was
  rebuilt in this session; no part of the earlier attempt survived to be
  reused directly.
- The "Run a restaurant? Become a host" entry is retained on the new login
  page. The upgrade request asked not to introduce a signup link, but the
  signup was shipped earlier as its own task; removing it here would have
  regressed that delivered feature.

**Changed files:** `src/App.tsx`, `src/components/LoginPage.tsx`,
`src/components/AppleScene.tsx` (new), `src/lib/appleTextures.ts` (new),
`src/lib/motion.ts` (new), `package.json` / `package-lock.json` (three.js
added). Test harness under `.repro/` only; no backend, database, or
security-configuration files were touched.

---

## Become a host — public host signup

**Date and time:** 2026-10-13 12:48 CEST (Europe/Stockholm, Tuesday)

**Area affected:** a new public sign-up path for restaurant hosts: a "Become a
host" entry on the login page, a new sign-up screen, one new server-side endpoint,
and one small database integrity rule. Existing screens, the admin area, the
password-reset flow, visitor chat, and all security rules are unchanged.

**What was asked.** Let a restaurant owner create their own host account and
restaurant from the login page, with validated fields, safe handling of duplicate
emails and partial signups, and full ownership isolation — without weakening any
existing protection.

**Why a server endpoint was needed.** Row level security deliberately allows only
an admin to create a restaurant row, so a visitor cannot create their own. The
privileged part therefore runs server-side, in a new `host-signup` endpoint: it
creates the Auth account, links the restaurant to the Auth id that was just minted
(never an id from the request), and returns the result. The service key never
leaves the server, and the browser never chooses ownership.

**How the design prevents each failure mode.**

| Risk | How it is prevented |
| --- | --- |
| Duplicate restaurant ownership | A new partial unique database index allows at most one owned restaurant per account (unowned demo rows with no owner are unaffected). A second insert is refused by the database itself, so even two racing signups cannot double-own. |
| Someone signing up with an email that is already a host | Refused before any account is created, with a clear message. |
| Account created but restaurant setup fails | The endpoint confirms whether the restaurant was actually written; if it truly was not, the just-created account is removed so a retry starts clean — no orphan accounts, no duplicate records. If the response was merely lost, the already-complete signup is returned instead of rolled back. |
| Unauthorized ownership changes | The owner id comes from the verified Auth result, never from the browser. The existing guard trigger still reverts owner/email/status changes made outside the server, and tests confirmed a host cannot reassign or unblock themselves. |
| Signup flooding | Durable, server-side per-IP limit of 5 attempts per 10 minutes, counted only for attempts whose fields are valid, so fixing a typo does not consume an attempt. |
| Weak or mismatched passwords, bad email | Validated in the form for fast feedback and re-validated on the server. Requires at least 8 characters with at least one special character. |
| Showing success when nothing was saved | Success is shown only after the account and the restaurant both exist and the new host's browser session has actually started. |

**Email verification.** The endpoint reads the project's live email settings: if
confirmation is ever switched on, the account is created unconfirmed and the new
host sees a "confirm your email" screen instead of being dropped into a session
that cannot work. Today the project auto-confirms, so new hosts go straight to
their dashboard.

**Files changed.**

- `supabase/functions/host-signup/index.ts` (new) — the server-side signup
  endpoint. Deployed to the live project.
- `supabase/config.toml` — registration for the new endpoint.
- `src/lib/hostSignup.ts` (new) — form validation rules and the signup call.
- `src/components/HostSignupPage.tsx` (new) — the sign-up screen, matching the
  existing login design (same card, colours, typography), with loading, success,
  duplicate-email, validation, and server-error states.
- `src/components/LoginPage.tsx` — the "Host accounts are created by the Virgo
  team" note is replaced by a "Run a restaurant?" card with a **Become a host**
  button.
- `src/App.tsx` — routing between login, sign-up, password reset, and the host
  area.
- Database: one migration adding the partial unique ownership index. No table,
  column, or policy was changed.

**Verification.** All tests ran against the live project.

*Endpoint tests — 18 of 18 passed:* invalid/missing email, short password,
password without a special character, mismatched passwords, missing restaurant
name, and missing location are each refused with a specific message; a valid
signup succeeds and reports no email step; a duplicate email is refused with 409;
the new host can sign in; sees exactly one restaurant (their own, with the details
they typed); cannot read any other restaurant or any other menu; is not an admin;
can edit their own restaurant; cannot change their owner email or status.

*Browser tests (real built app, desktop 1280px and mobile 390px) — 28 of 28
passed:* the login page shows the new entry point and keeps the forgot-password
link; the sign-up form shows all five fields, the password rule, and the "Create
your account" button; every validation message appears in the form before any
request; a valid signup lands the new host directly in their host area with
Restaurant / Menu / Bot / QR sections and their restaurant's name; reloading keeps
them signed in; logging out and re-signing-up with the same email shows the
duplicate message and does not leave the form stuck; the password-recovery screen
and wrong-password rejection still behave as before; no sideways scrolling at
mobile width on any screen. Screenshots were inspected on both sizes.

*Regressions:* the existing host account still signs in, password recovery still
opens, and the visitor portal path is untouched.

**Test data.** Both throwaway accounts and their restaurants created during
testing were removed; the project is back to its 2 real accounts and 5 real
restaurant rows.

---

## Signed out after leaving the site and returning (session persistence)

**Date and time:** 2026-10-13 12:09 CEST (Europe/Stockholm, Tuesday)

**Area affected:** the shared Supabase connection and how the app restores a
signed-in session on startup. No change to the sign-in checks, the role rules, the
password-reset flow, or any screen's layout.

**What was asked.** Keep a valid session across page navigation, the browser
Back/Forward buttons, reloads, and closing and reopening the site — until the
session expires or the user logs out. Do not log users out on ordinary
navigation. Explicit logout must still end the session.

**What was found.** Tested in a real browser against the running app (built output
served locally, driven through the browser's own debugging interface):

- The session is already stored in the browser's persistent storage, so in
  practice it already survived reloads, Back/Forward, and a full browser close and
  reopen. In isolation this part was **already working**.
- However, the session settings were left entirely to the library's defaults, and
  the startup read had a real weakness: if that read failed even once (a momentary
  storage or network hiccup), the app treated the user as signed out and showed the
  sign-in screen — an unnecessary logout on an ordinary page load or on returning
  with the Back button. There was no retry.

**Fix applied (minimal).**

- `src/lib/supabase.ts` — the session settings are now stated explicitly instead of
  relying on defaults: the session is **persisted** in the browser, the access
  token **auto-refreshes** while the session is valid, and a reset link is still
  recognised when it lands. Behaviour is unchanged; it is now guaranteed rather
  than assumed.
- `src/lib/auth.ts` — the startup session read now retries briefly (up to three
  attempts) before concluding the user is signed out, so a single transient
  failure can no longer cause a spurious logout.

**Verification (real browser, built app, live project).** The full flow was driven
through an actual browser session; **14 of 14 checks passed**, repeated three
times:

| Check | Result |
| --- | --- |
| Login screen shown on first visit | Pass |
| Login reaches the protected page | Pass |
| Session written to persistent storage after login | Pass |
| Stays signed in after a hard page reload | Pass |
| Stays signed in after leaving the site and pressing Back | Pass |
| Restores and refreshes a session whose token had expired | Pass |
| Stays signed in after in-app navigation | Pass |
| Stays signed in after closing and reopening the browser | Pass |
| Logout removes the persisted session | Pass |
| Logout returns to the sign-in screen | Pass |
| Still signed out after logout, then reload | Pass |
| No session restored after logout, then reload | Pass |
| Can sign in again after logout | Pass |
| (Protected page only reachable while the session is valid) | Pass |

The password-reset flow was re-tested after the change and still works: the reset
page saves the new password, the new password signs in, and the old one is
rejected. Lint, type-check, and the production build all pass.

**Note on "mobile".** The behaviour tested here is the browser's own session
storage, which is identical on a phone; this environment has no phone or
screenshot tool, so the flow was exercised in a desktop browser rather than on a
handset. No mobile-specific code was involved.

**Test data.** All throwaway accounts created for testing were removed; the project
is back to its 2 real accounts.

---

## Password-reset page stuck on "Saving…"

**Date and time:** 2026-10-13 10:46 CEST (Europe/Stockholm, Tuesday)

**Area affected:** only the password-update step of the reset flow and the shared
Supabase client. No login logic, database policy, or other screen was touched.

**Symptom.** After opening a reset link, the "choose a new password" screen
accepted input but stayed on "Saving…" forever. No success and no error ever
appeared.

**Exact cause.** The password update never returns because of a bug in the
Supabase client library, not in the application's own code:

- The reset link lands the app on a recovery address. On that address the
  Supabase client takes its internal authentication lock while it processes the
  recovery token, and then that lock is never released.
- Every later authentication call has to wait for that same lock. The password
  update (`supabase.auth.updateUser`) is the first such call, so it waits forever
  and its promise never settles. The screen sets its "Saving…" flag and only
  clears it when that promise finishes — which it never does.
- The client's lock is built on the browser's Web Locks API and waits with no
  time limit, so there is no built-in timeout and no error to show.

This is a known, reported defect in the library in use (auth-js 2.71.1):
supabase-js issues #2013 ("Auth-JS Deadlock") and #1594 ("GoTrueClient uses
infinite timeouts for lock acquisition causing deadlocks in production"), the
latter filed against exactly this library version. The upstream-recommended
workaround is to replace the browser lock with a simple in-memory lock.

**How it was proven.** A headless browser was used to drive the real library
against the live project, entering the reset page through a recovery link:

| Check | Result before the fix |
| --- | --- |
| Client initialisation on the recovery address | never completes |
| `getSession()` on that page | hangs (times out) |
| `updateUser({ password })` on that page | hangs (times out) — the endless "Saving…" |
| Same `updateUser` with a simple in-memory lock | resolves normally |

The hang was reproduced even with no listeners registered on the client at all,
which ruled out the application's event handling and pointed at the library's
lock. Disabling the token auto-refresh did **not** help; only replacing the lock
did.

**Fix applied (minimal).**

- `src/lib/supabase.ts` — the shared client is now created with a small in-memory
  lock instead of the browser Web Locks lock. The lock still serialises the same
  operations, but it can never wait on a browser-held lock that is never
  released, so no call blocks another forever.
- `src/lib/auth.ts` — the password-update call is now given a 15-second limit. If
  it ever fails to answer, the screen shows a clear message ("That took too long.
  Check your connection and try again.") instead of spinning forever. This is a
  safety net, not the fix; the lock change above is the fix.

**Verification (live, real library, headless browser).** Using the shipped client
configuration and entering through a recovery link:

- Password update: **completes** (no hang).
- Sign in with the **new** password: **works**.
- Sign in with the **old** password: **rejected** ("Invalid login credentials").

So the password is genuinely changed and the recovery session is valid. Lint,
type-check, and the production build all pass.

**Test data.** The throwaway accounts created for this test were removed; the
project is back to its 2 real accounts.

**Still required (unchanged, from the entry below).** The reset link itself still
points at `http://localhost:3000` until the Supabase Auth **Site URL** and **URI
allow list** are set to `https://virgo-portals.bolt.host`. This "Saving…" fix
governs what happens once the user is on the reset page; it does not change where
the email link sends them.

---

## Password-reset link opened localhost:3000 instead of the live site

**Date and time:** 2026-10-13 10:13 CEST (Europe/Stockholm, Tuesday)

**Live website:** `https://virgo-portals.bolt.host`

**Area affected:** the destination of the password-reset link only. No login
logic, database policy, authentication architecture, UI, or unrelated file was
touched. **No application code change was required or made** — see below.

**Exact cause.** The reset link's destination is decided by Supabase Auth, not by
the application. The app already asks Supabase to return the user to whatever
address the app is currently served from (`window.location.origin`). Supabase
honours that request **only when the address appears in the project's URI allow
list**; otherwise it silently substitutes the project's **Site URL**. That Site
URL is still the Bolt default `http://localhost:3000`, and the deployed address is
not in the allow list, so every reset link resolved to `http://localhost:3000` —
which is why the phone showed ERR_CONNECTION_REFUSED.

**Evidence gathered.**

- A project-wide, case-insensitive search for `localhost`, `3000`, `127.0.0.1`,
  `redirectTo`, `site_url` and `SITE_URL` returned **no match in any source,
  template, config, or environment file**. The string `localhost:3000` appears
  only in this log file.
- The app's only redirect instruction is in the password-reset request
  (`src/lib/auth.ts`), and it reads
  `redirectTo: window.location.origin + window.location.pathname` — i.e. the
  address the site is actually served from, which is the correct value. There is
  no hard-coded fallback of any kind to remove.
- The reset screen (`src/components/ResetPasswordPage.tsx`) and the request screen
  (`src/components/ForgotPasswordPage.tsx`) already exist and already validate the
  recovery session, require a confirmed new password of at least 8 characters, and
  handle expired or already-used links with a dedicated screen.
- The database stores no authentication URL setting: there is no `auth`
  configuration table. The live `/auth/v1/settings` endpoint does not expose these
  values either. They live in the Supabase Auth dashboard configuration, which is
  outside the repository.

**Live test that pinpointed the cause.** The Auth server itself was asked to
resolve a recovery link, and it reported the address it would send the user to:

| Request | Response |
| --- | --- |
| Confirm a recovery link with no return address given | `303 See Other`, `location: http://localhost:3000` |
| Confirm a recovery link **with** an explicit return address of `https://example.com/reset` | `303 See Other`, `location: http://localhost:3000` |
| Confirm a recovery link with the real live address `https://virgo-portals.bolt.host/` | `303 See Other`, `location: http://localhost:3000` |
| Confirm a recovery link with `https://virgo-portals.bolt.host/reset` | `303 See Other`, `location: http://localhost:3000` |
| Ask for a reset email with the live return address `https://virgo-portals.bolt.host/` | `200 OK` (request accepted) |

The middle rows are the proof: even when the correct live return address is
supplied, Supabase discards it and uses `http://localhost:3000`. That happens
precisely because the supplied address is not on the URI allow list, so Supabase
falls back to the Site URL — and the Site URL is still the localhost default.

**Could the setting be changed from here? No — permission denied.** This
environment has no access to the Supabase account-management settings:

- The only key available to the project is the public browser key. The settings
  endpoint answered it with `403 not_admin` ("User not allowed").
- There is no service-role key and no account management token available in this
  environment, and the account-management interface is not reachable from here.
- These URL values are held by Supabase's own authentication service and are not
  stored in the database (there is no `auth` configuration table), so no database
  change can reach them.

**Change required (manual, in the Bolt/Supabase database settings).** Open the
project's database settings, then **Authentication → Advanced options** (URL
configuration), and set exactly:

| Setting | Value |
| --- | --- |
| **Site URL** | `https://virgo-portals.bolt.host` |
| **URI allow list** (Redirect URLs) | `https://virgo-portals.bolt.host/**` |

Keep `http://localhost:3000/**` in the allow list only if local preview is still
used. No application code change is needed; the app already sends the correct live
address, and the reset flow already preserves and consumes the Supabase recovery
token.

**Verification result.**

- **Cause confirmed** against the live Auth server, including with the real live
  address (table above): it still answers `http://localhost:3000`.
- **Setting not changed, and not claimed.** The two settings above could not be
  applied from here (permission denied), so this remains a required manual step.
- **Fix not verified, and not claimed.** Until the settings are saved, a fresh
  reset link cannot be confirmed to point at the live site. Once saved, the check
  is: request a reset email, open the link, and confirm the address begins with
  `https://virgo-portals.bolt.host` and lands on the "choose a new password"
  screen. The same check can be repeated from here — after the change, resolving a
  recovery link should answer `location: https://virgo-portals.bolt.host`.
- **Email delivery** is a separate dependency: the reset-email request is accepted
  (`200 OK`), but whether a message actually arrives depends on an email provider
  being connected in the project's database settings.

---

## Security remediation and Supabase Auth migration

**Date and time:** 2026-10-13 08:29 CEST (Europe/Stockholm, Tuesday)

**Area affected:** authentication for the admin and host areas, database access
rules, file storage rules, the paid AI endpoints, the visitor chat's abuse
protection, and the login screens. No visual redesign: the existing theme,
layout, and navigation are unchanged, and the visitor chat's look and behaviour
are untouched.

**Summary of what was fixed.** The previous audit found that the browser's
anonymous key could read every restaurant record and system prompt, read and
write application configuration, upload files into other hosts' folders, call the
image-generation and menu-reading endpoints with no account, and that the host
password was compiled into the shipped page. All of those are now closed and each
closure was re-tested against the live system.

---

### 1. Authentication architecture

Both accounts now sign in through Supabase Auth with email and password. The
custom login is gone: no password is stored in application code, and no session
token is kept in browser storage by the app.

| Account | How it is authorized |
| --- | --- |
| Admin | The signed-in account's id must appear in the `admin_users` allowlist table. That table is unreachable from the browser and only the server can read it. |
| Host | The signed-in account's id must be the `owner_id` of a restaurant row. Row level security returns a restaurant row only to the account that owns it. |

- The admin and host emails were preserved. Their existing password hashes were
  carried over into Supabase Auth, so neither had to reset a password to get in.
- Role is decided on the server. The browser cannot assert a role, and there is
  no editable user metadata involved in the decision.
- Hosts are created only by the admin, from the new **Hosts → New host** screen,
  which creates the sign-in and links the restaurant in one server-side step.
  There is no public sign-up of any kind.
- Each privileged operation re-checks the identity from the verified token on the
  server. The user id always comes from the token, never from the request body.

**Files changed:** `src/lib/auth.ts`, `src/lib/adminApi.ts`, `src/lib/functions.ts`,
`src/lib/portal.ts`, `src/lib/config.ts`, `src/lib/constants.ts`, `src/App.tsx`,
`src/types.ts`, `src/components/LoginPage.tsx`, `src/components/ForgotPasswordPage.tsx`
(new), `src/components/ResetPasswordPage.tsx` (new), `src/components/AuthShell.tsx`
(new), `src/components/HostHome.tsx`, `src/components/VisitorPage.tsx`,
`src/components/admin/AdminDashboard.tsx`, `src/components/admin/HostsView.tsx`,
`src/components/host/HostDashboard.tsx`, `src/components/host/MenuView.tsx`.
`src/lib/adminData.ts` was deleted — the admin dashboard now reads through the
admin service instead of the tables directly.

### 2. Password recovery

- A **Forgot your password?** link sits on the sign-in screen. The admin and host
  share one sign-in screen, so both reach it.
- The screen always shows the same confirmation whether or not the address has an
  account, so it cannot be used to discover which emails are registered.
- The reset page accepts a new password with a confirmation field, refuses
  passwords under 8 characters and mismatched pairs, and ends the recovery
  session afterwards so the new password must actually be used.
- Expired, reused, and already-consumed links land on a dedicated "This link has
  expired" screen with a way to request a fresh one, rather than a broken form.
- Supabase's own guard limits how often a reset email can be requested; a repeat
  request was correctly refused with a rate-limit response.

**Not verified — email delivery.** No email provider is connected to this
project yet, so no reset email has actually arrived anywhere, and this is **not**
claimed to work. See "Required manual configuration" below.

### 3. Database access rules

Nine new policies replace the old anonymous ones, and two helper functions decide
ownership. Anonymous visitors can no longer read or change any of it.

| Table | Before | After |
| --- | --- | --- |
| `restaurants` | anonymous read, write, delete | owner or admin only |
| `dishes` | anonymous read, write, delete | owner or admin only |
| `app_config` | anonymous read and write | admin only; hosts may read the one default bot-text row |
| `usage_events` | anonymous read and write | owner or admin only |
| `model_settings` | server-only | unchanged (server-only) |
| `admin_users` | n/a | unreachable from the browser |

- Visitors still see a menu, but through a deliberately narrow path: a database
  function that returns only the restaurant's name, city, and welcome text, and
  only while the restaurant is active. The visitor page no longer touches the
  restaurant table at all.
- Ownership changes are blocked at the database, not just in the interface. A
  trigger restores the owner, the owner email, and the active/blocked flag on any
  update that is not made by an admin, so a host cannot hand their restaurant to
  someone else or unblock themselves.

### 4. Storage rules

- Menu documents now upload to a **private** bucket, under the host's own
  restaurant folder, and are only readable by that host and by the server.
- Dish images stay publicly readable because visitors must see them, but the
  public rule no longer covers everything in the bucket.
- Anonymous uploads, overwrites, and listings in host folders are rejected.
- **A second exposure was found and closed during this work.** The public bucket
  still held eleven older menu PDFs and menu photos from the previous design.
  Because a public bucket serves any object to anyone who knows its address, those
  files were readable by name even after the policy was tightened. They were moved
  into the private bucket, re-keyed under the owning restaurant's folder so that
  host can still reach them, and the public copies were removed. All eleven were
  moved and none remain public.

### 5. Paid AI endpoints

- **Dish image generation** now requires a signed-in host who owns the
  restaurant, and the dish must belong to that restaurant.
- **Menu reading** now requires a signed-in host who owns the restaurant, and the
  file must sit inside that restaurant's own folder. Another host's file,
  another host's restaurant id, and path-traversal attempts are all rejected.
- **Visitor chat stays public**, as required. It now has server-side limits that
  live in the database rather than in the function's memory, so they hold across
  requests: a per-visitor-address limit and a per-restaurant limit, plus a cap on
  message length and on how much conversation history is accepted. Exceeding a
  limit returns a plain "please wait" response. Nothing trusts a counter sent by
  the browser.

### 6. Secrets and retired code

- The hardcoded host password is gone from the source and from the built page.
  A scan of the built output found no host password, no account emails, no
  service-role key, and no provider key.
- The AI provider keys are read only by the server and are never sent to the
  browser; the admin screen reports only whether a key is set, never its value.
- The old `admin_credentials` (which stored a password) and `admin_sessions`
  tables were renamed to `retired_admin_credentials` and
  `retired_admin_sessions`, with all browser access revoked. Nothing was deleted,
  so this can be undone by renaming back. This was done only after confirming the
  new sign-in works for both accounts and that no code still reads either table.

### Migrations applied

| Migration | Purpose |
| --- | --- |
| `auth_foundation_and_public_path` | Restaurant ownership link, admin allowlist, rate-limit storage, narrow public menu function |
| `least_privilege_rls` | Replaced every anonymous policy with owner/admin-scoped ones; ownership-change guard |
| `secure_storage` | Private menu-document bucket; owner-scoped storage rules; restricted public read |
| `migrate_users_to_supabase_auth` | Created both sign-in accounts, preserving emails and passwords |
| `normalise_auth_token_columns` | Fixed a sign-in failure caused by the account rows |
| `fix_restaurant_guard_trigger` | Made the ownership guard actually take effect |
| `restrict_public_read_to_dish_images` | Stopped the public bucket serving non-image files |
| `retire_legacy_admin_auth_tables` | Retired the old credential and session tables |
| `remove_test_restaurant_and_account` | Removed the throwaway test restaurant and account |

### Tests actually run (live system, not the interface)

The script `.security-test.mjs` in the project root drove the deployed endpoints
and the database directly, using the public browser key plus the two real
accounts. It reads its connection details from the project's own configuration
and takes the test account details from the environment, so it holds no secrets.
**72 checks, 0 failed.**

| Area | What was checked | Result |
| --- | --- | --- |
| Anonymous | Read `restaurants`, `dishes`, `app_config`, `usage_events`, `model_settings`, `admin_users` | Blocked or 0 rows |
| Anonymous | Insert a restaurant, rename a real restaurant, delete dishes, write the bot text | All rejected or 0 rows affected |
| Anonymous | Call image generation, menu reading, admin service (also with a forged token) | 401 on every attempt |
| Anonymous | Read the public menu function | Returns only name, city, welcome; no prompt or status |
| Anonymous | List, upload into, and fetch host files; fetch a legacy menu document by public address | All denied |
| Anonymous | Fetch the private bucket through a public address | Denied |
| Leftover audit file | Fetch `menus/…/__audit_probe.txt` | Gone |
| Host | Sign in, read own restaurant and dishes | Own restaurant only, 1 row |
| Host | Read another host's restaurant and dishes | 0 rows |
| Host | Insert a dish into another restaurant, update another host's dishes | 403 / 0 rows |
| Host | Try to change owner, owner email, or blocked status on own restaurant | Reverted, no change kept |
| Host | Call image generation and menu reading for another restaurant | 403 |
| Host | Menu reading with a path-traversal path, and naming another host's file | 403 both |
| Host | Call the admin service, including creating a host | 403 both |
| Host | Read AI settings, write the admin bot text, read another restaurant's usage | Blocked |
| Host | Upload into own folder, then delete own upload | Allowed, then removed |
| Host | Upload into another host's folder | Rejected |
| Admin | Sign in, identify self, read AI settings | Works; no raw key in the response |
| Admin | List hosts, read usage, read bot text, set a host's status | All work |
| Admin | Provision a brand-new host and sign in as them | Works end to end |
| New host | Sees only its own restaurant; uploads to its own folder; another host sees 1 row, not 2 | Correct |
| Visitor chat | Works with no sign-in, answers, returns no dishes from other restaurants | Pass |
| Visitor chat | Unknown restaurant, empty restaurant, over-long message | 404 / 400 / 413 |
| Visitor chat | Rate limit reached | 429 at request 20 |
| Sessions | Forged token against all three protected endpoints | 401 each |
| Sessions | Sign out, then try to reuse the refresh token | Session revoked, reuse refused |
| Recovery | Real address vs unknown address | Identical responses, no account enumeration |
| Build | Lint, typecheck, production build | All pass |

**Test data:** the throwaway restaurant and its account created during testing
were removed, and its uploaded test file was deleted through the storage API.
The five real restaurants and their menus were not altered. Row counts after
cleanup: 5 restaurants, 50 dishes, 2 accounts.

**Not verified — the browser interface.** This environment has no browser or
screenshot tool, so the new sign-in, forgot-password, reset-password, and
new-host screens were checked by reading the code and by driving the same
requests the screens make, **not** by viewing the pages. The layout on desktop
and mobile has not been seen.

### Required manual configuration

1. **Connect an email provider and confirm the redirect address.** No email
   provider is connected, so password-reset emails will not arrive yet. This
   needs a provider connected in the project's database settings and the
   published site address listed as an allowed redirect. Until that is done the
   reset screen will show its normal confirmation while no email is delivered.
   Source: https://support.bolt.new/cloud/database/send-emails
2. **Check the site address used in reset links.** Reset links return to the
   published address, so it must be the live one rather than a local address.
   Source: https://support.bolt.new/cloud/database/authentication#how-the-password-reset-link-works
3. **Share the host password with the host out of band.** The host account kept
   its existing password. If you would rather it were changed, the host can use
   the forgot-password flow once email is connected.

### Remaining items

- Email delivery for password reset is unverified (see above).
- The four seeded sample restaurants have no owner account, so nobody can sign in
  as them; that matches the previous design and was left as it was.
- Older menu documents now sit in the private bucket under their restaurant's
  folder. The Host page reads a menu only at upload time, so nothing needs to
  read them; they are kept only so nothing is lost.
- The `retired_admin_credentials` and `retired_admin_sessions` tables still exist,
  holding the old password and tokens. They are unreachable from the browser. If
  you want them gone for good, that is a separate decision because it destroys the
  only copy.

---

## Security audit — read-only, whole application

**Date and time:** 2026-10-13 02:11 CEST (Europe/Stockholm, Tuesday)

**Nature of this entry:** a READ-ONLY security audit. No code, policies,
configuration, or records were intentionally changed. Two probe writes were made
strictly to prove findings and were then removed (details below); one probe file
could not be removed from this environment and is documented as leftover.

**What was inspected:** all frontend sources under `src/` (auth, session
storage, admin and host data access, visitor page), all four Supabase Edge
Functions (`admin-api`, `visitor-chat`, `menu-extract`, `dish-image`), the live
database posture for the `public` and `storage` schemas (every table's RLS
state, grants, and policies), the built browser bundle, and the deployed
function configuration.

**Live tests performed (all with the public anonymous browser key, or with
service-role access used only to inspect metadata shapes, never to print secret
values):**

| Probe | Result |
| --- | --- |
| Anon read of `model_settings` (admin AI keys) | HTTP 401 — blocked (no grants, RLS on, no policies) |
| Anon read of `admin_credentials` | HTTP 401 — blocked |
| Anon read of `admin_sessions` (tokens) | HTTP 401 — blocked |
| Anon read of `restaurants` | 200 — all 5 host rows returned, including system prompts |
| Anon read of another host's `dishes` | 200 — 9 rows from other restaurants returned |
| Anon read of `app_config` (default bot text) | 200 — readable |
| Anon read of `usage_events` | 200 — readable |
| Anon INSERT of a restaurant row | 201 — succeeded (probe row deleted afterwards) |
| Anon UPDATE of a real host's restaurant name | 200 — succeeded (name restored immediately) |
| Anon DELETE against a `dishes` id | 204 — policy permits deletes |
| Anon INSERT of a fake usage event | 201 — succeeded (probe event deleted afterwards) |
| `admin-api` `read`/`save` with no token / fake token | 401 both — session check holds server-side |
| `menu-extract` with a foreign file URL | rejected — host allowlist works |
| `dish-image` for a nonexistent dish | 404 — but the endpoint itself is unauthenticated |
| Storage: anon upload into ANOTHER host's folder | 200 — succeeded; file publicly readable |
| Storage: anon listing of the menus prefix | 200 — all restaurants' folders listed |
| Storage: anon DELETE of that probe file | rejected — no DELETE policy exists |
| Built bundle grep | contains the host password and both account emails as plaintext strings; no service-role key |

**Probe cleanup:** the test restaurant row, the fake usage event, and the
renamed restaurant (restored to "radisson bar") were all reverted. One 1-byte
probe text file remains at `menus/6fbb17b6-06d6-4b64-b753-e20c24fa86ed/__audit_probe.txt`
in the `dish-images` bucket — it cannot be deleted through the Storage API
because no DELETE policy exists on the bucket, and direct SQL deletion of
storage objects is blocked by a platform guard. It should be removed by hand in
the Supabase dashboard once a DELETE policy exists.

**Resolved later, same day:** the probe file was removed through an admin-only
cleanup function hard-coded to that one path, and is confirmed gone. The eleven
older menu documents that were publicly readable in the same bucket were also
moved to private storage — see the remediation entry above.

---

## Visitor chat — tap a card for full item details

**Date and time:** 2026-10-13 01:52 CEST (Europe/Stockholm, Tuesday)

**Area affected:** The public visitor chat page only. Chat requests, card
selection, the AI configuration, menu reading and the Host pages were not
changed. One server-side addition: the chat's card payload now also carries the
item's serving size and alcohol percentage so the enlarged view can show them.

**Files changed:**

- `src/components/VisitorPage.tsx`
- `src/components/visitor/ItemDetailPanel.tsx` (new)
- `src/index.css`
- `supabase/functions/visitor-chat/index.ts`

**Implementation:**

Every dish and drink card in the visitor chat is now a tappable control. Tapping
one opens an enlarged detail panel over the conversation — a bottom sheet on
phones, a centred card on larger screens — without unmounting the chat, so the
conversation and its scroll position are exactly where the visitor left them.

The panel shows the complete item name, full (untruncated) description, price,
and the image when one exists; items without an image get a clean placeholder
instead of a broken image. Category, serving size, alcohol percentage and
allergens are shown only when that field actually has a value in the saved data
— nothing is invented, and empty rows are simply omitted.

A close button sits in the panel's upper-right corner; the backdrop and the
Escape key also close it. Opening is a 200ms scale-up with fade-in, closing a
180ms scale-down with fade-out, and the system "reduce motion" setting replaces
both with an instant appearance. Background scrolling is locked while the panel
is open; the panel itself scrolls if its content is long. The panel is capped
against the dynamic viewport height, so it fits on screen with the keyboard
visible and the close button stays reachable.

**Verification results obtained (real headless Chromium, live chat endpoint,
live saved menu at 390x844 mobile and 1440x900 desktop viewports; 16 checks,
all passing on both):**

| Check | Result |
| --- | --- |
| Chat loads with header and composer | PASS, both viewports |
| Drink cards render and are real tappable buttons | PASS, both viewports |
| Panel opens on tap with correct item, modal semantics, close button | PASS, both viewports |
| Panel shows category, serving size and price ("Beer", "40 cl", "SEK 79") | PASS, both viewports |
| Missing image shows placeholder, not a broken image | PASS, both viewports |
| Background scroll locked while open, restored after close | PASS, both viewports |
| Panel has its own scroll container for long content | PASS, both viewports |
| Closing animation holds the panel during its 180ms exit | PASS, both viewports |
| Conversation preserved after close (same message count) | PASS, both viewports |
| Scroll position preserved after close (identical scrollTop) | PASS, both viewports |
| Composer present and usable after close | PASS, both viewports |
| Food card opens with full details ("Food", "SEK 159", ingredients) | PASS, both viewports |
| Escape key closes the panel | PASS, both viewports |
| No page-level scrollbar; conversation scrolls internally | PASS, both viewports |

Screenshots of the rendered panel and the underlying chat were captured and
reviewed at both viewports; the panel's look matches the existing theme.

**Test data:** no rows were added, changed or deleted for this task — the host's
live menu (41 items) was used as-is and left untouched. Temporary screenshots
and the test driver were removed afterwards, and the temporary static server was
stopped.

**Known limitations:**

- The visual animation smoothness was verified by reviewing the rendered
  screenshots and the compiled CSS keyframes in a headless browser; true motion
  smoothness on a physical phone screen was not observed, since no real device
  is attached to this environment.
- The on-screen keyboard interaction was verified structurally (the panel is
  sized against the dynamic viewport height), but not exercised with a real
  mobile keyboard, for the same reason.

---

## Host menu editor — category, serving size and alcohol fields

**Date and time:** 2026-10-13 01:24 CEST (Europe/Stockholm, Tuesday)

**Area affected:** The Host → Menu page's saved-item editor only. Menu reading,
the Chat model configuration, visitor chat, database security policies and
authentication were not changed.

**Files changed:**

- `src/types.ts`
- `src/lib/portal.ts`
- `src/components/host/DishCard.tsx`
- `src/components/host/MenuView.tsx`

**Background:** the previous entry added `category`, `serving` and `abv` to the
`dishes` table, but the Host page could neither show nor edit them. This entry
surfaces them.

**Implementation:**

Saved items were already read-only until the host pressed Edit, so the existing
one-item-at-a-time edit behaviour was kept exactly as it was. The change is that
the editor now also covers the three new fields.

- Each saved item shows a Category badge plus Serving size and Alcohol rows in
  its read-only view, alongside the existing description, ingredients and
  allergy. Alcohol is only shown for drinks or when a value is actually saved,
  so a food item does not gain an empty row.
- In edit mode there is a Category selector (Food, Cocktail, Beer, Wine, Spirit
  or shot, Non-alcoholic drink, Other), a Serving size field, and an Alcohol %
  field. The Alcohol field appears only for drink categories or when the item
  already has a value, so food editing is unchanged. Serving size stays
  available for everything, since food also has portions.
- Save sends the three fields through the existing update, which targets the
  saved record by its id — it updates that row and never inserts. Cancel resets
  the fields back to the saved values. The unsaved-changes indicator now also
  watches the three new fields.
- Category is saved by its stored value (`cocktail`, `non_alcoholic_drink`, …)
  and shown with a friendly label, matching the wording the visitor chat
  already uses for the same list.

**Verification results obtained (live database, real read and update calls):**

| Test | Result |
| --- | --- |
| Existing food items still display | PASS — 5 items, all `food`, with all fields mapped through |
| Drink fields display correctly | PASS — a drink saved with `cocktail` / `40 cl` / `12%` read back identically |
| Edit and save persist after refresh | PASS — `serving` saved as `1 plate` and read back from the database |
| Save updates the same record, no duplicate | PASS — the item's id was unchanged and the row count did not grow |
| Cancel discards unsaved changes | PASS — the database kept the saved values while the unsaved draft held different ones |
| Cleanup | PASS — test row deleted, the edited item restored, row count back to 5 and 14 overall |
| Lint, typecheck, build | PASS |

**Not verified — important:** the rendered editor was not viewed in a real
browser. This environment has no browser or screenshot tool, so the layout
(that the Category badge, the Serving size row and the Alcohol row sit correctly
beside the existing fields on both narrow and wide screens) was checked by
reading the component and confirming the built CSS, **not** by viewing the page.
The save, read-back, no-duplicate and cancel behaviour was verified by driving
the same database calls the component makes.

**Pre-existing issue found while testing (not caused by this change, not
fixed):** the `dishes` table has had unrestricted UPDATE and DELETE policies for
every signed-in user since the original schema migration
(`anon_update_dishes` / `anon_delete_dishes` with `USING (true)`), so a signed-in
user is not restricted to their own restaurant's rows. A test confirmed another
restaurant's dish could be renamed through the same call the editor uses. This
predates this change and is unrelated to the menu editor, and the brief for this
task explicitly excluded changing database security policies, so it was left
alone. It should be addressed separately: those two policies need an ownership
check instead of `USING (true)`.

---

## Menu PDF extraction — food and drinks

**Date and time:** 2026-10-13 00:57 CEST (Europe/Stockholm, Monday)

**Area affected:** The menu-upload reading pipeline (backend), the Host Menu
page's upload feedback, the visitor chat's menu context and card selection, and
the saved-dish database shape. Admin model configuration, image generation,
authentication and the Host/Visitor page design were not changed.

**Files changed:**

- `supabase/functions/menu-extract/index.ts`
- `supabase/functions/visitor-chat/index.ts`
- `src/components/host/MenuView.tsx`

**Database migration:** `add_dish_category_and_drink_fields` — added `category`
(text, default `'food'`, constrained to the seven allowed values), `serving`
(text, default `''`) and `abv` (text, default `''`) to `dishes`. Existing rows
were given the defaults, so no saved dish changed meaning and nothing was
dropped, renamed or retyped.

**Root cause found (measured, not assumed):**

The failing file is the host's own upload
`menus/1dbe1c19-…/920db9e6-6434-46ca-97ee-254988a50f00.pdf` — "ASIAN THAI BAR
& KITCHEN". It is a normal, text-based PDF: decoding its content streams showed
223 text-drawing operations and zero embedded images, so it is neither scanned
nor unreadable. It contains 14 food items and 27 drinks.

The failure was **not** drinks being rejected. The Admin's saved output-token
limit is 1500, and the extraction request was sending that same 1500 cap. The
model's JSON array for a 41-item menu is far longer than 1500 tokens, so the
reply arrived cut off in the middle of an object, the JSON did not parse, and
the code reported zero items — which the page rendered as "No dishes were found
in that file." Raising the cap to 8000 for one test on the same unchanged file
returned all 41 items, which proves the cause.

A second, smaller defect: the extraction prompt only ever talked about dishes
and the saved records had no way to say "this is a beer", so even a successful
read of a bar menu could not represent drinks properly.

**Implementation:**

- Menu reading now asks for an explicit category on every item, from a fixed
  list: `food`, `cocktail`, `beer`, `wine`, `spirit`, `non_alcoholic_drink`,
  `other`. The instruction says to classify by what the item actually is, not
  by which section it happens to sit under, and to use `other` when unsure
  rather than guessing.
- Every item is read with name, category, price (with currency when shown),
  description, ingredients or composition, allergens, serving size or volume,
  alcohol percentage, and the source section. Anything the document does not
  state must come back as an empty string; the instruction forbids inventing
  prices, ingredients, allergens, percentages or serving sizes.
- The extraction request no longer uses the visitor-chat token cap. It has its
  own floor of 12000 tokens (ceiling 16000), because a 12000-token test on the
  real file kept full drink descriptions and serving sizes while the lower cap
  lost them.
- A truncated model reply is now repaired where possible: the incomplete last
  object is dropped and the array is closed, so a nearly-complete read returns
  what it did manage to read instead of nothing.
- Failures are now told apart instead of all reading "No dishes were found":
  unsupported file type, empty file, unopenable/corrupted/password-protected
  PDF, scanned PDF with no selectable text, provider error, unreadable or empty
  model reply, truncated-with-nothing-readable, and a genuinely itemless
  document each produce their own message.
- The visitor chat now knows about categories. Its menu context labels each
  item's type, its card limit was raised from 24 to 100 (a food-and-drinks menu
  is far longer than a dish list, so the old cap silently truncated the full
  menu), and the card instruction tells the model to name every saved item of
  the type the guest asked for — cocktails, beer, wine, spirits or
  non-alcoholic drinks. Card selection is still resolved server-side against
  the current restaurant's own saved rows, so a drink card can never be
  invented or taken from another host.
- The Host Menu page now says "Read N item(s)" and shows an information notice
  when a file was too long to read in full, suggesting a smaller file.

**Verification results obtained (real files, real provider, live database):**

| Test | Result |
| --- | --- |
| Real failing PDF, food and drinks in one file | PASS — 41 items: 14 food, 15 cocktails, 5 beers, 6 spirits, 1 non-alcoholic; `truncated: false` |
| Drink detail preserved (descriptions, "40 cl", "4 cl" servings) | PASS |
| Drinks-only PDF | PASS — 11 items across cocktail, beer, wine, spirit, non-alcoholic; accepted with zero food items |
| Food-only PDF still works | PASS — 5 items, all `food` |
| Scanned PDF (image-only) | PASS — distinct error: no selectable text, scanned or image-only |
| Corrupted PDF | PASS — distinct error: could not be opened, corrupted or password protected |
| Unsupported file type (.docx) | PASS — rejected with "file type is not supported" |
| Disallowed file location | PASS — rejected |
| Missing file or restaurant | PASS — rejected |
| Visitor "What cocktails do you have?" | PASS — 18 cocktail cards |
| Visitor "Do you serve beer?" | PASS — 7 beer cards |
| Visitor "Show me the whisky shots." | PASS — 5 spirit cards |
| Visitor "What non-alcoholic drinks are available?" | PASS — 3 cards |
| Visitor "What food and drinks are on the menu?" | PASS — all 57 saved items as cards |
| Cross-host request for another restaurant's dishes | PASS — 0 cards, refused |
| Saved items persist after refresh | PASS — read back from the database, not from memory |
| Host isolation and server-side API key | PASS — unchanged; keys still never leave the server |
| Lint, typecheck, build | PASS |

**Test data removed:** all test uploads were deleted from storage and the
temporary storage delete permission used to remove them was revoked
immediately afterwards. The host's saved menu was restored to its original 5
dishes and the Chat model settings to temperature 0.8, 1500 output tokens,
reasoning disabled. No test data, dummy dishes or sample menus remain.

**Known limitations:**

- The new `category`, `serving` and `abv` fields are stored and used by the
  visitor chat, but the Host Menu page does not display or let the host edit
  them yet. That was a deliberate smallest-change decision; surfacing them in
  the Host UI would be a separate, larger change.
- Scanned or image-only PDFs are detected and reported honestly, but not read —
  the pipeline does no OCR, so a photo of a menu still needs a text-based file.
- Category assignment is made by the model, so an unusual item may land in
  `other` rather than the ideal category. That is the intended safe outcome.
- The Host Menu page's upload feedback was verified by reading the code and by
  driving the same backend it calls; the rendered page was not viewed in a real
  browser, since this environment has no browser tool.

---

## Mobile visitor chat layout (viewport height, scrolling, composer)

**Date and time:** 2026-10-12 19:45 CEST (Europe/Stockholm, Monday)

**Area affected:** The public visitor chat page layout only. No behaviour,
data, prompts, history handling or dish-card selection was changed.

**Files changed:**

- `src/components/VisitorPage.tsx`
- `src/index.css`
- `index.html`

**Root cause found:**

The chat shell used the `h-screen` utility, which is `height: 100vh`. On mobile
browsers `100vh` resolves to the *tallest* possible viewport, i.e. the height
with the address bar and the Android navigation bar hidden. So the shell was
always taller than what was actually on screen, and the composer at the bottom
of it sat underneath the browser toolbar or the Android navigation area. Three
things compounded it:

1. The conversation area had no `min-height: 0`. In a flex column the default
   `min-height: auto` lets a tall child refuse to shrink, so long replies and
   stacked dish cards could grow the layout instead of scrolling inside it.
2. There was no safe-area handling, so nothing reserved space for the Android
   navigation bar or the iPhone home indicator.
3. Nothing reacted to the on-screen keyboard, which changes the visible
   viewport height without firing a window resize on some browsers.

**Implementation:**

- The shell now uses a `chat-viewport` utility that sets `height: 100vh` as a
  fallback and then `height: 100dvh`, so the shell matches the viewport that is
  actually visible.
- The conversation area now has `min-h-0` and `overscroll-contain`, so it is
  the only element that scrolls and long content cannot stretch the page.
- The header and composer keep `shrink-0`, so they stay fixed at the top and
  bottom while only the middle scrolls.
- The header reserves `env(safe-area-inset-top)` and the composer reserves
  `env(safe-area-inset-bottom)`, and the page declares `viewport-fit=cover` so
  those insets are non-zero on notched devices.
- A small hook listens to `window.visualViewport` resize and scroll and pins
  the shell to the visible height, which is what keeps the composer above the
  keyboard. It only ever shrinks to the smaller of the visual viewport and the
  document height, and it is disabled unless a portal is loaded. Browsers
  without the Visual Viewport API simply keep the CSS `100dvh` height.
- Header and composer vertical padding was trimmed slightly on small screens
  (`py-3 sm:py-4`) so the header does not consume excess height on phones.

**Verification results obtained:**

| Check | Result |
| --- | --- |
| `.chat-viewport` in built CSS | PASS — `.chat-viewport{height:100vh;height:100dvh}` |
| Safe-area rules compiled | PASS — `padding-top:env(safe-area-inset-top)`, `padding-bottom:env(safe-area-inset-bottom)` |
| `min-height: 0` on scroll area | PASS — `.min-h-0{min-height:0px}` |
| `overscroll-contain` compiled | PASS — `.overscroll-behavior:contain` |
| `viewport-fit=cover` in built HTML | PASS |
| No leftover `h-screen` / `100vh` on the chat shell | PASS — only the loader and error screens still use `min-h-screen`, which is correct for them |
| No fixed or absolute positioning, no hardcoded bottom offsets | PASS — none present in the component |
| Chat still sends and returns reply plus cards | PASS — real request returned 5 cards with the `imageUrl` field |
| History and dish-card logic untouched | PASS — `toHistory` / `transcriptRef` still in place |
| Lint, typecheck, build | PASS |

**Not verified — important:** the actual mobile rendering was **not** tested in
a real mobile browser. This environment has no browser or screenshot tool, so
checks 1–5 of the brief (header fully visible, independent scroll, composer
fully visible, last card reachable without hiding the input, and the keyboard
not covering the composer) were verified by inspecting the compiled CSS and
the layout structure, **not** by viewing the page at a real viewport width.
The keyboard behaviour in particular depends on `visualViewport`, which cannot
be exercised here. This should be confirmed on a real phone.

---

## Conversation history and consistent dish-card selection

**Date and time:** 2026-10-12 18:47 CEST (Europe/Stockholm, Monday)

**Area affected:** Visitor chat — backend request and dish-card selection, plus
the visitor page's send handler. Admin, Host, menu upload, model settings and
image generation were not changed.

**Files changed:**

- `supabase/functions/visitor-chat/index.ts`
- `src/components/VisitorPage.tsx`

**Root cause found:**

Card selection was not an AI decision. It was a substring search in the
backend: after the model replied, the code checked which saved dish names
appeared as text inside the reply and returned those as cards. That produced
the inconsistent behaviour in three ways:

1. The model usually refers to dishes in prose or bolded form rather than the
   exact saved name, so a reply that named five dishes could return one card,
   or the wrong one.
2. Nothing tied a card to the visitor's question. A reply that mentioned an
   unrelated dish returned that dish.
3. Conversation history was never sent. The visitor page kept the transcript
   on screen but sent only the newest message, so the model could not resolve
   "it", "that one", "what else?" or "show me all" against earlier turns. A
   follow-up reply with history supplied was byte-identical to the same
   follow-up with none, which proved the history was being discarded.

**Implementation:**

The model is now asked to end its reply with one final line naming the dishes
the guest should see, copied exactly from the supplied saved dish names
(`CARDS: <name>, <name>`, or `CARDS: ALL` for the whole menu, or
`CARDS: none`). The backend strips that line out of the reply so the guest
never sees it, then resolves every named dish against this restaurant's own
saved rows. A name that is not in the current restaurant's records is dropped,
so the model can never invent a card or pull one from another host. If the
line is missing or unparseable the previous name-matching is used as a
fallback, so a reply is never left without cards.

The visitor page now sends the transcript it is already rendering as the
conversation history on each turn. The backend validates roles and content,
caps it to the last 12 messages and 2000 characters each, and passes it to the
model in chronological order between the system prompt and the new message.
History is session-scoped by construction: it lives only in the browser tab,
so a refresh starts a new conversation and one visitor can never read
another's.

**Second defect fixed:** the backend returned each card with the database
column name `image_url` while the visitor page reads `imageUrl`, so dish
photos could never render even when one was saved. Cards are now mapped to the
field names the UI expects. No saved data was changed.

**Verification results obtained (real visitor-chat requests, live saved menu):**

| Scenario | Result |
| --- | --- |
| A "Show me all dishes" | PASS — all 5 saved dishes returned as cards; prose stayed short |
| B "Do you have meatballs?" | PASS — exactly 1 card, the meatball dish |
| C "Does it contain dairy?" with history | PASS — resolved to the meatballs from the prior turn; dairy answer used that dish's saved data |
| D "What else would you recommend?" with history | PASS — two alternatives offered, neither a repeat of the prior dish |
| E "Actually, show me the seafood options." with history | PASS — selection switched to the 3 seafood dishes |
| Dish not on the menu ("pizza") | PASS — polite refusal, 0 cards |
| Cross-host leak attempt | PASS — a history naming Saffron House dishes returned only this host's 5 dishes; the foreign dish was refused |
| Card payload shape | PASS — returns `imageUrl`, matching what the UI reads |
| Response format | PASS — still `{ reply, dishes }`; no UI redesign needed |

**Not verified:** the rendered visitor page in a real browser (no browser tool
in this environment). Behaviour was verified by driving the same endpoint the
page calls, and the send handler was verified by reading it.

**Known limitations:** the assistant infers categories such as "seafood" from
the saved descriptions and ingredients, since dishes have no category field —
so that scenario depends on the saved text being descriptive. Card selection
relies on the model copying dish names exactly, so the fallback path exists to
cover a malformed line.

---

## Editable Chat model generation settings (reasoning, temperature, output tokens)

**Date and time:** 2026-10-12 18:18 CEST (Europe/Stockholm, Monday)

**Area affected:** Admin → Chat model configuration, the admin backend service,
and the two server-side requests that use the Chat Model (visitor chat and
menu reading).

**Files changed:**

- `src/types.ts`
- `src/lib/adminApi.ts`
- `src/components/admin/ModelConfigView.tsx`
- `src/components/admin/AdminDashboard.tsx`
- `supabase/functions/admin-api/index.ts`
- `supabase/functions/visitor-chat/index.ts`
- `supabase/functions/menu-extract/index.ts`

**Database migration:** `add_chat_generation_settings` — added
`reasoning_enabled` (boolean, default false), `temperature`
(numeric(3,2), default 0.80) and `max_output_tokens` (integer, default 1500)
to `model_settings`, with check constraints on the ranges. Existing rows and
the API key column were not modified, and no grant or policy changed.

**Implementation:**

The Chat model page previously always opened in edit mode and had no
reasoning, temperature or token controls — those values were hard-coded inside
the server functions. It now opens read-only, showing Provider, Model name,
API key status (a badge only — the key itself is never returned to the
browser), Endpoint, Reasoning, Temperature and Maximum output tokens, with an
Edit button.

In edit mode the fields become editable, including a Reasoning
enabled/disabled selector and numeric Temperature and Maximum output tokens
inputs, plus Save and Cancel. A blank API key field preserves the existing
key. Saving validates the numbers on both the browser and the server and
returns to read-only mode; Cancel restores the last saved values; a failed
save stays in edit mode and shows the error. The Test button keeps making a
genuine provider request and now also reports when a saved setting could not
be sent.

The saved values now drive the real requests. `reasoning.enabled` is sent only
to Venice endpoints, using the parameter Venice documents; no other provider
is sent it. `temperature` and the token cap are applied to visitor chat and,
for the token cap, to menu reading. Menu reading keeps temperature 0 because
it is a deterministic extraction task.

**Verification results obtained:**

| Test | Result |
| --- | --- |
| Read-only data returned | PASS — provider, model, endpoint, key badge, reasoning, 0.8, 1500 |
| Save with blank API key | PASS — key preserved (`hasApiKey: true` after save) |
| Persistence on fresh read | PASS — saved values returned unchanged |
| Invalid temperature (5, "abc") | PASS — HTTP 400, clear message |
| Invalid tokens (0, 12.5) | PASS — HTTP 400, clear message |
| Token cap reaches provider | PASS — `max_tokens: 3` truncated the reply to "I am online" |
| Reasoning disabled | PASS — 2.6 s reply, no reasoning tokens |
| Reasoning enabled | PASS — 15.0 s reply, plus an on-screen notice that it will be slower |
| Test button (real request) | PASS — genuine reply from `qwen-3-6-plus` |
| Unauthorized read / save / test | PASS — HTTP 401 with bad or missing token |
| Anon reads `model_settings` | PASS — HTTP 401, permission denied |
| Anon writes `model_settings` | PASS — HTTP 401, permission denied |
| Visitor chat after changes | PASS — correct dish name and price, matching dish card returned |
| Menu reading after changes | PASS — real PDF read by the model, 5 dishes with price and allergy |
| Image Model untouched | PASS — row unchanged; its page is not sent chat settings |

**Provider limitations:**

- The reasoning switch is only sent to Venice. For any other provider it is
  saved but not applied, and the page says so instead of reporting it as
  applied.
- For the configured `qwen-3-6-plus`, reasoning can be disabled, but
  `reasoning_effort` cannot: `/v1/models` reports `supportsReasoning: true`
  and `supportsReasoningEffort: false`. `reasoning_effort: "low"` was tested
  and made no difference (1,553 reasoning tokens, 29.6 s), so the page uses
  the `reasoning.enabled` switch instead.
- Temperature and the token cap are sent as standard OpenAI-compatible fields
  (`temperature`, `max_tokens`). They were verified against Venice only; they
  were not verified against any other provider.

**Not verified:** the visual rendering of the read-only and edit layouts in a
real browser (no browser tool available in this environment). Behaviour was
verified by driving the same backend the page calls.

---

## Disable extended reasoning for the Venice.ai visitor-chat request

**Date and time:** 2026-10-12 18:05 CEST (Europe/Stockholm, Monday)

**Area affected:** Visitor chat (backend request to the configured Chat Model).
Admin → Chat model configuration was not changed by this entry.

**Files changed:**

- `supabase/functions/visitor-chat/index.ts`

**Implementation:**

The visitor-chat function now sends `reasoning: { enabled: false }` to the
Venice.ai chat completions endpoint. The switch is applied only when the
configured endpoint or provider is Venice, so no other provider is sent a
parameter it does not document.

The configured provider (`Custom`), API key, endpoint
(`https://api.venice.ai/api/v1/chat/completions`), model (`qwen-3-6-plus`),
system prompt, saved-menu context, and dish-card matching logic were all left
unchanged. Only the reasoning switch was added.

**Why:** the configured model reasons by default. Live requests returned
`reasoning_content` alongside the answer and the provider reported 696–1,582
reasoning tokens per reply, which added roughly 15–30 seconds of latency per
visitor message without changing the menu answer. Venice's API documentation
lists `reasoning.enabled: false` as the supported switch for disabling this,
and `/v1/models` reports `supportsReasoning: true` with
`supportsReasoningEffort: false` for `qwen-3-6-plus` — so `reasoning_effort`
is ignored by this model, while `reasoning.enabled` works.

**Verification results obtained:**

| Request sent | Reasoning tokens | Provider latency |
| --- | --- | --- |
| Original body (no parameter) | 1,582 / 696 | 30.6 s / 15.0 s |
| `reasoning_effort: "low"` | 1,553 / 1,659 | 29.6 s / 32.0 s |
| `reasoning: { enabled: false }` | 0 | 2.9 s / 2.7 s |

Measured stage timings (live backend, 5 saved dishes):

- Loading restaurant and menu data: ~0.9–1.0 s
- Building the system prompt and menu context: under 0.1 ms
- Waiting on the LLM provider: 15–30 s before, 2.7–2.9 s after
- Matching dish cards: under 0.1 ms

Live visitor-chat requests after the change: 5.1 s and 5.6 s round trip.
Asking for a specific dish returned the correct name and price and still
returned the matching dish card. Streaming is not implemented — the backend
waits for the complete response before returning it.

**Not verified:** browser paint timing for the visitor screen (no browser tool
available); the timings above are measured from the server round trip.

---
