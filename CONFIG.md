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
- [scrollRate](#scrollrate)
- [hold — pinned scrubbing](#hold--pinned-scrubbing)

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

**Pinned scrubbing** — the slide stops dead and your scrolling walks the frames

```js
{ hold: 3, type: "video", src: "media/clip.mp4" }
```

**A soundtrack that drags when you read slowly**

```js
bed: { src: "media/drone.mp3", scrollRate: true }
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
  scrollRate: true,           // speed follows how fast you scroll
  fx: [ { fx: "lowpass", from: 300, to: 6000 } ]
}
```

Only [audio effects](#audio-effects) and [`scrollRate`](#scrollrate) work on the
bed.

---

## Slides

Each entry in `slides` is one screenful.

| Key | What it does |
|---|---|
| `id` | a name, shown in the `?debug=1` readout. Optional but helpful |
| `background` | CSS colour behind this slide's layers |
| `layers` | array of layers, drawn back to front |
| `hold` | pins the slide to the screen while you scroll `N` extra screens past it — see [hold](#hold--pinned-scrubbing) |

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
| `scrollRate` | video, audio | playback speed follows how fast you scroll — see [scrollRate](#scrollrate) |
| `hold` | all | same as putting it on the slide — see [hold](#hold--pinned-scrubbing) |
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

If the layer also has [`scrollRate`](#scrollrate), the two **multiply**:
`playbackRate` sets the base speed and `scrollRate` pushes it around.

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
| `"scrub"` | doesn't play on its own — the video's playhead follows your scrolling. Scroll up and it runs backwards. Pairs with [`hold`](#hold--pinned-scrubbing), which is what makes it feel like a transport rather than a flicker |
| `"never"` | never plays. Useful for a video you only want as a still frame |
| `"manual"` | never plays by itself and is left alone. An escape hatch; you will probably never need it |

Only `maxConcurrent` clips (default 4) play at once; when more qualify, the
most-visible ones win. Media is not downloaded until its slide is nearly on
screen, so long pieces stay light.

For scrubbing to feel smooth the clip needs frequent keyframes — see
[preparing a clip to scrub](#preparing-a-clip-to-scrub).

---

## scrollRate

Ties playback speed to **how fast you are scrolling**, rather than to how far
you have got. Scroll slowly and the sound drags; flick down the page and it
races. Stop and it idles rather than stopping, which is the whole trick — it
never feels like you hit a pause button.

```js
bed: { src: "media/drone.mp3", scrollRate: true }
```

`true` gives sensible defaults. For control, use an object:

| Key | Default | What it does |
|---|---|---|
| `normal` | `0.8` | how many **screens per second** of scrolling counts as normal speed. Lower it to make the piece easier to speed up |
| `min` | `0.5` | slowest it goes. This is also where it idles when you stop |
| `max` | `2.0` | fastest it goes |
| `smooth` | `0.12` | how quickly it reacts, `0`–`1`. `0.05` is syrupy, `0.5` is twitchy |
| `pitch` | `true` | `true` lets the pitch rise and fall with the speed, like a tape. `false` keeps the pitch and changes only the tempo |

Works on the [`bed`](#bed) and on any `video` or `audio` layer.

Speed is measured in **screens per second, not pixels**, so the same numbers
feel the same on a phone and on a projector. Scrolling **up** speeds it up too —
it is about how hard you are moving, not which way.

> **Keep `min` at or above `0.5` and `max` at or below `2.0`.** Outside that
> range Safari and iOS throw the sound away and you get silence. Chrome will
> happily play `0.1`, which is exactly how you ship a piece that is mute on half
> the machines in the room.

`scrollRate` and `playWhen: "scrub"` do the same job in two different ways — a
scrubbing clip is already glued to your scrolling. Use one or the other.

In `mode: "carousel"` the scroll arrives in snapped bursts, so the effect reads
as a pulse per slide. It is much better in `mode: "continuous"`.

---

## hold — pinned scrubbing

`playWhen: "scrub"` on an ordinary slide gives you one screen of scrolling to get
through an entire clip, which is far too fast to see anything. `hold` fixes that:
it makes the slide taller and pins its contents to the screen, so your scrolling
moves **time** instead of space.

```js
{ id: "descent", hold: 3, type: "video", src: "media/clip.mp4" }
```

Three extra screens of scrolling, during which nothing moves except the video's
playhead. On a `video` layer `hold` turns on `playWhen: "scrub"` for you — write
`playWhen: "inview"` yourself if you would rather it just play while pinned.

| Value | Meaning |
|---|---|
| `2`–`4` | the useful range. `hold: 3` is about four seconds of unhurried scrolling |
| `true` | the same as `2` |
| `0.5` | fractions are fine, for a short held beat |

`hold` can go on the slide or on any one layer inside it — it means the same
thing either way, because it describes the whole slide.

Everything else on the slide is pinned too, and **every layer's effects are
driven by the pin** rather than by the slide arriving: `0` is the moment it locks
to the screen, `1` the moment it lets go. So text can assemble itself over the
hold:

```js
{
  hold: 3,
  layers: [
    { type: "video", src: "media/clip.mp4" },
    { type: "text", text: "slower", pos: "bottomleft", shadow: true,
      fx: [ { fx: "opacity", from: 0, to: 1, range: [0.05, 0.4] } ] }
  ]
}
```

Start that fade a little way in. At `range: [0, ...]` the text is already fully
there the instant the pin engages, which reads as a mistake.

**hold and carousel don't really get along.** A snap point wants to lock the
slide's top edge; a pin wants you to scroll past it. If any slide has a `hold`,
snapping across the whole piece softens from "always" to "only when you are
already close". Pieces built around `hold` are happier in `mode: "continuous"`.

### Preparing a clip to scrub

This single thing decides whether scrubbing feels like a transport or like a
slideshow. A normal `.mp4` only stores a complete picture every couple of
seconds and rebuilds everything in between, so to show you one frame the browser
has to decode everything since the last complete one. Store one every few frames
instead:

```sh
ffmpeg -i source.mov \
  -vf "scale=-2:720,fps=24" \
  -c:v libx264 -pix_fmt yuv420p -crf 23 -preset slow \
  -g 6 -keyint_min 6 -sc_threshold 0 \
  -x264-params "bframes=0:ref=1:scenecut=0" \
  -movflags +faststart -an \
  media/clip.mp4
```

- `-g 6 -keyint_min 6` — a complete picture every 6 frames, a quarter of a
  second, so no seek ever has to decode more than five frames.
- `-sc_threshold 0` and `scenecut=0` — stop ffmpeg adding extra ones of its own
  wherever it sees a cut, so the spacing stays even. Without these, `-g` alone
  does not do what you think.
- `bframes=0 ref=1` — no out-of-order frames. This is the other half of why
  ordinary video scrubs badly.
- `-an` — drop the audio. A scrubbing clip is paused, so it is silent anyway;
  put the sound on a separate `audio` layer or the `bed`.
- `fps=24` and `720` — scrubbing decodes much harder than playing does. Half the
  pixels is twice the responsiveness.

If it still feels gluey, go all the way and store every frame complete:

```sh
ffmpeg -i source.mov -vf "scale=-2:720,fps=24" \
  -c:v libx264 -pix_fmt yuv420p -crf 20 -g 1 \
  -movflags +faststart -an media/clip.mp4
```

That seeks instantly and is roughly four times the size — fine for four seconds,
a disaster for forty.

**Length.** Aim for **4 to 8 seconds** at 720p, under 8 MB. Roughly
`hold ≈ seconds ÷ 2`, so a 6-second clip wants `hold: 3`. Longer than about ten
seconds and you are asking someone to scroll for a full minute.

> **Scrubbing needs a webserver that supports byte ranges.** Every real host
> does, so your uploaded piece is fine — but `python3 -m http.server` does not,
> and the symptom is confusing: the clip loads, shows its first frame, and
> silently refuses to seek. Locally, use `npx serve` or `php -S localhost:8000`.
