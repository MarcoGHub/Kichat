// ─────────────────────────────────────────────────────────────
// Nikita's on-screen avatar.
//
// A stylized, expressive SVG portrait that reacts to mood and pose.
// It is deliberately illustrative (not photorealistic). To use your own
// artwork instead, drop images named for each mood into public/art/ and
// set USE_IMAGE_ART = true below (see loadImageArt()).
// ─────────────────────────────────────────────────────────────

const USE_IMAGE_ART = false; // set true to use public/art/<mood>.png instead of SVG

const MOOD_FACE = {
  neutral:      { brow: 0,   eyeOpen: 1.0, mouth: 'M -18 26 Q 0 30 18 26',            blush: 0,   glow: '#c9a24b' },
  happy:        { brow: -2,  eyeOpen: 0.85, mouth: 'M -20 24 Q 0 40 20 24',           blush: 0.4, glow: '#e0b95a' },
  playful:      { brow: -3,  eyeOpen: 0.9, mouth: 'M -18 24 Q 6 38 20 22',            blush: 0.5, glow: '#e0b95a' },
  affectionate: { brow: -1,  eyeOpen: 0.7, mouth: 'M -16 26 Q 0 34 16 26',           blush: 0.7, glow: '#e6a15f' },
  cool:         { brow: 1,   eyeOpen: 0.75, mouth: 'M -16 28 Q 0 28 16 28',          blush: 0,   glow: '#b9c2d0' },
  intense:      { brow: 5,   eyeOpen: 1.05, mouth: 'M -16 30 Q 0 26 16 30',          blush: 0,   glow: '#e5623c' },
  sad:          { brow: -5,  eyeOpen: 0.8, mouth: 'M -18 30 Q 0 22 18 30',           blush: 0,   glow: '#7f8aa0' },
  thoughtful:   { brow: 2,   eyeOpen: 0.9, mouth: 'M -14 28 Q 2 28 16 26',           blush: 0,   glow: '#c9a24b' },
};

const POSE_TILT = {
  idle: 0,
  lean: -6,
  'arms-crossed': 0,
  wave: 3,
  wink: -2,
  combat: 4,
};

export class Avatar {
  constructor(container) {
    this.container = container;
    this.mood = 'neutral';
    this.pose = 'idle';
    this.talking = false;
    this._blink = 0;
    this._t = 0;
    this._winkOnce = false;
    this._build();
    this._loop();
  }

  _build() {
    this.container.innerHTML = `
      <svg viewBox="-100 -120 200 300" class="nikita-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="glow" cx="50%" cy="35%" r="65%">
            <stop offset="0%" stop-color="var(--glow, #c9a24b)" stop-opacity="0.55"/>
            <stop offset="100%" stop-color="var(--glow, #c9a24b)" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2a2530"/>
            <stop offset="100%" stop-color="#0c0a10"/>
          </linearGradient>
          <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f0c9a6"/>
            <stop offset="100%" stop-color="#d9a578"/>
          </linearGradient>
          <linearGradient id="cloth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1c1c22"/>
            <stop offset="100%" stop-color="#0a0a0d"/>
          </linearGradient>
        </defs>

        <ellipse cx="0" cy="20" rx="120" ry="150" fill="url(#glow)"/>

        <g id="figure">
          <!-- shoulders / clothing -->
          <g id="body">
            <path d="M -70 175 Q -60 95 -30 78 L 30 78 Q 60 95 70 175 Z" fill="url(#cloth)"/>
            <path d="M -30 78 Q 0 100 30 78 L 26 66 Q 0 78 -26 66 Z" fill="url(#skin)"/>
          </g>

          <!-- hair behind -->
          <path d="M -58 20 Q -70 120 -40 170 L -20 165 Q -46 110 -40 30 Z" fill="url(#hair)"/>
          <path d="M 58 20 Q 70 120 40 170 L 20 165 Q 46 110 40 30 Z" fill="url(#hair)"/>

          <!-- neck -->
          <path d="M -14 55 L -14 78 Q 0 88 14 78 L 14 55 Z" fill="url(#skin)"/>

          <g id="head">
            <!-- hair top -->
            <path d="M -52 6 Q -52 -70 0 -74 Q 52 -70 52 6 Q 46 -34 30 -44 Q 0 -30 -30 -44 Q -46 -34 -52 6 Z" fill="url(#hair)"/>
            <!-- face -->
            <path d="M -44 -6 Q -44 46 0 60 Q 44 46 44 -6 Q 44 -46 0 -50 Q -44 -46 -44 -6 Z" fill="url(#skin)"/>

            <!-- cheeks blush -->
            <ellipse id="blushL" cx="-26" cy="16" rx="11" ry="7" fill="#e07a6a" opacity="0"/>
            <ellipse id="blushR" cx="26" cy="16" rx="11" ry="7" fill="#e07a6a" opacity="0"/>

            <!-- eyebrows -->
            <path id="browL" d="M -34 -18 Q -22 -24 -10 -19" stroke="#1a1520" stroke-width="3.2" fill="none" stroke-linecap="round"/>
            <path id="browR" d="M 10 -19 Q 22 -24 34 -18" stroke="#1a1520" stroke-width="3.2" fill="none" stroke-linecap="round"/>

            <!-- eyes (almond, hazel) -->
            <g id="eyeL">
              <path d="M -34 -6 Q -22 -14 -10 -6 Q -22 2 -34 -6 Z" fill="#fff"/>
              <circle cx="-22" cy="-6" r="5.4" fill="#8a5a2b"/>
              <circle cx="-22" cy="-6" r="2.4" fill="#140d06"/>
              <circle cx="-20.4" cy="-7.6" r="1.1" fill="#fff"/>
            </g>
            <g id="eyeR">
              <path d="M 10 -6 Q 22 -14 34 -6 Q 22 2 10 -6 Z" fill="#fff"/>
              <circle cx="22" cy="-6" r="5.4" fill="#8a5a2b"/>
              <circle cx="22" cy="-6" r="2.4" fill="#140d06"/>
              <circle cx="23.6" cy="-7.6" r="1.1" fill="#fff"/>
            </g>
            <!-- eyelids for blink/wink -->
            <rect id="lidL" x="-35" y="-16" width="26" height="0" fill="url(#skin)"/>
            <rect id="lidR" x="9" y="-16" width="26" height="0" fill="url(#skin)"/>

            <!-- nose -->
            <path d="M 0 -4 Q 4 12 0 16 Q -4 17 -6 14" stroke="#c98d63" stroke-width="2" fill="none" stroke-linecap="round"/>

            <!-- lips -->
            <path id="mouth" d="M -18 26 Q 0 30 18 26" stroke="#b5476b" stroke-width="4.5" fill="none" stroke-linecap="round"/>

            <!-- hair front strands -->
            <path d="M -52 4 Q -50 -40 -18 -48 Q -40 -30 -44 6 Z" fill="url(#hair)"/>
            <path d="M 52 4 Q 50 -40 18 -48 Q 40 -30 44 6 Z" fill="url(#hair)"/>
          </g>
        </g>
      </svg>`;

    this.svg = this.container.querySelector('svg');
    this.figure = this.svg.querySelector('#figure');
    this.head = this.svg.querySelector('#head');
    this.$ = (id) => this.svg.querySelector('#' + id);
  }

