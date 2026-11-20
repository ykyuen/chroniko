# Chroniko API reference

This page covers everything Chroniko exports: the `Chroniko` class, its options and methods, and the date helpers. For a guide to installing and using it, see the [README](../README.md).

> [!NOTE]
> New features by version:
>
> - **0.8.0**
>   - IANA [time zones](#time-zones), such as `'Asia/Tokyo'`, in `timeZone`, `timeZones`, [`setTimeZone`](#settimezonetimezone), [`setState`](#setstatestate) and `ck-tz`.
>   - A toolbar menu for three or more `timeZones`, and the `timeZone` UI string, its label.
> - **0.7.0**
>   - [Live mode](#live-mode): the [`follow`, `onFollowChange`, `retain`, `maxEvents` and `source`](#options) options, and [`running`](#event-object) events.
>   - [`follow`](#followon) and [`isFollowing`](#isfollowing).
>   - `following` in [`getState`](#getstate) and [`setState`](#setstatestate), and `ck-live` in the [URL hash](#url-hash-format).
>   - The `--ck-now` [CSS custom property](#css-custom-properties).
> - **0.6.0**
>   - The [`timeZone`, `timeZones` and `onTimeZoneChange`](#options) options, for [time zones](#time-zones).
>   - [`setTimeZone`](#settimezonetimezone) and [`getTimeZone`](#gettimezone).
>   - `timeZone` in [`getState`](#getstate) and [`setState`](#setstatestate), and `ck-tz` in the [URL hash](#url-hash-format).
> - **0.5.0**
>   - The [`timeScale`](#options) option, for the [clock scale](#clock-scale).
>   - [`parseTime`](#parsetimeinput).
>   - [`formatDate`](#formatdatedate-language) and [`formatDuration`](#formatdurationstart-end-language) also accept `parseTime()` results.
> - **0.4.0**
>   - [`addEvents`](#addeventsevents)
>   - [`updateEvent`](#updateeventid-patch)
>   - [`removeEvents`](#removeeventsids)
>
> Everything else is available from 0.3.1.

## Contents

- [Importing](#importing)
- [Constructor](#constructor)
- [Options](#options)
- [Event object](#event-object)
- [Dates](#dates)
- [Live mode](#live-mode)
- [Methods](#methods)
  - [Events](#events): [`setEvents`](#seteventsevents), [`addEvents`](#addeventsevents), [`updateEvent`](#updateeventid-patch), [`removeEvents`](#removeeventsids)
  - [View](#view): [`zoomTo`](#zoomtostart-end), [`zoomBy`](#zoombyfactor-ratio), [`panBy`](#panbypx), [`fit`](#fit), [`reveal`](#revealid)
  - [Time zone](#time-zone): [`setTimeZone`](#settimezonetimezone), [`getTimeZone`](#gettimezone)
  - [Following](#following): [`follow`](#followon), [`isFollowing`](#isfollowing)
  - [Selection](#selection): [`select`](#selectid), [`deselect`](#deselectid), [`toggle`](#toggleid), [`clearSelection`](#clearselection), [`getSelection`](#getselection)
  - [State](#state): [`getState`](#getstate), [`setState`](#setstatestate)
  - [Lifecycle](#lifecycle): [`destroy`](#destroy)
- [Callbacks](#callbacks)
- [Date helpers](#date-helpers): [`parseDate`](#parsedateinput), [`parseTime`](#parsetimeinput), [`formatDate`](#formatdatedate-language), [`formatYear`](#formatyearyear-language), [`formatDuration`](#formatdurationstart-end-language)
- [URL hash format](#url-hash-format)
- [CSS custom properties](#css-custom-properties)
- [Errors](#errors)

## Importing

Chroniko is an ES module. Load the stylesheet as well as the script.

```js
// From npm, with a bundler
import { Chroniko, parseDate, parseTime, formatDate, formatYear, formatDuration } from 'chroniko';
import 'chroniko/chroniko.css';
```

```html
<!-- From a CDN, without installing anything -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/chroniko@0.7.1/dist/chroniko.min.css">
<script type="module">
  import { Chroniko } from 'https://cdn.jsdelivr.net/npm/chroniko@0.7.1/dist/chroniko.min.js';
</script>
```

## Constructor

```js
new Chroniko(container, options?)
```

| Parameter   | Type                    | Description |
| ----------- | ----------------------- | ----------- |
| `container` | `string \| HTMLElement` | The element to render into, or a CSS selector for it. |
| `options`   | `object`                | Optional. See [Options](#options). |

The constructor draws the timeline, loads `options.events`, and then sets the view:

1. If both `start` and `end` are given, it shows that range.
2. Otherwise it fits all events.
3. With `syncUrl: true`, it then applies any state found in the URL hash.
4. With `source`, it calls the source last. See [Sources](#sources).

The constructor throws if:

- the container isn't found;
- an option has an invalid value;
- an event is invalid;
- two events share an id;
- the `source` throws (the timeline is removed first).

See [Errors](#errors).

```js
const timeline = new Chroniko('#timeline', {
  events: [
    { id: 'ww2', title: 'World War II', start: '1939-09-01', end: '1945-09-02', category: 'war' },
  ],
  colors: { war: '#c0392b' },
  onSelectionChange: (events) => console.log(events),
});
```

## Options

Every option is optional.

| Option              | Type                 | Default | Description |
| ------------------- | -------------------- | ------- | ----------- |
| `events`            | `object[]`           | `[]`    | The events to show. See [Event object](#event-object). |
| `timeScale`         | `'historical' \| 'clock'` | `'historical'` | How dates are read and shown. See [Dates](#dates). Any other value throws. |
| `timeZone`          | `string`             | `'local'` | Clock scale only. The zone times are shown in, and offset-free strings read in: `'local'`, `'UTC'` or an IANA name such as `'Asia/Tokyo'` (*since 0.8.0*). See [Time zones](#time-zones). |
| `timeZones`         | `string[]`           | —       | Clock scale only. Two or more zones for the viewer to switch between: two give a toolbar button, e.g. `['local', 'UTC']`, and three or more a menu (*since 0.8.0*). No control when omitted. Two names for the same zone throw. |
| `onTimeZoneChange`  | `(timeZone: string) => void` | — | Called when the time zone changes. See [Callbacks](#callbacks). |
| `follow`            | `boolean`            | —       | Clock scale only. Start [following now](#following-now) (`true`) or not (`false`). Either value adds the **● Live** toolbar button. *Since 0.7.0.* |
| `onFollowChange`    | `(following: boolean) => void` | — | Called when following starts or stops. See [Callbacks](#callbacks). *Since 0.7.0.* |
| `retain`            | `number`             | —       | Clock scale only. Drop events that ended more than this many ms ago. A positive number. See [Retention](#retention). *Since 0.7.0.* |
| `maxEvents`         | `number`             | —       | Keep at most this many events, dropping those that start first. A positive whole number. See [Retention](#retention). *Since 0.7.0.* |
| `source`            | `(api) => cleanup?`  | —       | Feeds the timeline from a stream. See [Sources](#sources). *Since 0.7.0.* |
| `start`             | [`DateInput`](#dates) | Fit all events | Start of the first visible range. Only used if `end` is also set. |
| `end`               | [`DateInput`](#dates) | Fit all events | End of the first visible range. Only used if `start` is also set. |
| `colors`            | `object`             | `{}`    | Category → CSS color, e.g. `{ war: '#c0392b' }`. Categories without a color get one from the built-in palette. |
| `minSpan`           | `number`             | `1/12` (one month); clock: `1000` (one second) | Smallest visible span, in years, or ms on the clock scale. |
| `maxSpan`           | `number`             | 3× the data span, at least 100 years (clock: one day) | Largest visible span, in years, or ms on the clock scale. Without this option, the limit grows as events are added. |
| `onSelectionChange` | `(events: object[]) => void` | — | Called when the selection changes. See [Callbacks](#callbacks). |
| `syncUrl`           | `boolean`            | `false` | Keep the view, selection and hidden categories in the URL hash. See [URL hash format](#url-hash-format). |
| `storyPosition`     | `'below' \| 'right'` | `'below'` | Where the story of selected events goes. |
| `split`             | `number`             | `0.6`   | With `storyPosition: 'right'`, the timeline's share of the width. Must be between 0 and 1, not including either. |
| `dimToggle`         | `boolean`            | `true`  | Show the **◐** toolbar button, which dims unselected events while any are selected. It starts switched on. |
| `textSizeToggle`    | `boolean`            | `false` | Show the **Aa** toolbar button, which makes the labels, the story and the toolbar text larger. |
| `language`          | `string`             | `'en'`  | UI language: `en`, `zh-Hant`, `zh-Hans`, `yue`, `ja`, `ko`, `fr`, `de`, `it`, `es`, `pt`, `pl` or `nl`. It can't be changed after construction. |
| `uiText`            | `object`             | —       | Replaces individual UI strings of the chosen language, e.g. `{ fit: 'Show all' }`. The keys are listed in [`src/locales/en.js`](../src/locales/en.js). |
| `categoryLabels`    | `object`             | `{}`    | Category → text shown in the legend and on cards. The category name itself stays the key. |
| `tagLabels`         | `object`             | `{}`    | Tag → text shown in the tag bar and on cards. The tag bar is sorted by these labels. |

## Event object

| Field         | Type                  | Required | Description |
| ------------- | --------------------- | -------- | ----------- |
| `title`       | `string`              | yes      | Shown on the timeline and in the story. |
| `start`       | [`DateInput`](#dates) | yes      | When the event starts. |
| `end`         | [`DateInput`](#dates) | no       | When it ends. An event with an `end` is drawn as a bar; one without is drawn as a point. An end before the start throws; an end covering the start's day (or year) is fine. |
| `running`     | `boolean`             | no       | Clock scale only. `true` for an event that has started and not yet ended. It can't have an `end`. See [Running events](#running-events). *Since 0.7.0.* |
| `id`          | `string \| number`    | no       | A unique id. Ids are compared as strings, so `7` and `'7'` are the same id. If you leave it out, one is generated (see [Generated ids](#generated-ids)). |
| `category`    | `string`              | no       | Sets the event's color and its entry in the legend filter. |
| `tags`        | `string \| string[]`  | no       | Tags shown on the event's card and in the tag bar. A single string is one tag. Blank and repeated tags are dropped. |
| `description` | `string`              | no       | Shown on the event's card in the story. |
| `url`         | `string`              | no       | An `http(s)` link shown on the event's card. |
| `color`       | `string`              | no       | A CSS color. It overrides the category color for this event only. |

Chroniko keeps a reference to the event objects you pass in, and returns them again from [`getSelection()`](#getselection) and `onSelectionChange`. Don't change an event object directly: use [`updateEvent()`](#updateeventid-patch) instead.

### Generated ids

An event without an `id` gets `<category>-<position>`. The category is lowercased, and each run of whitespace becomes a hyphen. For example, the event at position 3 in the `"Olympic Game"` category gets `olympic-game-3`. An event without a category gets `event-<position>`.

- **With `setEvents`**, the position is the event's 0-based index in the array. So these ids change if events are inserted, removed or reordered.
- **With `addEvents`**, the numbering carries on from the last `setEvents` call, even after removals. Adding events never changes the ids of the events already there.

Give events explicit ids if you replace them with `setEvents`, or if shared links must keep working when the data changes.

## Dates

What a `DateInput` is depends on the `timeScale` option.

### Historical scale

With `timeScale: 'historical'` (the default), a `DateInput` can be any of these:

| Input | Example | Precision |
| ----- | ------- | --------- |
| A year number | `1969`, `-221` | year |
| A fractional year | `1453.41` | year |
| `"YYYY"` | `"1969"`, `"-221"` | year |
| `"YYYY-MM"` | `"1969-07"` | month |
| `"YYYY-MM-DD"` | `"1969-07-20"`, `"-44-03-15"` | day |
| An object | `{ year: 1969, month: 7, day: 20 }` | the most precise field given |

- Negative years are BCE.
- A date that doesn't exist, such as month 13 or 31 April, throws an error.
- 29 February is accepted in any year, because historical dates may use the Julian calendar.

Internally, and in [`getState()`](#getstate), positions on the timeline are **fractional years**. For example, `1453.5` is the middle of 1453.

### Clock scale

With `timeScale: 'clock'`, a `DateInput` can be any of these:

| Input | Example | Precision |
| ----- | ------- | --------- |
| Epoch ms | `1793836798250` | ms |
| A `Date` | `new Date()` | ms |
| `"YYYY-MM-DD"` | `"2026-11-04"` | day |
| `"YYYY-MM-DDTHH:MM"` | `"2026-11-04T09:02"` | minute |
| `"YYYY-MM-DDTHH:MM:SS"` | `"2026-11-04T09:02:30"` | second |
| `"YYYY-MM-DDTHH:MM:SS.sss"` | `"2026-11-04T09:02:30.250"` | ms |

- A time can end with `Z` or an offset (`+08:00`, `-0330`), and then it is an exact instant. A space can replace the `T`. More than three fraction digits are cut to ms.
- **A string without `Z` or an offset is read in the [time zone](#time-zones)**, local time by default, including a date-only string, which is midnight in that zone. JavaScript's `Date` reads date-only strings as UTC instead. At a daylight saving change, a local time that doesn't exist (02:30 when the clocks go forward) moves forward an hour, and one that happens twice uses the earlier instant.
- A date or time that doesn't exist, such as 29 February 2026, hour 24 or second 60, throws an error.
- An `end` with a time is the instant itself. A date-only `end` covers that whole day, like an all-day calendar event.
- Dates and times are shown in the time zone, on a 24-hour clock, and the axis names the zone (e.g. `GMT+8` or `UTC`).

Internally, and in [`getState()`](#getstate), positions on the timeline are **epoch ms**.

### Time zones

On the clock scale, times are shown in one zone at a time:

| Zone      | Shown as | Axis label | Toolbar text |
| --------- | -------- | ---------- | ------------ |
| `'local'` | The viewer's own time zone, with its daylight saving changes. | e.g. `GMT+8`, `GMT-4`, `GMT+5:30` | "Local time" (the `localTime` UI string) |
| `'UTC'`   | Coordinated Universal Time, the same for every viewer. | `UTC` | "UTC" |
| An IANA name, e.g. `'Asia/Tokyo'` (*since 0.8.0*) | That zone, with its daylight saving changes, wherever the viewer is. | e.g. `GMT+9`, or `GMT-4 – GMT-5` for a view across a change | Intl's name and the offset now, e.g. "Japan Standard Time (GMT+9)" |

- Set the zone with the `timeZone` option or [`setTimeZone()`](#settimezonetimezone). With two `timeZones`, a toolbar button shows the zone in use and switches to the other one. With three or more, a menu (`<select class="ck-zone-toggle ck-zone-select">`) lists them, labelled by the `timeZone` UI string. A zone in use that isn't listed has an option of its own while it's in use; an alias of a listed zone selects that zone.
- IANA names are checked with `Intl.DateTimeFormat`, so a name it doesn't recognise throws. An alias (`'US/Eastern'`) keeps the name given, with Intl's capitalisation if it only differs in case (`'asia/tokyo'` becomes `'Asia/Tokyo'`); that name is what `getTimeZone()`, `getState()`, `ck-tz` and `onTimeZoneChange` give. Names Intl reads as UTC (`'Etc/UTC'`, `'GMT'`) are `'UTC'`.
- An IANA zone's toolbar text is Intl's generic name in the timeline's `language`, the same all year, with the offset when the control was last updated (at construction and on each zone change). Zones in the list with the same name also get their city, e.g. "Eastern Time, Toronto (GMT-5)"; a zone Intl has no name for, such as `'Etc/GMT+9'`, shows only its offset.
- Changing the zone moves no event and keeps the view. Only the axis, the story and the tooltips change.
- A string without `Z` or an offset is read in the zone in use when it's added (by the `events` option, `setEvents`, `addEvents`, or an `updateEvent` patch that contains that date), and keeps that instant when the zone changes. For example, `"2026-11-04"` added in local time in Hong Kong stays at 16:00 UTC on 3 November, and so starts at that time after switching to UTC. A date-only value shown in a zone other than the one it was read in gets its time in tooltips and the story, e.g. "3 Nov 2026, 16:00", and a date-only `end` shows the instant the range stops, e.g. "4 Nov 2026, 16:00". `start`, `end`, `zoomTo` and `setState` read such strings in the zone in use too.
- The exported [date helpers](#date-helpers) always use local time.

## Live mode

*Since 0.7.0.* On the clock scale, a timeline can follow the current time while events stream in. A red line marks now whenever it is in view, following or not.

### Following now

While following, the view keeps now 5% of its width from its right edge, at the current zoom, and pans as time passes. It never rearranges the rows, and it pauses while the page is hidden.

| Stops following | Keeps following |
| --------------- | --------------- |
| Dragging, scrolling sideways, the arrow keys; [`panBy`](#panbypx), [`zoomTo`](#zoomtostart-end), [`fit`](#fit), [`reveal`](#revealid); [`setState`](#setstatestate) with a view and without `following: true`; a `ck-view` in the URL hash | Zooming with the wheel, pinch, the +/− buttons or [`zoomBy`](#zoombyfactor-ratio), which zoom around now; data changes; clicks and selection |

The **● Live** toolbar button is shown when the `follow` option is given, `true` or `false`. It is pressed (`aria-pressed="true"`) while following. Pressing it starts following at the current zoom, and pressing it again stops. Its text and label are the `live` and `followNow` [UI strings](#options).

### Running events

An event with `running: true` is drawn as a bar from its start to now, growing as time passes. Its tooltip and story card show its start and how long it has run so far, through the `runningFor` UI string, e.g. "17 Nov 2026, 09:45:00 – running for 15 minutes, 12 seconds". This text is updated every second while the page is visible, at no finer a precision than the start. A running event that starts later than now shows only its start until now reaches it.

- Close it with [`updateEvent(id, { end, running: false })`](#updateeventid-patch). `running: false` without an `end` makes it a point at its start.
- It can't have an `end` while running: an event or patch giving both throws.
- Its row stays its own until it ends, so later events never sit under the growing bar.
- [`fit()`](#fit) counts it up to now.

### Retention

| Option | Drops |
| ------ | ----- |
| `retain: ms` | Events whose range ended (or, for a point, that happened) more than `ms` ago. Events added already expired are dropped straight away; the rest when they expire, on a timer. |
| `maxEvents: n` | The events that start first, beyond `n`, after each [`setEvents`](#seteventsevents) or [`addEvents`](#addeventsevents). Expired events go first. |

- Running events are never dropped, even beyond `maxEvents`.
- Dropped events leave the selection, and `onSelectionChange` is called, as with [`removeEvents`](#removeeventsids).
- The other events keep their rows. Rows left empty go the next time the rows are rearranged.

### New events

Events added by [`addEvents`](#addeventsevents), or a source's `add`, flash once, for 1.5 seconds. Events added during construction, such as a source's history, don't, and neither do `setEvents` or `updateEvent`. Under `prefers-reduced-motion: reduce`, nothing flashes.

### Sources

```js
source: (api) => {
  const stream = new EventSource('/events');
  stream.addEventListener('add', (e) => api.add(JSON.parse(e.data)));
  stream.addEventListener('update', (e) => {
    const { id, patch } = JSON.parse(e.data);
    api.update(id, patch);
  });
  return () => stream.close();
}
```

The `source` option is called once, at the end of the constructor, with:

| `api` method | Same as |
| ------------ | ------- |
| `add(events)` | [`addEvents(events)`](#addeventsevents), including its return value and errors |
| `update(id, patch)` | [`updateEvent(id, patch)`](#updateeventid-patch) |
| `remove(ids)` | [`removeEvents(ids)`](#removeeventsids) |

- **Cleanup:** a function the source returns, or a Promise resolves to, is called once by [`destroy()`](#destroy), or straight away if it resolves after `destroy()`. Any other return value is ignored.
- After `destroy()`, `api` calls do nothing and return `undefined`.
- If the source throws, the timeline is removed and the constructor throws that error.
- Chroniko has no transport of its own. The [README](../README.md#sources) has WebSocket and polling examples.
- Chroniko doesn't know when a source's connection drops. After a reconnect, the source should get the current state, close or remove the running events that have ended (a lost end leaves a running bar growing for as long as the page is open), and add only the events it doesn't have, since `add` throws on an existing id. See [Reconnecting](../README.md#reconnecting) in the README.

## Methods

### Events

#### `setEvents(events)`

Replaces every event.

| Parameter | Type       | Description |
| --------- | ---------- | ----------- |
| `events`  | `object[]` | The new events. See [Event object](#event-object). |

**Returns:** `undefined`.

**Throws:** if an event has an invalid or missing date, or if two events share an id. The timeline is then left as it was.

- Selected events that are still in the new list stay selected. Selected events that are no longer there are dropped from the selection. If that changes the selection, `onSelectionChange` is called.
- The view doesn't move. Call [`fit()`](#fit) afterwards to show all the new events.
- Each category keeps its palette color.

#### `addEvents(events)`

Adds one event or several, and keeps everything already on the timeline. *Since 0.4.0.*

| Parameter | Type                 | Description |
| --------- | -------------------- | ----------- |
| `events`  | `object \| object[]` | One event or an array of events. |

**Returns:** `string[]`, the ids of the added events, including generated ones. They're sorted by start date. With [retention](#retention), it includes any event dropped straight away.

**Throws:** if an event has an invalid or missing date, or if its id is already used. The error names the event. In that case none of the events are added.

```js
const [id] = timeline.addEvents({ title: 'Deploy started', start: '2026-10-28', category: 'deploy' });
timeline.reveal(id);
```

- The view and the selection don't change.
- Events that start later than all existing events go into the rows already shown, so nothing moves. An earlier event makes the timeline rearrange its rows.
- Added events [flash](#new-events) once.

#### `updateEvent(id, patch)`

Changes some fields of one event. *Since 0.4.0.*

| Parameter | Type               | Description |
| --------- | ------------------ | ----------- |
| `id`      | `string \| number` | The event's id. |
| `patch`   | `object`           | The fields to change. They're merged into the event one level deep. To remove a field, set it to `undefined`. |

**Returns:** `undefined`.

**Throws:** in the cases below. In each one the event is left as it was.

- No event has that id.
- `patch.id` is different from `id`. To change an id, remove the event and add it again.
- The updated event is invalid, for example because of a bad date, or a `running` event gets an `end` without `running: false`.

```js
timeline.updateEvent('deploy-42', { end: '2026-10-30', description: undefined });
```

- The view doesn't change, and a selected event stays selected. Its card in the story is redrawn.
- If the start stays the same and the event takes no more room than before (its bar and label), as when a [running event](#running-events) is closed, every event keeps its row. Otherwise the timeline may rearrange its rows.

#### `removeEvents(ids)`

Removes one event or several. *Since 0.4.0.*

| Parameter | Type                                     | Description |
| --------- | ---------------------------------------- | ----------- |
| `ids`     | `string \| number \| (string \| number)[]` | One id or an array of ids. Unknown ids are ignored. |

**Returns:** `undefined`.

- Removed events are dropped from the selection. If that changes the selection, `onSelectionChange` is called.
- The view doesn't change. The timeline may rearrange its rows.

> [!TIP]
> `addEvents`, `updateEvent` and `removeEvents` don't redraw everything straight away. The legend, tag bar and story are redrawn once per animation frame, however many calls you make, so adding many events one at a time is cheap.

### View

#### `zoomTo(start, end)`

Shows the range from `start` to `end`.

| Parameter | Type                  | Description |
| --------- | --------------------- | ----------- |
| `start`   | [`DateInput`](#dates) | Start of the range. |
| `end`     | [`DateInput`](#dates) | End of the range. Must be after `start`. |

**Throws:** if either date is missing or invalid, or if `start` isn't before `end`.

If the span is outside `minSpan` / `maxSpan`, it is clamped to the nearest limit, keeping the same middle.

#### `zoomBy(factor, ratio?)`

Zooms around a point.

| Parameter | Type     | Default | Description |
| --------- | -------- | ------- | ----------- |
| `factor`  | `number` | —       | Below 1 zooms in, above 1 zooms out. For example, `0.5` halves the visible span. |
| `ratio`   | `number` | `0.5`   | The point that stays still, as a fraction of the width: `0` is the left edge, `1` the right edge. |

#### `panBy(px)`

Pans by a number of pixels. A positive number moves forward in time.

#### `fit()`

Zooms so every event is visible, with a little space on both sides. With no events, it shows the years 0 to 2000.

#### `reveal(id)`

Brings an event into view.

- An event with an `end` is zoomed to fill the middle of the timeline. A point event is centered at the current zoom.
- If the event's category is hidden, it is shown again.
- The page scrolls so the timeline is on screen, and the event is focused and briefly highlighted.
- An unknown id is ignored.

### Time zone

These need `timeScale: 'clock'`. See [Time zones](#time-zones).

#### `setTimeZone(timeZone)`

Shows times in another zone.

| Parameter  | Type                | Description |
| ---------- | ------------------- | ----------- |
| `timeZone` | `string`            | `'local'`, `'UTC'` or an IANA name such as `'Asia/Tokyo'`. It doesn't have to be listed in `timeZones`. |

Events and the view stay where they are; the axis, story and tooltips are labelled again. Calls [`onTimeZoneChange`](#ontimezonechangetimezone) if the zone changed, and with `syncUrl` updates the URL.

**Throws:** on the historical scale, or if `timeZone` isn't `'local'`, `'UTC'` or a zone Intl knows.

#### `getTimeZone()`

**Returns:** the zone in use, `'local'`, `'UTC'` or an IANA name as given, or `null` on the historical scale.

### Following

These need `timeScale: 'clock'`. See [Following now](#following-now). *Since 0.7.0.*

#### `follow(on?)`

Starts following now (`on` is `true`, the default) or stops (`false`). Starting moves the view to now at the current zoom. Works with or without the `follow` option. Calls [`onFollowChange`](#onfollowchangefollowing) if following changed, and with `syncUrl` updates the URL.

**Throws:** on the historical scale.

#### `isFollowing()`

**Returns:** `true` while the view is following now, otherwise `false`.

### Selection

Selected events are listed in the story, in chronological order.

#### `select(id)`

Adds an event to the selection. Unknown ids, and events that are already selected, are ignored.

#### `deselect(id)`

Removes an event from the selection. Ignored if the event isn't selected.

#### `toggle(id)`

Selects the event if it isn't selected, and deselects it if it is.

#### `clearSelection()`

Deselects every event.

#### `getSelection()`

**Returns:** `object[]`, the selected [event objects](#event-object) in chronological order.

### State

#### `getState()`

**Returns:** the current view, selection and hidden categories, as an object you can save and later pass to [`setState()`](#setstatestate).

```ts
{
  start: number;      // left edge of the view, in fractional years (epoch ms on the clock scale)
  end: number;        // right edge of the view, in fractional years (epoch ms on the clock scale)
  selected: string[]; // selected ids, in chronological order
  hidden: string[];   // hidden categories
  timeZone?: string;  // clock scale only: 'local', 'UTC' or an IANA name
  following?: boolean; // clock scale only: whether the view is following now
}
```

#### `setState(state)`

Restores a state from [`getState()`](#getstate).

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `state`   | `object` | Any of `start` and `end` (both are needed to move the view), `selected`, `hidden`, and on the clock scale `timeZone` and `following`. |

Every field is optional, so a partial state changes only what it contains. Unknown ids are ignored. The time zone is applied first, so string `start` and `end` values are read in it.

A view stops following, unless `following` is `true`: then the view's span is followed (or the current span, without a view). `following: false` stops following. Everything is checked before anything changes.

```js
localStorage.setItem('story', JSON.stringify(timeline.getState()));
timeline.setState(JSON.parse(localStorage.getItem('story')));
timeline.setState({ selected: ['ww2'] }); // change only the selection
```

### Lifecycle

#### `destroy()`

Removes the timeline from the page and cleans up after it: event listeners (including the `hashchange` listener used by `syncUrl`), timers and observers. Then it calls the [source](#sources)'s cleanup, if any. Calling it again does nothing. Don't call any other method on the instance afterwards.

## Callbacks

### `onSelectionChange(events)`

Called with the selected [event objects](#event-object), in chronological order, whenever the selection changes. That includes:

- clicking events or tags, pressing Esc, or clicking **Clear all**;
- calling `select`, `deselect`, `toggle`, `clearSelection` or `setState`;
- `setEvents` or `removeEvents` removing a selected event, or [retention](#retention) dropping one;
- the URL hash changing while `syncUrl` is on.

> [!IMPORTANT]
> When `syncUrl` restores a selection from the URL, `onSelectionChange` is called *during* construction, before `new Chroniko(...)` returns. At that point the variable you're assigning the timeline to is still undefined.

### `onTimeZoneChange(timeZone)`

Called with the new zone's name, `'local'`, `'UTC'` or an IANA name, whenever the [time zone](#time-zones) changes. That includes:

- the time zone button or menu in the toolbar;
- calling `setTimeZone` or `setState`;
- the URL hash changing while `syncUrl` is on.

It isn't called for the `timeZone` option itself. Like `onSelectionChange`, it can be called during construction when `syncUrl` restores a zone from the URL.

### `onFollowChange(following)`

Called with `true` when the view starts [following now](#following-now), and `false` when it stops. That includes:

- pressing the **● Live** button;
- calling `follow` or `setState`, or anything that [stops following](#following-now);
- the URL hash changing while `syncUrl` is on.

It isn't called for the `follow` option itself, but can be called during construction when `syncUrl` applies a link. *Since 0.7.0.*

## Date helpers

These are exported alongside `Chroniko`. In all of them, `language` is one of the [language codes](#options) and defaults to `'en'`.

#### `parseDate(input)`

Parses a [`DateInput`](#dates).

**Returns:** `null` if `input` is `null`, `undefined` or `''`. Otherwise it returns:

```ts
{
  year: number;
  month: number | null;  // 1–12
  day: number | null;    // 1–31
  precision: 'year' | 'month' | 'day';
  value: number;         // position in fractional years
}
```

**Throws:** if the input can't be parsed, or if the date doesn't exist.

```js
parseDate('-44-03-15');
// { year: -44, month: 3, day: 15, precision: 'day', value: -43.79… }
```

#### `parseTime(input)`

Parses a [clock `DateInput`](#clock-scale). Strings without `Z` or an offset are read in local time.

**Returns:** `null` if `input` is `null`, `undefined` or `''`. Otherwise it returns:

```ts
{
  scale: 'clock';
  value: number;  // epoch ms
  precision: 'day' | 'minute' | 'second' | 'ms';
}
```

**Throws:** if the input can't be parsed, or if the date or time doesn't exist.

```js
parseTime('2026-11-04T09:02:30Z');
// { scale: 'clock', value: 1793782950000, precision: 'second' }
```

#### `formatDate(date, language?)`

Formats a `parseDate()` or `parseTime()` result at its own precision. Clock times are written in local time, on a 24-hour clock.

```js
formatDate(parseDate('1644-03-19'));                   // "19 Mar 1644"
formatDate(parseDate('1644-03-19'), 'zh-Hant');        // "1644年3月19日"
formatDate(parseTime('2026-11-04T09:02'));             // "4 Nov 2026, 09:02"
formatDate(parseTime('2026-11-04T09:02:30.25'), 'de'); // "4. Nov. 2026, 09:02:30,250"
```

#### `formatYear(year, language?)`

Formats a year number.

```js
formatYear(-221);       // "221 BCE"
formatYear(-221, 'ja'); // "紀元前221年"
```

#### `formatDuration(start, end, language?)`

How long the time between two `parseDate()` results, or two `parseTime()` results, is. It's the same text as the "lasted …" note in the story.

- It uses the less precise of the two dates: if either is a year only, the result is in whole years.
- It shows at most two units next to each other, e.g. years and months.
- There is no year zero, so 27 BCE to 14 CE is 40 years.
- For clock times, years, months and days are counted on the local calendar, while hours, minutes and seconds are the time that actually passed. So 01:00 to 04:00 on the night the clocks go forward is 2 hours. Durations under a second are "less than a second".
- It returns `''` if `end` is before `start`.
- **Throws:** if one date comes from `parseDate()` and the other from `parseTime()`.

```js
formatDuration(parseDate('1914-07-28'), parseDate('1918-11-11')); // "4 years, 3 months"
formatDuration(parseDate('1939-09-01'), parseDate('1945-09-02')); // "6 years" (days aren't next to years)
formatDuration(parseDate(-27), parseDate(14));                    // "40 years"
formatDuration(parseTime('2026-11-04T09:02:30'), parseTime('2026-11-04T09:14:05')); // "11 minutes, 35 seconds"
```

## URL hash format

With `syncUrl: true`, the state is kept in the URL hash like this:

```
#ck-view=1300,1500&ck-sel=black-death,constantinople&ck-hide=science
```

| Key       | Value |
| --------- | ----- |
| `ck-view` | `start,end` in fractional years, or epoch ms on the clock scale. |
| `ck-sel`  | Selected ids, separated by commas. |
| `ck-hide` | Hidden categories, separated by commas. |
| `ck-tz`   | Clock scale only: the time zone, e.g. `local`, `UTC` or `Asia/Tokyo` (the `/` isn't escaped; other characters are, e.g. `Etc/GMT%2B9`). It's always written, so a link opens in the sender's zone even if the page's default differs. An unknown zone is ignored. |
| `ck-live` | Clock scale only: written instead of `ck-view` while the view is [following now](#following-now), as the view's span in ms, e.g. `ck-live=600000`. The view moves as time passes but the span doesn't, so the URL isn't rewritten all the time. Opening the link follows now at that span. It wins over `ck-view`, and a value that isn't a positive number is ignored. *Since 0.7.0.* |

- The hash is updated with `history.replaceState` shortly after each change, so it doesn't add entries to the browser history.
- Loading the page doesn't rewrite the URL.
- Other hash parameters are kept. Once the timeline writes to the hash, a plain `#section` anchor no longer works.
- Use `syncUrl` on only one timeline per page.

## CSS custom properties

Set these on `.chroniko`, in a stylesheet loaded after Chroniko's.

| Property         | Default (light / dark)  | Used for |
| ---------------- | ----------------------- | -------- |
| `--ck-bg`        | `#ffffff` / `#0d1117`   | Timeline and card background |
| `--ck-surface`   | `#f6f7f9` / `#161b22`   | Toolbar and story list background |
| `--ck-fg`        | `#1f2328` / `#e6edf3`   | Text |
| `--ck-muted`     | `#656d76` / `#8d96a0`   | Secondary text and axis labels |
| `--ck-border`    | `#d8dee4` / `#30363d`   | Borders and dividers |
| `--ck-grid`      | `#eef1f4` / `#1c2128`   | Grid lines behind the events |
| `--ck-focus`     | `#0969da` / `#4493f8`   | Focus rings and links |
| `--ck-now`       | `#cf222e` / `#f85149`   | The "now" line on the clock scale, and the **● Live** button while following |
| `--ck-height`    | `420px`                 | Height of the timeline |
| `--ck-sticky-top`| `0px`                   | With `storyPosition: 'right'`, how far from the top of the window the timeline sticks, e.g. the height of a fixed header |

The dark defaults apply under `prefers-color-scheme: dark`. Every class inside the component starts with `ck-`, so it won't clash with your page's styles.

## Errors

Every error is an `Error` whose message starts with `Chroniko:`. Any method that throws leaves the timeline unchanged.

| Thrown by | When |
| --------- | ---- |
| Constructor | The container isn't found; `timeScale` isn't `'historical'` or `'clock'`; `timeZone` or `timeZones` is given with the historical scale; `timeZone` isn't `'local'`, `'UTC'` or a zone Intl knows; `timeZones` isn't an array of two or more of those, or lists one zone twice, also by two names (`'US/Eastern'` and `'America/New_York'`); `storyPosition` isn't `'below'` or `'right'`; `split` isn't between 0 and 1; `language` is unknown; `follow` or `retain` is given with the historical scale; `retain` isn't a positive number; `maxEvents` isn't a positive whole number; `source` isn't a function. |
| `setTimeZone`, `setState` | On the historical scale; the zone isn't `'local'`, `'UTC'` or a zone Intl knows. |
| `follow` | On the historical scale. |
| `setState` | `following` is given on the historical scale, or isn't `true` or `false`. |
| Constructor, `setEvents`, `addEvents` | An event isn't an object (e.g. `null`); an event has no `start` or an invalid date; it ends before it starts; `running` isn't `true` or `false`, is `true` on the historical scale, or comes with an `end`; two events share an id. |
| `updateEvent` | Unknown id; the patch isn't an object; the patch changes the id; the updated event is invalid. |
| `zoomTo`, `setState` | A date is missing or invalid; `start` isn't before `end`. |
| `parseDate`, `parseTime` | The input can't be parsed, or the date doesn't exist. |
| `formatDuration` | One date comes from `parseDate()` and the other from `parseTime()`. |
