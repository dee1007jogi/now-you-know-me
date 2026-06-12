/**
 * AdminShaderEngine – Flagship WebGL2 reactive background shader
 * Layers:
 *   0 – Deep-space aurora (Perlin noise colour flow, idle state)
 *   1 – Perspective radar grid (always on, slow pan)
 *   2 – Pulse-wave ripples (triggered per admin click / buzzer event)
 *   3 – Player-buzz heatmap (Gaussian splats, updates at 15fps)
 *   4 – Glitch-matrix displacement (chaos mode, critical events)
 *
 * Performance contract:
 *   • Shader LOD dropped when tab is blurred (Page Visibility API)
 *   • Heatmap texture capped at 15fps
 *   • WebGL context-loss recovery via automatic rebuild
 *   • Canvas 2D fallback if WebGL2 unavailable
 */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* VERTEX SHADER                                                         */
  /* ------------------------------------------------------------------ */
  const VERT_SRC = `#version 300 es
  precision highp float;
  in vec2 a_pos;
  out vec2 vUv;
  void main() {
    vUv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }`;

  /* ------------------------------------------------------------------ */
  /* FRAGMENT SHADER – full cinematic pipeline                            */
  /* ------------------------------------------------------------------ */
  const FRAG_SRC = `#version 300 es
  precision highp float;

  uniform float  uTime;          // seconds elapsed
  uniform float  uIntensity;     // 0-1  buzz activity level
  uniform float  uChaos;         // 0-1  chaos mode factor
  uniform float  uLOD;           // 1 = full, 0.5 = half detail (tab blurred)
  uniform vec2   uResolution;    // viewport px
  uniform vec2   uClick;         // last click, normalised 0-1
  uniform float  uClickAge;      // seconds since last click (for ripple decay)
  uniform sampler2D uHeatmap;    // 32x32 Gaussian splat heatmap
  in vec2 vUv;
  out vec4 fragColor;

  /* ---- Helpers ---------------------------------------------------- */
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1,0)), u.x),
      mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x),
      u.y
    );
  }

  float fbm(vec2 p, int oct) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
      if (i >= oct) break;
      v += a * noise(p);
      p  = p * 2.0 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  /* ---- Layer 0 – Aurora ------------------------------------------- */
  vec3 aurora(vec2 uv) {
    vec2  p   = uv * 2.0 - 1.0;
    float t   = uTime * 0.12;
    int   oct = uLOD > 0.7 ? 5 : 3;
    float n1  = fbm(p * 1.5 + vec2(t, t * 0.7), oct);
    float n2  = fbm(p * 2.0 - vec2(t * 0.8, 0.5), oct);
    vec3  ca  = vec3(0.03, 0.07, 0.22);   // deep indigo
    vec3  cb  = vec3(0.45, 0.08, 0.72);   // violet surge
    vec3  cc  = vec3(0.0,  0.55, 0.80);   // cyan accent
    vec3  col = mix(ca, cb, n1);
    col       = mix(col, cc, n2 * 0.45 * (1.0 + uIntensity));
    return col * 0.35;
  }

  /* ---- Layer 1 – Radar grid --------------------------------------- */
  float radarGrid(vec2 uv) {
    float asp    = uResolution.x / uResolution.y;
    vec2  p      = vec2(uv.x * asp, uv.y);
    float speed  = uTime * 0.18;

    // Perspective warp: lines converge at vanishing point
    float persp  = 1.0 / max(uv.y * 1.4 + 0.2, 0.001);
    vec2  gp     = vec2(p.x * persp, uv.y * 28.0 - speed * 2.5);

    float gx     = step(0.94, fract(p.x * 20.0 * persp));
    float gy     = step(0.92, fract(gp.y));
    float grid   = max(gx, gy);

    // Scanline pulse
    float scanV  = abs(sin(uv.y * 80.0 - uTime * 3.0)) * 0.04;
    return clamp(grid * (0.3 + uIntensity * 0.6) + scanV, 0.0, 1.0);
  }

  /* ---- Layer 2 – Pulse ripple ------------------------------------- */
  float ripple(vec2 uv) {
    if (uClickAge > 4.0) return 0.0;
    vec2  d    = uv - uClick;
    d.x       *= uResolution.x / uResolution.y;
    float dist = length(d);
    float age  = uClickAge;
    float wave = sin((dist - age * 0.55) * 35.0) * exp(-dist * 6.0) * exp(-age * 1.8);
    return clamp(wave * 0.6, 0.0, 1.0);
  }

  /* ---- Layer 3 – Heatmap ----------------------------------------- */
  vec3 heatmap(vec2 uv) {
    float h = texture(uHeatmap, uv).r;
    vec3 cold = vec3(0.0, 0.1, 0.4);
    vec3 warm = vec3(0.0, 0.9, 0.7);
    vec3 hot  = vec3(1.0, 0.4, 0.0);
    vec3 col  = h < 0.5 ? mix(cold, warm, h * 2.0) : mix(warm, hot, (h - 0.5) * 2.0);
    return col * h * (0.4 + uIntensity * 0.5);
  }

  /* ---- Layer 4 – Glitch ------------------------------------------ */
  vec2 glitch(vec2 uv) {
    if (uChaos < 0.15) return uv;
    float t   = floor(uTime * 18.0);
    float row = floor(uv.y * 28.0);
    float rnd = hash(vec2(row, t));
    float dx  = (rnd - 0.5) * 0.045 * uChaos * step(0.65, rnd);
    float blockShift = step(0.97, hash(vec2(t, 3.7))) * 0.06 * uChaos;
    return uv + vec2(dx + blockShift, 0.0);
  }

  float chromaticSplit(vec2 uv) {
    if (uChaos < 0.15) return 0.0;
    float t   = floor(uTime * 20.0);
    float row = floor(uv.y * 40.0);
    return step(0.92, hash(vec2(row, t))) * uChaos * 0.3;
  }

  /* ---- Main ------------------------------------------------------- */
  void main() {
    vec2 uv  = glitch(vUv);                // glitch displaces UV

    vec3 col = aurora(uv);                 // layer 0 base

    float grid = radarGrid(uv);
    col += grid * vec3(0.0, 0.7, 1.0) * 0.55;  // layer 1 cyan grid

    float rpl  = ripple(uv);
    col += rpl * vec3(1.0, 0.8, 0.0) * 0.7;    // layer 2 gold ripple

    col += heatmap(uv);                    // layer 3 heat overlay

    // Chromatic aberration pass (chaos)
    float ca = chromaticSplit(uv);
    if (ca > 0.0) {
      col.r += texture(uHeatmap, uv + vec2(0.005, 0.0)).r * ca;
      col.b += texture(uHeatmap, uv - vec2(0.005, 0.0)).r * ca;
    }

    // Vignette
    vec2 vig = vUv * 2.0 - 1.0;
    col *= 1.0 - dot(vig, vig) * 0.35;

    // Final alpha – 0.18 so UI elements remain legible
    fragColor = vec4(col, 0.18 + uIntensity * 0.04);
  }`;

  /* ================================================================== */
  /* ENGINE                                                               */
  /* ================================================================== */
  class AdminShaderEngine {
    constructor() {
      this.canvas   = null;
      this.gl       = null;
      this.program  = null;
      this.uniforms = {};
      this.state    = {
        intensity : 0.0,  // live buzz activity
        chaos     : 0.0,  // chaos mode
        lod       : 1.0,  // tab visibility
        clickUv   : [0.5, 0.5],
        clickAge  : 99.0,
      };
      this.heatmapData    = new Float32Array(32 * 32);
      this.heatmapTex     = null;
      this.heatmapDirty   = true;
      this.heatmapLastUpd = 0;
      this.startTime      = performance.now();
      this.rafId          = null;
      this.playerPositions = []; // [{nx, ny}] normalised 0-1
    }

    /* -------------------------------------------------------------- */
    /* Init                                                             */
    /* -------------------------------------------------------------- */
    init() {
      this.canvas = document.getElementById('adminShaderCanvas');
      if (!this.canvas) {
        this.canvas       = document.createElement('canvas');
        this.canvas.id    = 'adminShaderCanvas';
        Object.assign(this.canvas.style, {
          position  : 'fixed',
          inset     : '0',
          width     : '100vw',
          height    : '100vh',
          zIndex    : '0',
          pointerEvents: 'none',
          display   : 'block',
        });
        document.body.prepend(this.canvas);
      }

      const gl = this.canvas.getContext('webgl2', {
        alpha            : true,
        premultipliedAlpha: false,
        antialias        : false,
        powerPreference  : 'default',
      });

      if (!gl) {
        this._fallbackCanvas2D();
        return;
      }

      this.gl = gl;
      this._buildProgram();
      this._buildHeatmapTexture();
      this._bindListeners();
      this._resize();
      this._startLoop();

      // Context-loss recovery
      this.canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        cancelAnimationFrame(this.rafId);
      });
      this.canvas.addEventListener('webglcontextrestored', () => {
        this._buildProgram();
        this._buildHeatmapTexture();
        this._startLoop();
      });

      console.log('[AdminShader] WebGL2 pipeline online ✅');
    }

    /* -------------------------------------------------------------- */
    /* Shader compilation                                               */
    /* -------------------------------------------------------------- */
    _buildProgram() {
      const gl  = this.gl;
      const vs  = this._compile(gl.VERTEX_SHADER,   VERT_SRC);
      const fs  = this._compile(gl.FRAGMENT_SHADER, FRAG_SRC);
      const prg = gl.createProgram();
      gl.attachShader(prg, vs);
      gl.attachShader(prg, fs);
      gl.linkProgram(prg);
      if (!gl.getProgramParameter(prg, gl.LINK_STATUS)) {
        console.error('[AdminShader] Link error:', gl.getProgramInfoLog(prg));
        this._fallbackCanvas2D();
        return;
      }
      this.program = prg;

      // Full-screen quad
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1,-1,  1,-1,  -1,1,  1,-1,  1,1,  -1,1
      ]), gl.STATIC_DRAW);

      const posLoc = gl.getAttribLocation(prg, 'a_pos');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      gl.useProgram(prg);

      // Cache uniform locations
      ['uTime','uIntensity','uChaos','uLOD','uResolution','uClick','uClickAge','uHeatmap']
        .forEach(n => { this.uniforms[n] = gl.getUniformLocation(prg, n); });

      gl.uniform1i(this.uniforms.uHeatmap, 0);
    }

    _compile(type, src) {
      const gl  = this.gl;
      const sh  = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('[AdminShader] Compile error:', gl.getShaderInfoLog(sh));
      }
      return sh;
    }

    /* -------------------------------------------------------------- */
    /* Heatmap texture                                                  */
    /* -------------------------------------------------------------- */
    _buildHeatmapTexture() {
      const gl  = this.gl;
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 32, 32, 0, gl.RED, gl.FLOAT, this.heatmapData);
      this.heatmapTex = tex;
    }

    _updateHeatmapFromPlayers() {
      const data = new Float32Array(32 * 32);
      this.playerPositions.forEach(({ nx, ny }) => {
        const cx = Math.floor(nx * 31);
        const cy = Math.floor((1 - ny) * 31);
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const px = cx + dx, py = cy + dy;
            if (px < 0 || px > 31 || py < 0 || py > 31) continue;
            const sigma2 = 4.5;
            const w = Math.exp(-(dx*dx + dy*dy) / sigma2);
            data[py * 32 + px] += w;
          }
        }
      });
      // Normalise
      let mx = 0;
      data.forEach(v => { if (v > mx) mx = v; });
      if (mx > 0) data.forEach((v, i) => { data[i] = v / mx; });
      this.heatmapData = data;
      this.heatmapDirty = true;
    }

    _pushHeatmapToGPU() {
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.heatmapTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 32, 32, 0, gl.RED, gl.FLOAT, this.heatmapData);
      this.heatmapDirty = false;
    }

    /* -------------------------------------------------------------- */
    /* Render loop                                                      */
    /* -------------------------------------------------------------- */
    _startLoop() {
      const loop = (now) => {
        this.rafId = requestAnimationFrame(loop);
        this._render(now);
      };
      this.rafId = requestAnimationFrame(loop);
    }

    _render(now) {
      const gl  = this.gl;
      const t   = (now - this.startTime) / 1000;

      // Heatmap update capped at 15fps
      if (this.heatmapDirty && (now - this.heatmapLastUpd) > 66) {
        this._pushHeatmapToGPU();
        this.heatmapLastUpd = now;
      }

      // Smooth state transitions
      this.state.clickAge = Math.min(this.state.clickAge + 0.016, 99);

      const u = this.uniforms;
      gl.uniform1f(u.uTime,       t);
      gl.uniform1f(u.uIntensity,  this.state.intensity);
      gl.uniform1f(u.uChaos,      this.state.chaos);
      gl.uniform1f(u.uLOD,        this.state.lod);
      gl.uniform2f(u.uResolution, this.canvas.width, this.canvas.height);
      gl.uniform2f(u.uClick,      this.state.clickUv[0], this.state.clickUv[1]);
      gl.uniform1f(u.uClickAge,   this.state.clickAge);

      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    /* -------------------------------------------------------------- */
    /* Event bindings                                                   */
    /* -------------------------------------------------------------- */
    _bindListeners() {
      // Admin click → ripple at click position
      document.addEventListener('click', (e) => {
        this.state.clickUv  = [e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight];
        this.state.clickAge = 0;
      });

      // Page visibility → LOD management
      document.addEventListener('visibilitychange', () => {
        this.state.lod = document.hidden ? 0.4 : 1.0;
      });

      window.addEventListener('resize', () => this._resize());
    }

    _resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, this.state.lod > 0.7 ? 1.5 : 1.0);
      this.canvas.width  = window.innerWidth  * dpr;
      this.canvas.height = window.innerHeight * dpr;
    }

    /* -------------------------------------------------------------- */
    /* Public API – called by admin.js / socket.io handlers            */
    /* -------------------------------------------------------------- */

    /**
     * setIntensity(v) – 0.0 idle → 1.0 full buzz storm
     * Smoothly lerped each frame via requestAnimationFrame.
     */
    setIntensity(target, durationMs = 800) {
      const start = this.state.intensity;
      const t0    = performance.now();
      const tick  = () => {
        const p = Math.min((performance.now() - t0) / durationMs, 1);
        this.state.intensity = start + (target - start) * p;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    /**
     * triggerChaos(on) – enable/disable chaos-mode glitch layer
     */
    triggerChaos(on) {
      const target = on ? 1.0 : 0.0;
      this.setIntensity(on ? 0.9 : 0.4);
      const start = this.state.chaos;
      const t0    = performance.now();
      const dur   = on ? 400 : 1200;
      const tick  = () => {
        const p = Math.min((performance.now() - t0) / dur, 1);
        this.state.chaos = start + (target - start) * p;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    /**
     * updatePlayers(positions) – array of {nx,ny} normalised positions
     * Used to build the live heatmap. Call whenever leaderboard state updates.
     */
    updatePlayers(positions) {
      this.playerPositions = positions;
      this._updateHeatmapFromPlayers();
    }

    /**
     * triggerBuzzPulse() – call when a player buzzes in
     */
    triggerBuzzPulse() {
      const prev = this.state.intensity;
      this.setIntensity(Math.min(prev + 0.25, 1.0), 200);
      setTimeout(() => this.setIntensity(prev, 1500), 300);
    }

    /* -------------------------------------------------------------- */
    /* Canvas 2D fallback                                               */
    /* -------------------------------------------------------------- */
    _fallbackCanvas2D() {
      console.warn('[AdminShader] WebGL2 unavailable – Canvas 2D fallback active');
      if (!this.canvas) return;
      const ctx = this.canvas.getContext('2d');
      if (!ctx) return;

      let t = 0;
      const draw = () => {
        this.rafId = requestAnimationFrame(draw);
        t += 0.005;
        const { width: w, height: h } = this.canvas;
        ctx.clearRect(0, 0, w, h);
        const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w,h)*0.7);
        grad.addColorStop(0, `hsla(${200 + Math.sin(t)*30},70%,15%,0.15)`);
        grad.addColorStop(1, 'hsla(240,60%,5%,0.08)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      };
      draw();
    }
  }

  /* ================================================================== */
  /* Bootstrap – expose globally so admin.js can call the public API     */
  /* ================================================================== */
  window.AdminShader = new AdminShaderEngine();

  // Auto-init once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.AdminShader.init());
  } else {
    window.AdminShader.init();
  }

})();
