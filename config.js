
const DOOM = {

  title: "doom scroll — demo by August",

  scroll: "vertical",       // "vertical", "horizontal", "up" or "left"
  mode: "carousel",       // "continuous" (free) or "carousel" (snaps)
  background: "#000",
  fit: "cover",             // "cover" fills the screen, "contain" fits inside

  // The opening screen. Tapping it is what lets the browser play sound,
  // so it is not optional — treat it as your title card.
  splash: {
    text: "DOOM SCROLL",
    sub: "tap to begin",
    background: "#000000"
  },

  // One soundtrack under the whole piece. Its effects are driven by how far
  // you've scrolled through the ENTIRE thing, not by any single slide.
  bed: {
    src: "media/drone.mp3",
    volume: 1,
    loop: true,

    // Uncomment to make the soundtrack's speed follow how fast you scroll:
    // read slowly and it drags, flick and it races, stop and it idles.
    // `true` uses the defaults; see CONFIG.md "scrollRate" to tune it.
    scrollRate: true,

    fx: [
      { fx: "lowpass", from: 300, to: 6000 },   // opens up as you descend
      { fx: "volume", from: 1, to: 0.4, range: [0.7, 1] }
    ]
  },

  slides: [
    {
      id: "one",
      background: "#0a0a12",
      layers: [
        {
          type: "image",
          src: "media/pg01.jpg",
        },
        {
          type: "text",
          text: "SOMETHING IS INTERFERING",
          size: "large",
          pos: "center",
          color: "#000000",
          fx: [
            { fx: "opacity", from: 0, to: 1, range: [0.1, 0.5] },
            { fx: "blur", from: 30, to: 0, range: [0.1, 0.5] },
            { fx: "scale", from: 1.6, to: 1 }

          ]
        }

      ]
    },
    {
      id: "two",
      background: "#0a0a12",
      layers: [
        {
          type: "image",
          src: "media/pg02.jpg",
        },
        {
          type: "text",
          text: "THIS IS NOT A SPEAKER",
          size: "large",
          pos: "center",
          color: "#000000",
          fx: [
            { fx: "opacity", from: 0, to: 1, range: [0.1, 0.5] },
            { fx: "blur", from: 30, to: 0, range: [0.1, 0.5] },
            { fx: "scale", from: 1.6, to: 1 }

          ]
        }
      ]
    },
    {
      id: "descent",
      background: "#000",
      hold: 5,                  // pinned for 3 extra screens of scrolling
      layers: [
        {
          type: "video",
          src: "media/floor_sm.mp4"
          // hold implies playWhen: "scrub" on a video, so nothing else needed
        },
        {
          type: "text",
          text: "you are the transport",
          size: "medium",
          pos: "bottomleft",
          shadow: true,
          // On a hold slide, effects run across the PIN: 0 when it locks,
          // 1 when it releases. Start the fade a little way in so it doesn't
          // appear to pop.
          fx: [
            { fx: "opacity", from: 0, to: 1, range: [0.05, 0.4] },
            { fx: "translateY", from: 10, to: -10 }
          ]
        },
        {
          type: "audio",
          src: "media/noise.mp3",
          scrollRate: true,
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


    {
      id: "one",
      background: "#0a0a12",
      layers: [
        {
          type: "image",
          src: "media/pg03.jpg",
        },
        {
          type: "text",
          text: "NO ONE IS TALKING",
          size: "large",
          pos: "center",
          color: "#000000",
          fx: [
            { fx: "opacity", from: 0, to: 1, range: [0.1, 0.5] },
            { fx: "blur", from: 30, to: 0, range: [0.1, 0.5] },
            { fx: "scale", from: 1.6, to: 1 }

          ]
        }

      ]
    },


    {
      id: "one",
      background: "#0a0a12",
      layers: [
        {
          type: "image",
          src: "media/pg04.jpg",
        },
        {
          type: "text",
          text: "I DONT KNOW",
          size: "large",
          pos: "center",
          color: "#000000",
          fx: [
            { fx: "opacity", from: 0, to: 1, range: [0.1, 0.5] },
            { fx: "blur", from: 30, to: 0, range: [0.1, 0.5] },
            { fx: "scale", from: 1.6, to: 1 }

          ]
        }

      ]
    },


    {
      id: "one",
      background: "#0a0a12",
      layers: [
        {
          type: "image",
          src: "media/pg05.jpg",
        },
        {
          type: "text",
          text: "WINDOWLESS ROOM",
          size: "large",
          pos: "center",
          color: "#000000",
          fx: [
            { fx: "opacity", from: 0, to: 1, range: [0.1, 0.5] },
            { fx: "blur", from: 30, to: 0, range: [0.1, 0.5] },
            { fx: "scale", from: 1.6, to: 1 }

          ]
        }

      ]
    },


    {
      id: "one",
      background: "#0a0a12",
      layers: [
        {
          type: "image",
          src: "media/pg06.jpg",
        },
        {
          type: "text",
          text: "ALL ALONE",
          size: "large",
          pos: "center",
          color: "#000000",
          fx: [
            { fx: "opacity", from: 0, to: 1, range: [0.1, 0.5] },
            { fx: "blur", from: 30, to: 0, range: [0.1, 0.5] },
            { fx: "scale", from: 1.6, to: 1 }

          ]
        }

      ]
    },


    {
      layers: [
        {
          type: "image",
          src: "media/pg07.jpg",
        },
        {
          type: "text",
          text: "BORING OBJECTS",
          size: "large",
          pos: "center",
          color: "#000000",
          fx: [
            { fx: "opacity", from: 0, to: 1, range: [0.1, 0.9] },
            { fx: "blur", from: 100, to: 0, range: [0.1, 0.9] },
            { fx: "scale", from: 1.6, to: 1 }

          ]
        }

      ]
    },

    {
      id: "one",
      background: "#0a0a12",
      layers: [
        {
          type: "image",
          src: "media/pg08.jpg",
        },
      ]
    },



    /* --- a pinned, scroll-scrubbed video ----------------------------------
       The slide stops dead in the middle of the screen and your scrolling
       walks the video's frames. At the last frame it lets go and moves on.
       See CONFIG.md "hold — pinned scrubbing" for how to encode the clip —
       an ordinary mp4 will scrub like a slideshow.
    {
      id: "descent",
      background: "#000",
      hold: 3,                  // pinned for 3 extra screens of scrolling
      layers: [
        {
          type: "video",
          src: "media/floor_sm.mp4"
          // hold implies playWhen: "scrub" on a video, so nothing else needed
        },
        {
          type: "text",
          text: "you are the transport",
          size: "medium",
          pos: "bottomleft",
          shadow: true,
          // On a hold slide, effects run across the PIN: 0 when it locks,
          // 1 when it releases. Start the fade a little way in so it doesn't
          // appear to pop.
          fx: [
            { fx: "opacity", from: 0, to: 1, range: [0.05, 0.4] },
            { fx: "translateY", from: 10, to: -10 }
          ]
        }
      ]
    },
    */

    /* --- 1. a plain title card -------------------------------------------
       Text is just another layer type, so it can sit alone like this or be
       stacked on top of video and images (see slide 2).
    {
      id: "title",
      background: "#0a0a12",
      layers: [
        {
          type: "text",
          text: "Keep Vibing",
          size: "huge",
          pos: "center"
        }
      ]
    },

    {
      id: "arrival",
      background: "#111",
      layers: [
        {
          type: "video",
          src: "media/floor_sm.mp4",
          playWhen: "inview",
          fx: [
            { fx: "rotate", from: -6, to: 6 },
            { fx: "scale", from: 1.6, to: 1.1 },
            { fx: "contrast", from: 1.6, to: 1 },
            { fx: "hueRotate", from: 0, to: 360 }
          ]
        }
      ]
    },

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
    */
  ]
};
