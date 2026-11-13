# Accessibility

Target: WCAG 2.2 AA on every public and admin page, plus AAA contrast (7:1) on body text where it is cheap. The public statement lives at `/{locale}/accessibility`.

## Automated

All of this runs in CI (`bun run lint`, `bun run test`, `bun run test:e2e`, `bun run lhci`).

- **Lint:** `eslint-plugin-jsx-a11y` (strict).
- **Unit:** token contrast (`src/styles/tokens.test.ts`): `text-1` and `text-2` at 7:1, `text-3` at 4.5:1 on the surfaces they are used on.
- **axe** (`@axe-core/playwright`, WCAG 2.0/2.1/2.2 A and AA plus best practices, Chromium; WebKit is skipped per D23; pending `Reveal` nodes are excluded per D36):
  - Home in both locales, with the mobile menu open (`shell.spec.ts`);
  - `/projects`, a filtered listing, a project detail, the lightbox open, `/accessibility`, in both locales (`projects.spec.ts`, `a11y.spec.ts`);
  - the localized 404s and the global 404 (`a11y.spec.ts`);
  - the terminal open with output (`terminal.spec.ts`), the tech cloud (`stack.spec.ts`);
  - Home under `prefers-contrast: more` and reduced motion (`a11y.spec.ts`);
  - every admin list and editor, authenticated (`admin-content.spec.ts`).
- **Emulated runs** (`a11y.spec.ts`): reflow at 320 CSS px (400% zoom) and 640 px (200%) with no horizontal scroll on Home, `/projects`, a detail page and `/accessibility`; WCAG 1.4.12 text-spacing overrides; forced colors keeps a ≥ 2px focus outline; reduced motion and the **Pause animations** toggle each leave no looping animation running.
- **Keyboard-only** (`a11y.spec.ts`, `terminal.spec.ts`, `window.spec.ts`): skip link first and moving focus to `main`; the project filter and the language switcher are single tab stops with arrow keys (roving tabindex, applied only after hydration so every option stays reachable without JavaScript); the lightbox opens with Enter, pages with arrows, closes with Esc and returns focus; focus is never covered by the sticky header (2.4.11); the terminal opens with its modifier shortcut, and windows move and resize from the keyboard.
- **Names.** The H1 is the name; the job title stays visible (a line above the H1 below `lg`, the chip above) and in the `<title>` and JSON-LD. Buttons whose label differs from their text, such as the terminal button, the gallery thumbnails and the tech chips, keep the visible text inside their accessible name (WCAG 2.5.3; axe `label-content-name-mismatch`).
- **Lighthouse** accessibility = 100 on Home, `/projects` and a detail page in both locales (`lighthouserc.json`, D60).

Known automation gap: axe cannot judge contrast under forced colors (it reads authored colors); Chromium's forced palette is checked through computed styles instead.

## Manual checklist

Run once before launch and after any large UI change. Mark each cell with the date and ✓, or link an issue.

| Flow                                                                                                                                                                        | NVDA + Firefox | VoiceOver + Safari (macOS) | VoiceOver + Safari (iOS) | TalkBack + Chrome |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------- | ------------------------ | ----------------- |
| Home: skip link, landmarks, heading outline (one `h1`)                                                                                                                      |                |                            |                          |                   |
| Header nav: `aria-current`, language switch keeps route and hash                                                                                                            |                |                            |                          |                   |
| Mobile menu: modal, focus trapped, Esc restores focus; terminal item closes it and focuses the terminal input; language switcher in the header at 320 px with 44 px targets |                |                            |                          |                   |
| Tech stack: List view read as grouped lists; the sphere is silent                                                                                                           |                |                            |                          |                   |
| Project filter (radiogroup) and pagination, also with JavaScript off                                                                                                        |                |                            |                          |                   |
| Project card: "View details about {title}", "Visit app" as its own stop                                                                                                     |                |                            |                          |                   |
| Project detail: breadcrumbs, gallery lightbox as a dialog with a label                                                                                                      |                |                            |                          |                   |
| Resume panes (Experience / Education) as radios                                                                                                                             |                |                            |                          |                   |
| Contact: obfuscated email revealed and copied, copy confirmation announced                                                                                                  |                |                            |                          |                   |
| Terminal: label on the input, output announced after each command, not per character                                                                                        |                |                            |                          |                   |
| Terminal secret flow: password prompt allows paste, nothing echoed                                                                                                          |                |                            |                          |                   |
| Admin: error summary takes focus, fields announce errors, session-expiry warning                                                                                            |                |                            |                          |                   |
| Pause animations toggle (footer and menu), reduced motion honored                                                                                                           |                |                            |                          |                   |
| 200% and 400% browser zoom, text-spacing bookmarklet                                                                                                                        |                |                            |                          |                   |
| Windows High Contrast / forced colors: focus rings and borders visible                                                                                                      |                |                            |                          |                   |

Tips:

- NVDA: browse mode (`Insert+Space` toggles), `H` for headings, `D` for landmarks, `Insert+F7` for the elements list.
- VoiceOver macOS: `VO` = `Ctrl+Option`; the rotor (`VO+U`) lists headings, links and landmarks.
- VoiceOver iOS and TalkBack: swipe through every element of Home once, then use the headings rotor or reading controls.

## Known limitations

Listed on the statement page as well: decorative motion (aurora, sphere spin) has no text equivalent because it carries no information; the tech sphere is hidden from assistive technology and the List view is its equivalent; linked third-party sites are outside this standard. Feedback goes to the contact address on the statement page.
