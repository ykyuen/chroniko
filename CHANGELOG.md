# Changelog

All notable changes to Chroniko are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.8.0] - 2026-11-20

### Added

- Any IANA time zone on the clock scale, e.g. `timeZone: 'Asia/Tokyo'`, for a venue's time or a region's business hours. `timeZone`, `timeZones`, `setTimeZone`, `setState` and the URL's `ck-tz` take any name the browser's `Intl` knows, aliases such as `'US/Eastern'` included; an unknown name throws. A zone keeps the name it was given, with its capitalisation corrected, and names `Intl` reads as UTC, such as `'Etc/UTC'`, are `'UTC'`. Times, axis ticks and daylight saving changes follow the zone wherever the viewer is. See the README's "Time zones" section.
- With three or more `timeZones`, the toolbar shows a menu instead of a button. IANA zones are named by `Intl` in the timeline's language, with their current offset, e.g. "Japan Standard Time (GMT+9)", in the menu and on the button. A new `timeZone` string in all 13 languages labels the menu, and `uiText` can override it.
- A README section, "Reconnecting", on catching up after a source's connection drops, so a running event whose end was lost doesn't grow forever.

### Changed

- `timeZones` throws when it lists two names for the same zone, e.g. `'US/Eastern'` and `'America/New_York'`.
- The URL's `ck-tz` leaves the `/` in IANA names unescaped, e.g. `ck-tz=Asia/Tokyo`. Links with `Asia%2FTokyo` still open.
- The clock and live examples have a time zone menu of local time, UTC, New York and Tokyo.
- The live example removes its running events when the demo server starts a new feed after a long disconnect, since their ends won't come. The server marks a new feed with a `reset` message, and gives each feed its own ids, so a new feed never repeats an id the page has.

### Fixed

- On a night the clocks change by half an hour, as on Lord Howe Island, the axis no longer shows an extra tick at the half hour: hourly ticks go from 01:00 to 03:00 instead of 01:00, 02:30, 03:00.

## [0.7.1] - 2026-11-20

### Changed

- Faster live timelines. With 5,000 events in view, 20 new a second and the view following now, frames take about 17 ms (60 fps) in headless Chromium, down from about 83 ms. Panning, and following, moves the lanes, axis and grid with one transform instead of moving every event; tooltips, the legend, the tag bar and the label font are only worked out again when they change.
- `updateEvent` keeps every event in its row when the event keeps its start and takes no more room than before, as when a running event is closed. Before, every update rearranged the rows.
- The README's "Live mode" section has a "Performance" part with these measurements.

### Fixed

- While events stream in, the legend and tag bar buttons are no longer replaced on most frames, so clicking one no longer sometimes misses.

## [0.7.0] - 2026-11-20

### Added

