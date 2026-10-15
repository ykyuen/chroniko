# Changelog

All notable changes to Chroniko are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-10-15

### Added

- `language` option: translates the toolbar, story, screen-reader labels, dates and durations. Built in: `en` (default), `zh-Hant`, `zh-Hans`, `yue`, `ja`, `ko`, `fr`, `de`, `it`, `es`, `pt`, `pl`, `nl`. An unknown code throws. The root element gets a matching `lang` attribute.
- `uiText` option: replaces individual UI strings of the chosen language.
- `categoryLabels` option: text shown for each category in the legend and on cards, while the category name stays the key for colors, the URL hash and `getState()`.
- `formatDate`, `formatDuration` and `formatYear` take an optional `language` argument (default `'en'`).
- The example page has a language dropdown (also `?lang=<code>`) and shows translated category labels for every built-in language except English.
- `textSizeToggle` option: shows an **Aa** button in the toolbar that switches the event and category labels from 13px to 14px and the time axis labels from 12px to 13px. The lanes are repacked for the new size.

### Fixed

- Labels no longer overlap or leave gaps when a web font finishes loading after the events are set: label widths are measured again and the lanes are repacked.
- Label widths now use the styles on `.ck-label` itself, including `font-style`, `letter-spacing`, `word-spacing` and `text-transform: uppercase | lowercase`, not just the font on `.ck-lanes`.

## [0.1.1] - 2026-10-14

### Added

- `storyPosition` option: `'below'` (default) keeps the story under the timeline; `'right'` puts it beside the timeline. The toolbar and timeline stick to the top of the window while the page scrolls the story. When nothing is selected, the story column shows a placeholder so the first click doesn't resize the timeline. When the component is 640px wide or narrower, it falls back to the stacked layout.
- `split` option: with `storyPosition: 'right'`, the timeline's share of the width, between 0 and 1 (default `0.6`).
- `--ck-sticky-top` custom property (default `0px`) to keep the sticky timeline below a fixed page header.
- The example page shows the side-by-side layout when opened with `?story=right`.

### Changed

- The constructor throws if `storyPosition` or `split` is invalid.
- The toolbar and timeline are now wrapped in `.ck-main`, and together with the story in `.ck-layout`. Custom CSS that relies on direct children of `.chroniko` (e.g. `.chroniko > .ck-toolbar`) needs updating.
- The README lists the options in a table with their types, whether they're required, and their defaults.
- Chroniko is published on npm. The README's jsDelivr links now load it from npm (`cdn.jsdelivr.net/npm/chroniko@0.1.1/...`) instead of GitHub.

## [0.1.0] - 2026-10-14

- Initial release.

[0.2.0]: https://github.com/ykyuen/chroniko/compare/0.1.1...0.2.0
[0.1.1]: https://github.com/ykyuen/chroniko/compare/0.1.0...0.1.1
[0.1.0]: https://github.com/ykyuen/chroniko/releases/tag/0.1.0
