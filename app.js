// Экран Mini App: повторяет поведение настольного виджета (widget.py).
import * as Core from "./core.js?v=9";
import * as Store from "./storage.js?v=9";

// версия страницы: видна внизу настроек — так сразу понятно, загрузилась ли свежая
const APP_VERSION = "2026-11-22.9";
let tgRef = null;
const fsInfo = { supported: null, requested: false, failed: "" };

const params = new URLSearchParams(location.search);
const ASK_DEFAULT = 30;                                 // время на ответ (можно изменить в настройках)
const REVEAL_SEC = Number(params.get("reveal")) || 10;  // сколько показывать ответ до новой фразы
const WRONG_SEC = Number(params.get("wrong")) || 5;     // после неверного ответа — быстрее к новой фразе

const TYPE_RU = {
  idiom: "идиома", proverb: "пословица", "phrasal verb": "фразовый глагол",
  slang: "сленг", conversational: "разговорное", word: "слово",
};

const $ = (id) => document.getElementById(id);
const el = {
  tag: $("tag"), prompt: $("prompt"), entry: $("entry"), status: $("status"), answer: $("answer"),
  example: $("example"), countdown: $("countdown"), timerFill: $("timerFill"), goalNum: $("goalNum"), goalFill: $("goalFill"),
  goalText: document.querySelector(".goaltext"), streakNum: $("streakNum"), streakChip: $("streakChip"), fav: $("favBtn"),
  check: $("checkBtn"), show: $("showBtn"), back: $("backBtn"), next: $("nextBtn"),
  known: $("knownBtn"), easy: $("easyBtn"), normal: $("normalBtn"), hard: $("hardBtn"),
  savedBody: $("savedBody"), invBody: $("invBody"), revBody: $("revBody"), progBody: $("progBody"),
};
const actionBtns = [el.known, el.easy, el.normal, el.hard];

// ---------- огонёк (анимируется стилями, см. .flame в style.css) ----------
const FLAME_PATH = "M12 1.5c.4 3.2-1.6 4.9-3.3 7C7.2 10.4 5.6 12.6 5.6 15.4 5.6 19 8.4 21.6 12 21.6s6.4-2.6 6.4-6.2c0-2.3-1-4.1-2.1-5.6-.1 1.4-.7 2.3-1.7 2.9.3-3.1-.9-6.3-3.6-9.7-.1-.4-.1-.7-.1-1z";
const FLAME = `<svg class="flame" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
  <g class="f1"><path d="${FLAME_PATH}" fill="#ff7a1a" stroke="none"/></g>
  <g class="f2"><path d="${FLAME_PATH}" transform="translate(12 21.6) scale(.68) translate(-12 -21.6)" fill="#ffb524" stroke="none"/></g>
  <g class="f3"><path d="${FLAME_PATH}" transform="translate(12 21.6) scale(.38) translate(-12 -21.6)" fill="#fff0a6" stroke="none"/></g>
</svg>`;

// ---------- мишень с дротиком (попадает в яблочко) и отрывной календарь ----------
const TARGET = `<svg class="ico target" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
  <g class="tgt" stroke="none">
    <circle cx="12" cy="12" r="10" fill="#e5484d"/>
    <circle cx="12" cy="12" r="7.7" fill="#ffffff"/>
    <circle cx="12" cy="12" r="5.4" fill="#e5484d"/>
    <circle cx="12" cy="12" r="3.1" fill="#ffffff"/>
    <circle cx="12" cy="12" r="1.3" fill="#e5484d"/>
  </g>
  <circle class="hit" cx="12" cy="12" r="4" fill="none" stroke="#ffd24a" stroke-width="1.3"/>
  <g class="dart">
    <path d="M12 12L19.4 4.6" stroke="#3b3f4a" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M12 12l1.7-.9-.8-.8z" fill="#9aa0ad" stroke="none"/>
    <path d="M16.6 8.4l-1.4 3 3-1.4zM19.4 4.6l1.9-1.9.6 3.4-3.4.6z" fill="#ffb524" stroke="none"/>
  </g>
</svg>`;

/** Отрывной календарь: верхний листок (вчера) отлетает, под ним сегодняшний. */
function calendarSvg() {
  const day = new Date().getDate(), prev = new Date(Date.now() - 864e5).getDate();
  const sheet = (n) => `<rect x="3" y="4.5" width="18" height="17" rx="3" fill="#f4f5f7" stroke="none"/>
    <path d="M3 7.5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2.5H3z" fill="#e5484d" stroke="none"/>
    <text x="12" y="18.4" text-anchor="middle" font-size="8.6" font-weight="700" fill="#2b2e38" stroke="none"
      font-family="Inter, system-ui, sans-serif">${n}</text>`;
  return `<svg class="ico calendar" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
  <g class="back">${sheet(day)}</g>
  <g class="front">${sheet(prev)}</g>
  <rect x="7" y="2.2" width="2.2" height="4.2" rx="1.1" fill="#8a8f9c" stroke="none"/>
  <rect x="14.8" y="2.2" width="2.2" height="4.2" rx="1.1" fill="#8a8f9c" stroke="none"/>
</svg>`;
}