- Live mode on the clock scale, for activity feeds of deploys, jobs, incidents or alerts. See the README's "Live mode" section.
- A red "now" line on the clock scale, drawn whenever the current time is in view. Its color is the new `--ck-now` custom property.
- `follow` option: `true` keeps now near the view's right edge as time passes, at the current zoom. Panning (dragging, scrolling sideways, the arrow keys, `panBy`, `zoomTo`, `fit`, `reveal`, `setState` with a view) stops following; zooming doesn't, and zooms around now. `true` or `false` adds a **● Live** toolbar button, lit while following, that starts and stops it.
- `follow(on)`, `isFollowing()` and the `onFollowChange(following)` callback.
- Running events: `running: true` draws a bar from the start to now that grows as time passes, and keeps its row until it ends. Its tooltip and story card say how long it has run, e.g. "running for 15 minutes, 12 seconds", updated every second. Close it with `updateEvent(id, { end, running: false })`. A running event with an `end` throws, as does `running` on the historical scale.
- `retain` option (clock scale): drops events that ended more than that many ms ago. `maxEvents` option: keeps at most that many events, dropping those that start first. Running events are never dropped. Dropped events leave the selection, calling `onSelectionChange`, and don't make the rows rearrange.
- `source` option: a function called once at the end of the constructor with `{ add, update, remove }`, to feed the timeline from Server-Sent Events, a WebSocket or polling. A cleanup function it returns, or resolves to, is called by `destroy()`. Calls after `destroy()` are ignored.
- Events added with `addEvents` (or a source's `add`) flash once. Events added during construction don't. Nothing flashes under `prefers-reduced-motion`.
- `getState()` includes `following` on the clock scale, and `setState({ following })` starts or stops following, at the span of the view it sets, if any. With `syncUrl`, the hash stores `ck-live=<span in ms>` instead of `ck-view` while following, so it isn't rewritten as time passes; opening such a link follows now at that span.
- New locale strings in all 13 languages, which `uiText` can override: `live` and `followNow(live)` for the Live button, and `runningFor(date, duration)`.
- A third example page, `examples/live.html`, streamed from a new `/events` Server-Sent Events endpoint in `npm start`'s server. The page makes up the feed itself when that endpoint isn't there.

### Changed

- `destroy()` can be called more than once; the calls after the first do nothing.

## [0.6.2] - 2026-11-17

### Changed

- `setState` with a `timeZone` on the historical scale throws `setState timeZone needs timeScale: 'clock'`. Before, it blamed `setTimeZone`.
- A backwards visible range given as `Date` objects shows them as ISO strings in the error, e.g. `zoomTo start (2026-11-05T00:00:00.000Z) must be before zoomTo end (2026-11-04T00:00:00.000Z)`. Before, it showed their long `toString()` form.

### Fixed

- `setEvents`, `addEvents` and `updateEvent` throw when an event ends before it starts, e.g. `event "Black Death" ends (1340) before it starts (1347)`, and leave the timeline unchanged. Before, such an event was accepted and drawn backwards, and `updateEvent` could move a start past an end the patch didn't change. An end is compared by where its range stops, so a date-only end on the start's day, or a year end in the start's year, is fine.
- On the clock scale, the story counts a date-only `end` to the end of its day, as the bar does: `"2026-11-01"` to `"2026-11-04"` lasted 4 days, not 3. Its "End of …" marker sits where the range stops, so an event ending on the day it starts, e.g. `"2026-11-04T09:00"` to `"2026-11-04"`, now gets a marker ("lasted 15 hours"). Before, such an event had no end marker, and after a time zone switch the duration disagreed with the end time shown, e.g. "31 Oct 2026, 16:00 – 4 Nov 2026, 16:00" lasted 3 days. `formatDuration` and the historical scale are unchanged.

## [0.6.1] - 2026-11-11

### Changed

- Errors for a bad visible range name the call and the date that was wrong, e.g. `setState start is invalid: cannot parse time "nope"`, `zoomTo end is missing` or `the start option (1500) must be before the end option (1300)`. Before, `setState` and the `start` and `end` options blamed `zoomTo`, and an unparseable date didn't say where it came from.

### Fixed

- `updateEvent` no longer moves an event whose dates the patch doesn't change. Before, after a time zone switch, any patch (even one changing only the title) read the event's offset-free `start` and `end` strings again in the new zone, shifting the event by the zone's offset. Dates in the patch are still read in the zone in use.
- A date-only `start` or `end` shown in a time zone other than the one it was read in now shows its time in tooltips and the story, e.g. "3 Nov 2026, 16:00" for `"2026-11-04"` added in Hong Kong and shown in UTC. Before, it showed only the date in the new zone ("3 Nov 2026"), a day off with nothing to explain it. A date-only `end` shows the instant the range stops, e.g. "4 Nov 2026, 16:00".
- `setState` checks the whole state before applying any of it, so a state that throws leaves the timeline unchanged. Before, a state with a valid `timeZone` and an invalid `start` or `end` switched the zone and called `onTimeZoneChange`, and then threw.

## [0.6.0] - 2026-11-11

### Added

- Time zones on the clock scale: `timeZone: 'local' | 'UTC'` shows times in the viewer's local time (the default) or in UTC. Offset-free strings are read in the zone in use when they're added, and keep that instant when the zone changes. The axis names the zone, e.g. `GMT+8` or `UTC`. Other zone names throw; IANA zones such as `'Asia/Tokyo'` are planned. `timeZone` with `timeScale: 'historical'` throws.
- `timeZones` option: lists two or more zones, e.g. `['local', 'UTC']`, and adds a toolbar button that shows the zone in use and switches to the next one. Switching moves no event and keeps the view; the axis, story and tooltips are labelled again.
- `setTimeZone(timeZone)`, `getTimeZone()` and the `onTimeZoneChange(timeZone)` callback.
- `getState()` and `setState()` include `timeZone` on the clock scale. With `syncUrl`, the hash stores it as `ck-tz`, so a shared link opens in the sender's zone.
- New locale strings in all 13 languages, which `uiText` can override: `localTime`, and `switchTimeZone(current, next)` for the button's tooltip and accessible label.
- The clock example page has the time zone button.

## [0.5.0] - 2026-11-04

### Added

- `timeScale: 'clock'`: timelines measured in days, hours, minutes and seconds, for deploys, jobs, incidents and other events. Dates are epoch ms, `Date` objects or ISO strings. Strings with `Z` or an offset are exact. Strings without one, including date-only strings, are read in local time. Times are shown in local time on a 24-hour clock, and the axis names the time zone (e.g. `GMT+8`). The axis steps from 1 second to years, with day and longer steps on local midnight, so a day with a daylight saving change is 23 or 25 hours wide. A date-only `end` covers the whole day. `getState()`, `minSpan`, `maxSpan` and the `ck-view` URL parameter use epoch ms. The default `timeScale: 'historical'` works as before.
- `parseTime(input)`: parses clock dates. `formatDate` and `formatDuration` accept its results as well as `parseDate`'s. Clock durations count days, months and years on the calendar, and hours, minutes and seconds as the time that actually passed.
- New locale strings in all 13 languages, which `uiText` can override: hour, minute and second units, "less than an hour/minute/second", `dateTime(date, time)` and `dayMonth(day, month)`.
- A second example page, `examples/clock.html`, with a day of deploys, jobs, incidents and alerts.

## [0.4.1] - 2026-11-04

### Fixed

- `setEvents`, `addEvents` and `updateEvent` throw a `Chroniko:` error naming the call and the event's position when given something other than an object, e.g. `addEvents(null)`. Before, they threw a `TypeError` that didn't say what was wrong. The timeline is still left unchanged.

## [0.4.0] - 2026-10-28

### Added

- `addEvents(events)`, `updateEvent(id, patch)` and `removeEvents(ids)`: change some events without replacing them all with `setEvents`. The view and selection are kept. `addEvents` returns the added events' ids, and adds none of them if any is invalid. Events added later than all others are packed into the existing lanes, so the lanes already shown don't move. The legend, tag bar and story are redrawn at most once per animation frame.
- Events added without an `id` continue the position numbering from `setEvents`, so adding events never changes existing generated ids.
- An API reference in [`docs/API.md`](docs/API.md), linked from the README.
- The example page has a form under the timeline that adds events, and edits or deletes the event last selected in the timeline.

### Changed

- `setEvents` calls `onSelectionChange` when selected events are no longer in the new list and so leave the selection, as `removeEvents` does. With `syncUrl`, the URL is updated too. Before, the selection changed without either.
- A category keeps its palette color for the timeline's lifetime. Before, every `setEvents` call assigned palette colors again from scratch, so a category could change color when the events changed.

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

[Unreleased]: https://github.com/ykyuen/chroniko/compare/0.8.0...HEAD
[0.8.0]: https://github.com/ykyuen/chroniko/compare/0.7.1...0.8.0
[0.7.1]: https://github.com/ykyuen/chroniko/compare/0.7.0...0.7.1
[0.7.0]: https://github.com/ykyuen/chroniko/compare/0.6.2...0.7.0
[0.6.2]: https://github.com/ykyuen/chroniko/compare/0.6.1...0.6.2
[0.6.1]: https://github.com/ykyuen/chroniko/compare/0.6.0...0.6.1
[0.6.0]: https://github.com/ykyuen/chroniko/compare/0.5.0...0.6.0
[0.5.0]: https://github.com/ykyuen/chroniko/compare/0.4.1...0.5.0
[0.4.1]: https://github.com/ykyuen/chroniko/compare/0.4.0...0.4.1
[0.4.0]: https://github.com/ykyuen/chroniko/compare/0.3.1...0.4.0
[0.3.1]: https://github.com/ykyuen/chroniko/compare/0.3.0...0.3.1
[0.3.0]: https://github.com/ykyuen/chroniko/compare/0.2.1...0.3.0
[0.2.1]: https://github.com/ykyuen/chroniko/compare/0.2.0...0.2.1
[0.2.0]: https://github.com/ykyuen/chroniko/compare/0.1.1...0.2.0
[0.1.1]: https://github.com/ykyuen/chroniko/compare/0.1.0...0.1.1
[0.1.0]: https://github.com/ykyuen/chroniko/releases/tag/0.1.0