  setMood(mood) {
    if (!MOOD_FACE[mood]) return;
    this.mood = mood;
    const f = MOOD_FACE[mood];
    this.svg.style.setProperty('--glow', f.glow);
    this.$('mouth').setAttribute('d', f.mouth);
    this.$('browL').setAttribute('transform', `translate(0 ${f.brow})`);
    this.$('browR').setAttribute('transform', `translate(0 ${f.brow})`);
    this.$('blushL').setAttribute('opacity', f.blush);
    this.$('blushR').setAttribute('opacity', f.blush);
    this._eyeOpen = f.eyeOpen;
  }

  setPose(pose) {
    if (POSE_TILT[pose] === undefined) return;
    this.pose = pose;
    if (pose === 'wink') this._winkOnce = true;
    if (pose === 'wave') this._waveUntil = performance.now() + 1600;
  }

  speak(on) { this.talking = on; }

  _loop() {
    const tick = (now) => {
      this._t = now / 1000;
      // idle breathing + pose tilt
      const breathe = Math.sin(this._t * 1.4) * 1.2;
      const tilt = POSE_TILT[this.pose] || 0;
      this.figure.setAttribute('transform', `translate(0 ${breathe}) rotate(${tilt} 0 40)`);

      // blinking
      const f = MOOD_FACE[this.mood];
      const open = (f ? f.eyeOpen : 1);
      this._blink -= 0.016;
      if (this._blink < -3) this._blink = 0.18; // schedule next blink
      const blinkAmt = this._blink > 0 ? this._blink / 0.18 : 0;
      const lidH = (1 - open + blinkAmt) * 16;
      this.$('lidL').setAttribute('height', Math.min(16, lidH * 16 / 16 + (1 - open) * 8));
      this.$('lidR').setAttribute('height', Math.min(16, lidH * 16 / 16 + (1 - open) * 8));

      // simple version: lids follow blink
      const h = Math.max(0, blinkAmt * 14 + (1 - open) * 6);
      this.$('lidL').setAttribute('height', h);
      this.$('lidR').setAttribute('height', this._winkOnce ? 14 : h);
      if (this._winkOnce && blinkAmt > 0.9) this._winkOnce = false;

      // waving
      if (this._waveUntil && now < this._waveUntil) {
        const w = Math.sin(this._t * 12) * 6;
        this.head.setAttribute('transform', `rotate(${w} 0 40)`);
      } else {
        this.head.setAttribute('transform', '');
      }

      // talking mouth
      if (this.talking) {
        const m = 26 + Math.sin(this._t * 16) * 4;
        this.$('mouth').setAttribute('d', `M -18 ${m} Q 0 ${m + 8} 18 ${m}`);
      } else if (f) {
        this.$('mouth').setAttribute('d', f.mouth);
      }

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
