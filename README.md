# X Ad Hider

X Ad Hider is a personal Chrome MV3 extension for locally hiding unwanted posts and replies on X. It runs entirely in the browser: no X API, no OAuth, no account mutation, and no external service.

## Features

- Hide posts or replies when the body text contains configured keywords.
- Hide posts or replies when the display name or `@handle` contains configured keywords.
- Keep a handle whitelist that always wins over hide rules.
- Extract emoji rendered as `img[alt]` so emoji rules can match X's rendered DOM.
- Hide the whole X timeline item instead of only the `article`, avoiding leftover spacer rows.
- Use a virtual-list-friendly hide flow that keeps scrolling stable while X is loading many replies.
- Show recent local hide logs in the options page.
- Import and export settings as readable JSON.

## Install

1. Run the build:

   ```bash
   pnpm install
   pnpm run build
   ```

2. Open Chrome at `chrome://extensions`.
3. Enable Developer mode.
4. Click **Load unpacked**.
5. Select:

   ```text
   dist
   ```

## Usage

Open the extension options page and configure:

- **Body keywords**: matches post/reply text.
- **Username keywords**: matches display name, `@handle`, and handle text without `@`.
- **Whitelist**: handles that should never be hidden.

All rules are case-insensitive. Matches are local to your browser and do not change your X account relationships.

Settings can be exported from the options page as a UTF-8 JSON file and imported later. Import replaces the current settings. Logs and runtime counters are not included.

## Development

The project uses TypeScript, pnpm, and esbuild. It intentionally does not use Vue, React, or another UI framework.

```bash
pnpm install
pnpm run typecheck
pnpm run build
```

Edit source files under `src/`, rebuild, then reload the unpacked extension from `dist/`.

## Project Structure

```text
src/
  background/   MV3 service worker and message routing
  content/      X timeline discovery, parsing, scheduling, and hiding
  rules/        Rule evaluation
  shared/       Constants, settings normalization, types, and utilities
  storage/      chrome.storage.local access
  ui/           Popup and options pages
  types/        Chrome API type declarations

scripts/        Build scripts
dist/           Generated extension bundle loaded by Chrome
```

## Design Notes

The content script treats X as a virtualized event stream. A page-level lifecycle observer only discovers or replaces the active timeline; scanning then stays inside a container derived from timeline cells. Ready cells are parsed into normalized candidates, evaluated synchronously from a local settings cache, and the background service worker is only used for storage and log writes.

The X-specific DOM boundary is the timeline cell:

```text
[data-testid="cellInnerDiv"]
```

There is no fallback to hiding only `article`. If X changes the timeline item selector, hiding should fail clearly rather than leave partial UI artifacts. Update `src/content/timeline-adapter.ts` if that selector changes.

The active timeline container is derived from the shared parent structure of those cells. The extension does not use parallel CSS selectors, API interception, or alternate DOM fallbacks for filtering.

The content pipeline is split by responsibility:

- `observer-manager.ts`: owns named page and timeline observers and disconnects scopes cleanly.
- `timeline-lifecycle.ts`: discovers the active timeline and remounts when X replaces it.
- `timeline-adapter.ts`: finds X timeline cells and reports viewport relation.
- `candidate-parser.ts`: extracts handle, username text, body text, tweet URL, and a DOM reuse signature.
- `text-extractor.ts`: extracts text and preserves emoji rendered through `img[alt]`.
- `content-rule-cache.ts`: keeps settings in content and runs the shared rule engine synchronously.
- `scan-scheduler.ts`: batches nearby cells first and retries pending cells with bounded backoff.
- `hide-controller.ts`: reserves height while the user is actively scrolling, then compacts hidden cells when scrolling is idle.

## Limitations

- This extension only affects the local browser view.
- It does not mute, block, report, or otherwise modify accounts on X.
- X DOM structure can change; DOM adapters may need updates over time.
