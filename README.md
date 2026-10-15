# chroniko

Render historical events on a single zoomable time axis. Plain HTML, CSS and JavaScript, with no dependencies. Here is the [demo](https://chroniko.ykyuen.info/philosophers-in-history/).

## Install

```sh
npm install chroniko
```

## Run the example

```sh
npm start   # http://localhost:3000/
```

Add `?story=right` to the example's URL to see the [story beside the timeline](#story-beside-the-timeline), or `?lang=ja` (any [language code](#languages)) to see the UI in another language. Both can be combined, e.g. `?story=right&lang=zh-Hant`.

## Usage

The minified files can be loaded from jsDelivr without installing anything.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Chroniko</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/chroniko@0.2.0/dist/chroniko.min.css">
</head>
<body>
  <div id="timeline"></div>

  <script type="module">
    import { Chroniko } from 'https://cdn.jsdelivr.net/npm/chroniko@0.2.0/dist/chroniko.min.js';

    const timeline = new Chroniko('#timeline', {
      events: [
        { id: 'caesar', title: 'Assassination of Julius Caesar', start: '-44-03-15', category: 'politics' },
        { id: 'ww2', title: 'World War II', start: '1939-09-01', end: '1945-09-02', category: 'war',
          description: 'The deadliest conflict in human history.' },
      ],
      onSelectionChange: (events) => console.log(events),
    });
  </script>
</body>
</html>
```

### Event fields

| Field         | Required | Notes |
| ------------- | -------- | ----- |
| `title`       | yes      | |
| `start`       | yes      | Year number, `"YYYY"`, `"YYYY-MM"` or `"YYYY-MM-DD"`. Negative years are BCE. A date that doesn't exist (month 13, 31 April) throws an error naming the event. 29 February is accepted in any year, since historical dates may follow the Julian calendar. |
| `end`         | no       | Same formats as `start`. If set, the event is drawn as a bar. |
| `id`          | no       | Must be unique. See [Event ids](#event-ids). |
| `category`    | no       | Used for colors and the legend filter. |
| `description` | no       | Shown in the detail panel. |
| `url`         | no       | `http(s)` link shown in the detail panel. |
| `color`       | no       | Overrides the category color. |

### Event ids

An event's `id` identifies it for `select(id)`, `deselect(id)`, `toggle(id)` and for keeping the selection across `setEvents` calls. Ids are compared as strings, so `7` and `'7'` are the same id.

If an event has no `id`, one is generated from its category and its 0-based position in the `events` array: the category is lowercased and each run of whitespace becomes a hyphen. For example, the event at position 3 in category `"Olympic Game"` gets `"olympic-game-3"`. An event without a category uses `event`, e.g. `"event-3"`.

Generated ids depend on position, so they change when events are inserted, removed or reordered. Give events an explicit `id` if you call `setEvents` more than once and want the selection to follow the same events.

Ids must be unique. If two events end up with the same id, whether given or generated, `setEvents` (and the constructor) throws an error naming both events and leaves the timeline unchanged.

### Options

| Option              | Type                 | Required | Default | Notes |
| ------------------- | -------------------- | -------- | ------- | ----- |
| `events`            | `object[]`           | no       | `[]`    | Array of events. See [Event fields](#event-fields). |
| `start`             | `number \| string`   | no       | Fit all events | Start of the initial visible range. Same formats as event dates, or a fractional year. Only used if `end` is also set. |
| `end`               | `number \| string`   | no       | Fit all events | End of the initial visible range. Only used if `start` is also set. |
| `colors`            | `object`             | no       | `{}`    | Category → color, e.g. `{ war: '#c0392b' }`. Categories without a color get one from the built-in palette. |
| `minSpan`           | `number`             | no       | `1/12` (one month) | Smallest visible span in years. |
| `maxSpan`           | `number`             | no       | 3× the data span, at least 100 years | Largest visible span in years. |
| `onSelectionChange` | `function(events)`   | no       | N/A     | Called with the selected events in chronological order. |
| `syncUrl`           | `boolean`            | no       | `false` | Keep the view, selection and hidden categories in the URL hash. See [Sharing](#sharing). |
| `storyPosition`     | `'below' \| 'right'` | no       | `'below'` | Where the [story](#story-view) goes. See [Story beside the timeline](#story-beside-the-timeline). |
| `split`             | `number`             | no       | `0.6`   | With `storyPosition: 'right'`, the timeline's share of the width, between 0 and 1 (exclusive). The story gets the rest. |
| `textSizeToggle`    | `boolean`            | no       | `false` | Show an **Aa** button in the toolbar that switches the event and category labels from 13px to 14px and the time axis labels from 12px to 13px. |
| `language`          | `string`             | no       | `'en'`  | Language of the timeline's own text and dates. See [Languages](#languages). An unknown code throws. |
| `uiText`            | `object`             | no       | N/A     | Replaces individual UI strings of the chosen language. See [Languages](#languages). |
| `categoryLabels`    | `object`             | no       | `{}`    | Category → text shown in the legend and on cards, e.g. `{ war: '戰爭' }`. Categories without a label show their name. |

### Methods

`setEvents(events)`, `zoomTo(start, end)`, `zoomBy(factor)`, `panBy(px)`, `fit()`, `select(id)`, `deselect(id)`, `toggle(id)`, `clearSelection()`, `getSelection()`, `reveal(id)`, `getState()`, `setState(state)`, `destroy()`.

`zoomTo(start, end)` takes the same date formats as events, or fractional years. `start` must be before `end`, or it throws. A span outside `minSpan` / `maxSpan` is clamped around the middle of the range. This also applies to the `start` / `end` options, `setState` and shared links.

`reveal(id)` pans and zooms so the event is in view (a range fills the middle of the timeline; a point is centered at the current zoom), shows its category if hidden, scrolls the timeline onto the screen, focuses the event and briefly highlights it.

### Sharing

`getState()` returns `{ start, end, selected, hidden }`: the visible range in fractional years (e.g. `1453.5` is mid-1453; negative is BCE), the selected event ids in chronological order, and the hidden categories. `setState(state)` restores it. Every field is optional, so `setState({ selected: ['ww2'] })` changes only the selection; unknown ids are ignored. Use these to save a story yourself, for example in `localStorage` or your own URL format.

With `syncUrl: true`, the timeline keeps this state in the URL hash, so the address bar is always a shareable link:

```
#ck-view=1300,1500&ck-sel=black-death,constantinople&ck-hide=science
```

- Opening the link restores the view, selection and hidden categories. Editing the hash on an open page applies it too.
- The URL is updated with `history.replaceState` shortly after each change, so it doesn't fill the back-button history. Loading the page doesn't change the URL.
- Other hash parameters are kept, but the hash no longer works as a plain `#section` anchor once the timeline writes to it. Use `syncUrl` on one timeline per page.
- Generated ids depend on position (see [Event ids](#event-ids)), so give events explicit ids if shared links must survive changes to the event list.
- When a link restores a selection, `onSelectionChange` is called during construction, before `new Chroniko(...)` returns.

### Navigation

Drag, use the arrow keys or scroll sideways to pan. To zoom, use the +/− buttons or keys, or hold Ctrl (⌘ on macOS) while scrolling; trackpad pinch works too. On touch screens, pinch with two fingers to zoom around the point between them, and slide both fingers to pan while zooming. Once the timeline has focus (click it), a plain vertical scroll zooms as well, and a faint ring around the timeline shows this mode is on. Until then it scrolls the page, so the timeline doesn't trap readers scrolling past it.

Events keep their row while you pan. While a wheel, trackpad or touch zoom is in progress the rows stay put and are rearranged once the gesture settles.

### Story view

Clicking an event toggles its selection. Selected events are listed below the timeline (or beside it, see below) in chronological order. Each event appears at its start date, and an event with an `end` also gets a small "End of …" marker at its end date, showing how long it lasted (e.g. "lasted 2 years, 11 months"); clicking the marker jumps to the event's card. Durations use the coarser precision of the two dates (a year-only date gives whole years) and show at most two units. There is no year zero, so 27 BCE to 14 CE lasted 40 years. The same text is available as `formatDuration(parseDate(start), parseDate(end), language)`, exported alongside `parseDate`, `formatDate(date, language)` and `formatYear(year, language)`; `language` defaults to `'en'`. **Show on timeline** on a card calls `reveal(id)` for that event. Hovering or focusing an event, its card or its end marker highlights all three. Press Esc or **Clear all** to clear the selection.

#### Story beside the timeline

With `storyPosition: 'right'`, the toolbar and timeline take the left `split` of the width and the story takes the rest:

```js
new Chroniko('#timeline', { events, storyPosition: 'right', split: 0.6 });
```

- The timeline sticks to the top of the browser window while the page scrolls the story beside it. Scrolling over the timeline scrolls the story too, until you click the timeline. Its height is `--ck-height` (`420px` by default), as in the stacked layout.
- If your page has a fixed header, set `--ck-sticky-top` on `.chroniko` to its height (e.g. `--ck-sticky-top: 56px`) so the timeline sticks below the header.
- The story column is shown even when nothing is selected, with a short hint, so the first click doesn't resize the timeline.
- When the component is 640px wide or narrower, it falls back to the stacked layout. This uses the component's own width, not the window's, so it also works in a narrow column. It relies on CSS container queries and `overflow: clip`, which all current browsers support.

### Languages

Set `language` when creating the timeline to translate its own text: the toolbar, the story, screen-reader labels, and how dates and durations are written. The language is fixed for the timeline's lifetime.

```js
new Chroniko('#timeline', { events, language: 'zh-Hant' });
```

| Code      | Language | Example date | Example duration |
| --------- | -------- | ------------ | ---------------- |
| `en`      | English (default) | 19 Mar 1644 · 221 BCE | 3 years, 2 months |
| `zh-Hant` | Traditional Chinese | 1644年3月19日 · 公元前221年 | 3年2個月 |
| `zh-Hans` | Simplified Chinese | 1644年3月19日 · 公元前221年 | 3年2个月 |
| `yue`     | Cantonese (colloquial, traditional characters) | 1644年3月19日 · 公元前221年 | 3年2個月 |
| `ja`      | Japanese | 1644年3月19日 · 紀元前221年 | 3年2か月 |
| `ko`      | Korean | 1644년 3월 19일 · 기원전 221년 | 3년 2개월 |
| `fr`      | French | 19 mars 1644 · 221 av. J.-C. | 3 ans et 2 mois |
| `de`      | German | 19. März 1644 · 221 v. Chr. | 3 Jahre, 2 Monate |
| `it`      | Italian | 19 mar 1644 · 221 a.C. | 3 anni e 2 mesi |
| `es`      | Spanish | 19 mar 1644 · 221 a. C. | 3 años y 2 meses |
| `pt`      | Portuguese | 19 mar 1644 · 221 a.C. | 3 anos e 2 meses |
| `pl`      | Polish | 19 mar 1644 · 221 p.n.e. | 3 lata, 2 miesiące |
| `nl`      | Dutch | 19 mrt 1644 · 221 v.Chr. | 3 jaar en 2 maanden |

- **Your events aren't translated.** Titles, descriptions and category names come from your data, so pass events in the reader's language. Keep the same `id`s across languages so shared links work in every language.
- **Category names are keys.** They're used by `colors`, the URL hash and `getState()`, so translate them with `categoryLabels` rather than in the events: `{ category: 'war' }` plus `categoryLabels: { war: 'Krieg' }`.
- The component's root gets the `lang` attribute, so screen readers use the right pronunciation and browsers use the right Chinese, Japanese or Korean character forms.
- `uiText` replaces individual strings, e.g. `uiText: { fit: 'Show all' }`. The keys, and what each function receives, are listed in [`src/locales/en.js`](src/locales/en.js). Keys you leave out keep the language's text.
- To add a language, copy `src/locales/en.js`, translate it, and register it in `src/locales/index.js`.

### Colors

There are two kinds of color: the colors of the events, set from JavaScript, and the colors of the component itself (background, text, borders), set with CSS.

#### Event colors

Each event's color is picked in this order:

1. The event's own `color` field.
2. The color of its category in the `colors` option.
3. A color from the built-in palette. Each category without a configured color gets the next palette color that isn't already used in `colors`. Events without a category use the first palette color.

```js
new Chroniko('#timeline', {
  colors: { war: '#c0392b', politics: '#2c7be5' },
  events: [
    { title: 'World War II', start: 1939, end: 1945, category: 'war' },
    { title: 'Moon landing', start: '1969-07-20', category: 'science' },              // palette color
    { title: 'Fall of the Berlin Wall', start: '1989-11-09', category: 'politics',
      color: 'gold' },                                                                // overrides 'politics'
  ],
});
```

Any CSS color works, e.g. `'#c0392b'`, `'rgb(192 57 43)'`, `'tomato'` or `'var(--my-war-color)'`. The legend uses the category colors, so an event with its own `color` doesn't change its category's legend entry. To change colors after construction, pass new events with `setEvents(events)`.

Event colors are the same in light and dark mode. To use a different color in each, point the option at a CSS variable of your own and set that variable per mode:

```js
colors: { war: 'var(--war-color)' }
```

```css
.chroniko { --war-color: #c0392b; }
@media (prefers-color-scheme: dark) {
  .chroniko { --war-color: #ff7b72; }
}
```

#### Component colors

The component's colors are CSS custom properties on `.chroniko`:

| Property       | Used for | Light     | Dark      |
| -------------- | -------- | --------- | --------- |
| `--ck-bg`      | Timeline and card background | `#ffffff` | `#0d1117` |
| `--ck-surface` | Toolbar and story list background | `#f6f7f9` | `#161b22` |
| `--ck-fg`      | Text | `#1f2328` | `#e6edf3` |
| `--ck-muted`   | Secondary text, axis labels | `#656d76` | `#8d96a0` |
| `--ck-border`  | Borders and dividers | `#d8dee4` | `#30363d` |
| `--ck-grid`    | Grid lines behind the events | `#eef1f4` | `#1c2128` |
| `--ck-focus`   | Focus rings and links | `#0969da` | `#4493f8` |

Override them in your own stylesheet, loaded after `chroniko.min.css`:

```css
.chroniko {
  --ck-bg: #fffdf7;
  --ck-surface: #f5f0e6;
  --ck-border: #e0d6c3;
}
```

The dark values are set in a `prefers-color-scheme: dark` media query. A rule like the one above applies in both modes, so if your page supports dark mode, also override the dark values:

```css
@media (prefers-color-scheme: dark) {
  .chroniko {
    --ck-bg: #1b1915;
    --ck-surface: #24211c;
    --ck-border: #3a352d;
  }
}
```

To theme one timeline only, use a more specific selector such as `#timeline.chroniko`.

### Theming

Besides the [colors](#component-colors), you can override `--ck-height` (the timeline's height, `420px` by default) and `--ck-sticky-top` (see [Story beside the timeline](#story-beside-the-timeline)) on `.chroniko`. Dark mode follows `prefers-color-scheme`. All other class names inside the component use the `ck-` prefix (e.g. `.ck-event`, `.ck-card`), so they won't clash with your page's styles.

## License

[Apache License 2.0](LICENSE)
