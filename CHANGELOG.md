# Changelog

All notable changes to Chroniko are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/).

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

## [0.1.0] - 2026-10-14

- Initial release.

[0.1.1]: https://github.com/ykyuen/chroniko/compare/0.1.0...0.1.1
[0.1.0]: https://github.com/ykyuen/chroniko/releases/tag/0.1.0
