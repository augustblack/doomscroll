# doom scroll

Make a scrolling media piece — abstract or narrative — by editing one file.

No installing, no accounts, no build step. You edit `config.js`, drop your media
in the `media/` folder, and open `index.html`. When you're finished you upload
the whole folder to a webserver and it just works.

---

## Start here

1. **Open `index.html`** by double-clicking it. You should see the demo.
2. **Open `config.js`** in a text editor. That's your piece.
3. Change the `title`, change some words, save, and reload the browser.
4. Delete the demo slides and start making your own.

That's the entire workflow. Everything below is detail.

---

## The one idea you need

Every layer has a **progress** value that runs from `0` to `1` as it travels
across the screen:

```
      0                 0.5                  1
  about to enter    dead centre        just left
```

Every effect is written as a journey across that travel:

```js
{ fx: "blur", from: 30, to: 0 }
```

"Start blurred, be sharp by the time you've crossed." That's it. The same shape
works for sound:

```js
{ fx: "lowpass", from: 200, to: 18000 }
```

"Start muffled, open up as you arrive."

Add `range` to make an effect happen during only part of the travel, and `ease`
to change its shape:

```js
{ fx: "opacity", from: 0, to: 1, range: [0, 0.35], ease: "out" }
```

**Full list of every option and effect: [CONFIG.md](CONFIG.md)**

---

## The shape of a piece

```js
const DOOM = {
  title: "my piece",
  scroll: "vertical",        // or "horizontal"
  mode: "continuous",        // or "carousel", which snaps one slide at a time

  splash: { text: "MY PIECE", sub: "tap to begin" },

  bed: { src: "media/drone.mp3", volume: 0.3 },   // optional soundtrack

  slides: [
    { type: "text", text: "hello", size: "huge" },

    { type: "video", src: "media/clip.mp4",
      fx: [ { fx: "blur", from: 30, to: 0 } ] },

    { layers: [                                    // stack things up
        { type: "video", src: "media/bg.mp4" },
        { type: "image", src: "media/grain.png", blend: "difference" },
        { type: "text",  text: "day 4", pos: "bottomleft" }
      ] }
  ]
};
```

A slide with one thing in it can skip `layers` entirely. A slide with several
things uses `layers`, drawn back to front.

---

## Why there's a "tap to begin" screen

Browsers refuse to play sound until the visitor interacts with the page. There
is no way around it, so the framework turns that requirement into your title
card. Style it with the `splash` block — treat it as the first thing in your
piece, not as a nuisance.

---

## Four things worth trying first

| Try this | What it does |
|---|---|
| `{ fx: "lowpass", from: 200, to: 18000 }` on an audio layer | muffled → clear, as if surfacing from underwater |
| `playWhen: "scrub"` on a video | the clip's playhead follows your scrolling; scroll up and it runs backwards |
| `blend: "difference"` on a layer stacked over another | the two images eat each other |
| `{ fx: "scale", from: 1.3, to: 1 }` | a slow push-in as the slide arrives |

---

## Media diet

**Read this before you shoot or export anything.** The single most common way
these projects fail is a folder full of enormous files that freezes the laptop
during critique.

- **Video:** 1080p or smaller, H.264 `.mp4`, aim for **under 10 MB per clip**.
  Short loops beat long takes — a 6-second loop reads as continuous.
- **Audio:** `.mp3` or `.m4a`, 128 kbps is plenty. Not `.wav`.
- **Images:** `.jpg` for photos, `.png` only when you need transparency. No
  bigger than 2000px on the long edge.
- **Filenames:** lowercase, no spaces. `my-clip.mp4`, never `My Clip.mp4` —
  spaces and capitals break on some webservers even though they work locally.

To shrink a video:

```sh
ffmpeg -i big.mov -vf "scale=-2:1080" -c:v libx264 -crf 26 -preset slow \
  -pix_fmt yuv420p -c:a aac -b:a 128k small.mp4
```

If you plan to **scrub** a clip (`playWhen: "scrub"`, or a `hold` slide), it
needs frequent, evenly spaced keyframes or seeking will feel gluey:

```sh
ffmpeg -i big.mov -vf "scale=-2:720,fps=24" \
  -c:v libx264 -pix_fmt yuv420p -crf 23 -preset slow \
  -g 6 -keyint_min 6 -sc_threshold 0 \
  -x264-params "bframes=0:ref=1:scenecut=0" \
  -movflags +faststart -an scrubbable.mp4
```

`-g 10` on its own is not enough: x264 still inserts extra keyframes wherever it
detects a cut, so the spacing ends up uneven and some seeks are slow. The full
recipe is explained in [CONFIG.md](CONFIG.md#preparing-a-clip-to-scrub).

The framework only lets a few clips decode at once, but it can't rescue a
500 MB file. Keep the whole folder under a couple hundred megabytes.

---

## When something breaks

Problems show up as a **red panel** at the bottom of the screen naming the
exact slide, layer, and mistake. Read it — it usually tells you the fix.

If you get a **blank page**, `config.js` almost certainly has a typo. The red
panel will name the line number. The usual suspects:

- a missing comma between two items
- one comma too many, right before a `}` or `]`
- a quote or bracket that was never closed

Add `?debug=1` to the address bar to see a live readout of every slide's
progress and visibility:

```
file:///.../index.html?debug=1
```

---

## Handing it in / putting it online

Upload the **entire folder**, keeping the structure intact:

```
index.html
config.js
doom/
media/
```

Any webserver works — no special configuration, no server-side anything. Drop
it on your web space, a static host, or hand in the folder as a zip. The person
opening it needs nothing but a browser.

> **If you are scrubbing video, the server has to support byte ranges.** Real
> hosts all do, so your uploaded piece is fine. But the quick local server
> people reach for first, `python3 -m http.server`, does **not** — and the
> symptom is nasty, because the clip loads and shows its first frame and simply
> refuses to seek, so scrubbing looks broken when your config is correct. Use
> `npx serve` or `php -S localhost:8000` locally instead, or just test scrubbing
> on the real upload.

Before you hand in:

- delete any leftover demo files from `media/` that you aren't using
- open it once from a **fresh copy of the folder** to catch a file you forgot
- check it on a phone

---

## Files

| File | What it is |
|---|---|
| `config.js` | **your piece** — the only file you need to edit |
| `media/` | your images, video, and audio |
| `index.html` | the page itself; you rarely touch it |
| `doom/doom.js` | the engine |
| `doom/doom.css` | layout and scrolling |
| `CONFIG.md` | reference for every option and effect |