// ---------- звуки (файлы из виджета) ----------
const sounds = {};
for (const n of ["correct", "error", "next", "back", "fav"]) {
  const a = new Audio(`sounds/${n}.wav`);
  a.preload = "auto";
  sounds[n] = a;
}
function play(name) {
  if (progress && settings().sound === false) return;
  try {
    const a = sounds[name];
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch { /* звук не критичен */ }
}

// ---------- телефон: клавиатура ----------
const touch = window.matchMedia("(pointer: coarse)").matches;
let keepFocus = true; // false — пользователь сам убрал клавиатуру, новые карточки её не вызывают
let maxViewH = 0;

/** Невысокий экран -> сжимаем отступы (классы compact / compact2). В режиме «на весь экран» часть высоты
 *  занимают кнопки Телеграма сверху, поэтому считаем оставшееся место. */
function fit() {
  const cs = getComputedStyle(document.documentElement);
  const px = (name) => parseFloat(cs.getPropertyValue(name)) || 0;
  const fs = document.body.classList.contains("fs");
  const top = fs ? px("--tg-safe-area-inset-top") + (px("--tg-content-safe-area-inset-top") || 44) - 4 : 0;
  const eff = (maxViewH || window.innerHeight) - top;
  document.body.classList.toggle("compact", eff <= 780);
  document.body.classList.toggle("compact2", eff <= 690);
}

function checkKeyboard() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  maxViewH = Math.max(maxViewH, h);
  fit();
  const typing = document.activeElement && document.activeElement.tagName === "INPUT";
  document.body.classList.toggle("kbd", touch && typing && h < maxViewH - 120);
}

// ---------- состояние ----------
let progress, phrases;
let cur = null, direction = "en2ru", revealed = false;
let phase = "ask", nextAt = Infinity, phaseMs = 1;

const recent = () => progress.data.recent;
const settings = () => progress.data.settings || (progress.data.settings = {});
const askSec = () => Number(params.get("ask")) || settings().ask || ASK_DEFAULT;

/** Текст с подсказками: часть в скобках («Снимать (жильё)») выводится мелко и бледно рядом со словом. */
function setHinted(node, text) {
  node.replaceChildren(...text.split(/(\([^)]*\))/).filter(Boolean).map((part) => {
    if (!/^\(.*\)$/.test(part)) return document.createTextNode(part);
    const s = document.createElement("span");
    s.className = "hint";
    s.textContent = part;
    return s;
  }));
}

function showActions(...shown) {
  for (const b of actionBtns) b.hidden = !shown.includes(b);
}

function setStatus(text, kind = "") {
  el.status.textContent = text;
  el.status.className = kind;
}

// ---------- таймер ----------
// Две фазы: "ask" — минута на ответ; потом (или после ответа) "next" — 10 секунд
// показываем правильный ответ и пример, затем приходит новая фраза.
function schedule(seconds, ph) {
  phase = ph;
  phaseMs = seconds * 1000;
  nextAt = Date.now() + phaseMs;
  updateCountdown();
}

