/* ===========================================================================
   doom scroll — this is the only file you need to edit.
   ---------------------------------------------------------------------------
   Put your media in the media/ folder, describe your piece below, then open
   index.html. Full reference for every option is in CONFIG.md.

   THE ONE IDEA: every layer has a "progress" value that runs 0 -> 1 as it
   crosses the screen. 0 = about to enter, 0.5 = dead centre, 1 = just left.
   Every effect is written as a from/to across that travel:

       { fx: "blur", from: 30, to: 0 }

   ...means "start blurred, be sharp by the time you've fully crossed".
   Add range: [0, 0.5] to make it happen over only part of the travel.
   =========================================================================== */

const DOOM = {

  title: "doom scroll — demo",

  scroll: "vertical",       // "vertical" or "horizontal"
  mode: "carousel",       // "continuous" (free) or "carousel" (snaps)
  background: "#000",
  fit: "cover",             // "cover" fills the screen, "contain" fits inside

  // The opening screen. Tapping it is what lets the browser play sound,
  // so it is not optional — treat it as your title card.
  splash: {
    text: "DOOM SCROLL",
    sub: "tap to begin",
    background: "#0a0a12"
  },

  // One soundtrack under the whole piece. Its effects are driven by how far
  // you've scrolled through the ENTIRE thing, not by any single slide.
  bed: {
    src: "media/drone.mp3",
    volume: 0.35,
    loop: true,
    fx: [
      { fx: "lowpass", from: 300, to: 6000 },   // opens up as you descend
      { fx: "volume", from: 1, to: 0.4, range: [0.7, 1] }
    ]
  },

  slides: [

    /* --- 1. a plain title card -------------------------------------------
       Text is just another layer type, so it can sit alone like this or be
       stacked on top of video and images (see slide 2). */
    {
      id: "title",
      background: "#0a0a12",
      layers: [
        {
          type: "text",
          text: "Keep Scrolling",
          size: "huge",
          pos: "center",
          fx: [
            { fx: "opacity", from: 0, to: 1, range: [0, 0.35] },
            { fx: "opacity", from: 1, to: 0, range: [0.65, 1] },
            { fx: "blur", from: 0, to: 3 },
            { fx: "translateY", from: 100, to: 0 }
          ]
        }
      ]
    },

    /* --- 2. video + a sound with a filter sweep + a caption on top --------
       The lowpass going 200 -> 18000 is the "underwater becomes clear"
       move. If you only learn one audio effect, learn this one. */
    {
      id: "arrival",
      background: "#111",
      layers: [
        {
          type: "video",
          src: "media/pattern.mp4",
          playWhen: "inview",
          fx: [
            { fx: "blur", from: 40, to: 0, range: [0, 0.5], ease: "out" },
            { fx: "scale", from: 1.4, to: 1 },
            { fx: "saturate", from: 0, to: 1.3, range: [0.1, 0.6] }
          ]
        },
        {
          type: "audio",
          src: "media/noise.mp3",
          volume: 0.5,
          playWhen: "inview",
          fx: [
            { fx: "lowpass", from: 200, to: 18000, ease: "inOut" },
            { fx: "volume", from: 0, to: 1, range: [0, 0.3] },
            { fx: "volume", from: 1, to: 0, range: [0.7, 1] },
            { fx: "stereoPan", from: -1, to: 1 }
          ]
        },
        {
          type: "text",
          text: "DECIDE NOT TO DECIDE",
          size: "large",
          pos: "center",
          shadow: true,
          fx: [
            { fx: "opacity", from: 0, to: 1, range: [0.2, 0.45] },
            { fx: "translateY", from: 100, to: 0, range: [0, 0.5] }
          ]
        }
      ]
    },

    /* --- 3. two visuals stacked with a blend mode -------------------------
       mix-blend-mode is where abstract pieces get interesting. Try
       "difference", "screen", "multiply", "overlay", "exclusion". */
    {
      id: "interference",
      background: "#000",
      layers: [
        {
          type: "video",
          src: "media/gradient.mp4",
          fx: [{ fx: "scale", from: 1, to: 1.25 }]
        },
        {
          type: "image",
          src: "media/grain.png",
          blend: "difference",
          opacity: 0.55,
          fx: [
            { fx: "rotate", from: -6, to: 6 },
            { fx: "scale", from: 1.6, to: 1.1 }
          ]
        },
        {
          type: "text",
          text: "Something is\n...INTERFERING",
          size: "large",
          pos: "center",
          color: "#ff2b5e",
          fx: [{ fx: "opacity", from: 0, to: 1, range: [0.25, 0.5] }]
        }
      ]
    },

    /* --- 4. scrubbing: the video's playhead is tied to your scroll --------
       playWhen: "scrub" means the clip does not play on its own — YOU are
       the transport. Scroll up and it runs backwards. */
    {
      id: "scrub",
      background: "#000",
      layers: [
        {
          type: "video",
          src: "media/zoom.mp4",
          playWhen: "scrub",
          fx: [
            { fx: "contrast", from: 1.6, to: 1 },
            { fx: "hueRotate", from: 0, to: 360 }
          ]
        },
        {
          type: "text",
          text: "you are the transport",
          size: "medium",
          pos: "topleft",
          shadow: true,
          fx: [
            { fx: "contrast", from: 1.6, to: 1 },
            { fx: "hueRotate", from: 0, to: 360 }
          ]

        }
      ]
    },

    /* --- 5. a still image + a reverb swell -------------------------------- */
    {
      id: "cathedral",
      background: "#05050a",
      layers: [
        {
          type: "image",
          src: "media/stripes.png",
          fx: [
            { fx: "rotate", from: 0, to: 25 },
            { fx: "scale", from: 1.2, to: 2.8 },
            { fx: "invert", from: 0, to: 1, range: [0.5, 1] }
          ]
        },
        {
          type: "audio",
          src: "media/noise.mp3",
          volume: 0.35,
          playWhen: "inview",
          fx: [
            { fx: "reverb", from: 0, to: 0.9, decay: 4 },
            { fx: "highpass", from: 20, to: 900 },
            { fx: "delay", from: 0, to: 0.5, time: 0.33, feedback: 0.5, range: [0.4, 1] },
            { fx: "volume", from: 0, to: 1, range: [0, 0.25] }
          ]
        }
      ]
    },

    /* --- 6. the end ------------------------------------------------------- */
    {
      id: "end",
      background: "#000",
      layers: [
        {
          type: "text",
          text: "no bottom",
          size: "huge",
          pos: "center",
          fx: [
            { fx: "opacity", from: 0, to: 1, range: [0.1, 0.5] },
            { fx: "blur", from: 30, to: 0, range: [0.1, 0.5] },
            { fx: "scale", from: 1.6, to: 1 }
          ]
        }
      ]
    }
  ]
};
