# Changelog

All notable changes to Chroniko are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/).

## [0.3.1] - 2026-10-19

### Added

- `tagLabels` option: text shown for each tag in the tag bar and on cards, while the tag name stays the key that matches events to each other. The tag bar is sorted by label. Tags without a label show their name.
- The example page shows translated tag labels for every built-in language except English. Its category and tag labels now live in `examples/labels.js`.

## [0.3.0] - 2026-10-19

### Added

- `dimToggle` option (default `true`): shows a **◐** button in the toolbar, left of the **Aa** button, that starts on. While it is on and at least one event is selected, the unselected events are dimmed; hovering or focusing one brings it part way back. Set `dimToggle: false` to remove the button and never dim.
- `tags` event field: an array of strings shown as tags under the description on the event's card in the story. Tags are toggles with three states: a tag is on (solid dark fill, `aria-pressed="true"`) while every event with it is selected, partly on (light grey fill, `aria-pressed="mixed"`) while only some are, and off (`aria-pressed="false"`) while none are. Clicking an off or partly-on tag adds all its events to the selection; clicking an on tag removes them all, even ones that also have another tag. When any event has tags, a collapsible **Tags** bar between the toolbar and the timeline (collapsed at first) lists every tag alphabetically with its event count, and those tags are clickable the same way. A single string is one tag; blank and repeated tags are dropped. A new UI string, `tags`, is translated for every built-in language.
- The icon buttons in the toolbar (+, −, ◐, Aa) and the × on story cards show their label as a tooltip on hover or keyboard focus.

## [0.2.1] - 2026-10-15

### Changed

- `textSizeToggle` also enlarges the story and the toolbar buttons by 1px: body text from 13px to 14px, meta and dates from 12px to 13px, card titles from 16px to 17px.

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

[0.3.1]: https://github.com/ykyuen/chroniko/compare/0.3.0...0.3.1
[0.3.0]: https://github.com/ykyuen/chroniko/compare/0.2.1...0.3.0
[0.2.1]: https://github.com/ykyuen/chroniko/compare/0.2.0...0.2.1
[0.2.0]: https://github.com/ykyuen/chroniko/compare/0.1.1...0.2.0
[0.1.1]: https://github.com/ykyuen/chroniko/compare/0.1.0...0.1.1
[0.1.0]: https://github.com/ykyuen/chroniko/releases/tag/0.1.0
