/* =========================================================
   CADENA DE SEÑAL — SIMULACIÓN A NIVEL DEL ADC DE LA ESP32
   ---------------------------------------------------------
   Electrodos -> INA128 + filtros -> (referencia VREF + señal) -> ADC de la ESP
   -> firmware (resta la referencia, RMS, FFT, repeticiones, fatiga) -> paquete a la app

   Lo usan index.html (la app) y analisis.html (la página de la presentación).
   Todo lo de acá abajo se puede ajustar: son los números reales del circuito.
   ========================================================= */
const HW = {
  fs: 1000,       // frecuencia de muestreo del ADC (Hz). El pasabajo de 500 Hz hace de anti-aliasing.
  adcBits: 12,    // ADC de la ESP32
  vfs: 3.3,       // fondo de escala (V)
  vref: 1.85,     // referencia del circuito: la señal viaja montada sobre este nivel (V)
  gain: 250,      // ganancia total = INA128 (50) x etapa final (5)
};
const ADC_MAX = (1 << HW.adcBits) - 1;

// Parámetros del "sujeto" simulado (fisiología)
const SIM = {
  rmsMaxV: 0.18,     // RMS de salida (V) a 100% de activación y sin fatiga (≈ 0,7 mV en el brazo, con la ganancia de 250)
  period0: 2.6,      // duración de una repetición sin fatiga (s)
  periodSlow: 0.35,  // cuánto se enlentece cada repetición al llegar al fallo (+35%)
  ampRise: 0.40,     // con fatiga la amplitud (RMS) sube hasta +40%
  fcFresh: 170,      // corte del espectro sin fatiga (Hz)  -> MDF ≈ 110-120 Hz
  fcTired: 156,      // corte del espectro con fatiga (Hz)  -> MDF cae ≈ 6% al fallo (lo que mostró el dataset)
  aRest: 0.06,       // activación en reposo
  aPeak: 0.85,       // activación máxima durante la repetición
  mainsV: 0.006,     // resto de interferencia de red de 50 Hz (V)
  artifactV: 0.004,  // artefacto de movimiento residual (V)
  adcNoiseLsb: 1.5,  // ruido del ADC (LSB rms)
  vrefErrorV: 0.012, // la referencia real nunca es exacta: el firmware la estima, no la asume
};

// Parámetros del firmware (los que después van en el Arduino / ESP-IDF)
// Repeticiones, sin calibración: la envolvente se expresa como % entre el nivel de reposo y el pico
// de las últimas repeticiones, que el firmware va midiendo solo.
const REP = {
  up: 0.50, down: 0.30,   // umbrales con histéresis (% del rango reposo-pico)
  minDur: 0.6,            // duración mínima de una contracción (s)
  peakTau: 10,            // el pico se "olvida" con esta constante de tiempo (s), para seguir a la persona
  floorRise: 0.1,         // el nivel de reposo baja enseguida pero sube como mucho 10% por segundo
  minRatio: 3,            // hasta que el pico no supere 3 veces el reposo, no hubo contracción real (es ruido)
};
const FAT = {
  baseReps: 3,        // primeras repeticiones: calibran la línea base
  lastReps: 3,        // el RMS actual es el promedio de las últimas repeticiones
  freqDropFull: 0.06, // caída de la MDF (según la recta) que equivale a "fatiga 100%" (dataset: ≈6%)
  trendMinReps: 6,    // con menos repeticiones la recta no es confiable: la caída de frecuencia todavía no cuenta
  trendK: 1,          // cuántos errores estándar de la recta se descuentan antes de contar la caída
  rmsRiseFull: 0.40,  // suba de RMS que equivale a "fatiga 100%"
  wFreq: 0.5, wRMS: 0.5,
  smooth: 0.6,        // suavizado entre repeticiones
  moderate: 30, high: 60,   // umbrales de estado (%)
};
const DSP = { fftN: 256, hop: 120, rmsWin: 100, upd: 20, fLo: 20, fHi: 450 };   // hop múltiplo de upd
const SERIE = { restGap: 8 };   // s sin contracciones después de una repetición = la serie terminó

