# X Ad Hider

X Ad Hider is a personal Chrome MV3 extension for locally hiding unwanted posts and replies on X. It runs entirely in the browser: no X API, no OAuth, no account mutation, and no external service.

## Features

- Hide posts or replies when the body text contains configured keywords.
- Hide posts or replies when the display name or `@handle` contains configured keywords.
- Keep a handle whitelist that always wins over hide rules.
- Extract emoji rendered as `img[alt]` so emoji rules can match X's rendered DOM.
- Hide the whole X timeline item instead of only the `article`, avoiding leftover spacer rows.
- Show recent local hide logs in the popup and options page.

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
   outputs/x-ad-muter/dist
   ```

## Usage

Open the extension options page and configure:

- **Body keywords**: matches post/reply text.
- **Username keywords**: matches display name, `@handle`, and handle text without `@`.
- **Whitelist**: handles that should never be hidden.

All rules are case-insensitive. Matches are local to your browser and do not change your X account relationships.

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
  content/      X DOM scanning, parsing, and timeline item hiding
  rules/        Rule evaluation
  shared/       Constants, types, and utilities
  storage/      chrome.storage.local access
  ui/           Popup and options pages
  types/        Chrome API type declarations

scripts/        Build scripts
dist/           Generated extension bundle loaded by Chrome
```

## Design Notes

The content script scans X `article` nodes, extracts body text, username text, handle, and tweet URL, then asks the background rule engine for a decision.

When a rule matches, the extension hides the containing X timeline item:

```text
[data-testid="cellInnerDiv"]
```

There is no fallback to hiding only `article`. If X changes the timeline item selector, hiding should fail clearly rather than leave partial UI artifacts. Update `src/content/timeline-adapter.ts` if that selector changes.

## Limitations

- This extension only affects the local browser view.
- It does not mute, block, report, or otherwise modify accounts on X.
- X DOM structure can change; DOM adapters may need updates over time.
