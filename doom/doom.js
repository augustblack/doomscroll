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
    if (cfg.background) el.style.background = cfg.background;

    var slide = {
      cfg: cfg, el: el, index: index, layers: [],
      progress: 0, visibility: 0, near: false
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

    for (var i = 0; i < layerCfgs.length; i++) {
      var layer = buildLayer(layerCfgs[i], slide, index, i);
      if (layer) { slide.layers.push(layer); el.appendChild(layer.el); }
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
      playWhen: cfg.playWhen || defaults.playWhen || 'inview',
      hasPlayed: false,
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
        } else layer.audioFx.push(all[i]);
      } else if (k === 'media') {
        if (layer.media) layer.mediaFx.push(all[i]);
      } else {
        layer.cssFx.push(all[i]);
      }
    }

    if (layer.media) {
      layer.media.addEventListener('ended', function () { layer.hasPlayed = true; });
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
      cssFx: [], mediaFx: [], audioFx: []
    };
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
        if (slide) slide.near = entries[i].isIntersecting;
      }
    }, { root: track, rootMargin: '100% 100% 100% 100%', threshold: 0 });

    for (var j = 0; j < slides.length; j++) {
      slides[j].el.__doomSlide = slides[j];
      io.observe(slides[j].el);
    }
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

    for (var i = 0; i < mediaLayers.length; i++) buildAudioChain(mediaLayers[i]);

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

  function tick(now) {
    var trackRect = track.getBoundingClientRect();
    var viewSize = vertical ? trackRect.height : trackRect.width;

    for (var i = 0; i < slides.length; i++) {
      var s = slides[i];
      if (!s.near) continue;

      var r = s.el.getBoundingClientRect();
      var start = vertical ? r.top - trackRect.top : r.left - trackRect.left;
      var size = vertical ? r.height : r.width;

      /* 0 when the slide is just off the leading edge, 1 when it has just
         left the trailing edge, 0.5 when perfectly centred. */
      s.progress = clamp((viewSize - start) / (viewSize + size || 1), 0, 1);

      var visStart = Math.max(0, start);
      var visEnd = Math.min(viewSize, start + size);
      s.visibility = Math.max(0, visEnd - visStart) / Math.min(size, viewSize || 1);

      for (var j = 0; j < s.layers.length; j++) applyLayer(s.layers[j], s.progress);
    }

    if (bedLayer && started) applyAudio(bedLayer, documentProgress());

    /* Play/pause decisions don't need 60fps and cause work when they change. */
    if (!now || now - lastMediaCheck > 100) { lastMediaCheck = now || 0; updateMedia(); }

    if (DEBUG) updateHud();
    requestAnimationFrame(tick);
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
      for (var m = 0; m < layer.mediaFx.length; m++) {
        if (layer.mediaFx[m].fx === 'playbackRate') {
          var rate = fmt(clamp(fxValue(layer.mediaFx[m], p), 0.0625, 16));
          if (rate !== layer.lastRate) { layer.media.playbackRate = rate; layer.lastRate = rate; }
        }
      }
      if (started) applyAudio(layer, p);
    }
  }

  /* ------------------------------------------------- media play / pause ----- */

  function ensureSrc(layer) {
    /* Sources are attached lazily so distant clips never start downloading. */
    if (!layer.media.getAttribute('src')) {
      layer.media.preload = 'auto';
      layer.media.setAttribute('src', layer.cfg.src);
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

  function updateMedia() {
    if (!started) return;
    var candidates = [];

    for (var i = 0; i < mediaLayers.length; i++) {
      var layer = mediaLayers[i];
      var slide = layer.slide;
      var mode = layer.playWhen;

      if (mode === 'never' || mode === 'manual') { pause(layer); continue; }

      if (mode === 'scrub') {
        /* Bind the video's playhead directly to scroll position. */
        if (slide.near) {
          ensureSrc(layer);
          pause(layer);
          var d = layer.media.duration;
          if (d && isFinite(d)) {
            var target = clamp(slide.progress, 0, 1) * d;
            if (Math.abs(layer.media.currentTime - target) > 0.02) layer.media.currentTime = target;
          }
        }
        continue;
      }

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
      ' / ' + (config.mode === 'carousel' ? 'carousel' : 'continuous'),
      'overall  ' + documentProgress().toFixed(3)];
    for (var i = 0; i < slides.length; i++) {
      var s = slides[i];
      if (!s.near) continue;
      lines.push(
        pad(String(i + 1) + (s.cfg.id ? ' ' + s.cfg.id : ''), 12) +
        ' p=' + s.progress.toFixed(3) + '  vis=' + s.visibility.toFixed(2));
    }
    var text = lines.join('\n');
    if (text !== hudEl.textContent) hudEl.textContent = text;
  }

  function pad(s, n) { while (s.length < n) s += ' '; return s; }

  /* ================================================================= go ===== */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
