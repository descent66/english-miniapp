// Блик по кромке кнопки — перенос компонента SpecularButton (React Bits) на обычный JS (WebGL2).
// Взяты параметры пользователя: lineColor #fff, baseColor #525252, intensity 1, shineSize 10, shineFade 34, thickness 1.2, glow 1,
// followMouse false. По просьбе пользователя включён режим autoAnimate: два одинаковых блика — один сверху, другой снизу — плавно
// бегут по кругу вдоль кромки (speed 0.35 — как в оригинале, оборот ~18 с); при нажатии вспыхивают шире и плавно гаснут.
// Шейдер без изменений, кроме силы второго блика. Пока кнопки не видно на экране или включено «уменьшить движение», блики не бегут.
// Одна общая «картинка» на всё приложение: attachSpecular(кнопка) переносит холст в новую кнопку (кнопки на экране пересоздаются).
// Радиус берётся из настоящего скругления кнопки (border-radius), чтобы блик шёл точно по её кромке.

const PAD = 24;
const TAU = Math.PI * 2;
const SPEED = 0.35;                 // радиан в секунду: оборот по кромке за 2π / 0.35 ≈ 18 с
const START = 0.25;                 // положение блика на кромке (0…1): 0.25 — середина верхней стороны, второй блик напротив — снизу
const INTENSITY = 1, SHINE_SIZE = 10, SHINE_FADE = 34, THICKNESS = 1.2, GLOW = 1;
const LINE = [1, 1, 1], BASE = [0x52 / 255, 0x52 / 255, 0x52 / 255];

const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uCenter;
uniform vec2 uHalf;
uniform float uRadius;
uniform float uPx;
uniform float uSpot;
uniform vec2 uEntry;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform vec2 uWindow;
uniform float uThickness;
uniform float uGlow;
out vec4 outColor;

float roundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float loopPosition(vec2 p, vec2 b, float r) {
  vec2 inner = b - r;
  float arc = 1.5707963 * r;
  float quarter = inner.x + inner.y + arc;
  vec2 a = abs(p);
  vec2 q = a - inner;
  float s = q.x > 0.0 && q.y > 0.0
    ? inner.y + atan(q.y, q.x) * r
    : (q.x > q.y ? min(a.y, inner.y) : inner.y + arc + inner.x - min(a.x, inner.x));
  if (p.x < 0.0) s = p.y >= 0.0 ? 2.0 * quarter - s : 2.0 * quarter + s;
  else if (p.y < 0.0) s = 4.0 * quarter - s;
  return s / max(4.0 * quarter, 0.0001);
}

