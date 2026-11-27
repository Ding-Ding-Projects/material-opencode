# Material OpenCode redesign: design canvas handoff

Files for a Design canvas (type slug bcd2878f-a88d-4094-a616-8e39d8a5fd8a). Nothing here has been published; the caller publishes.

- `project/canvas.json`: v3 index, 7 pages, 29 boards, one sticky note per board, one `title1` note per page. Titles, page names and notes use the private vocabulary.
- `public-canvas.json`: the same index with every title, page name and note in ordinary English (scanned: no private vocabulary).
- `project/*.dc.html`: 29 self-contained boards. All text inside boards is ordinary English product copy.

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



### Page `deploy`: Deploy desktop app

All six boards are fixed 1280 x 800 windows (frameless, own title bar) for the desktop deploy app that is about to be built. They follow `hosting/` and `appliance/` in the worktree: port 4096, the six values `hosting/setup.ts` asks for, `hosting/host.sh` (local, `--ssh`, the 2-minute health wait), and the raw and `.vdi` images from `appliance/build.sh`. The earlier `DeployApp.dc.html` board on the hosting page is unchanged.

#### `DeployHome.dc.html` (Deploy desktop app: target picker)

- Frame: 1280 x 800 at (0, 0), fixed
- Shows: the deploy desktop app window (1280 x 800, frameless with its own title bar). Six target cards with readiness and one Deploy button each; nav rail; release picker chip.
- Tweaks: accent, dark, density, motion; `stage`: ready, checking (default ready)
- Try: Shared Tweaks: accent (seed colour), dark, density (comfortable or compact), motion (off stills everything). stage: ready, checking (readiness lines shimmer while the computer is probed). Hover cards.
- Motion: morphing header shape and staggered cards (dramatic entrance); live ping on ready dots; card shape-morph on hover. Normal motion on every board: entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for hosting/host.sh and host.bat (this computer, --ssh) and appliance/build.sh (.vdi for VirtualBox, raw image for USB and SD). Still open: the desktop app is about to be built. Readiness text and version numbers are sample values. The release code name and version are placeholders. VMware output is not produced by appliance/build.sh today.

#### `DeployRun.dc.html` (Deploy desktop app: deployment in progress)

- Frame: 1280 x 800 at (1760, 0), fixed
- Shows: one deployment with a six-step stepper (Download image, Verify checksum, Create instance, Start, Wait for health, Verify link) and a live log.
- Tweaks: accent, dark, density, motion; `stage`: running, success, failed (default running)
- Try: Shared Tweaks: accent (seed colour), dark, density (comfortable or compact), motion (off stills everything). stage: running, success, failed. Hide log / View log toggles the log.
- Motion: flowing progress on the active step and the overall bar (dramatic); address pops in and the check pulses rings on success (dramatic); alarm pulse on the failed error card (dramatic). Normal motion on every board: entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for hosting/host.sh: compose up, then polling the address for up to 2 minutes and printing Ready with the LAN address. Still open: checksum verification, retry-from-step and the QR block (a placeholder pattern) are design. The address is a sample.

#### `DeployInstances.dc.html` (Deploy desktop app: instance manager)

- Frame: 1280 x 800 at (3520, 0), fixed
- Shows: instances with name, target, version, health, link and row actions (start or stop, restart, open, copy link, More: logs, update, duplicate, remove).
- Tweaks: accent, dark, density, motion; `stage`: list, menu, remove (default list); `items`: 0 to 8 (default 4)
- Try: Shared Tweaks: accent (seed colour), dark, density (comfortable or compact), motion (off stills everything). items 0 to 8 (0 is the empty state). stage: list, menu (More menu open), remove (confirm naming the instance and what is deleted).
- Motion: rows stagger in and slide on hover; live ping only on rows checked just now; menu pops; alarm pulse on the remove dialog (dramatic). Normal motion on every board: entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for docker compose up, stop and down from hosting/host.sh; --down keeps the data volume, which is why deleting it is a separate switch. Still open: no instance registry exists yet. Rows are sample data. Health is only stated where the row says it was checked just now.

#### `DeployFlash.dc.html` (Deploy desktop app: USB and SD flashing)

- Frame: 1280 x 800 at (5280, 0), fixed
- Shows: flashing the appliance image to a card or drive: removable-disk list, two-key super confirmation naming the disk, write progress, read-back verify, done with tips for finding the address.
- Tweaks: accent, dark, density, motion; `stage`: pick, confirm, writing, verifying, done (default pick)
- Try: Shared Tweaks: accent (seed colour), dark, density (comfortable or compact), motion (off stills everything). stage: pick, confirm, writing, verifying, done. In pick nothing is preselected; choose a disk. In confirm press Turn key 1 and Turn key 2: both unlock Erase.
- Motion: key-rotate and pop per key; alarm pulse on the erase card (dramatic); thick flowing progress with a large percentage (dramatic); ring pulse on done (dramatic). Normal motion on every board: entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for the raw .img from appliance/build.sh (--pi for Raspberry Pi 4 and 400) and the console banner that shows Open the app. Still open: disk detection, system-disk exclusion, writing and read-back are not built. Percentages are fixed sample values. Choosing a disk does not enable the button on the board.

#### `DeployNewInstance.dc.html` (Deploy desktop app: new instance form)

- Frame: 1280 x 800 at (0, 920), fixed
- Shows: the per-target form: target, instance name, port with a free check chip, projects folder, SSH host (SSH target), memory and processor sliders and network mode (virtual machines), then a review step.
- Tweaks: accent, dark, density, motion; `stage`: form, invalid, review (default form)
- Try: Shared Tweaks: accent (seed colour), dark, density (comfortable or compact), motion (off stills everything). stage: form, invalid, review. Switch Target to see the SSH or virtual-machine fields; drag the sliders.
- Motion: validation chips and footer change with state; segmented, slider and field transitions; staggered entrance. Normal motion on every board: entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for the values hosting/setup.ts asks for (OPENCODE_INSTANCE, OPENCODE_PORT, OPENCODE_WORKSPACE) and --ssh user@host. Still open: live port checking, SSH test and VM sizing are design. Validation on the board is shown by stage, not computed from what is typed.

#### `DeploySetupTui.dc.html` (One-command setup in the terminal (web app in Docker))

- Frame: 1280 x 800 at (1760, 920), fixed
- Shows: a terminal window with the setup for the web app in Docker: arrow-key menu with the default marked, live validation, review before writing, password shown once; the plain-text fallback is smaller beneath.
- Tweaks: accent, dark, density, motion; `stage`: menu, invalid, review, done (default menu)
- Try: Shared Tweaks: accent (seed colour), dark, density (comfortable or compact), motion (off stills everything). stage: menu, invalid, review, done. The terminal stays dark in both themes on purpose.
- Motion: selected menu line pops; caret blink; screen rises in per stage; key hints morph on hover. Normal motion on every board: entrance of panels, hover, press and focus transitions on every control.
- Note says (summary): stands for bun hosting/setup.ts, which today asks the same six values as plain prompts and writes hosting/.env. Still open: arrow-key menus, Back, the review screen and showing the password once are design; today only the plain prompts exist. The password on the board is a placeholder, never a real secret.


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