/* ---------- utilidades ---------- */
function makeRng(seed) { // mulberry32, para pruebas repetibles
  let a = seed >>> 0;
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function makeGauss(rng) {
  let spare = null;
  return function () {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0, v = 0; while (u === 0) u = rng(); v = rng();
    const m = Math.sqrt(-2 * Math.log(u));
    spare = m * Math.sin(2 * Math.PI * v); return m * Math.cos(2 * Math.PI * v);
  };
}
function makeFFT(N) {
  const levels = Math.round(Math.log2(N));
  const cos = new Float64Array(N / 2), sin = new Float64Array(N / 2);
  for (let i = 0; i < N / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / N); sin[i] = Math.sin(2 * Math.PI * i / N); }
  const rev = new Uint16Array(N);
  for (let i = 0; i < N; i++) { let r = 0; for (let b = 0; b < levels; b++) r |= ((i >> b) & 1) << (levels - 1 - b); rev[i] = r; }
  return function fft(re, im) {
    for (let i = 0; i < N; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1, step = N / size;
      for (let i = 0; i < N; i += size) {
        for (let j = i, k = 0; j < i + half; j++, k += step) {
          const l = j + half;
          const tre = re[l] * cos[k] + im[l] * sin[k];
          const tim = -re[l] * sin[k] + im[l] * cos[k];
          re[l] = re[j] - tre; im[l] = im[j] - tim; re[j] += tre; im[j] += tim;
        }
      }
    }
  };
}
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
function linFit(xs, ys) {   // recta por mínimos cuadrados: y = a + b·x
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const b = sxx ? sxy / sxx : 0;
  return { a: my - b * mx, b };
}

/* ---------- ruido con espectro de EMG (pasabanda ~20 Hz .. fc) ---------- */
const NOISE_LUT = { fcs: [], stds: [] };
function noiseStep(st, w, fc) {
  const a = 1 - Math.exp(-2 * Math.PI * fc / HW.fs);
  st.y1 += a * (w - st.y1);
  st.y2 += a * (st.y1 - st.y2);
  const ah = 1 - Math.exp(-2 * Math.PI * 20 / HW.fs);
  st.lp += ah * (st.y2 - st.lp);
  return st.y2 - st.lp;
}
function noiseStd(fc) {   // desvío del ruido filtrado, para normalizarlo a RMS = 1
  if (!NOISE_LUT.fcs.length) {
    const g = makeGauss(makeRng(12345));
    for (let fcv = 60; fcv <= 220; fcv += 20) {
      const st = { y1: 0, y2: 0, lp: 0 }; let s2 = 0; const n = 60000;
      for (let i = 0; i < 2000; i++) noiseStep(st, g(), fcv);
      for (let i = 0; i < n; i++) { const v = noiseStep(st, g(), fcv); s2 += v * v; }
      NOISE_LUT.fcs.push(fcv); NOISE_LUT.stds.push(Math.sqrt(s2 / n));
    }
  }
  const f = NOISE_LUT.fcs, s = NOISE_LUT.stds;
  if (fc <= f[0]) return s[0];
  for (let i = 1; i < f.length; i++) if (fc <= f[i]) { const t = (fc - f[i - 1]) / (f[i] - f[i - 1]); return s[i - 1] + t * (s[i] - s[i - 1]); }
  return s[s.length - 1];
}

/* =========================================================
   1) EL SUJETO + EL CIRCUITO + EL ADC  (lo que produce el pin de la ESP)
   Devuelve cuentas de ADC (0..4095), igual que analogRead().
   ========================================================= */