function updateCountdown() {
  if (!Number.isFinite(nextAt)) { el.countdown.textContent = ""; el.timerFill.style.width = "0%"; return; }
  const msLeft = Math.max(0, nextAt - Date.now());
  const left = Math.round(msLeft / 1000);
  el.countdown.textContent = phase === "ask"
    ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`
    : `дальше ${left} с`;
  el.timerFill.style.width = `${Math.min(100, (msLeft / phaseMs) * 100)}%`;
}

/** Шапка: цель дня с полоской и серия дней. */
function updateGoal() {
  const n = progress.todayCorrect(), goal = progress.goal(), streak = progress.streak();
  const done = n >= goal;
  el.goalNum.textContent = `${Math.min(n, goal)}/${goal}`; // после достижения цели счёт не растёт: 20/20, а не 21/20
  el.goalFill.style.width = `${Math.min(100, (n / goal) * 100)}%`;
  el.goalText.classList.toggle("done", done);
  el.streakNum.textContent = String(streak);
  el.streakChip.classList.toggle("on", streak > 0);
}

function loop() {
  updateCountdown();
  updateGoal();
  if (Date.now() >= nextAt) onTick();
}

function onTick() {
  if (phase === "ask" && cur !== null && !revealed) {
    if (el.entry.value.trim()) {
      submit(); // успел напечатать, но не нажал Enter: считаем это ответом
    } else {
      // ответа не было: показываем правильный (без штрафа в статистике), потом новая фраза
      reveal(null);
      setStatus("Время вышло. Правильный ответ:", "bad");
    }
    return;
  }
  nextCard();
}

// ---------- карточки ----------
function nextCard() {
  let key;
  if (session) {
    if (session.finished) { schedule(askSec(), "ask"); return; }
    const pool = progress.reviewPool().filter((k) => !session.seen.includes(k));
    if (session.done >= session.total || !pool.length) { finishSession(); return; }
    key = pool[Math.floor(Math.random() * pool.length)];
    session.seen.push(key);
  } else {
    key = progress.pick(recent());
  }
  if (key === null) {
    cur = null;
    schedule(askSec(), "ask");
    setIdle("Все фразы выучены 🎉");
    return;
  }
  progress.data.recent = [...recent(), key].slice(-Core.RECENT_SKIP);
  progress.save();
  show(key, Math.random() < 0.5 ? "en2ru" : "ru2en", false);
}

function back() {
  if (recent().length < 2) return;
  progress.data.recent = recent().slice(0, -1);
  show(recent()[recent().length - 1], direction, true, true);
}

function setIdle(text) {
  el.tag.replaceChildren();
  el.prompt.textContent = text;
  setStatus("");
  el.answer.textContent = "";
  el.example.textContent = "";
  el.entry.value = "";
  el.entry.readOnly = true;
  el.check.hidden = el.show.hidden = true;
  showActions();
}

function show(key, dir, isRevealed) {
  cur = key; direction = dir; revealed = false;
  const p = progress.phrases.get(key);
  const state = progress.state(key);
  const pills = [];
  if (session && !session.finished) pills.push([`Повтор ${session.done + 1}/${session.total}`, "sess"]);
  pills.push([TYPE_RU[p.type] || p.type, ""], [p.level, "lvl"], [dir === "en2ru" ? "EN → RU" : "RU → EN", "mode"]);
  if (state === "learning") pills.push(["↻", "rep"]);
  el.tag.replaceChildren(...pills.map(([text, cls]) => make("span", "pill " + cls, text)));
  el.tag.title = state === "learning" ? "повторение" : "";
  setHinted(el.prompt, dir === "en2ru" ? p.en : p.ru[0]);
  el.entry.readOnly = false;
  el.entry.value = "";
  el.entry.className = "";
  setStatus("");
  el.answer.textContent = "";
  el.example.textContent = "";
  showActions();
  refreshFav();
  if (isRevealed) {
    reveal(null);
  } else {
    el.check.hidden = el.show.hidden = false;
    if (!touch || keepFocus) el.entry.focus({ preventScroll: true });
    schedule(askSec(), "ask");
  }
}

function onEnter() {
  if (cur === null) return;
  if (revealed) nextCard();
  else if (el.entry.value.trim()) submit();
  else giveUp(); // Enter на пустом поле = «не знаю»: показать ответ, засчитать как ошибку
}

function submit() {
  if (cur === null || revealed) return;
  const text = el.entry.value.trim();
  if (!text) return;
  const p = progress.phrases.get(cur);
  // в RU→EN засчитывается главный вариант и синонимы
  const ok = direction === "en2ru"
    ? Core.checkAnswer(text, [...p.ru, ...(p.ru_alt || [])], false) // ru_alt — доп. допустимые ответы (синонимы, формы слова)
    : Core.checkAnswer(text, [p.en, ...p.en_alt], true);
  play(ok ? "correct" : "error");
  reveal(ok);
}

function giveUp() {
  if (cur === null || revealed) return;
  play("error");
  reveal(false);
}

/** ok = null — просто показать (кнопка «Назад» или время вышло), без записи результата. */
function reveal(ok) {
  const p = progress.phrases.get(cur);
  revealed = true;
  schedule(ok === false ? WRONG_SEC : REVEAL_SEC, "next");
  if (direction === "en2ru") {
    setHinted(el.answer, p.ru.slice(0, 3).join(" / "));
  } else {
    setHinted(el.answer, p.en + (p.en_alt.length ? `  (также: ${p.en_alt.slice(0, 2).join(", ")})` : ""));
  }
  el.example.textContent = `${p.example_en}\n${p.example_ru}`;
  el.entry.readOnly = true; // не disabled: так на телефоне не закрывается клавиатура
  el.check.hidden = el.show.hidden = true;

  if (ok === null) { setStatus(""); return; }
  el.entry.className = ok ? "ok" : "bad";
  const before = progress.state(cur);
  const state = progress.record(cur, ok);
  if (session && !session.finished) { session.done += 1; session.correct += ok ? 1 : 0; }
  const todayBefore = progress.todayCorrect();
  progress.logAnswer(ok);
  updateGoal();
  if (ok && todayBefore < progress.goal() && progress.todayCorrect() >= progress.goal()) celebrate();
  if (state === "mastered") {
    setStatus(`Верно! ${Core.NEEDED_STREAK} подряд — фраза выучена навсегда`, "ok");
  } else if (state === "learning" && before === "new") {
    setStatus("Верно! Фраза пошла в повторения (проверим через час)", "ok");
  } else if (state === "learning") {
    const streak = progress.cards[cur].streak;
    setStatus(ok ? `Верно! Серия: ${streak} из ${Core.NEEDED_STREAK}`
                 : "Неверно. Серия сброшена, фраза скоро вернётся", ok ? "ok" : "bad");
  } else {
    setStatus(ok ? "Верно!" : "Неверно. Фраза скоро вернётся", ok ? "ok" : "bad");
  }
  // после неверного ответа кнопок нет; верный на новой фразе — «Уже знал»;
  // верный на повторении — оценка, которая сдвигает срок следующей проверки
  if ((before === "unseen" || before === "new") && ok) showActions(el.known);
  else if (before === "learning" && ok && state === "learning") showActions(el.easy, el.normal, el.hard);
}

function onRate(rating) {
  if (!cur) return;
  progress.rate(cur, rating);
  nextCard();
}

function onKnown() {
  if (!cur) return;
  progress.markKnown(cur);
  nextCard();
}

function refreshFav(animate = false) {
  el.fav.classList.toggle("instant", !animate);   // анимация заливки — только при нажатии на звезду
  el.fav.classList.toggle("on", !!(cur && progress.isFav(cur)));
}

const TOAST_KIND = {
  word: "Слово", slang: "Слово", idiom: "Идиома", "phrasal verb": "Глагол", proverb: "Пословица", conversational: "Фраза",
};

function toggleFav() {
  if (!cur) return;
  play("fav");
  const on = progress.toggleFav(cur);
  refreshFav(true);
  if (on) {
    // в описании нет самой фразы: в режиме RU→EN она выдала бы ответ — только её вид (слово, идиома…)
    const key = cur;
    const kind = TOAST_KIND[progress.phrases.get(key)?.type] || "Фраза";
    showToast({
      title: "Добавлено в закладки", description: `${kind} в «Закладках»`, actionLabel: "Отменить",
      onAction: () => { progress.toggleFav(key); refreshFav(true); },
    });
  } else {
    hideToast();
  }
}

// ---------- всплывающее окно ----------
// Точный перенос компонента SwipeToast (React Bits, версия JS+CSS) на обычный JS; стили — в style.css (.swipe-toast).
// Параметры из примера: slideMs 400, settleBounce 0.2, swipeDistance 40, duration 4000, fuse bottom, pauseOnHover.
// Единственное отличие от оригинала — вид кнопки «Отменить» (под стиль приложения).
const ST = {
  ease: "cubic-bezier(0.23, 1, 0.32, 1)", flick: 0.11, dead: 3, resist: 24, exit: 0.7,
  slideMs: 400, bounce: 0.2, swipe: 40, duration: 2000,
};
let toast = null;

const rubberband = (over, dim, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));
const velocityOf = (hist) => {
  if (hist.length < 2) return 0;
  const [t0, y0] = hist[0];
  const [t1, y1] = hist[hist.length - 1];
  return performance.now() - t1 > 100 ? 0 : (y1 - y0) / Math.max(1, t1 - t0);
};

/** Пружина (как type:"spring" в библиотеке motion): duration — «видимая» длительность, bounce — отскок. */
function runSpring(from, to, duration, bounce, v0, onTick, onDone) {
  const w = (2 * Math.PI) / duration, z = 1 - bounce;
  let x = from - to, v = v0, last = performance.now(), raf = 0;
  const step = (now) => {
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    const n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
    for (let i = 0; i < n; i++) { v += (-w * w * x - 2 * z * w * v) * h; x += v * h; }
    if (Math.abs(x) < 0.3 && Math.abs(v) < 5) { onTick(to); onDone?.(); return; }
    onTick(to + x);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

function hideToast(why = "programmatic") { toast?.close(why); }

function showToast({ title, description = "", actionLabel = "", onAction, onClose, duration = ST.duration }) {
  toast?.destroy();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let phase = "open", leaving = false, drag = null, pendingClose = null, closeTimer = 0;
  let stopSpring = null, fadeAnim = null, burn = null, lastInput = "pointer", y = 0;
  const flags = { hover: false, interacting: false, focus: false, hidden: document.hidden };

  // --- разметка (как в SwipeToast.jsx) ---
  const root = make("div", "swipe-toast");
  root.dataset.phase = "open";
  root.dataset.mounted = "false";
  root.dataset.fuse = duration > 0 ? "bottom" : "none";
  const lift = make("div", "swipe-toast__lift");
  const card = make("div", "swipe-toast__card");
  card.setAttribute("role", "status");
  card.setAttribute("aria-live", "polite");
  card.setAttribute("aria-atomic", "true");
  card.tabIndex = 0;
  const body = make("span", "swipe-toast__body");
  body.append(make("span", "swipe-toast__title", title));
  if (description) body.append(make("span", "swipe-toast__desc", description));
  card.append(body);
  if (actionLabel) {
    const act = make("button", "btn swipe-toast__action", actionLabel);
    act.type = "button";
    act.addEventListener("click", () => { onAction?.(); close("action"); });
    card.append(act);
  }
  const fuseEl = make("i", "swipe-toast__fuse");
  fuseEl.setAttribute("aria-hidden", "true");
  card.append(fuseEl);
  lift.append(card);
  const gate = make("div", "swipe-toast__gate");
  gate.append(lift);
  root.append(gate);

  // окно стоит над нижней панелью (если панель спрятана клавиатурой — у нижнего края)
  const bar = $("bar"), br = bar.getBoundingClientRect();
  root.style.bottom = getComputedStyle(bar).display !== "none" && br.height
    ? `${window.innerHeight - br.top + 10}px`
    : "calc(16px + env(safe-area-inset-bottom, 0px))";
  document.body.append(root);
  void lift.offsetHeight;                       // чтобы выезд проигрался
  root.dataset.mounted = "true";

  // --- «фитиль» ---
  const syncFuse = () => {
    if (!burn) return;
    if (flags.hover || flags.interacting || flags.focus || flags.hidden) burn.pause();
    else if (burn.playState === "paused") burn.play();
  };
  const startFuse = () => {
    if (duration <= 0) return;
    burn?.cancel();
    burn = fuseEl.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }],
      { duration, easing: "linear", fill: "forwards" });
    burn.onfinish = () => close("timeout");
    syncFuse();
  };

  const setPhase = (p) => { phase = p; root.dataset.phase = p; };
  const setY = (v) => { y = v; card.style.transform = `translateY(${v}px)`; };
  const onVis = () => { flags.hidden = document.hidden; syncFuse(); };
  document.addEventListener("visibilitychange", onVis);

  function cleanup() {
    clearTimeout(closeTimer);
    stopSpring?.();
    burn?.cancel();
    document.removeEventListener("visibilitychange", onVis);
    root.remove();
    if (toast === api) toast = null;
  }
  function finish(why) {
    setPhase("gone");
    leaving = false;
    cleanup();
    onClose?.(why);
  }
  function close(why) {
    if (phase !== "open" || leaving) return;
    if (drag) { pendingClose = why; return; }
    burn?.pause();
    const now = why === "escape" || ((why === "action" || why === "close") && lastInput === "keyboard");
    if (now) root.setAttribute("data-instant", "");
    setPhase("closing");
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => finish(why), now ? 0 : ST.slideMs * ST.exit + 60);
  }
  function rescue() {
    clearTimeout(closeTimer);
    root.removeAttribute("data-instant");
    setY(0);
    card.style.opacity = "";
    setPhase("open");
    startFuse();
  }
  function swipeOut(dy, v) {
    burn?.pause();
    leaving = true;
    pendingClose = null;
    if (!reduce) stopSpring = runSpring(dy, dy + card.offsetHeight, 0.3, 0, v * 1000, setY);
    fadeAnim = card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: ST.ease, fill: "forwards" });
    fadeAnim.onfinish = () => finish("swipe");
  }

  // --- мышь, касание, клавиатура ---
  card.addEventListener("pointerdown", (e) => {
    lastInput = "pointer";
    if (e.button !== 0 || drag || leaving || e.target.closest("button")) return;
    if (phase === "closing") rescue();
    try { card.setPointerCapture(e.pointerId); } catch { /* не страшно */ }
    stopSpring?.();
    drag = { id: e.pointerId, startY: e.clientY, grab: null, moved: false, hist: [[performance.now(), y]] };
    flags.interacting = true;
    syncFuse();
  });
  card.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    if (drag.grab === null) {
      if (Math.abs(e.clientY - drag.startY) < ST.dead) return;
      drag.grab = e.clientY - y;
      card.dataset.swiping = "";
    }
    const raw = e.clientY - drag.grab;
    const next = raw >= 0 ? raw : rubberband(raw, ST.resist);
    setY(next);
    drag.moved = true;
    drag.hist.push([performance.now(), next]);
    if (drag.hist.length > 4) drag.hist.shift();
  });
  const onUp = (e) => {
    const d = drag;
    if (!d || d.id !== e.pointerId) return;
    drag = null;
    delete card.dataset.swiping;
    try { card.releasePointerCapture(e.pointerId); } catch { /* не страшно */ }
    flags.interacting = false;
    const dy = y, v = velocityOf(d.hist);
    if (dy > 0 && (v > ST.flick || (dy >= ST.swipe && v >= 0))) { swipeOut(dy, v); return; }
    if (d.moved) {
      stopSpring = reduce ? runSpring(dy, 0, 0.2, 0, 0, setY)
        : runSpring(dy, 0, 0.5, ST.bounce, v * 1000, setY);
    }
    const queued = pendingClose;
    pendingClose = null;
    if (queued) close(queued); else syncFuse();
  };
  card.addEventListener("pointerup", onUp);
  card.addEventListener("pointercancel", onUp);
  card.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { flags.hover = true; syncFuse(); } });
  card.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") { flags.hover = false; syncFuse(); } });
  card.addEventListener("focusin", () => { flags.focus = true; syncFuse(); });
  card.addEventListener("focusout", (e) => {
    if (!card.contains(e.relatedTarget)) { flags.focus = false; syncFuse(); }
  });
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") lastInput = "keyboard";
    if (e.key === "Escape") { e.stopPropagation(); close("escape"); }
  });

  startFuse();
  const api = { close, destroy: () => { cleanup(); } };
  toast = api;
}

// ---------- нижняя панель: Учить / Повтор / Закладки / Инвентарь / Прогресс ----------
const VIEWS = ["learn", "rev", "saved", "inv", "prog"];
let view = "learn";
let invTab = "hard";
let calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

let swapTimer = null;

/** Завершить переход: убрать служебные классы, оставить видимым только текущий экран. */
function finishSwap() {
  clearTimeout(swapTimer);
  for (const v of VIEWS) {
    const e = $(v);
    e.classList.remove("leaving", "entering", "to-r", "to-l", "from-r", "from-l");
    e.hidden = v !== view;
  }
}

/** Переключить вкладку: старый экран плавно уходит в сторону, новый приезжает; белая заливка на кнопке идёт параллельно. */
function showView(name) {
  const prev = view;
  finishSwap(); // если прошлый переход ещё идёт (быстрые нажатия) — сразу завершаем его
  view = name;
  for (const b of document.querySelectorAll(".tabbtn")) b.classList.toggle("on", b.dataset.view === name);
  if (name === "rev") renderRev();
  if (name === "saved") renderSaved();
  if (name === "inv") renderInv();
  if (name === "prog") renderProg();
  const still = name === prev || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (still) {
    finishSwap();
    window.scrollTo(0, 0);
    return;
  }
  const dir = VIEWS.indexOf(name) > VIEWS.indexOf(prev) ? "r" : "l"; // куда «едем»: вправо или влево
  window.scrollTo(0, 0);
  $(prev).classList.add("leaving", "to-" + dir);
  $(name).hidden = false;
  $(name).classList.add("entering", "from-" + dir);
  swapTimer = setTimeout(finishSwap, 340);
}

function make(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function emptyNote(text) { return make("div", "empty", text); }

const SIDE = {
  hard: (c) => (c.misses ? `ошибок: ${c.misses}` : "трудно"),
  learning: (c) => (c.state === "new" ? "видел" : `серия ${c.streak} из ${Core.NEEDED_STREAK}`),
  mastered: () => "выучено",
  known: () => "знал",
};

/** Список фраз: в закладках — крестик «убрать», в остальных — подпись справа. */
function renderList(body, keys, kind, emptyText) {
  body.replaceChildren();
  if (!keys.length) { body.append(emptyNote(emptyText)); return; }
  const LIMIT = 300;
  for (const key of keys.slice(0, LIMIT)) {
    const row = make("div", "item");
    const txt = make("div", "txt");
    txt.append(make("div", "en", key), make("div", "ru", progress.phrases.get(key).ru.slice(0, 2).join(" / ")));
    row.append(txt);
    if (kind === "saved") {
      const rm = make("button", "rm");
      rm.setAttribute("aria-label", "Убрать из закладок");
      rm.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      rm.addEventListener("click", () => {
        progress.toggleFav(key);
        refreshFav();
        renderSaved();
      });
      row.append(rm);
    } else {
      row.append(make("div", "side", SIDE[kind](progress.cards[key])));
    }
    body.append(row);
  }
  if (keys.length > LIMIT) body.append(emptyNote(`Показано ${LIMIT} из ${keys.length}. Уточните поиск.`));
}

function renderSaved() {
  renderList(el.savedBody, progress.favorites(), "saved",
    "Пока пусто.\nНажмите звёздочку на карточке,\nчтобы сохранить фразу сюда.");
}

// --- Инвентарь: все слова по состояниям, с поиском ---
const INV_EMPTY = {
  hard: "Трудных слов пока нет.\nОни появятся, если вы часто\nошибаетесь или нажмёте «Трудно».",
  learning: "Здесь будут слова, которые вы\nсейчас учите.",
  mastered: "Выученных слов пока нет.\nСлово считается выученным после\nтрёх верных ответов подряд.",
  known: "Слов с отметкой «Уже знал» пока нет.",
};

function invKeys(tab) {
  if (tab === "hard") return progress.hardCards();
  if (tab === "learning") return progress.keysByState("new", "learning");
  return progress.keysByState(tab);
}

function renderInv() {
  for (const b of document.querySelectorAll(".segbtn")) b.classList.toggle("on", b.dataset.tab === invTab);
  const q = $("invSearch").value.trim().toLowerCase();
  let keys = invKeys(invTab);
  if (q) {
    keys = keys.filter((k) => k.toLowerCase().includes(q)
      || progress.phrases.get(k).ru.some((r) => r.toLowerCase().includes(q)));
  }
  renderList(el.invBody, keys, invTab, q ? "Ничего не найдено." : INV_EMPTY[invTab]);
}

// --- Повтор: короткая сессия из «трудных» и тех, у кого подошёл срок ---
const SESSION_SIZE = 10;
let session = null; // { total, done, correct, seen, finished }

function panel(title, text, buttons) {
  const p = make("div", "panel");
  p.append(make("div", "big", title));
  if (text) p.append(make("p", "", text));
  for (const [label, primary, fn] of buttons) {
    const b = make("button", "btn wide" + (primary ? " primary" : ""), label);
    b.addEventListener("click", fn);
    p.append(b);
  }
  return p;
}

function renderRev() {
  const body = el.revBody;
  body.replaceChildren();
  if (session && !session.finished) {
    body.append(panel(`Идёт повтор: ${session.done} из ${session.total}`,
      "Отвечайте на карточки во вкладке «Учить».",
      [["Продолжить", true, () => showView("learn")], ["Закончить повтор", false, endSession]]));
  } else if (session) {
    body.append(panel("Готово!", `Верных ответов: ${session.correct} из ${session.done}.`,
      [["Ещё раз", true, startReview], ["К обычным карточкам", false, endSession]]));
  } else {
    const hard = progress.hardCards().length;
    const pool = progress.reviewPool().length;
    body.append(panel(pool ? `К повторению: ${pool}` : "Повторять пока нечего",
      pool ? `Трудные слова и те, у которых подошёл срок проверки. В сессии — до ${SESSION_SIZE} карточек.\nТрудных: ${hard}.`
           : "Когда подойдёт срок проверки или появятся трудные слова, они будут здесь.",
      pool ? [["Начать", true, startReview]] : []));
  }
}

function startReview() {
  const pool = progress.reviewPool();
  if (!pool.length) return;
  session = { total: Math.min(SESSION_SIZE, pool.length), done: 0, correct: 0, seen: [], finished: false };
  showView("learn");
  nextCard();
}

function finishSession() {
  session.finished = true;
  cur = null;
  schedule(askSec(), "ask");
  setIdle("Повтор закончен");
  showView("rev");
}

function endSession() {
  session = null;
  showView("learn");
  nextCard();
}

// --- Прогресс: цифры и календарь ---
function renderProg() {
  const body = el.progBody;
  body.replaceChildren();
  const acc = progress.accuracy(), s = progress.stats();
  const done = progress.todayCorrect() >= progress.goal();

  const tiles = make("div", "tiles");
  const streak = progress.streak();
  // у каждой плитки: главный текст по центру, подпись ниже, а позади — большой полупрозрачный анимированный значок
  for (const [num, label, gold, icon, cls] of [
    [`${Math.min(progress.todayCorrect(), progress.goal())}/${progress.goal()}`, "сегодня", false, calendarSvg(), "calicon"],
    [String(streak), streak % 10 === 1 && streak % 100 !== 11 ? "день подряд" : "дней подряд", done, FLAME,
      "flamebg" + (streak > 0 ? " on" : "")],
    [acc !== null ? `${acc}%` : "—", "точность", false, TARGET, "targeticon"],
  ]) {
    const tile = make("div", "tile" + (gold ? " gold" : ""));
    const bg = make("span", "bgicon " + cls);
    bg.innerHTML = icon;
    tile.append(bg, make("b", "", num), make("span", "lbl", label));
    tiles.append(tile);
  }
  body.append(tiles);

  const cal = make("div", "panel");
  const head = make("div", "calhead");
  const prev = make("button", "", "‹"), next = make("button", "", "›");
  prev.setAttribute("aria-label", "Предыдущий месяц");
  next.setAttribute("aria-label", "Следующий месяц");
  prev.style.fontSize = next.style.fontSize = "26px";
  const title = calMonth.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }).replace(/\s*г\.$/, "");
  head.append(prev, make("span", "", title[0].toUpperCase() + title.slice(1)), next);
  const nowMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  next.disabled = calMonth >= nowMonth;
  next.style.opacity = next.disabled ? ".3" : "1";
  prev.addEventListener("click", () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderProg(); });
  next.addEventListener("click", () => {
    if (!next.disabled) { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderProg(); }
  });
  const grid = make("div", "cal");
  for (const w of ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]) grid.append(make("div", "wd", w));
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  for (let i = 0; i < (new Date(y, m, 1).getDay() + 6) % 7; i++) grid.append(make("div"));
  const today = Core.dayKey(new Date());
  for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) {
    const day = new Date(y, m, d, 12), info = progress.dayInfo(day);
    let cls = "d";
    if (info.correct >= progress.goal()) cls += " goal";
    else if (info.answered > 0) cls += " some";
    if (Core.dayKey(day) === today) cls += " today";
    grid.append(make("div", cls, String(d)));
  }
  cal.append(head, grid, make("p", "", `Белым отмечены дни, когда выполнена цель (${progress.goal()} верных ответов).`));
  body.append(cal);

  body.append(make("div", "stats",
    `Трудных слов: ${progress.hardCards().length}\n\n` +
    `Ещё не показывались: ${s.unseen}\n` +
    `Видел, но не выучил: ${s.new}\n` +
    `Учу (проверки): ${s.learning}\n` +
    `Выучено (3 подряд): ${s.mastered}\n` +
    `Уже знал: ${s.known}`));
}

// ---------- конфетти: цель дня достигнута, огонёк «загорелся» ----------
const CONFETTI_COLORS = ["#ffffff", "#ffd24a", "#ff9a1f", "#ff6a1a", "#e5484d", "#dfe1e6"];
const CONFETTI_SECONDS = 3.9;

function confettiPiece(x, y, vx, vy, g, drag) {
  return {
    x, y, vx, vy, g, drag,
    w: 5 + Math.random() * 6, h: 3 + Math.random() * 5,
    flip: Math.random() * 6.28, vflip: 5 + Math.random() * 9, rot: Math.random() * 6.28, vrot: (Math.random() - 0.5) * 9,
    c: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)], round: Math.random() < 0.25,
  };
}

/** Конфетти на весь экран: взрыв из точки (x, y) и «дождь» сверху; холст сам исчезает через ~4 секунды. */
function confetti(x, y) {
  const cv = document.createElement("canvas");
  cv.className = "confetti";
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth, H = window.innerHeight;
  cv.width = W * dpr;
  cv.height = H * dpr;
  document.body.append(cv);
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  const parts = [];
  for (let i = 0; i < 110; i++) { // взрыв во все стороны из огонька
    const a = Math.random() * Math.PI * 2, sp = 260 + Math.random() * 560;
    parts.push(confettiPiece(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 1000, 0.9));
  }
  for (let i = 0; i < 120; i++) { // дождь: стартует выше экрана в разное время, плавно падает по всей ширине
    parts.push(confettiPiece(Math.random() * W, -Math.random() * H * 0.7 - 10, (Math.random() - 0.5) * 90,
      60 + Math.random() * 160, 420, 1.6));
  }
  const t0 = performance.now();
  let last = t0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    const alpha = Math.max(0, Math.min(1, (CONFETTI_SECONDS - t) / 0.9));
    for (const p of parts) {
      p.vx *= 1 - 1.2 * dt;
      p.vy = p.vy * (1 - p.drag * dt) + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.flip += p.vflip * dt; p.rot += p.vrot * dt;
      if (p.y > H + 20) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.c;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.flip)); // переворот: бумажка поблёскивает ребром
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, 6.283); ctx.fill(); }
      else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (t < CONFETTI_SECONDS) requestAnimationFrame(frame);
    else cv.remove();
  }
  requestAnimationFrame(frame);
}

/** Цель дня выполнена: огонёк в шапке подпрыгивает, из него вылетает конфетти. */
function celebrate() {
  const chip = el.streakChip;
  chip.classList.remove("pop");
  void chip.offsetWidth; // перезапуск анимации
  chip.classList.add("pop");
  setTimeout(() => chip.classList.remove("pop"), 1100);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = chip.getBoundingClientRect();
  confetti(r.width ? r.left + r.width / 2 : window.innerWidth / 2, r.height ? r.top + r.height / 2 : 60);
}

// ---------- настройки и выбор цели ----------
const sheetEl = $("sheet"), sheetBox = $("sheetBox");

function sheetOpen(build, closable) {
  sheetBox.replaceChildren();
  build(sheetBox);
  sheetEl.dataset.closable = closable ? "1" : "";
  sheetEl.hidden = false;
}
const sheetClose = () => { sheetEl.hidden = true; };

/** Ряд кнопок-переключателей: options = [[значение, подпись], ...]. */
function segRow(options, current, onPick) {
  const seg = make("div", "seg");
  for (const [value, label] of options) {
    const b = make("button", "segbtn" + (value === current ? " on" : ""), label);
    b.addEventListener("click", () => onPick(value));
    seg.append(b);
  }
  return seg;
}

function setRow(label, control) {
  const r = make("div", "setrow");
  r.append(make("label", "", label), control);
  return r;
}

const GOALS = [10, 20, 30];

/** Мелкая строка внизу настроек: какая версия страницы и что ответил Телеграм про полный экран. */
function diagText() {
  const tg = tgRef;
  let fs;
  if (!tg) fs = "вне Телеграма";
  else if (tg.isFullscreen) fs = "включён";
  else if (!["android", "ios"].includes(tg.platform)) fs = "только на телефонах";
  else if (!fsInfo.supported) fs = "не поддерживается этой версией Телеграма";
  else fs = fsInfo.failed ? `отказ: ${fsInfo.failed}` : fsInfo.requested ? "запрошен, ответа нет" : "не запрошен";
  const where = tg ? `Telegram ${tg.version || "?"}, ${tg.platform || "?"}` : "браузер";
  return `Версия страницы ${APP_VERSION} · ${where} · полный экран: ${fs}`;
}

function openSettings() {
  sheetOpen((box) => {
    box.append(make("h2", "", "Настройки"));
    box.append(setRow("Цель на день (верных ответов)",
      segRow(GOALS.map((n) => [n, String(n)]), progress.goal(), (n) => {
        progress.data.goal = n; progress.save(); updateGoal(); openSettings();
      })));
    box.append(setRow("Звук",
      segRow([[true, "Вкл"], [false, "Выкл"]], settings().sound !== false, (v) => {
        settings().sound = v; progress.save(); openSettings();
      })));
    box.append(setRow("Время на ответ (с)",
      segRow([20, 30, 45, 60].map((n) => [n, String(n)]), settings().ask || ASK_DEFAULT, (n) => {
        settings().ask = n; progress.save(); openSettings();
      })));
    box.append(make("p", "", "Время начнёт действовать со следующей карточки. Цель дня учитывается и в календаре за прошлые дни."));
    const done = make("button", "btn primary wide", "Готово");
    done.addEventListener("click", sheetClose);
    box.append(done);
    box.append(make("p", "diag", diagText()));
  }, true);
}

/** Первый запуск: выбрать цель на день. */
function openWelcome(then) {
  sheetOpen((box) => {
    box.append(make("h2", "", "Цель на день"));
    box.append(make("p", "", "Сколько верных ответов в день вы хотите давать? Выполнили цель — дни считаются в серию. Потом это можно изменить в настройках (шестерёнка вверху)."));
    const pick = make("div", "goalpick");
    for (const n of GOALS) {
      const b = make("button", "btn" + (n === 20 ? " primary" : ""));
      b.append(String(n), make("small", "", n === 10 ? "спокойно" : n === 20 ? "рекомендуем" : "упорно"));
      b.addEventListener("click", () => {
        progress.data.goal = n;
        progress.save();
        sheetClose();
        then();
      });
      pick.append(b);
    }
    box.append(pick);
  }, false);
}

// ---------- запуск ----------
async function boot() {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    try { tg.setHeaderColor("#05060d"); tg.setBackgroundColor("#05060d");
      if (tg.setBottomBarColor) tg.setBottomBarColor("#05060d"); } catch { /* старый клиент */ }
    try { tg.disableVerticalSwipes(); } catch { /* старый клиент */ }
    // на телефоне — на весь экран, как у других мини-приложений; кнопки «закрыть» и «…» тогда рисует сам Телеграм
    // поверх страницы, а серия 🔥 переезжает в верхнюю полосу между ними
    const applyFullscreen = () => {
      const fs = !!tg.isFullscreen, chip = $("streakChip"), top = $("topbar");
      document.body.classList.toggle("fs", fs);
      top.hidden = !fs;
      if (fs) top.append(chip);
      else document.querySelector(".hdr").insertBefore(chip, $("settingsBtn"));
    };
    const refit = () => { applyFullscreen(); fit(); };
    tg.onEvent("fullscreenChanged", refit);
    tg.onEvent("safeAreaChanged", fit);
    tg.onEvent("contentSafeAreaChanged", fit);
    tgRef = tg;
    const wantFs = ["android", "ios"].includes(tg.platform);
    try { fsInfo.supported = tg.isVersionAtLeast("8.0"); } catch { fsInfo.supported = false; }
    tg.onEvent("fullscreenFailed", (p) => { fsInfo.failed = String((p && p.error) || "ошибка"); });
    const tryFullscreen = () => {
      if (!wantFs || !fsInfo.supported || tg.isFullscreen) return;
      try { fsInfo.requested = true; tg.requestFullscreen(); } catch (e) { fsInfo.failed = String((e && e.message) || e); }
    };
    tryFullscreen();
    // некоторые клиенты принимают запрос только после касания пользователя — повторяем один раз
    document.addEventListener("pointerdown", tryFullscreen, { once: true });
    applyFullscreen();
    fit();
  }
  const [list, aspect, saved] = await Promise.all([
    fetch("data/phrases.json").then((r) => r.json()),
    fetch("data/aspect.json").then((r) => r.json()),
    Store.load(),
  ]);
  phrases = list;
  Core.setAspect(aspect);
  progress = new Core.Progress(phrases, saved, Store.save);
  if (Store.usingCloud) Store.save(progress.data); // если локальная копия была новее — подтянуть облако

  el.check.addEventListener("click", submit);
  el.show.addEventListener("click", giveUp);
  el.back.addEventListener("click", () => { play("back"); back(); });
  el.next.addEventListener("click", () => { play("next"); nextCard(); }); // звук «Дальше» — только по клику
  el.known.addEventListener("click", onKnown);
  el.easy.addEventListener("click", () => onRate("easy"));
  el.normal.addEventListener("click", () => onRate("normal"));
  el.hard.addEventListener("click", () => onRate("hard"));
  el.fav.addEventListener("click", toggleFav);
  for (const b of document.querySelectorAll(".tabbtn")) b.addEventListener("click", () => showView(b.dataset.view));
  for (const b of document.querySelectorAll(".segbtn")) {
    b.addEventListener("click", () => { invTab = b.dataset.tab; renderInv(); });
  }
  $("invSearch").addEventListener("input", renderInv);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && view === "learn") { e.preventDefault(); onEnter(); }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) Store.flush();
    else loop();
  });
  window.addEventListener("pagehide", Store.flush);

  $("settingsBtn").addEventListener("click", openSettings);
  sheetEl.addEventListener("click", (e) => { if (e.target === sheetEl && sheetEl.dataset.closable) sheetClose(); });

  // телефон: тап по пустому месту убирает клавиатуру; пока печатают, панель вкладок прячется
  el.entry.addEventListener("pointerdown", () => { keepFocus = true; });
  document.addEventListener("click", (e) => {
    if (!touch || e.target.closest("input, button, .item, .sheetbox")) return;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    keepFocus = false;
    checkKeyboard();
  });
  for (const ev of ["focusin", "focusout"]) document.addEventListener(ev, () => setTimeout(checkKeyboard, 50));
  window.addEventListener("resize", checkKeyboard);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", checkKeyboard);
  if (tg) tg.onEvent("viewportChanged", checkKeyboard);
  checkKeyboard();

  for (const s of document.querySelectorAll(".flame-slot")) s.innerHTML = FLAME;
  updateGoal();
  setInterval(loop, 250);
  const firstRun = progress.data.goal == null && Object.keys(progress.cards).length === 0;
  if (firstRun) openWelcome(nextCard);
  else nextCard();
}

boot();