float lobe(float position, float center) {
  float gap = abs(fract(position - center + 0.5) - 0.5);
  return 1.0 - smoothstep(uWindow.x, uWindow.x + uWindow.y, gap);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = roundedBox(p, uHalf, uRadius);
  float position = loopPosition(p, uHalf, uRadius);
  float key = lobe(position, uSpot);
  float back = lobe(position, uSpot + 0.5);
  float streak = key + back;   // в оригинале второй блик слабее (back * 0.45); по просьбе пользователя оба одинаковые
  float width = max(uThickness * uPx * mix(1.0, max(key, back), 0.6), 0.35);
  float band = smoothstep(-width - 0.6, -width + 0.6, d) * (1.0 - smoothstep(-0.6, 0.6, d));
  float hair = smoothstep(-uPx - 0.6, -uPx + 0.6, d) * (1.0 - smoothstep(-0.6, 0.6, d));
  float inside = 1.0 - smoothstep(-0.6, 0.6, d);
  vec2 pool = (p - uEntry) / (uHalf.y * vec2(1.6, 1.1));
  float glow = streak * 0.2 * exp(-abs(d + width * 0.5) / (5.0 * uPx)) + inside * 0.08 * exp(-dot(pool, pool));
  float light = clamp((band * streak + glow * uGlow) * uIntensity, 0.0, 1.0);
  vec4 base = vec4(uBaseColor, 1.0) * hair * 0.6;
  outColor = vec4(uLineColor, 1.0) * light + base * (1.0 - light);
}`;

const UNIFORMS = ["uCenter", "uHalf", "uRadius", "uPx", "uSpot", "uEntry", "uLineColor", "uBaseColor", "uIntensity", "uWindow", "uThickness", "uGlow"];

const wrap = (v) => v - Math.floor(v);

const rimPoint = (position, halfX, halfY, r) => {
  const innerX = halfX - r, innerY = halfY - r;
  const arc = (Math.PI / 2) * r;
  const quarter = innerX + innerY + arc;
  let s = wrap(position) * 4 * quarter;
  let signX = 1, signY = 1;
  if (s > 3 * quarter) { s = 4 * quarter - s; signY = -1; }
  else if (s > 2 * quarter) { s -= 2 * quarter; signX = -1; signY = -1; }
  else if (s > quarter) { s = 2 * quarter - s; signX = -1; }
  let x = innerX - (s - innerY - arc), y = halfY;
  if (s <= innerY) { x = halfX; y = s; }
  else if (s <= innerY + arc) {
    const angle = (s - innerY) / Math.max(r, 0.0001);
    x = innerX + Math.cos(angle) * r;
    y = innerY + Math.sin(angle) * r;
  }
  return [x * signX, y * signY];
};

const compile = (gl, type, source) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
};

const link = (gl) => {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, "aPosition");
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  gl.deleteProgram(program);
  return null;
};

// У каждого места своя «картинка» (холст и WebGL) по ключу: экраны перерисовывают свои кнопки, а холст переезжает в новую, не создаваясь заново
// (иначе набежал бы десяток контекстов WebGL — у браузера их лимит ~16). Состояние: { canvas, gl, program, uniforms, vao, view, spot, press, raf, last, observer, visObserver, visible, spin, button, radius }
const slots = new Map();

function init() {
  const canvas = document.createElement("canvas");
  canvas.className = "specular-light";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) return null;
  const program = link(gl);
  if (!program) return null;
  const uniforms = {};
  for (const name of UNIFORMS) uniforms[name] = gl.getUniformLocation(program, name);
  const buffer = gl.createBuffer();
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  const spin = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;   // при «уменьшить движение» блики стоят на месте
  return { canvas, gl, program, uniforms, vao, view: { width: 1, height: 1, ratio: 1 }, radius: 18, spot: START, spin, visible: true, button: null,
    press: 0, raf: 0, last: 0, observer: null, visObserver: null };
}

const cornerRadius = (s) => Math.min(s.radius, s.view.width / 2, s.view.height / 2);

function draw(s) {
  const { gl, canvas, uniforms: u, view } = s;
  const { width, height } = view;
  const scaleX = canvas.width / (width + PAD * 2), scaleY = canvas.height / (height + PAD * 2);
  const r = cornerRadius(s), spot = s.spot;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(s.program);
  gl.uniform2f(u.uCenter, (PAD + width / 2) * scaleX, (PAD + height / 2) * scaleY);
  gl.uniform2f(u.uHalf, (width / 2) * scaleX, (height / 2) * scaleY);
  gl.uniform1f(u.uRadius, r * scaleX);
  gl.uniform1f(u.uPx, view.ratio);
  const [rimX, rimY] = rimPoint(spot, width / 2, height / 2, r);
  const pull = 1 - Math.min(0.35 * (height / 2), Math.hypot(rimX, rimY)) / Math.max(Math.hypot(rimX, rimY), 0.0001);
  gl.uniform1f(u.uSpot, spot);
  gl.uniform2f(u.uEntry, rimX * pull * scaleX, rimY * pull * scaleY);
  gl.uniform3fv(u.uLineColor, LINE);
  gl.uniform3fv(u.uBaseColor, BASE);
  gl.uniform1f(u.uIntensity, INTENSITY * (1 + s.press * 0.8));
  gl.uniform2f(u.uWindow, SHINE_SIZE / 360 + s.press * 0.06, SHINE_FADE / 360 + 0.0001);
  gl.uniform1f(u.uThickness, THICKNESS);
  gl.uniform1f(u.uGlow, GLOW);
  gl.bindVertexArray(s.vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
}

function wake(s) {
  if (!s.raf && s.visible) s.raf = requestAnimationFrame((t) => frame(s, t));
}

function frame(s, now) {   // блик бежит по кругу; вспышка при нажатии плавно гаснет (экспонента, 5 в секунду)
  s.raf = 0;
  if (!s.visible || !s.button?.isConnected) { s.last = 0; return; }   // кнопки нет на экране — кадры не тратим
  const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 1 / 60;
  s.last = now;
  if (s.spin) s.spot = wrap(s.spot + (SPEED / TAU) * dt);
  s.press *= Math.exp(-dt * 5);
  draw(s);
  if (s.spin || s.press > 0.002) wake(s);
  else { s.press = 0; s.last = 0; }
}

function measure(s, button) {
  s.view.width = Math.max(1, button.offsetWidth);
  s.view.height = Math.max(1, button.offsetHeight);
  s.view.ratio = Math.min(window.devicePixelRatio || 1, 2);   // не больше 2: на большой карточке при 3 слишком много пикселей на каждый кадр
  s.radius = parseFloat(getComputedStyle(button).borderTopLeftRadius) || 18;
  s.canvas.width = Math.max(1, Math.round((s.view.width + PAD * 2) * s.view.ratio));
  s.canvas.height = Math.max(1, Math.round((s.view.height + PAD * 2) * s.view.ratio));
  draw(s);
}

/** Повесить блик на кнопку или карточку (position: relative); key — своё место ("place", "card"). Без WebGL2 ничего не делает. */
export function attachSpecular(button, key = "default") {
  let s = slots.get(key);
  if (!s) { s = init(); if (!s) return; slots.set(key, s); }
  s.observer?.disconnect();
  s.visObserver?.disconnect();
  cancelAnimationFrame(s.raf); s.raf = 0; s.press = 0; s.last = 0; s.spot = START; s.button = button; s.visible = true;
  button.prepend(s.canvas);
  s.observer = new ResizeObserver(() => { measure(s, button); wake(s); });
  s.observer.observe(button);
  s.visObserver = new IntersectionObserver((entries) => {   // вышла за край экрана или экран скрыт — бег останавливается
    s.visible = entries.some((e) => e.isIntersecting);
    if (s.visible) { s.last = 0; wake(s); }
  });
  s.visObserver.observe(button);
  measure(s, button);
  wake(s);
  button.addEventListener("pointerdown", () => { s.press = 1; wake(s); });
}