class SimulatedSubject {
  constructor(opts = {}) {
    this.rng = opts.rng || Math.random;
    this.g = makeGauss(this.rng);
    this.repsToFailure = opts.repsToFailure || 16;
    this.t = 0; this.phase = 0; this.repsDone = 0;
    this.ampRep = 1; this.F = 0;
    this.nz = { y1: 0, y2: 0, lp: 0 };
    this.vrefReal = HW.vref + SIM.vrefErrorV;
    this.mainsPh = this.rng() * 2 * Math.PI;
    this.resting = false;
  }
  rest() { this.resting = true; }
  resume() { this.resting = false; this.repsDone = 0; this.phase = 0; }   // tras el descanso el músculo se recupera
  get activation() { return SIM.aRest + (SIM.aPeak * this.ampRep - SIM.aRest) * Math.pow(Math.sin(Math.PI * this.phase), 2); }
  nextCount() {
    const dt = 1 / HW.fs;
    // fatiga "verdadera" (lo que el firmware tiene que lograr estimar)
    this.F = clamp(Math.pow((this.repsDone + this.phase) / this.repsToFailure, 1.2), 0, 1);
    const P = SIM.period0 * (1 + SIM.periodSlow * this.F);
    if (!this.resting) this.phase += dt / P;
    if (this.phase >= 1) { this.phase -= 1; this.repsDone++; this.ampRep = 1 + 0.06 * this.g(); }
    this.t += dt;
    const a = this.activation;
    const fc = SIM.fcFresh - (SIM.fcFresh - SIM.fcTired) * this.F;
    const n = noiseStep(this.nz, this.g(), fc) / noiseStd(fc);
    const emg = a * SIM.rmsMaxV * (1 + SIM.ampRise * this.F) * n;
    const mains = SIM.mainsV * Math.sin(2 * Math.PI * 50 * this.t + this.mainsPh);
    const art = SIM.artifactV * Math.sin(2 * Math.PI * 3 * this.t);
    const v = this.vrefReal + emg + mains + art;           // <- referencia + señal (el "sumador" lo hace el pin REF del INA128)
    const counts = Math.round(v / HW.vfs * ADC_MAX + this.g() * SIM.adcNoiseLsb);
    return clamp(counts, 0, ADC_MAX);
  }
}

/* =========================================================
   2) EL FIRMWARE DE LA ESP (esto es lo que se programa en Arduino)
   cuentas -> volts -> restar referencia -> RMS -> repeticiones -> FFT (MDF/MNF) -> fatiga
   ========================================================= */
