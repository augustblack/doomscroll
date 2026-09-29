# config.js reference

Everything your piece does is described in `config.js`. This is the full list of
what you can put in it. If you're just starting, read the [README](README.md)
first — this page is for looking things up.

- [Recipes](#recipes)
- [Top level](#top-level)
- [Slides](#slides)
- [Layers](#layers)
- [Text layers](#text-layers)
- [Effects](#effects)
- [playWhen](#playwhen)

---

## Recipes

Copy these and change the numbers.

**Fade in as it arrives, fade out as it leaves**

```js
fx: [
  { fx: "opacity", from: 0, to: 1, range: [0, 0.35] },
  { fx: "opacity", from: 1, to: 0, range: [0.65, 1] }
]
```

**Underwater → clear** (the one audio move worth learning)

```js
fx: [ { fx: "lowpass", from: 200, to: 18000, ease: "inOut" } ]
```

**Slow push-in (Ken Burns)**

```js
fx: [ { fx: "scale", from: 1, to: 1.3 } ]
```

**Parallax** — put this on a background layer so it drifts slower than the slide

```js
fx: [ { fx: "translateY", from: 15, to: -15 } ]
```

**Scrubbing** — you become the video's transport

```js
{ type: "video", src: "media/clip.mp4", playWhen: "scrub" }
```

**Sound sweeping across your head**

```js
fx: [ { fx: "stereoPan", from: -1, to: 1 } ]
```

**A swell into a cavernous space**

```js
fx: [
  { fx: "reverb", from: 0, to: 0.9, decay: 4 },
  { fx: "highpass", from: 20, to: 900 }
]
```

**Two images eating each other**

```js
layers: [
  { type: "video", src: "media/bg.mp4" },
  { type: "image", src: "media/grain.png", blend: "difference", opacity: 0.6 }
]
```

---

## Top level

```js
const DOOM = { ...these... };
```

| Key | Values | Default | What it does |
|---|---|---|---|
| `title` | text | `"doom scroll"` | browser tab title |
| `scroll` | `"vertical"` \| `"horizontal"` | `"vertical"` | which way the piece runs |
| `mode` | `"continuous"` \| `"carousel"` | `"continuous"` | `carousel` snaps one slide at a time; `continuous` scrolls freely |
| `background` | any CSS colour | `"#000"` | behind everything |
| `fit` | `"cover"` \| `"contain"` | `"cover"` | `cover` fills the screen and crops; `contain` fits the whole frame in |
| `maxConcurrent` | number | `4` | how many clips may play at once. Lower it if playback stutters |
| `splash` | object | — | the opening screen, see below |
| `bed` | object | — | one soundtrack under the whole piece, see below |
| `defaults` | object | — | `fit` and `playWhen` applied to every layer unless overridden |
| `slides` | array | **required** | your piece |

### `splash`

The opening screen. Tapping it is what permits sound, so it always appears.

```js
splash: { text: "MY PIECE", sub: "tap to begin", background: "#0a0a12" }
```

### `bed`

One looping soundtrack under the entire piece. Unlike everything else, its
effects are driven by how far you've scrolled through the **whole piece**, not
by any single slide.

```js
bed: {
  src: "media/drone.mp3",
  volume: 0.35,
  loop: true,                 // default true
  fx: [ { fx: "lowpass", from: 300, to: 6000 } ]
}
```

Only [audio effects](#audio-effects) work on the bed.

---

## Slides

Each entry in `slides` is one screenful.

| Key | What it does |
|---|---|
| `id` | a name, shown in the `?debug=1` readout. Optional but helpful |
| `background` | CSS colour behind this slide's layers |
| `layers` | array of layers, drawn back to front |

**Shorthand:** a slide with a `type` and no `layers` is treated as a single
layer, so these two are identical:

```js
{ type: "text", text: "hello" }
{ layers: [ { type: "text", text: "hello" } ] }
```

---

## Layers

Every layer has a `type`. Layers are drawn in order — first is furthest back.

| Key | Applies to | What it does |
|---|---|---|
| `type` | all | `"video"`, `"image"`, `"audio"` or `"text"` |
| `src` | video, image, audio | path to the file, e.g. `"media/clip.mp4"` |
| `fx` | all | array of [effects](#effects) |
| `opacity` | all | fixed opacity, `0`–`1`. Combines with an `opacity` effect |
| `blend` | all | `"difference"`, `"screen"`, `"multiply"`, `"overlay"`, `"exclusion"`, `"lighten"`, `"darken"` … |
| `fit` | video, image | `"cover"` or `"contain"`, overriding the top-level setting |
| `loop` | video, audio | `true` (default) or `false` |
| `volume` | video, audio | base loudness, `0`–`1` |
| `playWhen` | video, audio | see [playWhen](#playwhen) |
| `silent` | video | `true` mutes the clip entirely |
| `alt` | image | description for screen readers |

---

## Text layers

```js
{ type: "text", text: "day 4", size: "large", pos: "bottomleft", color: "#fff" }
```

| Key | Values | What it does |
|---|---|---|
| `text` | text | what it says. Use `\n` for a line break |
| `size` | `"small"`, `"medium"`, `"large"`, `"huge"` | scales with the screen, so it works on a phone and a projector |
| `pos` | `"center"`, `"top"`, `"bottom"`, `"left"`, `"right"`, `"topleft"`, `"topright"`, `"bottomleft"`, `"bottomright"` | where it sits |
| `color` | CSS colour | text colour |
| `font` | CSS font stack | e.g. `"Georgia, serif"` |
| `weight` | `100`–`900` | thickness |
| `tracking` | CSS length | letter spacing, e.g. `"0.2em"` |
| `shadow` | `true` or a CSS shadow | `true` gives a soft drop shadow so text stays legible over video |

Text is a normal layer, so it stacks over video and images and takes all the
same visual effects.

---

## Effects

An effect entry looks like this:

```js
{ fx: "blur", from: 30, to: 0, range: [0, 0.5], ease: "out" }
```

| Key | Default | What it does |
|---|---|---|
| `fx` | **required** | the effect name |
| `from` | effect's own default | value at the start of the travel |
| `to` | effect's own default | value at the end |
| `range` | `[0, 1]` | which part of the 0→1 travel the change happens over. Outside it, the value holds |
| `ease` | `"linear"` | `"linear"`, `"in"`, `"out"`, `"inOut"`, `"step"` |
| `value` | — | a fixed value instead of `from`/`to` |

You can stack as many effects on a layer as you like, including the same effect
twice with different `range`s (that's how the fade in/out recipe works).

### Visual effects

Work on any layer.

| Name | Range | Default | Notes |
|---|---|---|---|
| `blur` | `0`–`60` | `0` | in pixels. Expensive above ~40 |
| `brightness` | `0`–`3` | `1` | `1` is untouched |
| `contrast` | `0`–`3` | `1` | |
| `saturate` | `0`–`3` | `1` | `0` is greyscale |
| `grayscale` | `0`–`1` | `0` | |
| `invert` | `0`–`1` | `0` | |
| `sepia` | `0`–`1` | `0` | |
| `hueRotate` | `0`–`360` | `0` | in degrees |
| `opacity` | `0`–`1` | `1` | |
| `scale` | any | `1` | `1.3` = 30% bigger |
| `rotate` | any | `0` | in degrees |
| `translateX` | `-100`–`100` | `0` | percent of the screen |
| `translateY` | `-100`–`100` | `0` | percent of the screen |

> If the viewer has "reduce motion" turned on in their system settings, the
> movement effects (`scale`, `rotate`, `translateX`, `translateY`) are skipped
> automatically. Everything else still runs.

### Media effects

| Name | Range | Default | Notes |
|---|---|---|---|
| `playbackRate` | `0.0625`–`16` | `1` | speed. Also shifts the pitch of the sound |

### Audio effects

Only work on `video` and `audio` layers, and on the `bed`.

| Name | Range | Default | Notes |
|---|---|---|---|
| `volume` | `0`–`4` | `1` | multiplies the layer's `volume` |
| `lowpass` | `20`–`20000` | `20000` | Hz. Cuts treble — low numbers sound muffled |
| `highpass` | `20`–`20000` | `20` | Hz. Cuts bass — high numbers sound thin and distant |
| `bandpass` | `20`–`20000` | `1000` | Hz. Keeps only a narrow band, like a telephone |
| `resonance` | `0.1`–`40` | `1` | emphasis right at the filter's frequency. Above ~10 it whistles |
| `reverb` | `0`–`1` | `0` | how wet. Add `decay:` in seconds (default `2.5`) for room size |
| `delay` | `0`–`1` | `0` | how wet. Add `time:` in seconds (default `0.25`) and `feedback:` `0`–`0.95` (default `0.35`) |
| `stereoPan` | `-1`–`1` | `0` | `-1` full left, `1` full right |
| `distortion` | `0`–`1` | `0` | how wet. Add `drive:` (default `120`) for how savage |

Settings like `decay`, `time`, `feedback` and `drive` are fixed for the whole
layer — they sit alongside `from`/`to` and don't animate:

```js
{ fx: "delay", from: 0, to: 0.5, time: 0.33, feedback: 0.5, range: [0.4, 1] }
```

> **One filter per layer.** `lowpass`, `highpass` and `bandpass` share the same
> filter, so use only one of them on a given layer. If you list more than one,
> `lowpass` wins, then `highpass`, then `bandpass`. `resonance` applies to
> whichever one is active.

---

## playWhen

Controls when a `video` or `audio` layer plays.

| Value | Behaviour |
|---|---|
| `"inview"` | **default.** Plays while the slide is on screen, pauses when it isn't |
| `"always"` | plays constantly, on screen or not |
| `"once"` | starts the first time the slide appears and never restarts |
| `"scrub"` | doesn't play on its own — the video's playhead follows your scrolling. Scroll up and it runs backwards |
| `"never"` | never plays. Useful for a video you only want as a still frame |

Only `maxConcurrent` clips (default 4) play at once; when more qualify, the
most-visible ones win. Media is not downloaded until its slide is nearly on
screen, so long pieces stay light.

For scrubbing to feel smooth the clip needs frequent keyframes — see the
media diet section of the [README](README.md#media-diet).
