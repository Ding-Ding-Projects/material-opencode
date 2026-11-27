# Material OpenCode redesign: design canvas handoff

Files for a Design canvas (type slug bcd2878f-a88d-4094-a616-8e39d8a5fd8a). Nothing here has been published; the caller publishes.

- `project/canvas.json`: v3 index, 6 pages, 23 boards, one sticky note per board, one `title1` note per page. Titles, page names and notes use the private vocabulary.
- `public-canvas.json`: the same index with every title, page name and note in ordinary English (scanned: no private vocabulary).
- `project/*.dc.html`: 23 self-contained boards. All text inside boards is ordinary English product copy.

Status of everything on these boards: design proposal. Nothing is claimed as implemented or verified in the app.

## Look

Material 3 Expressive: tonal surfaces (light #FEF7FF, dark #141218), 28px cards, pill buttons, 16px-radius chips, seed accent #6750A4 with coral #FF8A65 and teal #00897B (teal fills use #00796B and coral is used as a container with dark text so text stays at or above 4.5:1). Roboto Flex plus JetBrains Mono through one Google Fonts css2 link per board. Icons are inline stroke SVG in one style (Lucide-style paths, 1.75 stroke); no emoji.

## Shared Tweaks (same name and default on every board)

| Tweak | Editor | Default | Effect |
|---|---|---|---|
| `accent` | color | `#6750A4` | Sets `--acc` on the board root; primary, containers and focus rings derive from it with `color-mix` |
| `dark` | boolean | `false` | Root class `th-dark` swaps every surface and ink token |
| `density` | enum comfortable, compact | `comfortable` | Root class `dn-compact` tightens padding, gaps and type |
| `motion` | boolean | `true` | Root class `mo-off` sets `animation:none; transition:none` on everything; `prefers-reduced-motion` does the same |

Board-specific Tweaks are `stage` (enum) and `items` (int), listed per board below.

## Controls

Every setting row has: label, config key, an info icon button whose tooltip and aria-label carry the schema description, the real schema type, a rich control, a source badge (Default, Global, Project) and a reset icon button. Controls are real inputs backed by component state: segmented buttons are radio groups, switches are `role="switch"` checkboxes, sliders are paired with a number field, text fields are labelled inputs. Hit targets are 44px or larger (small icon buttons extend their target with a pseudo-element).

## Boards


### Page `shell`: App shell

#### `Main.dc.html` (Home and projects (app front door))

- Frame: 1440 x 980 at (0, 0), `expand: fill`
- Shows: the app front door. New-session hero with prompt, project, agent and model pickers; recent sessions; projects.
- Tweaks: accent, dark, density, motion; `items`: 0 to 6 (default 5)
- Motion: drifting tonal shapes behind the hero (dramatic); staggered rise on panels; shape-morph on hover and press. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for the home route in packages/app (home/, new-session/). The search bar opens the palette board. Still open: this layout is a proposal. Session rows, status chips and the project list use sample data. Nothing here is wired to the server.

#### `Session.dc.html` (Session workspace)

- Frame: 1440 x 960 at (1920, 0), `expand: fill`
- Shows: one session. Timeline with tool calls, a permission request, composer, and a side panel with tabs, changed files and a diff.
- Tweaks: accent, dark, density, motion; `stage`: permission, streaming, idle (default permission); `items`: 0 to 6 (default 4)
- Motion: permission card pulses until answered (dramatic); flowing progress and blinking caret while streaming; rise on entry. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for session/ in packages/app. The permission card uses the real replies (once, always, reject) and the real permissions key. Still open: side-panel tabs other than Changes are not drawn. The diff and transcript are sample content. The context meter is a placeholder figure.

#### `Palette.dc.html` (Command palette (Ctrl+Shift+F))

- Frame: 1440 x 1000 at (3840, 0), `expand: fill`
- Shows: the palette over a dimmed home screen. Settings results carry live controls (segmented, switch, slider) beside commands, sessions and files.
- Tweaks: accent, dark, density, motion; `stage`: results, no-results, regex-error (default results); `items`: 0 to 6 (default 4)
- Motion: scrim fade and spring-in of the dialog; error pulse on the regex-error banner. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for home/start/command-palette.tsx plus the settings search index. Editing a setting inside search results is new. Still open: inline setting controls in the palette, the regex toggle and the Ctrl+Shift+F binding are proposals. No global key handler exists on the board.

#### `ShellStages.dc.html` (Shell stages: loading, empty, offline, error)

- Frame: 1440 x 900 at (5760, 0), `expand: fill`
- Shows: the four whole-screen stages of the app shell.
- Tweaks: accent, dark, density, motion; `stage`: loading, empty, offline, error (default loading)
- Motion: shimmer skeleton and flowing connect bar (loading); slow shape drift (empty); flowing retry bar (offline); alarm pulse on the error icon (dramatic). Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for session/route-error.tsx, server-unavailable-panel.tsx and the first-run empty home. Still open: copy and layout are proposals. The stack trace is sample text with a placeholder session id. Auto-retry timing is not specified.


### Page `config`: Configuration studio

#### `ConfigOverview.dc.html` (Configuration studio overview)

- Frame: 1440 x 1020 at (0, 0), `expand: fill`
- Shows: the entry to settings. Twelve categories with their real config keys, the search field with regex toggle, and the source-layer legend (Default, Global, Project).
- Tweaks: accent, dark, density, motion; `stage`: browse, search (default browse); `items`: 0 to 6 (default 6)
- Motion: staggered rise of category tiles; tile shape-morph on hover. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for packages/app/src/settings (search-catalog.ts, search-index.ts) over packages/schema/src/config.ts. Still open: the category grouping, the per-category counts and regex search are proposals; counts are sample data.

#### `ConfigGeneral.dc.html` (Configuration: General)

- Frame: 1440 x 1500 at (1920, 0), `expand: fill`
- Shows: top-level keys with rich controls: shell, model (+ variant), default_agent, username, timezone, update, share, enterprise.url, snapshots, automations, worktree.directory.
- Tweaks: accent, dark, density, motion
- Motion: staggered section rise; springy switch thumb and segmented check; hover and press on every control. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for Config.Info in packages/schema/src/config.ts. Types under each label are the real schema types. Still open: pickers open nothing on the board. Which layer each value comes from is sample data. Shell detection count is a placeholder.

#### `ConfigPermissions.dc.html` (Configuration: Permissions and policies)

- Frame: 1440 x 1660 at (3840, 0), `expand: fill`
- Shows: the ordered permissions rule builder (drag handle, tool chip, pattern field, allow / ask / deny) with an add row and a Try a call checker; then the policies list.
- Tweaks: accent, dark, density, motion; `items`: 0 to 8 (default 6)
- Motion: rules slide on hover; effect colours animate; staggered rise. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for Permission.Ruleset (action, resource, effect) where the last matching rule wins (core/permission/policy.ts findLast), and ConfigPolicy actions. Still open: drag reordering is drawn, not working. The Try a call result is static sample output. Tool list for the picker is not defined.

#### `ConfigAgents.dc.html` (Configuration: Agents and commands)

- Frame: 1440 x 2820 at (5760, 0), `expand: fill`
- Shows: agents as cards (build, reviewer) with model, mode, temperature, step limit, colour swatches, hidden, description, system prompt and per-agent tool permissions; then the commands record.
- Tweaks: accent, dark, density, motion; `items`: 0 to 4 (default 2)
- Motion: swatch shape-morph when chosen; slider thumb squeeze; staggered card rise. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for ConfigAgent.Info and ConfigCommand.Info. The schema has no temperature or tools keys, so temperature is shown as request.body.temperature and tool toggles as the agent permissions ruleset. Still open: whether request.body.temperature reaches every provider is not checked. The plan agent card is collapsed into a chip.

#### `ConfigMcp.dc.html` (Configuration: MCP servers and providers)

- Frame: 1440 x 3500 at (0, 2940), `expand: fill`
- Shows: mcp.timeout sliders; a local server (command chips, cwd, environment editor, Code Mode, protocol, pool) and a remote server (url, sign-in variant, headers) with status dots; collapsed servers; two provider cards.
- Tweaks: accent, dark, density, motion; `items`: 0 to 5 (default 3)
- Motion: live ping on connected dots; springy controls; staggered rise. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for Mcp.LocalConfig / RemoteConfig / OAuthConfig, the Mcp status union (connected, pending, disabled, failed, needs_auth) and ConfigProvider.Info. Still open: switching transport does not swap the form on the board. Provider key detection and model lists are sample data. No secret value is ever shown; only variable names.

#### `ConfigTools.dc.html` (Configuration: LSP, formatters, tool output, watcher, compaction, warming)

- Frame: 1440 x 2860 at (1920, 2940), `expand: fill`
- Shows: lsp and formatter (All built-in / Off / Per entry, then per-language rows), tool_output sliders, watcher.ignore chips, compaction and warming.
- Tweaks: accent, dark, density, motion
- Motion: staggered section rise; control transitions throughout. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for ConfigLSP, ConfigFormatter, ConfigToolOutput (defaults 2000 lines, 51200 bytes), ConfigWatcher, ConfigCompaction, ConfigWarming. Still open: this board stacks sections from four categories for review; in the app each sits under its own category. Built-in server and formatter names and commands are illustrative.

#### `ConfigSave.dc.html` (Configuration: save flow, validation error, saved)

- Frame: 1440 x 1220 at (3840, 2940), `expand: fill`
- Shows: how edits are saved. Pending-changes bar, JSONC diff review drawer, validation error stage, and the saved stage.
- Tweaks: accent, dark, density, motion; `stage`: pending, review, invalid, saved (default pending)
- Motion: bar springs up; drawer slides in; alarm pulse on the invalid card (dramatic); check pop with a burst of shapes on saved (dramatic). Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for the config document write path (server handlers/config.ts) and the config.updated event. Only changed keys are rewritten. Still open: comment-preserving JSONC writes, per-key revert, Undo, and whether running sessions pick up changes are not confirmed.

#### `ConfigBypass.dc.html` (Configuration studio — full bypass permissions mode)

- Frame: 1440 x 1080 at (5760, 2940), `expand: fill`
- Shows: the bypass_permissions switch in Permissions and policies (config key, default off), with what still applies: configured deny rules and managed policies.
- Tweaks: accent, dark, density, motion; `stage`: off, keys, slider, confirmed, on (default off)
- Confirmation: two-key super confirmation in the review drawer. "Turn key 1" and "Turn key 2" are separate buttons that each become "Key N turned"; both unlock the full-width "Slide all the way to confirm" slider; reaching the end shows "Confirmed. Save is now available." and enables Save. "Emergency exit" is always visible and resets the keys and slider. There is no typed-word step.
- Banner (stage on): "Full bypass mode is on — Tools run without asking for approval. Configured deny rules and managed policies still apply." with a Turn off button.
- Motion: key-rotate and pop when a key turns; flowing striped fill while the slider is dragged (dramatic); burst of shapes on Confirmed (dramatic, celebratory); pulsing rings on the warning mark and alarm pulse on the banner (dramatic); drawer slide. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for bypass_permissions in packages/schema/src/config.ts and the ask-to-allow check in core/src/permission.ts; the settings surface is settings/configuration/configuration.tsx. Still open: the two-key and slider confirmation and the banner layout are this design. The slider does not snap back if released early, and Save does not write anything on the board.


### Page `hosting`: Web app in Docker and appliance image

#### `HostSetup.dc.html` (First-run owner registration and setup (web app in Docker))

- Frame: 1440 x 900 at (0, 0), `expand: fill`
- Shows: first run of the web app in Docker. Step rail and the current step: owner account, server settings, model provider, ready.
- Tweaks: accent, dark, density, motion; `stage`: owner, server, provider, done (default owner)
- Motion: flowing progress under the active step (dramatic); check pop on done; staggered rise. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for hosting/ in the repository (compose.yaml, setup.ts, port 4096). Today the server uses one password from hosting/.env; owner accounts are new. Still open: accounts, the first-account-is-owner rule, and the credential store wording are proposals. No secret is displayed.

#### `HostDashboard.dc.html` (Server host status (web app in Docker))

- Frame: 1440 x 1100 at (1920, 0), `expand: fill`
- Shows: the host dashboard. LAN address with QR placeholder, health checks, version and update mode, storage, people.
- Tweaks: accent, dark, density, motion; `stage`: healthy, updating, degraded (default healthy); `items`: 0 to 6 (default 6)
- Motion: live ping on healthy; flowing update bar (dramatic); alarm pulse on the degraded error card (dramatic); storage meter grows in. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for the container health check in hosting/Dockerfile and the update config key. Still open: no dashboard exists yet. Storage figures, people and check names are sample data; version is a placeholder. The QR block is a placeholder pattern, not a real code.

#### `ApplianceBoot.dc.html` (Boot console (appliance image))

- Frame: 1440 x 900 at (3840, 0), `expand: fill`
- Shows: the only screen the appliance image draws: boot log on the left, address and QR on the right.
- Tweaks: accent, dark, density, motion; `stage`: booting, ready, error (default booting)
- Motion: flowing progress on the active boot step (dramatic); address pops in when ready; alarm pulse on the no-network error; caret blink. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for appliance/rootfs (OpenRC service, /etc/issue banner with Open the app and the material-opencode helper). Still open: the graphical side panel and QR are proposals; today the banner is text only. The QR block is a placeholder pattern.

#### `DeployApp.dc.html` (One-click deploy app)

- Frame: 1440 x 900 at (5760, 0), `expand: fill`
- Shows: the deploy app. Target list (this PC with Docker, SSH host, VirtualBox, USB flash, Raspberry Pi) and the form for the chosen target.
- Tweaks: accent, dark, density, motion; `stage`: choose, deploying, erase-confirm, done (default choose)
- Motion: flowing progress on the active deploy step (dramatic); alarm pulse on the erase dialog (dramatic); check pop on done. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for hosting/host.sh and host.bat for the PC path and appliance/build.sh for images. Still open: the deploy app does not exist. Choosing a target does not swap the form on the board. Drive detection and the typed-name check are drawn only.


### Page `site`: Docs site

#### `SiteHome.dc.html` (Landing page (docs site))

- Frame: 1440 x 2500 at (0, 0), `expand: fill`
- Shows: the docs site landing page. Hero with download button and a cropped product shot, feature grid, three ways to run it, closing call to action.
- Tweaks: accent, dark, density, motion
- Motion: glow and drift shapes behind the hero (dramatic); product shot rises, saved chip pops; feature cards morph on hover. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for the public site for this repository. The docker command comes from hosting/Dockerfile. Still open: version and password are placeholders. No testimonials or numbers are shown because none exist. Download targets are not wired.

#### `SiteDocs.dc.html` (Docs article: Configuration studio (docs site))

- Frame: 1440 x 2020 at (1920, 0), `expand: fill`
- Shows: a docs article with sidebar, on-this-page list, a layer table, live example controls and the JSON they write.
- Tweaks: accent, dark, density, motion
- Motion: gentle rise on load; link and sidebar hover transitions. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for a new article describing the Configuration studio page. Still open: the article is draft copy for a feature that is still a design. Sidebar entries are a proposed outline.

#### `SitePhone.dc.html` (Landing page on mobile (390 x 844))

- Frame: 390 x 844 at (3840, 0), fixed
- Shows: the landing page hero at mobile width with stacked buttons and a cropped product shot.
- Tweaks: accent, dark, density, motion
- Motion: the same hero drift, smaller. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for the same page as the landing board at a narrow width. Still open: only the first screen is drawn; the menu does not open.


### Page `chat`: Chat (session timeline and composer)

#### `ChatNewSession.dc.html` (New session screen)

- Frame: 1440 x 900 at (0, 0), `expand: fill`
- Shows: the new-session screen. Tinted wordmark over a pulsing violet and teal glow, composer card, project and branch row, four prompt starters.
- Tweaks: accent, dark, density, motion; `stage`: empty, filled (default empty)
- Try: Shared Tweaks: accent (seed colour), dark, density (comfortable or compact), motion (off stills everything). stage: empty, filled. Tap a starter: it fills the composer and the send button wakes up. Type in the composer.
- Motion: glow breathes behind the wordmark (dramatic); starters stagger in; focus ring and lift on the composer; send button shape-morph. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for new-session/ and composer/ in packages/app. Still open: starter wording and the prompts they insert are proposals. Pickers do not open. Nothing is sent.

#### `ChatSession.dc.html` (Running session)

- Frame: 1440 x 1040 at (1920, 0), `expand: fill`
- Shows: a running session. User bubbles (tighter corners where two meet), assistant markdown, a collapsible tool-call group with diff chips, the thinking row, docked composer.
- Tweaks: accent, dark, density, motion; `stage`: thinking, answered, error (default thinking)
- Try: Shared Tweaks: accent (seed colour), dark, density (comfortable or compact), motion (off stills everything). stage: thinking, answered, error. Click the tool-call header to collapse or expand it.
- Motion: shimmering gradient glow on the thinking row (dramatic); stop button with progress ring; alarm pulse on the error retry card (dramatic); tool cards stagger in. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for session/timeline and session/composer in packages/app. Still open: transcript, line counts and the provider error text are sample content. Retry and Stop do nothing on the board.

#### `ChatComposerStates.dc.html` (Composer states)

- Frame: 1440 x 1080 at (3840, 0), `expand: fill`
- Shows: six composer states side by side: idle, focused, attachments, slash commands, @ mention, sending.
- Tweaks: accent, dark, density, motion; `stage`: all, idle, focused, attachments, slash, mention, sending (default all)
- Try: Shared Tweaks: accent (seed colour), dark, density (comfortable or compact), motion (off stills everything). stage: all, or one of idle, focused, attachments, slash, mention, sending to see that state alone.
- Motion: send morphs into stop with a spinning progress ring and flowing bar (dramatic); popovers spring in; caret blink; cards stagger in. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for composer/ (attachments, suggestions, prompt-status machine) in packages/app. Still open: these are drawn states, not a live composer; text in them cannot be edited. The image chip uses a placeholder thumbnail.


### Page `components`: Material Design 3 controls

#### `Controls.dc.html` (Material Design 3 control set)

- Frame: 1440 x 1180 at (0, 0), `expand: fill`
- Shows: the Material Design 3 controls used across the app: buttons, switch, filled text field (with error state), select, segmented buttons, checkbox, assist and filter chips, menu, tooltip, slider.
- Tweaks: accent, dark, density, motion
- Try: Shared Tweaks: accent (seed colour), dark, density (comfortable or compact), motion (off stills everything). Every control works: toggle, type, pick, drag. Tab through to see focus rings; hover the reset button for the tooltip.
- Motion: springy thumb, check and shape changes on press; active indicator sweeps in on focus; header shape morphs; menu and tooltip pop in. Normal motion on every board: staggered entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for the shared controls in packages/ui that the redesign would restyle. Still open: no packages/ui component has been changed to match. The menu is drawn open; the select uses the native list.


## Config keys shown, and where the brief and the schema differ

All keys and types were read from `packages/schema/src/config.ts` and `packages/schema/src/config/*.ts` in the worktree.

- `agents.*` has no `temperature`, `tools` or `prompt` key. The Agents board shows the real keys instead: `model`, `mode`, `steps`, `color`, `hidden`, `disabled`, `description`, `system` (the prompt editor), `permissions` (the per-tool toggles) and `request.body.temperature` (the temperature slider). Whether every provider honours a body temperature is not checked.
- MCP local servers use `environment`; remote servers use `headers` and `oauth` (false or an object). The `disabled` key is drawn as an inverted Enabled switch.
- `lsp` and `formatter` are `boolean | record`; the board draws that as All built-in / Off / Per entry. Server and formatter names and commands in the rows are illustrative.
- `compaction.buffer` is a percent string or a token count; `warming` is `boolean | { prompt, interval, duration }`.
- `permissions` rules are `{ action, resource, effect: allow | deny | ask }` and the last matching rule wins (`core/src/permission/policy.ts`).
- `bypass_permissions` (boolean, default off) is in the worktree's schema and is checked in `core/src/permission.ts`. The two-key and slider confirmation and the warning banner on the bypass board are design proposals.
- Hosting boards follow `hosting/` and `appliance/` in the worktree (port 4096, `/data`, the console banner). Owner accounts, the dashboard, the graphical boot panel and the deploy app do not exist there; today the server uses one password.
- Not drawn as full boards: Models and providers (two provider cards sit on the MCP board), Integrations (websearch, references, plugins, skills, instructions), Automations, Experimental, Raw JSON, media.image. They appear as categories on the overview only.

## Stageshow

Cache used: `vendor/stageshow-skill` in the shared-instructions repository, commit named by the caller as 299140f (the checkout's own `git log` showed f87182b as its top commit; I did not reconcile the two). Read: `SKILL.md`, `references/craft.md`, `references/framing.md`. A fresh `npx skills add` install was not run, and no gold example was copied, because these are full app screens in the canvas format rather than React stage demos.

Applied:
- Restraint: one large element per screen (hero headline, address, stage title); no invented statistics or testimonials; placeholders such as [VERSION], [YOUR PASSWORD], [SESSION ID] where a fact is missing.
- Type: one family, mono only for code, keys, paths and numbers; sentence case; UI text 12 to 16px.
- Spacing: fixed gaps rather than leftover space; 12px or larger insets for words; controls hug their content; nested radii follow padding.
- Icons: one stroke family and size, one colour, no emoji, no sparkle or wand for agent features, no invented logo (plain text wordmark).
- Colour: one neutral family, status colours only for status, filled buttons keep their own colour on hover, depth in dark theme from lighter surfaces.
- Framing on the landing hero and phone board: the product shot bleeds off the bottom edge, only filler rows are cropped, one satellite chip straddles the shot's corner, no plate behind the page.
- Chrome: no fake status bar or keyboard on the phone board; no browser frame.
- Motion with a cause: progress flows only on the active step, alarm pulse only on error or danger, celebration only on success.

Not applicable: the React kit and `Stage`/`Act` scripting, cursor choreography, posters and loops, `--gate` filming, bento grids, kit `Phone`/`Window` frames, the 3-to-7 real-string budget (these are real app screens, so settings rows carry real labels), and "no purple for AI" (the violet seed is the brief's accent, not an AI marker).

## Review

How it was checked: each board's template was flattened locally (holes filled with defaults, branches resolved) and rendered in headless Chrome at frame size for every stage, dark, compact, zero items and maximum items, to measure height and look for overflow. Those previews are not the canvas runtime: no board has been opened in the real editor, so `support.js` behaviour (style strings with a custom property, `ref` callback, controlled inputs) is untested there. The accent is applied twice on purpose, as `--acc` in the root style and through a `ref` callback, in case one path is dropped.

A script also checked every shipped file: tag balance, quoted attributes, every `{{hole}}` being a plain dotted path that `renderVals()` returns, the logic class running under Node, Tweak names and defaults, emoji, private vocabulary in boards and in the public index, and overlap between frames and notes.

Found and fixed:
- Checked radios, switches and prefilled text used uncontrolled defaults that depend on attribute-case handling; all are now state-backed through `renderVals()`.
- Bare `disabled` would read as false; now `disabled="{{ true }}"`. An early version of that rewrite also hit the word "disabled" inside an aria-label on the save board; fixed and guarded.
- Loop variables named `c` shadowed the switch state object on three boards; renamed.
- Deploy target radios shared one group across stages, leaving the default stage with nothing selected; each stage now has its own group.
- Slider fill always painted full; rebuilt as a two-layer background sized from the value.
- Tooltips caused horizontal overflow; root now clips on the x axis.
- Permission rule rows and session side-panel tabs wrapped; agent field headers wrapped their badge; number fields clipped six digits; segmented controls stretched full width inside cards.
- Save board: with the review drawer open the settings grid overflowed into it (now a container query stacks the row); the saved stage still said "not saved yet" with Edited badges (each stage now has its own form).
- Erase dialog only covered part of the board; it now covers the whole frame.
- Boot console collapsed its spacing and used invented key hints; it now mirrors the real appliance banner.
- Removed an invented health endpoint; the landing page shows the docker command from `hosting/Dockerfile`.

Known limits:
- Board heights fit the tallest stage or item count, so some default views have empty space at the bottom.
- Choosing a different transport, target or category does not swap the form; pickers do not open; drag handles do not drag.
- Styling is class-based in `<helmet>` (needed for hover, focus, keyframes and Tweaks), so the properties panel edits fewer inline styles than the format prefers.
- Duplicate element ids exist across mutually exclusive stage branches of one board.
- Contrast was chosen by calculation for the default accent in light and dark; other accent values are not checked.
- QR blocks are placeholder patterns, not scannable codes.

## Repository copy and implementation status (added when the design was committed)

In this folder, `canvas.json` is the ordinary-English index (the hosted canvas keeps its own titles), the `.dc.html` files are the boards, `frames/` holds local renders of each board and stage, and `app-screens/` holds screenshots of the real app taken after the matching work landed.

| Area | In the app today | Still design only |
|---|---|---|
| Material Expressive look | Default design layer with Classic option, tonal palette on the default theme, Roboto Flex, large-radius surfaces, pill controls, spring motion, drifting backdrop graphics, reduced-motion path | Session timeline restyle, command palette with inline setting controls |
| Configuration studio | Every `opencode.json` key with switches, segmented buttons, sliders, chip lists, record and list editors, variant pickers, JSON fallback, source badges, reset, regex search, dry-run JSONC diff review, validation errors, save | Per-field guided wizards, drag-to-reorder |
| Full bypass permissions mode | `bypass_permissions` config key enforced by the server, two-key super confirmation with slider and emergency exit, warning banner with Turn off | Header chip outside Settings |
| Web app in Docker | `hosting/` Dockerfile, compose, interactive setup, `host.sh` / `host.bat` (local and SSH), CI image build, smoke test and GHCR publish | Dashboard screen, owner registration screen |
| Appliance image | `appliance/` Alpine image build (x86_64, arm64, Raspberry Pi 4 UEFI), console banner, CI QEMU boot test | Graphical boot panel, one-click deploy desktop app |
| Chat | Material composer card, tonal user bubbles, glowing new-session backdrop, prompt-starter chips | Thinking glow, composer state morphs, attachment chips restyle |
| Controls | Material buttons, switch, filled fields, segmented buttons, checkbox, menu and tooltip styles | Slider restyle |
| Website | See `site/` | |