class EmgFirmware {
  constructor() {
    this.n = 0;                                   // muestras procesadas
    this.dc = null;                               // referencia estimada (promedio móvil)
    this.sq = new Float64Array(DSP.rmsWin); this.sqSum = 0; this.sqPos = 0;
    this.win = new Float64Array(DSP.fftN); this.winPos = 0;
    this.raw = new Float32Array(4096);            // para graficar (V en el pin)
    this.fft = makeFFT(DSP.fftN);
    this.hann = new Float64Array(DSP.fftN);
    for (let i = 0; i < DSP.fftN; i++) this.hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (DSP.fftN - 1));
    this.re = new Float64Array(DSP.fftN); this.im = new Float64Array(DSP.fftN); this.pw = new Float64Array(DSP.fftN / 2);
    this.act = 0; this.contracted = false; this.tUp = 0;
    this.floor = null; this.peak = null; this.armed = false;
    this.repRms = [];
    this.acc = new Float64Array(DSP.fftN / 2); this.accN = 0;   // espectro promedio de la repetición en curso (Welch)
    this.serie = 1; this.repTimes = []; this.tLastRep = 0;
    this._newSerie();
    this.mdf = 0; this.mnf = 0; this.lastCount = 0; this.lastV = 0;
    this.envHist = [];                            // {t, act} para graficar
  }
  get t() { return this.n / HW.fs; }
  _newSerie() {   // todo lo de la fatiga vuelve a cero: el músculo descansó y se recalibra la línea base
    this.reps = 0; this.repLog = []; this.trend = null;
    this.baseAcc = []; this.base = null; this.score = 0; this.estado = 'calibrando';
    this.freqDrop = this.freqDropSure = this.rmsRise = undefined;
  }
  process(counts) {
    const alpha = 1 / (0.5 * HW.fs);
    for (let i = 0; i < counts.length; i++) {
      const c = counts[i];
      const v = c / ADC_MAX * HW.vfs;             // 1) cuentas -> volts
      if (this.dc === null) this.dc = v;
      this.dc += alpha * (v - this.dc);           // 2) estimo la referencia (≈1,85 V) con un promedio móvil...
      const x = v - this.dc;                      //    ...y se la resto: queda solo la señal, centrada en 0
      this.raw[this.n & 4095] = v;
      this.sqSum += x * x - this.sq[this.sqPos]; this.sq[this.sqPos] = x * x;
      this.sqPos = (this.sqPos + 1) % DSP.rmsWin;
      this.win[this.winPos] = x; this.winPos = (this.winPos + 1) % DSP.fftN;
      this.n++;
      this.lastCount = c; this.lastV = v;
      if (this.n % DSP.upd === 0) this._update();
    }
  }
  _update() {
    const rmsV = Math.sqrt(Math.max(0, this.sqSum) / DSP.rmsWin);
    this.rmsV = rmsV;
    // envolvente relativa: 0 = reposo, 1 = pico de las últimas repeticiones
    const dt = DSP.upd / HW.fs;
    if (this.floor === null) this.floor = this.peak = rmsV;
    this.floor = Math.min(rmsV, this.floor * (1 + REP.floorRise * dt));                                  // reposo
    this.peak = Math.max(rmsV, this.floor + (this.peak - this.floor) * Math.exp(-dt / REP.peakTau));    // pico
    this.armed = this.peak > REP.minRatio * this.floor;
    this.act = this.armed ? (rmsV - this.floor) / (this.peak - this.floor) : 0;
    const t = this.t;
    this.envHist.push({ t, act: this.act }); if (this.envHist.length > 500) this.envHist.shift();

    // 3) repeticiones: umbral con histéresis
    if (!this.contracted && this.act > REP.up) {
      this.contracted = true; this.tUp = t; this.repRms = []; this.acc.fill(0); this.accN = 0;
    } else if (this.contracted && this.act < REP.down) {
      this.contracted = false;
      if (t - this.tUp >= REP.minDur) { this.reps++; this.repTimes.push(t); this.tLastRep = t; this._repEnd(); }
    }
    // 6) serie nueva: si después de alguna repetición pasan SERIE.restGap s sin contracciones
    if (!this.contracted && this.reps > 0 && t - this.tLastRep >= SERIE.restGap) { this.serie++; this._newSerie(); }
    if (this.contracted) this.repRms.push(rmsV);   // para la fatiga se usa el RMS en volts, no el relativo

    // 4) espectro (MDF / MNF) cada "hop" muestras, solo mientras el músculo está activo
    if (this.n % DSP.hop === 0 && this.n >= DSP.fftN && this.contracted && this.act > 0.4) this._spectrum();
  }
  _spectrum() {
    const N = DSP.fftN;
    for (let i = 0; i < N; i++) { this.re[i] = this.win[(this.winPos + i) % N] * this.hann[i]; this.im[i] = 0; }
    this.fft(this.re, this.im);
    const df = HW.fs / N, k0 = Math.ceil(DSP.fLo / df), k1 = Math.floor(DSP.fHi / df);
    let tot = 0;
    for (let k = k0; k <= k1; k++) { const p = this.re[k] * this.re[k] + this.im[k] * this.im[k]; this.pw[k] = p; tot += p; }
    if (tot <= 0) return;
    for (let k = k0; k <= k1; k++) this.acc[k] += this.pw[k] / tot;   // cada ventana pesa igual (se normaliza por su potencia)
    this.accN++;
    const f = this._features();
    this.mdf = f.mdf; this.mnf = f.mnf;                                // valor "en vivo" de la repetición en curso
  }
  _features() {   // MDF y MNF a partir del espectro promedio acumulado
    const df = HW.fs / DSP.fftN, k0 = Math.ceil(DSP.fLo / df), k1 = Math.floor(DSP.fHi / df);
    let tot = 0, wsum = 0;
    for (let k = k0; k <= k1; k++) { tot += this.acc[k]; wsum += this.acc[k] * k * df; }
    let accum = 0, mdf = DSP.fHi;
    for (let k = k0; k <= k1; k++) { accum += this.acc[k]; if (accum >= tot / 2) { const prev = accum - this.acc[k]; mdf = (k - 1 + (tot / 2 - prev) / this.acc[k]) * df; break; } }
    return { mdf, mnf: wsum / tot };
  }
  _repEnd() {
    if (this.accN < 2) return;
    const f = this._features();
    const m = { n: this.reps, mdf: f.mdf, mnf: f.mnf, rms: mean(this.repRms) };
    this.repLog.push(m);
    if (!this.base) {
      this.baseAcc.push(m);
      if (this.baseAcc.length >= FAT.baseReps) {
        const b = this.baseAcc;
        this.base = { mdf: mean(b.map(r => r.mdf)), mnf: mean(b.map(r => r.mnf)), rms: mean(b.map(r => r.rms)) };
        this.estado = 'sin';
      }
      return;
    }
    // 5) fatiga. La caída de la MDF es chica (≈6% al fallo) y de una repetición a otra
    //    la MDF varía casi lo mismo, así que no se compara rep por rep: se ajusta una recta
    //    a la MDF de todas las repeticiones de la serie y se mira cuánto bajó la recta.
    //    Solo cuenta la parte de la caída que supera el error de la recta (con pocas
    //    repeticiones la recta es poco confiable y no dispara falsas alarmas).
    const n = this.repLog.length, xs = this.repLog.map((r, i) => i), ys = this.repLog.map(r => r.mdf);
    this.trend = linFit(xs, ys);
    const fit0 = this.trend.a, fitNow = this.trend.a + this.trend.b * (n - 1);
    const ssr = ys.reduce((s, y, i) => s + (y - (this.trend.a + this.trend.b * i)) ** 2, 0);
    const sxx = xs.reduce((s, x) => s + (x - (n - 1) / 2) ** 2, 0);
    const seDrop = n >= FAT.trendMinReps ? Math.sqrt(ssr / (n - 2) / sxx) * (n - 1) / fit0 : 1;
    this.freqDrop = 1 - fitNow / fit0;
    this.freqDropSure = Math.max(0, this.freqDrop - FAT.trendK * seDrop);
    this.rmsRise = mean(this.repLog.slice(-FAT.lastReps).map(r => r.rms)) / this.base.rms - 1;
    const raw = 100 * (FAT.wFreq * clamp(this.freqDropSure / FAT.freqDropFull, 0, 1) + FAT.wRMS * clamp(this.rmsRise / FAT.rmsRiseFull, 0, 1));
    this.score = FAT.smooth * raw + (1 - FAT.smooth) * this.score;
    this.estado = this.score >= FAT.high ? 'alta' : this.score >= FAT.moderate ? 'moderada' : 'sin';
  }
  packet() {   // lo ÚNICO que la ESP le manda a la app
    return { serie: this.serie, reps: this.reps, estado: this.estado, fatiga: Math.round(this.score) };
  }
}

/* Une las dos partes: es "la ESP" completa, simulada. */
class SimulatedEsp {
  constructor(opts = {}) { this.subject = new SimulatedSubject(opts); this.fw = new EmgFirmware(); }
  advance(nSamples) {
    const buf = new Uint16Array(nSamples);
    for (let i = 0; i < nSamples; i++) buf[i] = this.subject.nextCount();
    this.fw.process(buf);
    return this.fw.packet();
  }
}

// "Sujeto de demostración": cada modo se repite igual, para poder ensayar la presentación.
// Las semillas están elegidas para que en la primera serie la fatiga alta aparezca cerca del fallo.
const SIM_MODES = {
  rapida: { label: 'Rápida (llega al fallo en ~10 repeticiones)', repsToFailure: 10, seed: 2 },
  normal: { label: 'Normal (llega al fallo en ~16 repeticiones)', repsToFailure: 16, seed: 7 },
  lenta:  { label: 'Lenta (llega al fallo en ~24 repeticiones)', repsToFailure: 24, seed: 11 },
};
