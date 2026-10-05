/* doomScroll — a scrolling media engine driven entirely by config.js.
 *
 * The whole framework rests on one idea: every layer has a live `progress`
 * value from 0 to 1 describing how far it has travelled across the screen.
 * 0 = just about to enter, 0.5 = dead centre, 1 = just left.
 * Every effect, visual or audio, is an interpolation driven by that number.
 *
 * No build step, no dependencies. Works from file:// and from a webserver.
 */
(function () {
  'use strict';

  var DEBUG = /[?&]debug=1/.test(location.search);
  var REDUCE_MOTION = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var INVIEW_THRESHOLD = 0.25;   // fraction of a slide on screen before it plays
  var DEFAULT_MAX_CONCURRENT = 4;
  var PLAY_MODES = ['inview', 'always', 'once', 'scrub', 'never', 'manual'];

  var SCROLL_RATE_KEYS = ['normal', 'min', 'max', 'smooth', 'pitch'];
  var HOLD_MAX = 20;             // screens. Past this someone is scrolling for a minute
  var VEL_ALPHA = 0.3;           // fixed pre-smoothing that kills single-frame spikes

  /* Safari and iOS throw the audio away for playbackRate outside roughly this
     window. Chrome is far more permissive, which is exactly how you ship a piece
     that is mute on half the machines in the room. */
  var SAFE_RATE_LO = 0.5;
  var SAFE_RATE_HI = 2.0;

  /* ====================================================== error reporting === */
  /* Students will hit trailing commas and misspelled effect names constantly.
     A blank white page teaches them nothing, so every problem gets named. */

  var errors = [];
  var errorEl = null;

  function fail(message, hint) {
    for (var i = 0; i < errors.length; i++) {
      if (errors[i].message === message) return;   // don't spam duplicates
    }
    errors.push({ message: message, hint: hint });
    renderErrors();
    if (window.console) console.error('[doom] ' + message + (hint ? ' — ' + hint : ''));
  }

  function renderErrors() {
    if (!document.body) return;
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'doom-error';
      document.body.appendChild(errorEl);
    }
    var html = '<h2>doom scroll — ' + errors.length +
      (errors.length === 1 ? ' problem' : ' problems') + '</h2><ul>';
    for (var i = 0; i < errors.length; i++) {
      html += '<li>' + escapeHtml(errors[i].message);
      if (errors[i].hint) html += '<br><span style="opacity:.7">' + escapeHtml(errors[i].hint) + '</span>';
      html += '</li>';
    }
    errorEl.innerHTML = html + '</ul>';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ================================================================= math === */

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  var EASE = {
    linear: function (t) { return t; },
    'in':   function (t) { return t * t; },
    out:    function (t) { return 1 - (1 - t) * (1 - t); },
    inOut:  function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    step:   function (t) { return t < 0.5 ? 0 : 1; }
  };

  /* Round to 4 decimals so we don't churn the CSS string every frame. */
  function fmt(n) { return Math.round(n * 10000) / 10000; }

  /* Scroll speed jitters in the 4th decimal every single frame, so fmt() would
     still rewrite playbackRate 60 times a second and churn the decoder's
     resampler. 1% of speed is inaudible and cuts the writes by about 10x. */
  function fmt2(n) { return Math.round(n * 100) / 100; }

  /* Chase a target without caring about the frame rate. The naive
     `v += (target - v) * k` closes the gap twice as fast on a 120Hz iPad as on a
     60Hz laptop, so the same config would feel different on different screens.
     `smooth` reads as "how much of the gap it closes in one sixtieth of a second". */
  function damp(current, target, smooth, dt) {
    var k = clamp(smooth, 0.001, 1);
    return current + (target - current) * (1 - Math.pow(1 - k, dt * 60));
  }

  /* ============================================================= registry === */
  /* `kind` decides where a value ends up:
       filter    -> composed into one CSS filter: string
       transform -> composed into one CSS transform: string
       opacity   -> multiplied into the layer's opacity
       media     -> set on the <video>/<audio> element
       audio     -> set on a Web Audio node parameter                        */

  var FX = {
    /* --- visual: CSS filters --- */
    blur:       { kind: 'filter', css: 'blur',       unit: 'px',  def: 0 },
    brightness: { kind: 'filter', css: 'brightness', unit: '',    def: 1 },
    contrast:   { kind: 'filter', css: 'contrast',   unit: '',    def: 1 },
    saturate:   { kind: 'filter', css: 'saturate',   unit: '',    def: 1 },
    grayscale:  { kind: 'filter', css: 'grayscale',  unit: '',    def: 0 },
    invert:     { kind: 'filter', css: 'invert',     unit: '',    def: 0 },
    sepia:      { kind: 'filter', css: 'sepia',      unit: '',    def: 0 },
    hueRotate:  { kind: 'filter', css: 'hue-rotate', unit: 'deg', def: 0 },

    /* --- visual: opacity + transforms --- */
    opacity:    { kind: 'opacity', def: 1 },
    translateX: { kind: 'transform', css: 'translateX', unit: '%',   def: 0 },
    translateY: { kind: 'transform', css: 'translateY', unit: '%',   def: 0 },
    scale:      { kind: 'transform', css: 'scale',      unit: '',    def: 1 },
    rotate:     { kind: 'transform', css: 'rotate',     unit: 'deg', def: 0 },

    /* --- media --- */
    playbackRate: { kind: 'media', def: 1 },

    /* --- audio --- */
    volume:     { kind: 'audio', def: 1 },
    lowpass:    { kind: 'audio', def: 20000 },
    highpass:   { kind: 'audio', def: 20 },
    bandpass:   { kind: 'audio', def: 1000 },
    resonance:  { kind: 'audio', def: 1 },
    reverb:     { kind: 'audio', def: 0 },
    delay:      { kind: 'audio', def: 0 },
    stereoPan:  { kind: 'audio', def: 0 },
    distortion: { kind: 'audio', def: 0 }
  };

  /* Transforms are emitted in this fixed order so the result is predictable
     no matter what order they appear in the config. */
  var TRANSFORM_ORDER = ['translateX', 'translateY', 'scale', 'rotate'];

  /* Normalise one effect entry into { fx, from, to, range, ease, extra }. */
  function normFx(raw, where) {
    if (!raw || typeof raw !== 'object') {
      fail('An effect in ' + where + ' is not an object.', 'Each effect looks like { fx: "blur", from: 10, to: 0 }');
      return null;
    }
    var name = raw.fx || raw.name;
    if (!name) {
      fail('An effect in ' + where + ' is missing its "fx" name.', 'Example: { fx: "blur", from: 10, to: 0 }');
      return null;
    }
    if (!FX[name]) {
      fail('Unknown effect "' + name + '" in ' + where + '.', 'Available effects: ' + Object.keys(FX).join(', '));
      return null;
    }
    var def = FX[name];
    var from, to;
    if (typeof raw.value === 'number') {          // static value, no animation
      from = to = raw.value;
    } else {
      from = typeof raw.from === 'number' ? raw.from : def.def;
      to   = typeof raw.to === 'number' ? raw.to : def.def;
    }
    var range = Array.isArray(raw.range) && raw.range.length === 2 ? raw.range : [0, 1];
    if (raw.ease && !EASE[raw.ease]) {
      fail('Unknown ease "' + raw.ease + '" in ' + where + '.', 'Available: ' + Object.keys(EASE).join(', '));
    }
    return {
      fx: name, kind: def.kind, from: from, to: to,
      range: range,
      ease: EASE[raw.ease] || EASE.linear,
      raw: raw
    };
  }

  /* Evaluate an effect at progress p. */
  function fxValue(spec, p) {
    if (spec.from === spec.to) return spec.from;
    var lo = spec.range[0], hi = spec.range[1];
    var span = hi - lo;
    var t = span === 0 ? (p >= hi ? 1 : 0) : (p - lo) / span;
    t = spec.ease(clamp(t, 0, 1));
    return spec.from + (spec.to - spec.from) * t;
  }

  function fxListOf(cfg, where) {
    var raw = cfg.fx || cfg.effects || [];
    if (!Array.isArray(raw)) {
      fail('"fx" in ' + where + ' must be an array.', 'Write fx: [ { fx: "blur", from: 10, to: 0 } ]');
      return [];
    }
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var s = normFx(raw[i], where);
      if (s) out.push(s);
    }
    return out;
  }

  /* ======================================================== scrollRate ===== */
  /* Playback speed tied to how fast you are scrolling, rather than to where you
     have got to. Returns null when the feature is off. */

  function parseScrollRate(raw, where) {
    if (raw === undefined || raw === null || raw === false) return null;

    var sr = { normal: 0.8, min: SAFE_RATE_LO, max: SAFE_RATE_HI, smooth: 0.12, pitch: true };
    if (raw === true) return sr;

    if (typeof raw !== 'object') {
      fail('"scrollRate" in ' + where + ' must be true or an object.',
        'Try scrollRate: true, or scrollRate: { min: 0.6, max: 1.8 }');
      return null;
    }

    for (var k in raw) {
      if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
      if (SCROLL_RATE_KEYS.indexOf(k) === -1) {
        fail('Unknown scrollRate setting "' + k + '" in ' + where + '.',
          'Available: ' + SCROLL_RATE_KEYS.join(', '));
        continue;
      }
      if (k === 'pitch') {
        if (typeof raw.pitch !== 'boolean') {
          fail('"scrollRate.pitch" in ' + where + ' must be true or false.',
            'true lets the pitch rise with the speed, like a tape. ' +
            'false keeps the pitch and changes only the tempo.');
        } else sr.pitch = raw.pitch;
        continue;
      }
      if (typeof raw[k] !== 'number' || isNaN(raw[k])) {
        fail('"scrollRate.' + k + '" in ' + where + ' must be a number.',
          'You wrote ' + JSON.stringify(raw[k]) + '.');
      } else sr[k] = raw[k];
    }

    if (sr.normal <= 0) {
      fail('"scrollRate.normal" in ' + where + ' must be bigger than zero.',
        'It is how many screens per second counts as normal speed — try 0.8.');
      sr.normal = 0.8;
    }
    if (sr.max < sr.min) {
      fail('"scrollRate.max" in ' + where + ' is smaller than "min", so they have been swapped.',
        'min is the slowest speed, max the fastest.');
      var swap = sr.min; sr.min = sr.max; sr.max = swap;
    }
    sr.min = clamp(sr.min, 0.0625, 16);
    sr.max = clamp(sr.max, 0.0625, 16);
    sr.smooth = clamp(sr.smooth, 0.001, 1);

    /* Legal, and it sounds good in Chrome — so this is a warning rather than an
       error. It is still the most likely way this feature goes silent in class. */
    if ((sr.min < SAFE_RATE_LO || sr.max > SAFE_RATE_HI) && window.console) {
      console.warn('[doom] scrollRate in ' + where + ' goes outside ' +
        SAFE_RATE_LO + '–' + SAFE_RATE_HI + '. Safari and iOS drop the sound ' +
        'outside that window, so this may be silent on a phone.');
    }
    return sr;
  }

  /* `hold` is geometry: how many extra screens of scrolling a slide occupies
     while its contents stay pinned. Returns 0 when there is no hold. */
  function parseHold(raw, where) {
    if (!raw) return 0;
    if (raw === true) return 2;
    if (typeof raw !== 'number' || !isFinite(raw) || raw <= 0) {
      fail('"hold" in ' + where + ' must be true, or a positive number of screens.',
        'hold: 2 pins the slide while you scroll two extra screens past it. ' +
        'hold: true means 2.');
      return 0;
    }
    if (raw > HOLD_MAX) {
      fail('"hold" in ' + where + ' is ' + raw + ' screens, which is too long.',
        'Keep it to ' + HOLD_MAX + ' or less — nobody will scroll that far.');
      return 0;
    }
    return raw;
  }

  /* Safari spelled this with a prefix until recently, and forgets it whenever a
     new source loads — so it gets set both when the src is attached and again on
     loadedmetadata. */
  function applyPitchPref(m, pitchFollows) {
    var keep = !pitchFollows;
    if ('preservesPitch' in m) m.preservesPitch = keep;
    if ('webkitPreservesPitch' in m) m.webkitPreservesPitch = keep;
    if ('mozPreservesPitch' in m) m.mozPreservesPitch = keep;
  }

  /* ============================================================ audio bus === */

  var ctx = null;         // AudioContext, created on the splash tap
  var master = null;

  function audioReady() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { fail('This browser has no Web Audio support, so audio effects are off.'); return null; }
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    return ctx;
  }

  /* A reverb impulse response, generated rather than loaded, so there is no
     extra file for students to lose. Noise burst with an exponential decay. */
  function makeImpulse(seconds, decay) {
    var rate = ctx.sampleRate;
    var len = Math.max(1, Math.floor(rate * seconds));
    var buf = ctx.createBuffer(2, len, rate);
    for (var c = 0; c < 2; c++) {
      var data = buf.getChannelData(c);
      for (var i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function makeDistortionCurve(k) {
    var n = 1024, curve = new Float32Array(n), deg = Math.PI / 180;
    for (var i = 0; i < n; i++) {
      var x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  /* Wire an effect in parallel with a dry path so its amount can be animated
     by crossfading, which is far cheaper than rebuilding nodes each frame. */
  function wetDry(input, effectIn, effectOut) {
    var dry = ctx.createGain(), wet = ctx.createGain(), out = ctx.createGain();
    dry.gain.value = 1;
    wet.gain.value = 0;
    input.connect(dry); dry.connect(out);
    input.connect(effectIn); effectOut.connect(wet); wet.connect(out);
    return { out: out, wet: wet, dry: dry };
  }

  /* Build only the nodes this layer's effects actually ask for. */
  function buildAudioChain(layer) {
    if (!audioReady() || !layer.media || layer.audioSrc) return;

    var have = {};
    for (var i = 0; i < layer.audioFx.length; i++) have[layer.audioFx[i].fx] = layer.audioFx[i];

    var src;
    try {
      src = ctx.createMediaElementSource(layer.media);
    } catch (e) {
      fail('Could not route "' + layer.cfg.src + '" through the audio engine.', String(e.message || e));
      return;
    }
    layer.audioSrc = src;
    var head = src;
    var nodes = {};

    var filterType = have.lowpass ? 'lowpass' : have.highpass ? 'highpass' : have.bandpass ? 'bandpass' : null;
    if (filterType) {
      var biquad = ctx.createBiquadFilter();
      biquad.type = filterType;
      biquad.frequency.value = FX[filterType].def;
      head.connect(biquad); head = biquad;
      nodes.filter = biquad;
      nodes.filterType = filterType;
    }

    if (have.distortion) {
      var shaper = ctx.createWaveShaper();
      shaper.curve = makeDistortionCurve(numOr(layer.cfg.drive, 120));
      shaper.oversample = '2x';
      var d = wetDry(head, shaper, shaper);
      head = d.out; nodes.distortion = d;
    }

    if (have.delay) {
      var delay = ctx.createDelay(5.0);
      delay.delayTime.value = numOr(layer.cfg.time, have.delay.raw.time, 0.25);
      var fb = ctx.createGain();
      fb.gain.value = clamp(numOr(layer.cfg.feedback, have.delay.raw.feedback, 0.35), 0, 0.95);
      delay.connect(fb); fb.connect(delay);
      var dd = wetDry(head, delay, delay);
      head = dd.out; nodes.delay = dd;
    }

    if (have.reverb) {
      var conv = ctx.createConvolver();
      conv.buffer = makeImpulse(numOr(layer.cfg.decay, have.reverb.raw.decay, 2.5), 2.2);
      var rr = wetDry(head, conv, conv);
      head = rr.out; nodes.reverb = rr;
    }

    if (have.stereoPan && ctx.createStereoPanner) {
      var pan = ctx.createStereoPanner();
      head.connect(pan); head = pan;
      nodes.pan = pan;
    }

    var gain = ctx.createGain();
    gain.gain.value = layer.baseVolume;
    head.connect(gain);
    gain.connect(master);
    nodes.gain = gain;

    layer.audioNodes = nodes;
  }

  function numOr() {
    for (var i = 0; i < arguments.length; i++) {
      if (typeof arguments[i] === 'number' && !isNaN(arguments[i])) return arguments[i];
    }
    return 0;
  }

  /* Assign only when the value actually moved — AudioParam writes aren't free. */
  function setParam(param, value) {
    if (Math.abs(param.value - value) > 1e-4) param.value = value;
  }

  function applyAudio(layer, p) {
    var n = layer.audioNodes;
    if (!n) return;
    var vol = layer.baseVolume;

    for (var i = 0; i < layer.audioFx.length; i++) {
      var spec = layer.audioFx[i];
      var v = fxValue(spec, p);
      switch (spec.fx) {
        case 'volume': vol *= v; break;
        case 'lowpass': case 'highpass': case 'bandpass':
          if (n.filter && n.filterType === spec.fx) setParam(n.filter.frequency, clamp(v, 20, 22050));
          break;
        case 'resonance':  if (n.filter) setParam(n.filter.Q, clamp(v, 0.0001, 40)); break;
        case 'reverb':     if (n.reverb) crossfade(n.reverb, v); break;
        case 'delay':      if (n.delay) crossfade(n.delay, v); break;
        case 'distortion': if (n.distortion) crossfade(n.distortion, v); break;
        case 'stereoPan':  if (n.pan) setParam(n.pan.pan, clamp(v, -1, 1)); break;
      }
    }
    setParam(n.gain.gain, clamp(vol, 0, 4) * layer.duckGain);
  }

  function crossfade(pair, amount) {
    var a = clamp(amount, 0, 1);
    setParam(pair.wet.gain, a);
    setParam(pair.dry.gain, 1 - a);
  }

  /* ================================================================= boot === */

  var config = null;
  var track = null;
  var slides = [];
  var mediaLayers = [];
  var bedLayer = null;
  var anyHold = false;           // true once any slide asks to pin itself
  var vertical = true;
  var started = false;
  var maxConcurrent = DEFAULT_MAX_CONCURRENT;
  var hudEl = null;

  function boot() {
    /* `const DOOM = {...}` in a classic script creates a script-scoped binding,
       NOT a property of window — so read it as a bare identifier first. */
    /* jshint -W117 */
    if (typeof DOOM !== 'undefined' && DOOM) config = DOOM;
    else if (window.DOOM) config = window.DOOM;
    else if (typeof doom !== 'undefined' && doom) config = doom;

    if (!config) {
      /* index.html installs an error listener before config.js loads, so if the
         file failed to parse we can name the exact line instead of shrugging. */
      var boot = window.__doomBootErrors || [];
      var syntax = null;
      for (var b = 0; b < boot.length; b++) {
        if (/config\.js/.test(boot[b].file || '')) { syntax = boot[b]; break; }
      }
      if (syntax) {
        fail('config.js has a syntax error on line ' + syntax.line + '.',
          syntax.message + ' — look for a missing comma, one comma too many, ' +
          'or a bracket or quote that was never closed.');
      } else {
        fail('No configuration found.',
          'config.js should define:  const DOOM = { title: "...", slides: [ ... ] };');
      }
      return;
    }
    if (!Array.isArray(config.slides) || config.slides.length === 0) {
      fail('config.js has no slides.', 'Add a "slides" array: slides: [ { type: "text", text: "hello" } ]');
      return;
    }

    if (config.title) document.title = config.title;
    if (config.background) document.body.style.background = config.background;
    if (typeof config.maxConcurrent === 'number') maxConcurrent = config.maxConcurrent;

    vertical = (config.scroll || 'vertical') !== 'horizontal';
    if (config.scroll && config.scroll !== 'vertical' && config.scroll !== 'horizontal') {
      fail('Unknown scroll direction "' + config.scroll + '".', 'Use "vertical" or "horizontal".');
    }
    var carousel = config.mode === 'carousel';
    if (config.mode && config.mode !== 'carousel' && config.mode !== 'continuous') {
      fail('Unknown mode "' + config.mode + '".', 'Use "continuous" or "carousel".');
    }

    track = document.createElement('div');
    track.className = 'doom-track ' + (vertical ? 'is-vertical' : 'is-horizontal') +
      (carousel ? ' is-carousel' : '');
    document.body.appendChild(track);

    for (var i = 0; i < config.slides.length; i++) buildSlide(config.slides[i], i);

    /* A pin and a mandatory snap point cannot both win, so one hold slide
       softens snapping for the whole piece. Known only now that slides exist. */
    if (anyHold) track.classList.add('has-hold');

    if (config.bed && config.bed.src) buildBed(config.bed);

    observe();
    buildSplash();
    if (DEBUG) buildHud();

    tick();
  }

  /* --------------------------------------------------------------- slides --- */

  function buildSlide(cfg, index) {
    if (!cfg || typeof cfg !== 'object') {
      fail('Slide ' + (index + 1) + ' is not an object.', 'Each slide looks like { type: "image", src: "media/x.jpg" }');
      return;
    }
    var el = document.createElement('section');
    el.className = 'doom-slide';
    if (cfg.id) el.id = cfg.id;

    var slide = {
      cfg: cfg, el: el, index: index, layers: [],
      progress: 0, visibility: 0, near: false,
      hold: 0, scrubProgress: 0, fxProgress: 0
    };

    /* Beginner shorthand: a slide with `type`/`src` at the top level and no
       `layers` is treated as a single-layer slide. */
    var layerCfgs = cfg.layers;
    if (!layerCfgs) layerCfgs = cfg.type ? [cfg] : [];
    if (!Array.isArray(layerCfgs)) {
      fail('Slide ' + (index + 1) + ' has a "layers" that is not an array.');
      layerCfgs = [];
    }
    if (layerCfgs.length === 0) {
      fail('Slide ' + (index + 1) + ' has nothing in it.',
        'Give it a type and src, or a "layers" array.');
    }

    /* `hold` describes the whole slide, but it reads better written on the video
       that is being scrubbed — so accept it in either place and hoist it. With
       the shorthand above, `cfg` IS the layer cfg, so that case is free. */
    slide.hold = parseHold(cfg.hold, 'slide ' + (index + 1));
    if (cfg.layers) {
      for (var h = 0; h < layerCfgs.length; h++) {
        var lcfg = layerCfgs[h];
        if (!lcfg || typeof lcfg !== 'object' || !lcfg.hold) continue;
        var lhold = parseHold(lcfg.hold, 'slide ' + (index + 1) + ', layer ' + (h + 1));
        if (!lhold) continue;
        if (slide.hold && slide.hold !== lhold) {
          fail('Slide ' + (index + 1) + ' asks to hold for two different lengths.',
            'A hold belongs to the whole slide — put it on just one layer, ' +
            'or on the slide itself.');
          continue;
        }
        slide.hold = lhold;
      }
    }

    /* A hold slide is a long runway with a sticky holder inside it. Every other
       slide keeps exactly the structure it has always had: a sticky wrapper
       creates a stacking context, which would quietly change what a
       `blend:` layer blends against. */
    var parent = el;
    if (slide.hold) {
      anyHold = true;
      el.classList.add('is-hold');
      el.style.setProperty('--doom-hold', String(1 + slide.hold));
      parent = document.createElement('div');
      parent.className = 'doom-hold';
      el.appendChild(parent);
    }
    if (cfg.background) parent.style.background = cfg.background;

    for (var i = 0; i < layerCfgs.length; i++) {
      var layer = buildLayer(layerCfgs[i], slide, index, i);
      if (layer) { slide.layers.push(layer); parent.appendChild(layer.el); }
    }

    track.appendChild(el);
    slides.push(slide);
  }

  function buildLayer(cfg, slide, slideIndex, layerIndex) {
    var where = 'slide ' + (slideIndex + 1) + ', layer ' + (layerIndex + 1);
    if (!cfg || typeof cfg !== 'object') { fail(where + ' is not an object.'); return null; }

    var defaults = config.defaults || {};
    var type = cfg.type;
    if (!type) {
      fail(where + ' has no "type".', 'Use "video", "image", "audio" or "text".');
      return null;
    }

    var el = document.createElement('div');
    el.className = 'doom-layer';

    var layer = {
      cfg: cfg, el: el, slide: slide, where: where, type: type,
      media: null, audioNodes: null, audioSrc: null,
      baseOpacity: typeof cfg.opacity === 'number' ? cfg.opacity : 1,
      baseVolume: typeof cfg.volume === 'number' ? cfg.volume : 1,
      duckGain: 1,
      /* A pinned video almost always wants to be scrubbed, so `hold` turns that
         on for you — but never over an explicit choice, so `playWhen: "inview"`
         still gets you a clip that plays normally while it is pinned. */
      playWhen: cfg.playWhen ||
        (slide.hold && type === 'video' ? 'scrub' : null) ||
        defaults.playWhen || 'inview',
      hasPlayed: false,
      scrollRate: null, rateNow: 1,
      lastFilter: null, lastTransform: null, lastOpacity: null, lastRate: null
    };

    if (PLAY_MODES.indexOf(layer.playWhen) === -1) {
      fail('Unknown playWhen "' + layer.playWhen + '" in ' + where + '.',
        'Use ' + PLAY_MODES.join(', ') + '.');
      layer.playWhen = 'inview';
    }

    var fit = cfg.fit || defaults.fit || config.fit || 'cover';
    if (fit === 'contain') el.classList.add('is-contain');

    if (cfg.blend) el.style.mixBlendMode = cfg.blend;

    switch (type) {
      case 'video':
        if (!cfg.src) { fail(where + ' is a video with no "src".'); return null; }
        var v = document.createElement('video');
        v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.setAttribute('webkit-playsinline', '');
        v.loop = cfg.loop !== false;
        v.preload = 'none';
        /* Deliberately NOT muted: on iOS a muted element produces silence
           through Web Audio. The splash tap is what makes sound legal. */
        if (cfg.silent) v.muted = true;
        v.addEventListener('error', function () {
          fail('Could not load video "' + cfg.src + '" (' + where + ').',
            'Check the filename and that it sits inside your media folder.');
        });
        el.appendChild(v);
        layer.media = v;
        break;

      case 'image':
        if (!cfg.src) { fail(where + ' is an image with no "src".'); return null; }
        var img = document.createElement('img');
        img.loading = 'lazy';
        img.decoding = 'async';
        img.alt = cfg.alt || '';
        img.src = cfg.src;
        img.addEventListener('error', function () {
          fail('Could not load image "' + cfg.src + '" (' + where + ').',
            'Check the filename and that it sits inside your media folder.');
        });
        el.appendChild(img);
        break;

      case 'audio':
        if (!cfg.src) { fail(where + ' is audio with no "src".'); return null; }
        el.classList.add('is-audio');
        var a = document.createElement('audio');
        a.loop = cfg.loop !== false;
        a.preload = 'none';
        a.addEventListener('error', function () {
          fail('Could not load audio "' + cfg.src + '" (' + where + ').',
            'Check the filename and that it sits inside your media folder.');
        });
        el.appendChild(a);
        layer.media = a;
        break;

      case 'text':
        if (typeof cfg.text !== 'string') { fail(where + ' is text with no "text".'); return null; }
        el.classList.add('is-text');
        el.setAttribute('data-pos', cfg.pos || 'center');
        var p = document.createElement('p');
        p.className = 'doom-text';
        p.setAttribute('data-size', cfg.size || 'medium');
        p.textContent = cfg.text;
        if (cfg.color) p.style.color = cfg.color;
        if (cfg.font) p.style.fontFamily = cfg.font;
        if (cfg.weight) p.style.fontWeight = cfg.weight;
        if (cfg.tracking) p.style.letterSpacing = cfg.tracking;
        if (cfg.shadow) p.style.textShadow = cfg.shadow === true ? '0 2px 24px rgba(0,0,0,.8)' : cfg.shadow;
        el.appendChild(p);
        break;

      default:
        fail('Unknown layer type "' + type + '" in ' + where + '.',
          'Use "video", "image", "audio" or "text".');
        return null;
    }

    if (cfg.scrollRate !== undefined) {
      if (!layer.media) {
        fail('"scrollRate" in ' + where + ' needs a layer that makes a sound.',
          'scrollRate only works on "video" and "audio" layers, and on the bed.');
      } else if (layer.playWhen === 'scrub') {
        fail('"scrollRate" in ' + where + ' does nothing, because that layer is scrubbing.',
          'A scrubbing clip is already driven by your scrolling — use one or the other.');
      } else {
        layer.scrollRate = parseScrollRate(cfg.scrollRate, where);
      }
    }

    /* Split the effect list by where each value has to be written. */
    var all = fxListOf(cfg, where);
    layer.cssFx = [];
    layer.audioFx = [];
    layer.mediaFx = [];
    for (var i = 0; i < all.length; i++) {
      var k = all[i].kind;
      if (k === 'audio') {
        if (!layer.media) {
          fail('Effect "' + all[i].fx + '" in ' + where + ' is an audio effect, but that layer has no sound.',
            'Audio effects only work on "video" and "audio" layers.');
        } else {
          if (layer.playWhen === 'scrub') {
            fail('Effect "' + all[i].fx + '" in ' + where + ' will never be heard, ' +
              'because a scrubbing clip does not play.',
              'Drop the effect, or put the sound on its own "audio" layer.');
          }
          layer.audioFx.push(all[i]);
        }
      } else if (k === 'media') {
        if (layer.media) layer.mediaFx.push(all[i]);
      } else {
        layer.cssFx.push(all[i]);
      }
    }

    if (layer.media) {
      layer.media.addEventListener('ended', function () { layer.hasPlayed = true; });
      /* Safari forgets the pitch preference every time a source loads. */
      layer.media.addEventListener('loadedmetadata', function () {
        applyPitchPref(layer.media, layer.scrollRate ? layer.scrollRate.pitch : true);
      });
      mediaLayers.push(layer);
    }
    return layer;
  }

  /* One optional soundtrack running under the whole piece, driven by overall
     scroll position rather than by any single slide. */
  function buildBed(cfg) {
    var a = document.createElement('audio');
    a.loop = cfg.loop !== false;
    a.preload = 'auto';
    a.src = cfg.src;
    a.addEventListener('error', function () {
      fail('Could not load the audio bed "' + cfg.src + '".', 'Check the filename and folder.');
    });
    document.body.appendChild(a);

    bedLayer = {
      cfg: cfg, el: null, media: a, where: 'the audio bed',
      audioNodes: null, audioSrc: null,
      baseVolume: typeof cfg.volume === 'number' ? cfg.volume : 1,
      duckGain: 1,
      scrollRate: parseScrollRate(cfg.scrollRate, 'the audio bed'),
      rateNow: 1, lastRate: null,
      cssFx: [], mediaFx: [], audioFx: []
    };
    applyPitchPref(a, bedLayer.scrollRate ? bedLayer.scrollRate.pitch : true);
    a.addEventListener('loadedmetadata', function () {
      applyPitchPref(a, bedLayer.scrollRate ? bedLayer.scrollRate.pitch : true);
    });
    var all = fxListOf(cfg, 'the audio bed');
    for (var i = 0; i < all.length; i++) {
      if (all[i].kind === 'audio') bedLayer.audioFx.push(all[i]);
      else if (all[i].kind === 'media') bedLayer.mediaFx.push(all[i]);
      else fail('Effect "' + all[i].fx + '" cannot be used on the audio bed.', 'The bed only takes audio effects.');
    }
  }

  /* -------------------------------------------------------- near tracking --- */
  /* Only slides near the viewport get measured, animated, or allowed to load
     media — this is what keeps a twenty-clip piece from melting a laptop. */

  function observe() {
    if (!window.IntersectionObserver) {
      for (var i = 0; i < slides.length; i++) slides[i].near = true;
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var slide = entries[i].target.__doomSlide;
        if (!slide) continue;
        slide.near = entries[i].isIntersecting;
        if (slide.near) warmScrub(slide);
      }
    }, { root: track, rootMargin: '100% 100% 100% 100%', threshold: 0 });

    for (var j = 0; j < slides.length; j++) {
      slides[j].el.__doomSlide = slides[j];
      io.observe(slides[j].el);
    }
  }

  /* A scrubbing clip has to be downloaded and decoded BEFORE you reach it, or
     the first thing you scroll through is a black rectangle. The 100% rootMargin
     above buys about a screen of warning; a hold slide is taller than the
     screen, so it gets even more. */
  function warmScrub(slide) {
    for (var i = 0; i < slide.layers.length; i++) {
      var layer = slide.layers[i];
      if (!layer.media || layer.playWhen !== 'scrub') continue;
      ensureSrc(layer);
      primeScrub(layer);
    }
  }

  /* iOS will not render a seeked frame from a <video> that has never been handed
     to the decoder, no matter what `preload` says — so hand it over once and
     take it straight back. Only legal once the splash tap has happened, which is
     why warmScrub() is called again from start(). */
  function primeScrub(layer) {
    var m = layer.media;
    if (!layer.nudged) {
      layer.nudged = true;
      m.addEventListener('loadedmetadata', function () {
        if (m.currentTime === 0) m.currentTime = 0.001;
      });
    }
    if (!started || layer.primed) return;
    layer.primed = true;
    var p = m.play();
    if (p && p.then) p.then(function () { m.pause(); }, function () {});
    else { try { m.pause(); } catch (e) {} }
  }

  /* --------------------------------------------------------------- splash --- */

  function buildSplash() {
    var s = config.splash || {};
    var overlay = document.createElement('div');
    overlay.className = 'doom-splash';
    if (s.background) overlay.style.background = s.background;

    var inner = document.createElement('div');
    inner.className = 'doom-splash-inner';

    var h1 = document.createElement('h1');
    h1.className = 'doom-splash-title';
    h1.textContent = s.text || config.title || 'doom scroll';
    inner.appendChild(h1);

    var sub = document.createElement('p');
    sub.className = 'doom-splash-sub';
    sub.textContent = s.sub || 'tap to begin';
    inner.appendChild(sub);

    overlay.appendChild(inner);
    document.body.appendChild(overlay);

    function go() {
      overlay.removeEventListener('click', go);
      overlay.removeEventListener('keydown', onKey);
      start();
      overlay.classList.add('is-leaving');
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 700);
    }
    function onKey(e) { if (e.key === 'Enter' || e.key === ' ') go(); }

    overlay.tabIndex = 0;
    overlay.addEventListener('click', go);
    overlay.addEventListener('keydown', onKey);
    overlay.focus();
  }

  /* This runs inside the splash click, which is the user gesture that unlocks
     both the AudioContext and unmuted playback. */
  function start() {
    started = true;
    audioReady();

    /* A scrubbing clip is permanently paused, so it emits nothing — and
       createMediaElementSource rewires an element for good. Leave it alone. */
    for (var i = 0; i < mediaLayers.length; i++) {
      if (mediaLayers[i].playWhen !== 'scrub') buildAudioChain(mediaLayers[i]);
    }

    /* The observer may well have fired before the splash was tapped, and the
       decoder nudge in primeScrub() is only legal inside this gesture. */
    for (var s = 0; s < slides.length; s++) {
      if (slides[s].near) warmScrub(slides[s]);
    }

    if (bedLayer) {
      buildAudioChain(bedLayer);
      play(bedLayer);
    }
    updateMedia();

    /* iOS suspends the context when the tab goes to the background. */
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && ctx && ctx.state === 'suspended') ctx.resume();
    });
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  /* ------------------------------------------------------------ main loop --- */

  var lastMediaCheck = 0;
  var lastScrollPos = 0;
  var lastScrollTime = 0;
  var scrollVel = 0;             // how fast you are scrolling, in screens per second

  function tick(now) {
    var trackRect = track.getBoundingClientRect();
    var viewSize = vertical ? trackRect.height : trackRect.width;

    /* ---- how hard are you scrolling? ---------------------------------------
       Measured in screens per second rather than pixels, so the same config
       feels the same on a phone and on a projector. Absolute value: scrolling
       up counts just as much as scrolling down. */
    var pos = vertical ? track.scrollTop : track.scrollLeft;
    var frameDt = 0;
    if (now && lastScrollTime) {
      var dt = (now - lastScrollTime) / 1000;
      if (dt > 0.001 && dt < 0.25) {
        frameDt = dt;
        var raw = Math.abs(pos - lastScrollPos) / dt / (viewSize || 1);
        scrollVel += (raw - scrollVel) * VEL_ALPHA;
      }
      /* dt of a quarter second or more means the tab was in the background.
         Resync without feeding it in, or coming back pegs the rate at max. */
    }
    lastScrollPos = pos;
    if (now) lastScrollTime = now;

    if (frameDt) {
      for (var q = 0; q < mediaLayers.length; q++) followRate(mediaLayers[q], frameDt);
      if (bedLayer) followRate(bedLayer, frameDt);
    }

    for (var i = 0; i < slides.length; i++) {
      var s = slides[i];
      if (!s.near) continue;

      var r = s.el.getBoundingClientRect();
      var start = vertical ? r.top - trackRect.top : r.left - trackRect.left;
      var size = vertical ? r.height : r.width;

      /* 0 when the slide is just off the leading edge, 1 when it has just
         left the trailing edge, 0.5 when perfectly centred. */
      s.progress = clamp((viewSize - start) / (viewSize + size || 1), 0, 1);

      /* On a hold slide the pin IS the performance, so effects run across the
         pin instead: 0 the moment it locks to the screen, 1 the moment it lets
         go. Without this a text layer would sit frozen for the whole hold. */
      var pinSpan = size - viewSize;
      s.scrubProgress = (s.hold && pinSpan > 0) ? clamp(-start / pinSpan, 0, 1) : s.progress;
      s.fxProgress = s.hold ? s.scrubProgress : s.progress;

      var visStart = Math.max(0, start);
      var visEnd = Math.min(viewSize, start + size);
      /* For a slide taller than the screen this saturates at 1 for the whole
         pin, which is what we want — a pinned slide really is fully on screen. */
      s.visibility = Math.max(0, visEnd - visStart) / Math.min(size, viewSize || 1);

      for (var j = 0; j < s.layers.length; j++) {
        var L = s.layers[j];
        applyLayer(L, s.fxProgress);
        /* Seeking has to happen every frame. updateMedia() below only runs ten
           times a second, which is far too coarse for a playhead. */
        if (L.playWhen === 'scrub') applyScrub(L, s.fxProgress);
      }
    }

    if (bedLayer && started) {
      var dp = documentProgress();
      applyAudio(bedLayer, dp);
      applyRate(bedLayer, dp);     // the bed has no element, so it never sees applyLayer
    }

    /* Play/pause decisions don't need 60fps and cause work when they change. */
    if (!now || now - lastMediaCheck > 100) { lastMediaCheck = now || 0; updateMedia(); }

    if (DEBUG) updateHud();
    requestAnimationFrame(tick);
  }

  function followRate(layer, dt) {
    var sr = layer.scrollRate;
    if (!sr) return;
    var target = clamp(scrollVel / sr.normal, sr.min, sr.max);
    /* Stop scrolling and the target becomes `min`, so it glides down to a crawl
       and keeps going. It never stops, which is the whole trick. */
    layer.rateNow = damp(layer.rateNow, target, sr.smooth, dt < 0.1 ? dt : 0.1);
  }

  function documentProgress() {
    var max = vertical
      ? track.scrollHeight - track.clientHeight
      : track.scrollWidth - track.clientWidth;
    if (max <= 0) return 0;
    return clamp((vertical ? track.scrollTop : track.scrollLeft) / max, 0, 1);
  }

  /* ------------------------------------------------------- applying effects -- */

  function applyLayer(layer, p) {
    var filters = '';
    var tf = null;
    var opacity = layer.baseOpacity;

    for (var i = 0; i < layer.cssFx.length; i++) {
      var spec = layer.cssFx[i];
      var def = FX[spec.fx];
      var v = fxValue(spec, p);

      if (def.kind === 'filter') {
        filters += (filters ? ' ' : '') + def.css + '(' + fmt(v) + def.unit + ')';
      } else if (def.kind === 'transform') {
        if (REDUCE_MOTION) continue;               // motion is the part that hurts
        if (!tf) tf = {};
        tf[spec.fx] = v;
      } else if (def.kind === 'opacity') {
        opacity *= v;
      }
    }

    var transform = '';
    if (tf) {
      for (var k = 0; k < TRANSFORM_ORDER.length; k++) {
        var name = TRANSFORM_ORDER[k];
        if (name in tf) transform += (transform ? ' ' : '') + FX[name].css + '(' + fmt(tf[name]) + FX[name].unit + ')';
      }
    }

    /* Write each property at most once per frame, and only when it moved. */
    if (filters !== layer.lastFilter) { layer.el.style.filter = filters; layer.lastFilter = filters; }
    if (transform !== layer.lastTransform) { layer.el.style.transform = transform; layer.lastTransform = transform; }
    var o = fmt(clamp(opacity, 0, 1));
    if (o !== layer.lastOpacity) { layer.el.style.opacity = o; layer.lastOpacity = o; }

    if (layer.media) {
      applyRate(layer, p);
      if (started) applyAudio(layer, p);
    }
  }

  /* playbackRate has two possible drivers: a `playbackRate` effect, which sets
     the base speed, and `scrollRate`, which multiplies it by how fast you are
     scrolling. They compose, so you can have a slow-motion clip that still
     races when you flick. */
  function applyRate(layer, p) {
    var rate = 1, driven = false;
    for (var m = 0; m < layer.mediaFx.length; m++) {
      if (layer.mediaFx[m].fx === 'playbackRate') {
        rate = fxValue(layer.mediaFx[m], p);
        driven = true;
      }
    }
    if (layer.scrollRate) { rate *= layer.rateNow; driven = true; }
    if (!driven) return;

    var r = clamp(rate, 0.0625, 16);
    r = layer.scrollRate ? fmt2(r) : fmt(r);
    if (r !== layer.lastRate) { layer.media.playbackRate = r; layer.lastRate = r; }
  }

  /* ------------------------------------------------- media play / pause ----- */

  function ensureSrc(layer) {
    /* Sources are attached lazily so distant clips never start downloading. */
    if (!layer.media.getAttribute('src')) {
      layer.media.preload = 'auto';
      layer.media.setAttribute('src', layer.cfg.src);
      applyPitchPref(layer.media, layer.scrollRate ? layer.scrollRate.pitch : true);
    }
  }

  function play(layer) {
    ensureSrc(layer);
    if (!layer.media.paused) return;
    var promise = layer.media.play();
    if (promise && promise.catch) {
      promise.catch(function (e) {
        if (e && e.name === 'NotAllowedError') {
          fail('The browser blocked playback of "' + layer.cfg.src + '".',
            'This usually means the opening tap did not register — reload and tap the title screen.');
        }
      });
    }
    layer.hasPlayed = true;
  }

  function pause(layer) {
    if (layer.media && !layer.media.paused) layer.media.pause();
  }

  /* Bind the playhead straight to a progress value. Runs every frame. */
  function applyScrub(layer, p) {
    var m = layer.media;
    if (!m.paused) m.pause();
    /* Asking for a second seek while the first is still running is how you end
       up staring at one frozen frame on a phone. */
    if (m.seeking) return;
    var d = m.duration;
    if (!d || !isFinite(d)) return;
    /* Landing exactly on the end of an mp4 usually shows black, so stop short.
       Clamping the span rather than the result keeps progress 0 at time 0. */
    var span = Math.max(0, d - 0.05);
    var target = clamp(p, 0, 1) * span;
    if (Math.abs(m.currentTime - target) > 0.02) m.currentTime = target;
  }

  function updateMedia() {
    if (!started) return;
    var candidates = [];

    for (var i = 0; i < mediaLayers.length; i++) {
      var layer = mediaLayers[i];
      var slide = layer.slide;
      var mode = layer.playWhen;

      if (mode === 'never' || mode === 'manual') { pause(layer); continue; }

      /* Scrubbing is driven every frame by applyScrub() in tick(), not here.
         The pause catches a scrub layer whose slide is off screen, and the
         continue is what keeps it out of the candidate list below. */
      if (mode === 'scrub') { pause(layer); continue; }

      if (mode === 'always') { candidates.push({ layer: layer, score: 2 }); continue; }

      if (mode === 'once') {
        if (layer.hasPlayed) {
          /* Started already: let it run to the end, never restart it. */
          if (!layer.media.ended) candidates.push({ layer: layer, score: slide.visibility });
        } else if (slide.visibility >= INVIEW_THRESHOLD) {
          candidates.push({ layer: layer, score: slide.visibility });
        }
        continue;
      }

      /* mode is "inview" — validated when the layer was built. */
      if (slide.near && slide.visibility >= INVIEW_THRESHOLD) {
        candidates.push({ layer: layer, score: slide.visibility });
      } else {
        pause(layer);
      }
    }

    /* Cap how many clips decode at once; the most-visible ones win. */
    candidates.sort(function (a, b) { return b.score - a.score; });
    for (var c = 0; c < candidates.length; c++) {
      if (c < maxConcurrent) play(candidates[c].layer);
      else pause(candidates[c].layer);
    }
  }

  /* ------------------------------------------------------------------ hud --- */

  function buildHud() {
    hudEl = document.createElement('div');
    hudEl.className = 'doom-hud';
    document.body.appendChild(hudEl);
  }

  function updateHud() {
    var lines = ['doom debug — ' + (vertical ? 'vertical' : 'horizontal') +
      ' / ' + (config.mode === 'carousel' ? 'carousel' : 'continuous') +
      (anyHold ? ' / pinned' : ''),
      'overall  ' + documentProgress().toFixed(3),
      'scroll   ' + scrollVel.toFixed(2) + ' screens/s' +
        (bedLayer && bedLayer.scrollRate ? '   bed x' + bedLayer.rateNow.toFixed(2) : '')];
    for (var i = 0; i < slides.length; i++) {
      var s = slides[i];
      if (!s.near) continue;
      lines.push(
        pad(String(i + 1) + (s.cfg.id ? ' ' + s.cfg.id : ''), 12) +
        ' p=' + s.progress.toFixed(3) + '  vis=' + s.visibility.toFixed(2) +
        (s.hold ? '  pin=' + s.scrubProgress.toFixed(3) : '') +
        rateSuffix(s));
    }
    var text = lines.join('\n');
    if (text !== hudEl.textContent) hudEl.textContent = text;
  }

  function pad(s, n) { while (s.length < n) s += ' '; return s; }

  function rateSuffix(slide) {
    for (var i = 0; i < slide.layers.length; i++) {
      if (slide.layers[i].scrollRate) return '  x' + slide.layers[i].rateNow.toFixed(2);
    }
    return '';
  }

  /* ================================================================= go ===== */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
