# Chroniko API reference

This page covers everything Chroniko exports: the `Chroniko` class, its options and methods, and the date helpers. For a guide to installing and using it, see the [README](../README.md).

> [!NOTE]
> `addEvents`, `updateEvent` and `removeEvents` are new in 0.4.0. Everything else is available from 0.3.1.

## Contents

- [Importing](#importing)
- [Constructor](#constructor)
- [Options](#options)
- [Event object](#event-object)
- [Dates](#dates)
- [Methods](#methods)
  - [Events](#events): [`setEvents`](#seteventsevents), [`addEvents`](#addeventsevents), [`updateEvent`](#updateeventid-patch), [`removeEvents`](#removeeventsids)
  - [View](#view): [`zoomTo`](#zoomtostart-end), [`zoomBy`](#zoombyfactor-ratio), [`panBy`](#panbypx), [`fit`](#fit), [`reveal`](#revealid)
  - [Selection](#selection): [`select`](#selectid), [`deselect`](#deselectid), [`toggle`](#toggleid), [`clearSelection`](#clearselection), [`getSelection`](#getselection)
  - [State](#state): [`getState`](#getstate), [`setState`](#setstatestate)
  - [Lifecycle](#lifecycle): [`destroy`](#destroy)
- [Callbacks](#callbacks)
- [Date helpers](#date-helpers): [`parseDate`](#parsedateinput), [`formatDate`](#formatdatedate-language), [`formatYear`](#formatyearyear-language), [`formatDuration`](#formatdurationstart-end-language)
- [URL hash format](#url-hash-format)
- [CSS custom properties](#css-custom-properties)
- [Errors](#errors)

## Importing

Chroniko is an ES module. Load the stylesheet as well as the script.

```js
// From npm, with a bundler
import { Chroniko, parseDate, formatDate, formatYear, formatDuration } from 'chroniko';
import 'chroniko/chroniko.css';
```

```html
<!-- From a CDN, without installing anything -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/chroniko@0.4.0/dist/chroniko.min.css">
<script type="module">
  import { Chroniko } from 'https://cdn.jsdelivr.net/npm/chroniko@0.4.0/dist/chroniko.min.js';
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

The constructor throws if:

- the container isn't found;
- an option has an invalid value;
- an event is invalid;
- two events share an id.

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
| `start`             | [`DateInput`](#dates) | Fit all events | Start of the first visible range. Only used if `end` is also set. |
| `end`               | [`DateInput`](#dates) | Fit all events | End of the first visible range. Only used if `start` is also set. |
| `colors`            | `object`             | `{}`    | Category → CSS color, e.g. `{ war: '#c0392b' }`. Categories without a color get one from the built-in palette. |
| `minSpan`           | `number`             | `1/12` (one month) | Smallest visible span, in years. |
| `maxSpan`           | `number`             | 3× the data span, at least 100 | Largest visible span, in years. Without this option, the limit grows as events are added. |
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
| `end`         | [`DateInput`](#dates) | no       | When it ends. An event with an `end` is drawn as a bar; one without is drawn as a point. |
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

A `DateInput` can be any of these:

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

**Returns:** `string[]`, the ids of the added events, including generated ones. They're sorted by start date.

**Throws:** if an event has an invalid or missing date, or if its id is already used. The error names the event. In that case none of the events are added.

```js
const [id] = timeline.addEvents({ title: 'Deploy started', start: '2026-10-28', category: 'deploy' });
timeline.reveal(id);
```

- The view and the selection don't change.
- Events that start later than all existing events go into the rows already shown, so nothing moves. An earlier event makes the timeline rearrange its rows.

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
- The updated event is invalid, for example because of a bad date.

```js
timeline.updateEvent('deploy-42', { end: '2026-10-30', description: undefined });
```

- The view doesn't change, and a selected event stays selected. Its card in the story is redrawn.
- The timeline may rearrange its rows.

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
  start: number;      // left edge of the view, in fractional years
  end: number;        // right edge of the view, in fractional years
  selected: string[]; // selected ids, in chronological order
  hidden: string[];   // hidden categories
}
```

#### `setState(state)`

Restores a state from [`getState()`](#getstate).

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `state`   | `object` | Any of `start` and `end` (both are needed to move the view), `selected`, `hidden`. |

Every field is optional, so a partial state changes only what it contains. Unknown ids are ignored.

```js
localStorage.setItem('story', JSON.stringify(timeline.getState()));
timeline.setState(JSON.parse(localStorage.getItem('story')));
timeline.setState({ selected: ['ww2'] }); // change only the selection
```

### Lifecycle

#### `destroy()`

Removes the timeline from the page and cleans up after it: event listeners (including the `hashchange` listener used by `syncUrl`), timers and observers. Don't call any other method on the instance afterwards.

## Callbacks

### `onSelectionChange(events)`

Called with the selected [event objects](#event-object), in chronological order, whenever the selection changes. That includes:

- clicking events or tags, pressing Esc, or clicking **Clear all**;
- calling `select`, `deselect`, `toggle`, `clearSelection` or `setState`;
- `setEvents` or `removeEvents` removing a selected event;
- the URL hash changing while `syncUrl` is on.

> [!IMPORTANT]
> When `syncUrl` restores a selection from the URL, `onSelectionChange` is called *during* construction, before `new Chroniko(...)` returns. At that point the variable you're assigning the timeline to is still undefined.

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

#### `formatDate(date, language?)`

Formats a `parseDate()` result at its own precision.

```js
formatDate(parseDate('1644-03-19'));            // "19 Mar 1644"
formatDate(parseDate('1644-03-19'), 'zh-Hant'); // "1644年3月19日"
```

#### `formatYear(year, language?)`

Formats a year number.

```js
formatYear(-221);       // "221 BCE"
formatYear(-221, 'ja'); // "紀元前221年"
```

#### `formatDuration(start, end, language?)`

How long the time between two `parseDate()` results is. It's the same text as the "lasted …" note in the story.

- It uses the less precise of the two dates: if either is a year only, the result is in whole years.
- It shows at most two units next to each other, e.g. years and months.
- There is no year zero, so 27 BCE to 14 CE is 40 years.
- It returns `''` if `end` is before `start`.

```js
formatDuration(parseDate('1914-07-28'), parseDate('1918-11-11')); // "4 years, 3 months"
formatDuration(parseDate('1939-09-01'), parseDate('1945-09-02')); // "6 years" (days aren't next to years)
formatDuration(parseDate(-27), parseDate(14));                    // "40 years"
```

## URL hash format

With `syncUrl: true`, the state is kept in the URL hash like this:

```
#ck-view=1300,1500&ck-sel=black-death,constantinople&ck-hide=science
```

| Key       | Value |
| --------- | ----- |
| `ck-view` | `start,end` in fractional years. |
| `ck-sel`  | Selected ids, separated by commas. |
| `ck-hide` | Hidden categories, separated by commas. |

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
| `--ck-height`    | `420px`                 | Height of the timeline |
| `--ck-sticky-top`| `0px`                   | With `storyPosition: 'right'`, how far from the top of the window the timeline sticks, e.g. the height of a fixed header |

The dark defaults apply under `prefers-color-scheme: dark`. Every class inside the component starts with `ck-`, so it won't clash with your page's styles.

## Errors

Every error is an `Error` whose message starts with `Chroniko:`. Any method that throws leaves the timeline unchanged.

| Thrown by | When |
| --------- | ---- |
| Constructor | The container isn't found; `storyPosition` isn't `'below'` or `'right'`; `split` isn't between 0 and 1; `language` is unknown. |
| Constructor, `setEvents`, `addEvents` | An event isn't an object (e.g. `null`); an event has no `start` or an invalid date; two events share an id. |
| `updateEvent` | Unknown id; the patch isn't an object; the patch changes the id; the updated event is invalid. |
| `zoomTo`, `setState` | A date is missing or invalid; `start` isn't before `end`. |
| `parseDate` | The input can't be parsed, or the date doesn't exist. |
