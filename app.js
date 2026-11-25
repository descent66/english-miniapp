// Экран Mini App: повторяет поведение настольного виджета (widget.py).
import * as Core from "./core.js?v=27";
import * as Store from "./storage.js?v=27";
import { startMolten } from "./molten.js?v=27";
import { attachSpecular, detachSpecular } from "./specular.js?v=27";
import { animateList } from "./animlist.js?v=27";
import { initTenses, fitBlanks, MASTERED } from "./tenses.js?v=27";
import { checkKey, askWithFallback, googleMessage, richLines, toBase64, KEY_PAGE, MAX_FILES, MAX_PDF_BYTES, FILE_QUESTION, LEVELS as AI_LEVELS, DEFAULT_LEVEL as AI_DEFAULT } from "./ai.js?v=27";
import { translate, recognizeText, guessDir, prepareImage, TranslateError, MAX_CHARS } from "./translator.js?v=27";
import { GROUP_TITLES, GAMES, recordAnswer, recordRound, recordExplored, checkAchievements, achievementStatus, initAchSeen, unseenAchievements, markAchievementsSeen, initProgSeen, progressChange, markProgressSeen } from "./achievements.js?v=27";

// версия страницы: видна внизу настроек — так сразу понятно, загрузилась ли свежая
const APP_VERSION = "2026-11-25.27";
let tgRef = null;
const fsInfo = { supported: null, requested: false, failed: "" };

const params = new URLSearchParams(location.search);
const ASK_DEFAULT = 30;                                 // время на ответ (можно изменить в настройках)
const ASK_MIN = 5, ASK_MAX = 60;                       // границы ползунка «Время на ответ», секунды
const redLead = Core.redLead;                         // за сколько секунд до конца таймер краснеет (зависит от длины таймера)
const REVEAL_SEC = Number(params.get("reveal")) || 10;  // сколько показывать ответ до новой фразы
const WRONG_SEC = Number(params.get("wrong")) || 5;     // после неверного ответа — быстрее к новой фразе

const TYPE_RU = {
  idiom: "идиома", proverb: "пословица", "phrasal verb": "фразовый глагол",
  slang: "сленг", conversational: "разговорное", word: "слово",
};

const $ = (id) => document.getElementById(id);
const el = {
  tag: $("tag"), prompt: $("prompt"), entry: $("entry"), status: $("status"), answer: $("answer"),
  example: $("example"), countdown: $("countdown"), timerFill: $("timerFill"), timerBox: document.querySelector(".timer"), goalNum: $("goalNum"), goalFill: $("goalFill"),
  goalText: document.querySelector(".goaltext"), streakNum: $("streakNum"), streakChip: $("streakChip"), fav: $("favBtn"), mode: $("modeBtn"),
  check: $("checkBtn"), show: $("showBtn"), back: $("backBtn"), next: $("nextBtn"), hintBtn: $("hintBtn"),
  known: $("knownBtn"), easy: $("easyBtn"), normal: $("normalBtn"), hard: $("hardBtn"),
  gamesBody: $("gamesBody"), invBody: $("invBody"), revBody: $("revBody"), progBody: $("progBody"),
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

// ---------- значки позади текста уведомлений (как огонёк/мишень/календарь на плитках «Прогресса») ----------
/** 📁 «Добавлено в закладки»: папка приоткрывается, из неё выглядывает листок. */
const FOLDER = `<svg class="folder" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M2.5 6.7a2 2 0 0 1 2-2h4.6l2 2.2h8.4a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2z" fill="#e39a12" stroke="none"/>
  <rect class="paper" x="5.2" y="7.6" width="13.6" height="9" rx="1.2" fill="#f4f5f7" stroke="none"/>
  <path class="front" d="M2.5 11.3a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2z" fill="#ffc933" stroke="none"/>
</svg>`;
/** 🏆 «Новое достижение»: золотой кубок слегка подпрыгивает и блестит. */
const TROPHY = `<svg class="trophy" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M7.2 5.2H4.4v1.8a3.6 3.6 0 0 0 3.6 3.6M16.8 5.2h2.8v1.8a3.6 3.6 0 0 1-3.6 3.6" fill="none" stroke="#e5a321" stroke-width="1.6"/>
  <path d="M7 3.6h10v5.4a5 5 0 0 1-10 0z" fill="#ffd24a" stroke="none"/>
  <path d="M10.6 13.8h2.8V17h-2.8z" fill="#e5a321" stroke="none"/>
  <rect x="7.6" y="17" width="8.8" height="3" rx="1.2" fill="#ffd24a" stroke="none"/>
  <path class="shine" d="M9.4 5.2v3.6" stroke="#fff6cf" stroke-width="1.4" fill="none"/>
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

// ---------- звуки (correct, error, next — файлы из виджета; fill, ping, leaf, streak — новые файлы пользователя) ----------
// fill — кнопка «назад», ping — добавление в закладки, unstar — повторное нажатие на закладку и «Отменить» в уведомлении,
// leaf — крестик в списке «Закладки», streak — цель дня выполнена (огонёк)
// «correct» (верный ответ, в том числе в играх) теперь играет файл petal.wav (файл пользователя)
// 2026-11-23: «назад» (fill) теперь играет notch.wav, огонёк (streak) — wand.wav, изменение настроек в «Общих» (set) — rebound.wav
const SOUND_FILE = { correct: "petal", fill: "notch", streak: "wand", set: "rebound", tab: "tab.m4a" };   // tab — переключение вкладок (нижняя панель, разделы «Инвентаря»)
const SOUND_NAMES = ["correct", "error", "next", "fill", "ping", "unstar", "leaf", "streak", "set", "herald", "tab"];   // herald — новое достижение
const SOUND_VOL = { tab: 0.3 };   // громкость отдельных звуков (1 — как в файле); вкладки — на 70% тише по просьбе
const soundUrl = (n) => { const f = SOUND_FILE[n] || n; return `sounds/${f.includes(".") ? f : f + ".wav"}`; };   // у tab — m4a (файл пользователя), у остальных — wav

// Основной путь — Web Audio: все звуки заранее декодируются в память, и старт почти мгновенный. Обычный <audio> на телефонах
// запускается с задержкой ~0,4 с (пользователь заметил; в самих файлах тишины в начале нет — проверено), поэтому он остался только запасным:
// на случай, когда Web Audio нет, звук ещё не декодирован или «будильник» звука (resume) не сработал.
let actx = null;
const buffers = {};   // имя → декодированный звук
const live = {};      // имя → источник, который играет сейчас (чтобы можно было оборвать или перезапустить)
const sounds = {};    // запасной путь: <audio>, создаётся только если понадобится
try {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    actx = new AC({ latencyHint: "interactive" });
    for (const n of SOUND_NAMES) {
      fetch(soundUrl(n)).then((r) => r.arrayBuffer())
        .then((data) => new Promise((ok, bad) => actx.decodeAudioData(data, ok, bad)))   // с колбэками — так работает и в старом Safari
        .then((buf) => { buffers[n] = buf; })
        .catch(() => { /* не декодировался — будет играть запасной путь */ });
    }
  }
} catch { actx = null; }
// iOS и Android включают звук только после касания: «будим» контекст на первом же касании/клавише (до обработчика самой кнопки)
const unlockAudio = () => { if (actx && actx.state !== "running") actx.resume().catch(() => {}); };
for (const ev of ["pointerdown", "touchend", "keydown"]) document.addEventListener(ev, unlockAudio, { capture: true, passive: true });

function stopSound(name) {
  try { live[name]?.stop(); } catch { /* уже закончился */ }
  try { if (sounds[name]) { sounds[name].pause(); sounds[name].currentTime = 0; } } catch { /* звук не критичен */ }
}
function play(name) {
  if (progress && settings().sound === false) return;
  try {
    stopSound(name);                                              // повторное нажатие — с начала, как раньше
    if (actx && buffers[name] && actx.state === "running") {
      const src = actx.createBufferSource();
      src.buffer = buffers[name];
      if (SOUND_VOL[name]) { const g = actx.createGain(); g.gain.value = SOUND_VOL[name]; src.connect(g).connect(actx.destination); }
      else src.connect(actx.destination);
      live[name] = src;
      src.onended = () => { if (live[name] === src) delete live[name]; };
      src.start();
      return;
    }
    unlockAudio();
    const a = sounds[name] || (sounds[name] = new Audio(soundUrl(name)));
    a.currentTime = 0;
    a.volume = SOUND_VOL[name] ?? 1;   // запасной путь; на iPhone громкость <audio> не меняется — там почти всегда работает Web Audio выше
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
  const typing = document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);
  document.body.classList.toggle("kbd", touch && typing && h < maxViewH - 120);
  if (cur !== null) lockCardHeight();   // размер экрана изменился — высота свежей карточки другая
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
let phasingTimer = 0;
function schedule(seconds, ph) {
  // смена фазы (новая карточка ↔ ответ): заливка меняет длину неспешно (класс phasing); проявления по прозрачности нет (пользователь убрал)
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && el.timerBox.offsetParent) {
    el.timerBox.classList.add("phasing");
    clearTimeout(phasingTimer);
    phasingTimer = setTimeout(() => el.timerBox.classList.remove("phasing"), 550);
  }
  phase = ph;
  phaseMs = seconds * 1000;
  nextAt = Date.now() + phaseMs;
  updateCountdown();
}

function updateCountdown() {
  if (!Number.isFinite(nextAt)) { el.countdown.textContent = ""; el.timerFill.style.width = "0%"; el.timerBox.classList.remove("urgent"); return; }
  const msLeft = Math.max(0, nextAt - Date.now());
  const left = Math.round(msLeft / 1000);
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  el.countdown.textContent = phase === "ask" ? clock : `Дальше ${clock}`;
  el.timerBox.classList.toggle("next", phase !== "ask");   // после ответа надпись длиннее — рамка под неё шире (плавно), до ответа узкая: текст вплотную к полоске
  el.timerFill.style.width = `${Math.min(100, (msLeft / phaseMs) * 100)}%`;
  el.timerBox.classList.toggle("urgent", phase === "ask" && msLeft <= redLead(phaseMs / 1000) * 1000);   // последние секунды до показа ответа (зависят от длины таймера) — таймер плавно краснеет
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
    const pool = (session.pool || progress.reviewPool()).filter((k) => !session.seen.includes(k));
    if (session.done >= session.total || !pool.length) { finishSession(); return; }
    key = pool[Math.floor(Math.random() * pool.length)];
    session.seen.push(key);
  } else {
    key = progress.pick(recent(), undefined, allowedTypes(), allowedLevels());
  }
  if (key === null) {
    cur = null;
    schedule(askSec(), "ask");
    setIdle(!filterOn() ? "Все фразы выучены 🎉" : [...progress.phrases.values()].some(fits) ? "В выбранном всё выучено 🎉" : "Таких карточек нет — измените выбор в «Что учить»");
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
  el.check.hidden = el.show.hidden = el.hintBtn.hidden = true;
  showActions();
}

// Подсказка: каждое нажатие лампочки открывает у каждого слова ответа ещё одну букву (до HINT_MAX); показывается серым в пустом поле ввода.
// На счёт ответа не влияет. Только в Mini App.
const HINT_MAX = 3;
let hintLevel = 0;
function onHint() {
  if (cur === null || revealed || hintLevel >= HINT_MAX) return;
  const p = progress.phrases.get(cur);
  el.entry.placeholder = Core.hintMask(direction === "en2ru" ? p.ru[0] : p.en, ++hintLevel);
  el.hintBtn.classList.toggle("spent", hintLevel >= HINT_MAX);
}

/** Кнопка «Прекратить повтор» под «Проверить» — только пока идёт сессия повтора. */
const syncSessBtn = () => { $("endSessBtn").hidden = !(session && !session.finished); };

/** «Pop», как у строк списков: узлы по очереди всплывают (прозрачность 0→1, снизу вверх, лёгкое увеличение). Скрытые узлы и скрытая вкладка пропускаются. */
function popIn(nodes, delay = 0) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  nodes.filter((n) => n && !n.hidden && n.offsetParent).forEach((n, i) => n.animate(
    [{ opacity: 0, transform: "translateY(12px) scale(.92)" }, { opacity: 1, transform: "none" }],
    { duration: 380, delay: delay + i * 50, easing: "cubic-bezier(.22, 1.25, .4, 1)", fill: "backwards" }));
}

/** Высота карточки не меняется между «вопросом» и «ответом» (иначе низ карточки прыгает): запоминаем высоту свежей карточки и держим её как min-height.
 *  Замер без переходов (класс measuring). Вызывается на каждой новой карточке и при смене размера экрана/клавиатуры. */
let cardH = 0;
function lockCardHeight() {
  const glass = document.querySelector("#learn .glass");
  if (!glass.offsetParent) return;
  if (revealed) { glass.style.minHeight = ""; return; }   // на ответе свежую высоту не замерить — снимаем замок до следующей карточки
  glass.style.minHeight = "";
  glass.classList.add("measuring");
  cardH = glass.offsetHeight;
  glass.classList.remove("measuring");
  glass.style.minHeight = cardH + "px";
}

function show(key, dir, isRevealed) {
  cur = key; direction = dir; revealed = false;
  syncSessBtn();
  const p = progress.phrases.get(key);
  const state = progress.state(key);
  const pills = [];
  if (session && !session.finished) pills.push([`${session.pool ? "Слабые" : "Повтор"} ${session.done + 1}/${session.total}`, "sess"]);
  const kind = TYPE_RU[p.type] || p.type;
  pills.push([kind[0].toUpperCase() + kind.slice(1), ""], [p.level, "lvl"], [dir === "en2ru" ? "EN → RU" : "RU → EN", "mode"]);
  if (state === "learning") pills.push(["↻", "rep"]);
  el.tag.replaceChildren(...pills.map(([text, cls]) => make("span", "pill " + cls, text)));
  el.tag.title = state === "learning" ? "повторение" : "";
  setHinted(el.prompt, dir === "en2ru" ? p.en : p.ru[0]);
  el.entry.readOnly = false;
  el.entry.value = "";
  el.entry.className = "";
  el.entry.placeholder = "";
  hintLevel = 0;
  el.hintBtn.classList.remove("spent");
  setStatus("");
  el.answer.textContent = "";
  el.example.textContent = "";
  showActions();
  refreshFav();
  if (isRevealed) {
    reveal(null);
  } else {
    el.check.hidden = el.show.hidden = el.hintBtn.hidden = false;
    if (!touch || keepFocus) el.entry.focus({ preventScroll: true });
    schedule(askSec(), "ask");
  }
  if (isRevealed && cardH) document.querySelector("#learn .glass").style.minHeight = cardH + "px";   // «Назад»: та же высота, что у свежих карточек
  else lockCardHeight();
  popIn([el.tag, el.prompt, document.querySelector("#learn .entryrow"), el.check]);
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
  el.check.hidden = el.show.hidden = el.hintBtn.hidden = true;
  el.entry.placeholder = "";

  if (ok === null) { setStatus(""); popIn([el.answer, el.example]); return; }
  el.entry.className = ok ? "ok" : "bad";
  const before = progress.state(cur);
  const state = progress.record(cur, ok);
  if (session && !session.finished) { session.done += 1; session.correct += ok ? 1 : 0; }
  const todayBefore = progress.todayCorrect();
  recordAnswer(progress, ok);
  progress.logAnswer(ok);
  updateGoal();
  announceAchievements();
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
  popIn([el.status, el.answer, el.example, ...actionBtns]);
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
  el.fav.classList.toggle("instant", !animate);   // анимация заливки — только при нажатии на закладку
  const faved = !!(cur && progress.isFav(cur));
  el.fav.classList.toggle("on", faved);
  el.fav.setAttribute("aria-pressed", String(faved));
}

const TOAST_KIND = {
  word: "Слово", slang: "Слово", idiom: "Идиома", "phrasal verb": "Глагол", proverb: "Пословица", conversational: "Фраза",
};

function toggleFav() {
  if (!cur) return;
  const on = progress.toggleFav(cur);
  play(on ? "ping" : "unstar");
  refreshFav(true);
  if (on) {
    // в описании нет самой фразы: в режиме RU→EN она выдала бы ответ — только её вид (слово, идиома…)
    const key = cur;
    const kind = TOAST_KIND[progress.phrases.get(key)?.type] || "Фраза";
    showToast({
      title: "Добавлено в закладки", description: `${kind} в «Закладках»`, actionLabel: "Отменить", icon: FOLDER, duration: ST.duration * 1.5,   // 3 с
      onAction: () => { progress.toggleFav(key); play("unstar"); refreshFav(true); },
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

function showToast({ title, description = "", actionLabel = "", icon = "", onAction, onTap, onClose, duration = ST.duration }) {
  toast?.destroy();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let phase = "open", leaving = false, drag = null, pendingClose = null, closeTimer = 0;
  let stopSpring = null, fadeAnim = null, burn = null, lastInput = "pointer", y = 0, wasDragged = false;
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
  if (icon) {                                   // большой полупрозрачный значок позади текста
    const bg = make("span", "swipe-toast__bg");
    bg.setAttribute("aria-hidden", "true");
    bg.innerHTML = icon;
    card.append(bg);
  }
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
    // фитиль идёт по контуру карточки (скруглённые углы), поэтому сжимается не масштабом, а размером маски
    burn = fuseEl.animate([{ maskSize: "100% 100%", webkitMaskSize: "100% 100%" }, { maskSize: "0% 100%", webkitMaskSize: "0% 100%" }],
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
    wasDragged = d.moved;
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
  // нажатие на само уведомление (не на кнопку и не после перетаскивания) — действие onTap, окно закрывается
  const tap = () => { if (phase !== "open" || leaving) return; onTap(); close("tap"); };
  if (onTap) {
    card.style.cursor = "pointer";
    card.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      if (wasDragged) { wasDragged = false; return; }
      tap();
    });
    card.addEventListener("keydown", (e) => { if (e.target === card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); tap(); } });
  }
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

// ---------- нижняя панель: Учить / Повтор / Игры / Инвентарь (в нём закладки) / Прогресс ----------
// порядок = «кто справа от кого» для анимации; настройки, игры, времена, повтор, прогресс и достижения — внутри «Больше» (на панели у них своей кнопки нет)
const VIEWS = ["learn", "inv", "tr", "more", "general", "tenses", "tlesson", "games", "rev", "prog", "ach"];
const TABS = ["learn", "inv", "tr", "more"];
const TAB_OF = { general: "more", tenses: "more", tlesson: "more", games: "more", rev: "more", prog: "more", ach: "more" };
const BACK_OF = { tlesson: "tenses" };   // куда ведёт «назад» (по умолчанию — в «Больше»)
const tabOf = (v) => TAB_OF[v] || v;
let view = "learn";
let invTab = "saved";
let calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

let swapTimer = null;

// ---------- «Больше»: строка-статус в блоках и красные точки ----------
const TENSE_COUNT = 12;
const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };

/** Подписи под названиями блоков («5 из 32», «повторить: 7»…) и красные точки у «Повтора» и «Достижений»; вызывается при каждом открытии «Больше». */
function renderMore() {
  const set = (id, text) => { $(id).textContent = text; };
  const ach = achievementStatus(progress), pool = progress.reviewPool().length, streak = progress.streak();
  const tenses = Object.values(progress.data.tenses || {}).filter((r) => r && r.best >= MASTERED).length;
  set("mstGames", `${GAMES.filter((g) => progress.data.flawless && progress.data.flawless[g]).length}/${GAMES.length} пройдено`);
  set("mstProg", `серия ${streak} ${plural(streak, "день", "дня", "дней")}`);
  set("mstAch", `${ach.filter((a) => a.date).length} из ${ach.length}`);
  set("mstTenses", `освоено ${tenses} из ${TENSE_COUNT}`);
  set("mstRev", pool ? `повторить: ${pool}` : "пока нет");
  set("mstDict", `${progress.phrases.size} записей`);
  $("dotRev").hidden = !pool || settings().dotRev === false;                            // точки можно выключить в «Настройках → Напоминания»
  $("dotAch").hidden = !unseenAchievements(progress).length || settings().dotAch === false;
  $("dotProg").hidden = progressChange(progress).streak <= 0 || settings().dotProg === false;   // серия выросла с прошлого захода в «Прогресс»
  for (const dot of [$("dotRev"), $("dotAch"), $("dotProg")]) dot.parentElement.classList.toggle("alert", !dot.hidden);   // пока горит точка, значок блока раз в 10 с «подаёт знак» (CSS: кубок трясётся, стрелки делают круг)
}

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
  for (const b of document.querySelectorAll(".tabbtn")) {
    const on = b.dataset.view === tabOf(name);
    b.classList.toggle("on", on);
    if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  }
  if (name === "rev") renderRev();
  if (name === "games") renderGames();
  if (prev === "inv" && name !== "inv") favOpen = false;   // ряды фильтров закладок при следующем заходе спрятаны
  if (name === "inv") renderInv();
  if (name === "general") renderGeneral();
  if (name === "tenses") tenses.renderMap();
  if (name === "tlesson") tenses.renderLesson();
  if (name === "more") { renderMore(); animateList($("moreBody"), { entrance: true, bottomEl: $("bar") }); }   // подписи и точки обновляются, блоки выезжают, как слова в «Закладках»
  if (name === "prog") { progChange = progressChange(progress); renderProg(true); markProgressSeen(progress); clearTimeout(chipTimer); chipTimer = setTimeout(hideChips, 3000); }   // стрелки показывают, что изменилось с прошлого захода; потом снимок обновляется
  if (name === "ach") {
    announceAchievements();                                 // выданное «задним числом» тоже считается новым
    achNew = unseenAchievements(progress);                  // полученные и ещё не просмотренные: у них галочка «выскакивает», к последнему экран сам прокручивается
    achOpened = false; setAchSearchOpen(false); renderAch(); markAchievementsSeen(progress);
    clearTimeout(achScrollTimer); achScrollTimer = setTimeout(scrollToNewAch, 380);   // после того как экран приехал (переход 340 мс)
  }   // открыли экран — поиск закрыт, строки выезжают (как раньше)
  if (name === "tlesson") markExplored("tenses");
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
  mastered: () => "выучено",
  dict: (c) => ({ new: "Видел", learning: "Учу", mastered: "Выучено", known: "Знал" })[c?.state] || "",   // у ещё не показанных записи в прогрессе нет
};

/** Список фраз: в закладках — крестик «убрать», в остальных — подпись справа. */
function renderList(body, keys, kind, emptyText) {
  body.replaceChildren();
  if (!keys.length) { body.append(emptyNote(emptyText)); return; }
  const LIMIT = kind === "dict" ? dictShown : 300;   // словарь показывает всё, но порциями: 1040 анимированных строк разом перегружали телефон
  appendRows(body, keys.slice(0, LIMIT), kind);
  if (kind !== "dict" && keys.length > LIMIT) body.append(emptyNote(`Показано ${LIMIT} из ${keys.length}. Уточните поиск.`));
}

function appendRows(body, keys, kind) {
  for (const key of keys) {
    const row = make("div", "item");
    const txt = make("div", "txt");
    const en = make("div", "en", key);
    if (kind === "dict" || kind === "saved") en.append(" ", make("span", "dlvl", progress.phrases.get(key).level));   // уровень A2/B1/B2 — мелко и бледно после слова (в «Словаре» и «Закладках»)
    txt.append(en, make("div", "ru", progress.phrases.get(key).ru.slice(0, 2).join(" / ")));
    row.append(txt);
    if (kind === "saved") {
      const rm = make("button", "rm");
      rm.setAttribute("aria-label", "Убрать из закладок");
      rm.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      rm.addEventListener("click", () => {
        rm.disabled = true;
        play("leaf");
        progress.toggleFav(key);
        refreshFav();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { renderInv(false); return; }
        row.style.transition = ""; row.style.transitionDelay = "";   // переходы выезда списка не мешают схлопыванию (его переходы — в CSS)
        row.style.height = row.offsetHeight + "px";   // чтобы высота плавно уменьшалась до нуля
        void row.offsetHeight;
        row.classList.add("removing");
        setTimeout(() => renderInv(false), 440);       // после анимации — перерисовать список (без нового «выезда»)
      });
      row.append(rm);
    } else {
      row.append(make("div", "side", SIDE[kind](progress.cards[key])));
    }
    body.append(row);
  }
}

const DICT_PAGE = 60;    // сколько строк словаря рисуется за раз
let dictShown = DICT_PAGE, dictKeys = [];
/** Словарь: когда прокрутка подошла к низу списка — дорисовать следующую порцию строк (уже показанные не трогаем). */
function loadMoreDict() {
  if (invTab !== "dict" || dictShown >= dictKeys.length || !el.invBody.offsetParent) return;
  if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 900) return;
  appendRows(el.invBody, dictKeys.slice(dictShown, dictShown + DICT_PAGE), "dict");
  dictShown += DICT_PAGE;
  animateList(el.invBody, { entrance: false, bottomEl: $("bar") });
}
window.addEventListener("scroll", loadMoreDict, { passive: true });

// --- Инвентарь: закладки, трудные, словарь (вся база по алфавиту), выученные; везде поиск ---
const INV_EMPTY = {
  saved: "Пока пусто.\nНажмите закладку на карточке,\nчтобы сохранить фразу сюда.",
  hard:"Трудных слов пока нет.\nОни появятся, если вы часто\nошибаетесь или нажмёте «Трудно».",
  mastered: "Выученных слов пока нет.\nСлово считается выученным после\nтрёх верных ответов подряд.",
};

let dictSorted = null;   // база не меняется, поэтому алфавитный список считаем один раз
let dictKind = null;     // фильтр словаря: null — все, иначе вид записи (phrase.type)
let favKind = null, favLevel = null;   // фильтры закладок: null — все; не запоминаются между запусками
let favOpen = false;                   // выдвинута ли панель фильтров закладок (при уходе из «Инвентаря» прячется)
function invKeys(tab) {
  if (tab === "saved") return progress.favorites().filter((k) => { const p = progress.phrases.get(k); return (!favKind || p.type === favKind) && (!favLevel || p.level === favLevel); });
  if (tab === "hard") return progress.hardCards();
  if (tab === "dict") {
    dictSorted = dictSorted || [...progress.phrases.keys()].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
    return dictKind ? dictSorted.filter((k) => progress.phrases.get(k).type === dictKind) : dictSorted;
  }
  return progress.keysByState(tab);
}

const SEARCH_LUPA = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>';
const SEARCH_CLOSE = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

/** Кнопка-лупа открывает поле поиска (крестик закрывает, стирает запрос и вызывает onClose, чтобы вернуть полный список). */
function setSearchOpen({ btn, wrap, input, label, onClose }, open) {
  if (open === !wrap.hidden) return;
  wrap.hidden = !open;
  btn.setAttribute("aria-expanded", String(open));
  btn.setAttribute("aria-label", open ? "Закрыть поиск" : label);
  btn.innerHTML = open ? SEARCH_CLOSE : SEARCH_LUPA;
  if (open) input.focus();
  else { input.value = ""; onClose(); }
}
const achSearch = { btn: $("achSearchBtn"), wrap: $("achSearchWrap"), input: $("achSearch"), label: "Поиск по достижениям", onClose: () => renderAch() };
const setAchSearchOpen = (open) => setSearchOpen(achSearch, open);

/**
 * Ряд листается пальцем вручную: у #views стоит touch-action: pan-y (ради свайпа вкладок), и родная прокрутка вбок
 * внутри него не работает. Тянем scrollLeft сами, после отпускания — небольшая инерция; нажатие после перетаскивания гасим.
 */
function dragScroll(row) {
  let d = null, moved = false, raf = 0;
  row.addEventListener("pointerdown", (e) => {
    cancelAnimationFrame(raf);
    if (e.pointerType === "mouse" && e.button !== 0) return;
    d = { id: e.pointerId, x: e.clientX, left: row.scrollLeft, lastX: e.clientX, lastT: performance.now(), v: 0 };
    moved = false;
  });
  row.addEventListener("pointermove", (e) => {
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    if (!moved) {
      if (Math.abs(dx) < 6) return;
      moved = true;
      try { row.setPointerCapture(e.pointerId); } catch { /* не страшно */ }
    }
    row.scrollLeft = d.left - dx;
    const now = performance.now();
    d.v = (d.lastX - e.clientX) / Math.max(1, now - d.lastT);   // px/мс: куда «едет» содержимое
    d.lastX = e.clientX; d.lastT = now;
  });
  const end = (e) => {
    if (!d || e.pointerId !== d.id) return;
    let v = performance.now() - d.lastT < 80 ? d.v : 0;
    d = null;
    if (!moved || Math.abs(v) < 0.15) return;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(32, now - last); last = now;
      row.scrollLeft += v * dt;
      v *= Math.pow(0.94, dt / 16);
      if (Math.abs(v) > 0.03) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  row.addEventListener("pointerup", end);
  row.addEventListener("pointercancel", end);
  row.addEventListener("click", (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
}

/** Ряд кнопок-фильтров над словарём (создаётся один раз, дальше только меняется выбранная). */
function renderDictKinds() {
  const row = $("dictKinds");
  row.hidden = invTab !== "dict";
  if (!row.children.length) {
    const counts = {};
    for (const p of progress.phrases.values()) counts[p.type] = (counts[p.type] || 0) + 1;
    dragScroll(row);
    for (const [value, label] of [[null, "Все"], ...KINDS]) {
      const b = make("button", "dkind");
      b.dataset.kind = value ?? "";
      b.append(label, make("small", "", String(value ? counts[value] || 0 : progress.phrases.size)));
      b.addEventListener("click", () => {
        dictKind = value; renderInv();
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        row.scrollTo({ left: b.offsetLeft - (row.clientWidth - b.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });   // выбранный фильтр — в середину ряда
      });
      row.append(b);
    }
  }
  for (const b of row.children) {
    const on = b.dataset.kind === (dictKind ?? "");
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  }
}

/** Два ряда фильтров над закладками: по виду (как в «Словаре») и по уровню. Числа — сколько закладок такого вида/уровня (пересчитываются при каждой перерисовке,
 *  в том числе после удаления закладки); фильтры сочетаются друг с другом и с поиском. */
function renderFavFilters() {
  const kinds = $("favKinds"), levels = $("favLevels"), on = invTab === "saved", btn = $("favFilterBtn"), box = $("favFilters");
  btn.hidden = !on;
  btn.classList.toggle("on", !!(favKind || favLevel));           // фильтр выбран — кнопка белая, даже когда ряды спрятаны
  btn.setAttribute("aria-expanded", String(on && favOpen));
  if (!box.getAnimations().length) box.hidden = !(on && favOpen);   // пока идёт выдвижение/задвижение — им управляет slideFavFilters
  if (!on) return;
  const favs = progress.favorites().map((k) => progress.phrases.get(k));
  const fill = (row, items, field, cur, set) => {
    if (!row.children.length) {
      dragScroll(row);
      for (const [value, label] of items) {
        const b = make("button", "dkind");
        b.dataset.v = value ?? "";
        b.append(label, make("small"));
        b.addEventListener("click", () => {
          set(value); renderInv();
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          row.scrollTo({ left: b.offsetLeft - (row.clientWidth - b.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });   // выбранный — в середину ряда
        });
        row.append(b);
      }
    }
    for (const b of row.children) {
      const v = b.dataset.v || null;
      b.lastChild.textContent = String(v ? favs.filter((p) => p[field] === v).length : favs.length);
      b.classList.toggle("on", v === cur);
      b.setAttribute("aria-pressed", String(v === cur));
    }
  };
  fill(kinds, [[null, "Все"], ...KINDS], "type", favKind, (v) => { favKind = v; });
  fill(levels, [[null, "Все уровни"], ...LEVELS.map((l) => [l, l])], "level", favLevel, (v) => { favLevel = v; });
}

/** Кнопка «Фильтр»: ряды фильтров закладок плавно выдвигаются (высота и прозрачность) или задвигаются. */
function slideFavFilters(open) {
  const box = $("favFilters");
  for (const a of box.getAnimations()) a.cancel();
  $("favFilterBtn").setAttribute("aria-expanded", String(open));
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { box.hidden = !open; return; }
  box.hidden = false;
  const h = box.offsetHeight;
  box.style.overflow = "hidden";                                  // только на время движения: иначе обрезалось бы свечение выбранной кнопки
  // margin-top: −12 px убирает отступ между полем и пустой панелью (у экрана gap 12 px), чтобы список не прыгал в начале и в конце
  const frames = [{ height: "0px", opacity: 0, marginTop: "-12px" }, { height: h + "px", opacity: 1, marginTop: "0px" }];
  const anim = box.animate(open ? frames : frames.reverse(),
    open ? { duration: 320, easing: "cubic-bezier(.23, 1, .32, 1)" } : { duration: 220, easing: "cubic-bezier(.4, 0, 1, 1)" });
  anim.onfinish = () => { box.style.overflow = ""; if (!open) box.hidden = true; };
  anim.oncancel = () => { box.style.overflow = ""; };
}

/** Запрос q (уже в нижнем регистре) совпадает с НАЧАЛОМ какого-то слова текста: «дом» найдёт «домовладелец», но не «с трудом». */
function startsWord(text, q) {
  const t = text.toLowerCase();
  for (let i = t.indexOf(q); i !== -1; i = t.indexOf(q, i + 1)) {
    if (i === 0 || !/[\p{L}\p{N}]/u.test(t[i - 1])) return true;
  }
  return false;
}

/** animate = true — строки «выезжают» (при открытии вкладки и смене раздела); false — при поиске и после удаления закладки, без выезда. */
function renderInv(animate = true) {
  const segBtns = [...document.querySelectorAll("#inv .segbtn")];
  for (const b of segBtns) {
    b.classList.toggle("on", b.dataset.tab === invTab);
    b.setAttribute("aria-pressed", String(b.dataset.tab === invTab));
  }
  invThumb.go(segBtns.findIndex((b) => b.dataset.tab === invTab));   // белая плашка переезжает, как в «Общих»
  renderDictKinds();
  renderFavFilters();
  const q = $("invSearch").value.trim().toLowerCase();
  let keys = invKeys(invTab);
  if (q) keys = keys.filter((k) => startsWord(k, q) || progress.phrases.get(k).ru.some((r) => startsWord(r, q)));
  dictKeys = keys; dictShown = DICT_PAGE;
  const favFiltered = invTab === "saved" && (favKind || favLevel) && progress.favorites().length;
  renderList(el.invBody, keys, invTab, q ? "Ничего не найдено." : favFiltered ? "Таких закладок нет." : INV_EMPTY[invTab]);
  animateList(el.invBody, { entrance: animate, bottomEl: $("bar") });
}

// --- Игры ---
// «Подставь частицу»: предложение с пропуском на месте частицы фразового глагола («I'm looking ___ my keys»), 4 варианта.
// Данные (data/pv_game.json) делает miniapp_tests/make_pv_game.py из примеров базы; в раунде — 10 случайных вопросов.
// Игра не влияет на прогресс, цель дня и серию.
const VER = new URL(import.meta.url).searchParams.get("v") || "0";
const ROUND_MIN = 3, ROUND_MAX = 20, ROUND_DEFAULT = 10;
const FLAWLESS_MIN = 10;   // «без ошибок» и «Хет-трик» считаются только за раунды от 10 вопросов (иначе 3 вопроса — слишком легко)
/** Сколько вопросов в раунде этой игры ("pv" / "dlg") — выбирается ползунком перед игрой, хранится в settings.rounds. */
const roundSize = (g) => Math.min(ROUND_MAX, Math.max(ROUND_MIN, Number(settings().rounds?.[g]) || ROUND_DEFAULT));
let pvData = null;      // данные игры, загружаются при первом запуске
let game = null;        // идущий раунд: { items, i, right, picked, options }

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

/** 4 варианта: верная частица + 3 неверных (того же числа слов; не подходящие по смыслу к этому глаголу; частые — чаще). */
function gameOptions(item) {
  const n = item.answer.split(" ").length, count = new Map();
  for (const x of pvData) if (x.answer.split(" ").length === n) count.set(x.answer, (count.get(x.answer) || 0) + 1);
  const bad = new Set([item.answer, ...item.ex]);
  const cand = [...count].filter(([p]) => !bad.has(p));
  const picks = [];
  while (picks.length < 3 && cand.length) {
    let r = Math.random() * cand.reduce((s, [, w]) => s + w, 0), k = 0;
    for (; k < cand.length - 1; k++) { r -= cand[k][1]; if (r < 0) break; }
    picks.push(cand.splice(k, 1)[0][0]);
  }
  return shuffle([item.answer, ...picks]);
}

/** mode: "choose" — выбрать из 4 вариантов, "type" — вписать частицу самому. */
async function startGame(mode) {
  if (!pvData) pvData = await fetch(`data/pv_game.json?v=${VER}`).then((r) => r.json());
  const items = shuffle(pvData).slice(0, roundSize("pv"));
  game = { mode, items, i: 0, right: 0, picked: null, note: "", options: gameOptions(items[0]) };
  markExplored("pv");
  renderGames();
}

function sentence(item, fill, cls) {
  const [a, b] = item.gap.split("___");
  const s = make("div", "qsentence");
  const blank = make("span", "blank" + (cls ? " " + cls : ""));
  blank.append(make("span", "binner", fill || "?"));
  s.append(a, blank, b);
  return s;
}

/** Значения фразовых глаголов из базы: «hang around» → «Слоняться» (для объяснения неверного ответа в игре). */
let pvMeanings = null;
function pvMeaning(en) {
  if (!pvMeanings) {
    pvMeanings = new Map();
    for (const p of progress.phrases.values()) if (p.type === "phrasal verb") pvMeanings.set(p.en.toLowerCase(), p.ru[0]);
  }
  return pvMeanings.get(en.toLowerCase()) || null;
}
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

/** Почему ответ неверен: другой настоящий фразовый глагол с другим смыслом, либо частица здесь не подходит; пустой ответ — просто подсказка. */
function whyWrong(item, picked) {
  const right = item.en.toLowerCase(), verb = right.split(" ")[0], meaning = lowerFirst(item.pv_ru);
  if (!picked) return `Здесь нужна частица «${item.answer}»: ${right} — ${meaning}.`;
  const other = `${verb} ${picked}`;
  if (item.ex.includes(picked)) {
    const m = pvMeaning(other);
    return `«${other}»${m ? " — " + lowerFirst(m) + "," : " —"} это другой фразовый глагол. Здесь по смыслу нужно «${right}» — ${meaning}.`;
  }
  return `«${other}» здесь не подходит по смыслу. Правильно: «${right}» — ${meaning}.`;
}

/** Верх карточки любой игры: «Вопрос i из n», счёт, крестик «Выйти» и полоска раунда. */
function gameTop() {
  const head = make("div", "gamehead");
  const quit = make("button", "gamequit");
  quit.setAttribute("aria-label", "Выйти из игры");
  quit.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  quit.addEventListener("click", () => { game = null; renderGames(); });
  head.append(make("span", "muted", `Вопрос ${game.i + 1} из ${game.items.length}`), make("span", "muted", `Верно: ${game.right}`), quit);
  const bar = make("div", "track"), fill = make("i");
  fill.style.width = `${(game.i / game.items.length) * 100}%`;
  bar.append(fill);
  return [head, bar];
}

// «Диалоги»: короткий разговор, одна реплика спрятана — выбрать из 4 ответов. Данные — data/dialogs.json (miniapp_tests/make_dialogs.py).
let dlgData = null;
async function startDialogs() {
  if (!dlgData) dlgData = await fetch(`data/dialogs.json?v=${VER}`).then((r) => r.json());
  const items = shuffle(dlgData).slice(0, roundSize("dlg"));
  game = { kind: "dlg", items, i: 0, right: 0, picked: null, opts: shuffle(items[0].o) };
  markExplored("dlg");
  renderGames();
}

function answerDialog(opt) {
  if (!game || game.picked !== null) return;
  game.picked = opt;
  const ok = opt === game.items[game.i].o[0];          // верный ответ в данных всегда первый
  if (ok) game.right += 1;
  play(ok ? "correct" : "error");
  renderGames();
}

function renderDialog(body) {
  const item = game.items[game.i], answered = game.picked !== null, ok = answered && game.picked === item.o[0];
  const card = make("div", "gamecard");
  const chat = make("div", "chat");
  item.l.forEach(([who, en, ru], idx) => {
    const gap = idx === item.g;
    const b = make("div", `bubble ${who}${gap ? " gap" + (answered ? " ok" : "") : ""}`);
    b.append(make("span", "", gap && !answered ? "…" : en));       // после ответа в пропуске всегда верная реплика
    if (answered) b.append(make("small", "muted", ru));
    chat.append(b);
  });
  card.append(...gameTop(), make("div", "qlabel", `${item.s}. Что вы скажете?`), chat);
  const opts = make("div", "dlgopts");
  for (const o of game.opts) {
    const b = make("button", "btn", o.t);
    if (answered) { b.disabled = true; if (o === item.o[0]) b.classList.add("ok"); else if (o === game.picked) b.classList.add("bad"); }
    else b.addEventListener("click", () => answerDialog(o));
    opts.append(b);
  }
  card.append(opts);
  let fb = null;
  if (answered) {
    fb = make("div", "qfeedback " + (ok ? "ok" : "bad"), ok ? "Верно!" : `Неверно. Лучше сказать: «${item.o[0].t}»`);
    card.append(fb);
    if (!ok) card.append(make("div", "qnote muted", game.picked.w));
    const key = make("div", "qkey");
    key.append(make("span", "muted", "Запомните: "), make("b", "", item.k), ` — ${item.kr}`);
    card.append(key);
    const last = game.i + 1 >= game.items.length;
    const next = make("button", "btn primary wide", last ? "Результат" : "Далее");
    next.addEventListener("click", () => {
      game.i += 1; game.picked = null;
      if (game.i < game.items.length) game.opts = shuffle(game.items[game.i].o);
      renderGames();
    });
    card.append(next);
  }
  body.append(card);
  if (fb) fb.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

/** Ползунок «сколько вопросов в раунде» (3–20) перед игрой g; text(n) — подпись над ним. Значение сохраняется сразу, как «Время на ответ». */
function roundField(g, text) {
  const f = make("div", "field askfield");
  const meta = make("div", "gamemeta");
  const range = make("input");
  Object.assign(range, { type: "range", min: ROUND_MIN, max: ROUND_MAX, step: 1, value: roundSize(g) });
  range.setAttribute("aria-label", "Вопросов в раунде");
  const show = () => {
    const n = Number(range.value);
    meta.textContent = text(n);
    range.style.setProperty("--p", `${((n - ROUND_MIN) / (ROUND_MAX - ROUND_MIN)) * 100}%`);
  };
  range.addEventListener("input", () => {
    show();
    const s = settings();
    if (!s.rounds) s.rounds = {};
    s.rounds[g] = Number(range.value);
    progress.save();
  });
  show();
  f.append(meta, range);
  return f;
}

function renderGames() {
  const body = el.gamesBody;
  body.replaceChildren();
  if (!game) {
    const n = [...progress.phrases.values()].filter((p) => p.type === "phrasal verb" && p.en.includes(" ")).length;
    const few = (k) => k === 3 || k === 4;   // 3–4 → «вопроса», «диалога»; 5–20 → «вопросов», «диалогов»
    const dcard = make("div", "gamecard");
    dcard.append(make("h2", "", "Диалоги"),
      make("p", "", "Короткий разговор из жизни: выберите реплику, которую сказал бы носитель. Например, на «Thanks a lot!» — «No problem!»"),
      roundField("dlg", (k) => `${k} ${few(k) ? "диалога" : "диалогов"} за раунд`));
    const dplay = make("button", "btn wide primary", "Играть");
    dplay.addEventListener("click", () => { dplay.disabled = true; startDialogs().catch(() => { dplay.disabled = false; }); });
    dcard.append(dplay);
    const card = make("div", "gamecard");
    card.append(make("h2", "", "Подставь частицу"),
      make("p", "", "Фразовые глаголы: впишите нужный предлог в предложение, например «I'm looking ___ my keys» → for."),
      roundField("pv", (k) => `${k} ${few(k) ? "вопроса" : "вопросов"} за раунд · ${n} глаголов в игре`));
    const modes = [["choose", "Выбрать из 4 вариантов", "primary"], ["type", "Вписать самому", ""]];
    const btns = modes.map(([mode, label, cls]) => {
      const b = make("button", ("btn wide " + cls).trim(), label);
      b.addEventListener("click", () => { btns.forEach((x) => { x.disabled = true; }); startGame(mode).catch(() => { btns.forEach((x) => { x.disabled = false; }); }); });
      return b;
    });
    card.append(...btns);
    body.append(card, dcard);
    return;
  }
  if (game.i >= game.items.length) {                       // итоги
    if (!game.counted) {                                   // экран итогов перерисовывается — раунд считаем один раз
      game.counted = true;
      if (game.items.length >= FLAWLESS_MIN) recordRound(progress, game.kind === "dlg" ? "dlg" : "pv", game.right === game.items.length);   // короткие раунды достижения «без ошибок» не дают
      announceAchievements();
    }
    const card = make("div", "gamecard");
    const share = game.right / game.items.length;   // доля верных (раунд может быть от 3 до 20 вопросов)
    const tail = share >= 0.9 ? "Отлично!" : share >= 0.7 ? "Хороший результат" : share >= 0.5 ? "Неплохо, но стоит повторить" : "Есть над чем поработать";
    card.append(make("h2", "", "Результат"), make("div", "gamescore", `${game.right} из ${game.items.length}`), make("p", "", tail));
    const again = make("button", "btn primary wide", "Ещё раз");
    again.addEventListener("click", () => { const { kind, mode } = game; game = null; if (kind === "dlg") startDialogs(); else startGame(mode); });
    const menu = make("button", "btn wide", "К играм");
    menu.addEventListener("click", () => { game = null; renderGames(); });
    card.append(again, menu);
    body.append(card);
    return;
  }
  if (game.kind === "dlg") { renderDialog(body); return; }
  const item = game.items[game.i], answered = game.picked !== null, ok = answered && game.picked === item.answer;
  const card = make("div", "gamecard");
  const hint = make("div", "qhint");
  hint.append(make("span", "muted", "Значение: "), item.pv_ru);
  card.append(...gameTop(), make("div", "qlabel", "Какая частица пропущена?"),
    sentence(item, answered ? item.answer : "", answered ? "ok" : ""),      // после ответа в пропуске всегда верная частица
    make("div", "qru muted", item.ru), hint);
  let entry = null;
  if (game.mode === "type") {
    entry = make("input", "gameentry" + (answered ? (ok ? " ok" : " bad") : ""));
    Object.assign(entry, { type: "text", placeholder: "Впишите частицу", autocomplete: "off", autocapitalize: "off", autocorrect: "off", spellcheck: false, enterKeyHint: "done" });
    entry.setAttribute("aria-label", "Пропущенная частица");
    if (answered) { entry.value = game.picked; entry.readOnly = true; if (!game.picked) entry.placeholder = "не знаю"; }
    else {
      entry.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submitTyped(entry.value); } });
      const check = make("button", "btn primary wide", "Проверить");
      check.addEventListener("click", () => submitTyped(entry.value));
      card.append(entry, check);
    }
    if (answered) card.append(entry);
  } else {
    const opts = make("div", "gameopts");
    for (const o of game.options) {
      const b = make("button", "btn", o);
      if (answered) { b.disabled = true; if (o === item.answer) b.classList.add("ok"); else if (o === game.picked) b.classList.add("bad"); }
      else b.addEventListener("click", () => answerGame(o));
      opts.append(b);
    }
    card.append(opts);
  }
  if (answered) {
    card.append(make("div", "qfeedback " + (ok ? "ok" : "bad"), ok ? "Верно!" : `Неверно. Правильно: «${item.answer}»`));
    if (!ok) card.append(make("div", "qnote muted", whyWrong(item, game.picked)));   // почему неверно — как в уроках «Времён»
    const last = game.i + 1 >= game.items.length;
    const next = make("button", "btn primary wide", last ? "Результат" : "Далее");
    next.addEventListener("click", () => {
      game.i += 1; game.picked = null; game.note = "";
      if (game.i < game.items.length) game.options = gameOptions(game.items[game.i]);
      renderGames();
    });
    card.append(next);
  }
  body.append(card);
  fitBlanks(body);
  if (entry && !answered && !touchOnly()) entry.focus();   // на компьютере сразу можно печатать; на телефоне клавиатуру вызывает нажатие
}

/** Устройство с касанием: клавиатура сама выскакивать не должна (как и в обычных карточках). */
const touchOnly = () => window.matchMedia("(pointer: coarse)").matches;

// «Времена» (tenses.js): карта 12 времён, уроки, тесты
const tenses = initTenses({ make, play, $, getProgress: () => progress, version: VER, shuffle, animateList, showView, touchOnly, onResult: () => announceAchievements() });

function answerGame(option) {
  if (!game || game.picked !== null) return;
  game.picked = option;
  const ok = option === game.items[game.i].answer;
  if (ok) game.right += 1;
  play(ok ? "correct" : "error");
  renderGames();
}

/** Ответ, вписанный вручную: пробелы и регистр не важны; «тоже бывает» (другой фразовый глагол с этим глаголом) — не засчитывается, но объясняется. */
function submitTyped(raw) {
  if (!game || game.picked !== null) return;
  const text = raw.trim().toLowerCase().replace(/\s+/g, " ");
  const item = game.items[game.i];
  if (!text) { answerGame(""); return; }            // «Проверить» с пустым полем = «не знаю»: считается ошибкой, как в обычных карточках
  answerGame(text);
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
      [["Ещё раз", true, session.pool ? startWeak : startReview], ["К обычным карточкам", false, endSession]]));
  } else {
    const hard = progress.hardCards().length;
    const pool = progress.reviewPool().length;
    body.append(panel(pool ? `К повторению: ${pool}` : "Повторять пока нечего",
      pool ? `Трудные слова и те, у которых подошёл срок проверки. В сессии — до ${SESSION_SIZE} карточек.\nТрудных: ${hard}.`
           : "Когда подойдёт срок проверки или появятся трудные слова, они будут здесь.",
      pool ? [["Начать", true, startReview]] : []));
  }
}

/** keys — свой набор карточек (слабые слова); без него сессия берёт обычный пул повтора. */
function startSession(keys) {
  const pool = keys || progress.reviewPool();
  if (!pool.length) return;
  session = { total: Math.min(SESSION_SIZE, pool.length), done: 0, correct: 0, seen: [], finished: false, pool: keys };
  markExplored("rev");
  showView("learn");
  nextCard();
}
const startReview = () => startSession(null);
const startWeak = () => startSession(progress.weakCards().slice(0, SESSION_SIZE));

function finishSession() {
  session.finished = true;
  syncSessBtn();
  cur = null;
  schedule(askSec(), "ask");
  setIdle("Повтор закончен");
  showView("rev");
}

function endSession() {
  session = null;
  syncSessBtn();
  showView("learn");
  nextCard();
}

// --- Прогресс: цифры и календарь ---
/** Что изменилось с прошлого захода в «Прогресс» (считается в showView; при перелистывании календаря остаётся тем же, но без анимации). */
let progChange = { streak: 0, acc: null };

/** Через 3 секунды после захода «таблетки» с изменениями плавно исчезают (и при перелистывании календаря уже не возвращаются). */
let chipTimer = 0;
function hideChips() {
  progChange = { streak: 0, acc: null };
  for (const c of document.querySelectorAll("#progBody .tile > .delta")) {
    c.classList.add("out");
    setTimeout(() => c.remove(), 500);
  }
}

/** Маленькая «таблетка» в углу плитки: зелёная стрелка вверх и «+N» или красная вниз и «−N». */
function deltaChip(d, unit, animate) {
  const chip = make("i", "delta " + (d > 0 ? "up" : "down") + (animate ? " go" : ""));
  chip.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 10V2.2M2.6 5.4L6 2l3.4 3.4"/></svg>';
  chip.append(`${d > 0 ? "+" : "−"}${Math.abs(d)}${unit}`);
  return chip;
}

/** Число плитки плавно «досчитывает» от прежнего значения до нового. */
function countTo(node, from, to, fmt, ms = 900) {
  const t0 = performance.now();
  node.textContent = fmt(from);
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms), e = 1 - (1 - k) ** 3;
    node.textContent = fmt(Math.round(from + (to - from) * e));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderProg(animate = false) {
  const body = el.progBody;
  body.replaceChildren();
  const acc = progress.accuracy(), s = progress.stats();
  const done = progress.todayCorrect() >= progress.goal();

  const tiles = make("div", "tiles");
  const streak = progress.streak();
  // у каждой плитки: главный текст по центру, подпись ниже, а позади — большой полупрозрачный анимированный значок
  for (const [i, [num, label, gold, icon, cls]] of [
    [`${Math.min(progress.todayCorrect(), progress.goal())}/${progress.goal()}`, "сегодня", false, calendarSvg(), "calicon"],
    [String(streak), streak % 10 === 1 && streak % 100 !== 11 ? "день подряд" : "дней подряд", done, FLAME,
      "flamebg" + (streak > 0 ? " on" : "")],
    [acc !== null ? `${acc}%` : "—", "точность", false, TARGET, "targeticon"],
  ].entries()) {
    const tile = make("div", "tile" + (gold ? " gold" : ""));
    const bg = make("span", "bgicon " + cls);
    bg.innerHTML = icon;
    const big = make("b", "", num);
    tile.append(bg, big, make("span", "lbl", label));
    // что изменилось с прошлого захода: серия — на сколько дней (число «досчитывает» до нового), точность — на сколько процентов
    const ch = i === 1 ? progChange.streak : i === 2 ? progChange.acc : 0;
    if (ch) {
      tile.append(deltaChip(ch, i === 2 ? "%" : "", animate));
      if (animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const now = i === 1 ? streak : acc;
        countTo(big, now - ch, now, i === 2 ? (v) => `${v}%` : String);
      }
    }
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

  // «Слабые слова»: где ошибок больше всего (5 первых) и кнопка короткой тренировки по ним
  const weak = progress.weakCards();
  body.append(make("div", "weakhead", "Слабые слова"));
  if (!weak.length) {
    body.append(emptyNote(`Таких слов пока нет.\nСюда попадают слова, в которых\nвы ошиблись ${Core.HARD_MISSES} раза и больше.`));
  } else {
    appendRows(body, weak.slice(0, 5), "hard");
    if (weak.length > 5) body.append(make("div", "weaknote", `Показаны 5 из ${weak.length}. В тренировку войдут до ${SESSION_SIZE} самых слабых.`));
    const go = make("button", "btn wide primary", "Потренировать");
    go.addEventListener("click", startWeak);
    body.append(go);
  }

  body.append(make("div", "stats",
    `Трудных слов: ${progress.hardCards().length}\n\n` +
    `Ещё не показывались: ${s.unseen}\n` +
    `Видел, но не выучил: ${s.new}\n` +
    `Учу (проверки): ${s.learning}\n` +
    `Выучено (3 подряд): ${s.mastered}`));
}

// --- Достижения (логика — achievements.js) ---
/** Выдать новые достижения и показать уведомление снизу (как у закладок, но без кнопки). */
function announceAchievements() {
  const fresh = checkAchievements(progress);
  if (!fresh.length) return;
  stopSound("correct");   // «герольд» заменяет «верно» в этот момент
  play("herald");
  showToast({ title: fresh.length > 1 ? "Новые достижения!" : "Новое достижение!", description: fresh.map((a) => a.title).join(", ") + "!", icon: TROPHY, duration: 6400,
    onTap: () => openAchievements(fresh.map((a) => a.id)) });   // дольше закладки (2 с): нужно прочитать названия
}

const ACH_ICON = {   // контурные значки в стиле остальных иконок
  fire: `<path d="${FLAME_PATH}"/>`,
  answers: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 9.5"/>',
  saved: '<path d="M7 3.5h10a1.2 1.2 0 0 1 1.2 1.2V20.5L12 15.2l-6.2 5.3V4.7A1.2 1.2 0 0 1 7 3.5z"/>',
  mastery: '<circle cx="12" cy="9" r="5.5"/><path d="M8.6 13.6L7 21l5-2.6 5 2.6-1.6-7.4"/>',
  explore: '<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/>',
  games: '<path d="M8 4H16A5.6 5.6 0 0 1 21.6 9.7L22.1 16A3.7 3.7 0 0 1 16 18.7L14.5 16.3H9.5L8 18.7A3.7 3.7 0 0 1 1.9 16L2.4 9.7A5.6 5.6 0 0 1 8 4Z"/><path d="M7.7 9v4.2M5.6 11.1h4.2"/><path d="M16 9.7h.02M18.4 12.3h.02" stroke-width="2.6"/>',
  tenses: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  words: '<path d="M12 7C9.6 5.3 6.6 4.8 3 5.2V18.2c3.6-.4 6.6.1 9 1.8 2.4-1.7 5.4-2.2 9-1.8V5.2C17.4 4.8 14.4 5.3 12 7z"/><path d="M12 7v13"/>',
};

/** Первая попытка воспользоваться чем-то из списка «Исследователя»; если это в первый раз — проверить достижения. */
function markExplored(key) { if (recordExplored(progress, key)) announceAchievements(); }

/** Нажатие на уведомление: открыть «Достижения», прокрутить к первому из полученных и подсветить их. */
function openAchievements(ids) {
  const go = () => {
    const rows = ids.map((id) => document.querySelector(`#achBody [data-ach="${id}"]`)).filter(Boolean);
    if (!rows.length) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rows[0].scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    for (const r of rows) { r.classList.remove("flash"); void r.offsetWidth; r.classList.add("flash"); setTimeout(() => r.classList.remove("flash"), 2200); }
  };
  if (view === "ach") { setAchSearchOpen(false); go(); return; }
  showView("ach");
  clearTimeout(achScrollTimer);                              // вместо автопрокрутки к последнему новому — прокрутка к тем, про которые уведомление
  setTimeout(go, 380);   // после того как экран приехал (переход 340 мс) и строки появились
}

let achNew = [], achScrollTimer = 0, achIO = null;   // achNew — id достижений, которые были получены, но не просмотрены к моменту открытия экрана

/** Экран «Достижения» открыт при новых достижениях: прокрутить к последнему из них (самое позднее по дню получения; при равенстве — нижнее в списке). */
function scrollToNewAch() {
  if (view !== "ach" || !achNew.length) return;
  const fresh = achievementStatus(progress).filter((a) => a.date && achNew.includes(a.id)).sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  const last = fresh[fresh.length - 1];
  const row = last && document.querySelector(`#achBody [data-ach="${last.id}"]`);
  if (row) row.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

let achOpened = false;   // false — экран только что открыли (строки выезжают); при поиске строки появляются сразу, без выезда
function renderAch() {
  announceAchievements();                                   // заслуженное, но ещё не выданное (например, выучено до обновления), выдаём при открытии экрана
  const list = achievementStatus(progress), got = list.filter((a) => a.date).length;
  const q = $("achSearch").value.trim().toLowerCase();
  const matches = (a) => !q || startsWord(a.title, q) || startsWord(GROUP_TITLES[a.group], q) || a.text.split(" ").some((w) => w && startsWord(w, q));
  const body = $("achBody");
  body.replaceChildren();
  if (achIO) { achIO.disconnect(); achIO = null; }
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sum = make("div", "item achsum");
  const bar = make("div", "track"), fill = make("i");
  fill.style.width = `${(got / list.length) * 100}%`;
  bar.setAttribute("aria-hidden", "true");
  bar.append(fill);
  sum.append(make("b", "", `Получено ${got} из ${list.length}`), bar);
  body.append(sum);
  attachSpecular(sum, "ach");   // два бегущих блика по кромке — как у «Входного теста» во «Временах»
  const shown = [];
  for (const [group, title] of Object.entries(GROUP_TITLES)) {
    const inGroup = list.filter((x) => x.group === group && matches(x));
    if (!inGroup.length) continue;                        // при поиске пустые разделы не показываем
    body.append(make("div", "sechead achhead", title));
    for (const a of inGroup) {
      shown.push(a.id);
      const row = make("div", "item ach" + (a.date ? " got" : ""));
      row.dataset.ach = a.id;
      const ico = make("span", "mico");
      ico.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">${ACH_ICON[group]}</svg>`;
      const txt = make("div", "txt");
      const top = make("div", "achtitle");
      top.append(make("div", "en", a.title));
      if (!a.date) top.append(make("span", "achpct", `${Math.floor((a.cur / a.target) * 100)}%`));   // у полученных процента нет; вниз — чтобы «99%» не стало «100%»
      txt.append(top, make("div", "ru", a.text));
      if (a.date) {
        const [y, m, d] = a.date.split("-").map(Number);
        txt.append(make("div", "achdate", `Получено ${new Date(y, m - 1, d).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`));
      } else {
        const prog = make("div", "achprog"), tr = make("div", "track"), f = make("i");
        f.style.width = `${(a.cur / a.target) * 100}%`;
        tr.setAttribute("aria-hidden", "true");
        tr.append(f);
        prog.append(tr, make("span", "", `${a.cur} из ${a.target}`));
        txt.append(prog);
      }
      row.append(ico, txt);
      if (a.date) {
        const ck = make("span", "achcheck");
        ck.setAttribute("aria-label", "Получено");
        ck.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
        row.append(ck);
        if (achNew.includes(a.id) && !reduceMotion) {            // новая: галочка скрыта, пока карточка не окажется на экране, потом «выскакивает» со свечением и остаётся обычной
          ck.classList.add("fresh");
          achIO = achIO || new IntersectionObserver((entries) => {
            for (const e of entries) if (e.isIntersecting && e.intersectionRatio >= 0.6) { e.target.querySelector(".achcheck").classList.add("pop"); achIO.unobserve(e.target); }
          }, { threshold: [0.6] });
          achIO.observe(row);
        }
      }
      body.append(row);
    }
  }
  if (!shown.length) body.append(emptyNote("Такого достижения нет."));
  animateList(body, { entrance: !achOpened, bottomEl: $("bar") });
  achOpened = true;
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
  if (settings().goalSound !== false) {   // «серия» заменяет «верно»; если звук цели выключен — слышен обычный «верно»
    stopSound("correct");
    play("streak");
  }
  const chip = el.streakChip;
  chip.classList.remove("pop");
  void chip.offsetWidth; // перезапуск анимации
  chip.classList.add("pop");
  setTimeout(() => chip.classList.remove("pop"), 1100);
  if (settings().confetti === false || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = chip.getBoundingClientRect();
  confetti(r.width ? r.left + r.width / 2 : window.innerWidth / 2, r.height ? r.top + r.height / 2 : 60);
}

// ---------- настройки и выбор цели ----------
const sheetEl = $("sheet"), sheetBox = $("sheetBox");

// окно выезжает снизу и проявляется плавно (классы .show в style.css); если оно уже открыто — только обновляется
let sheetTimer = 0, sheetAfterClose = null, sheetReturnFocus = null;
const behindSheet = () => [$("views"), $("bar")];   // пока окно открыто, фон недоступен с клавиатуры и для чтения с экрана
function sheetOpen(build, closable) {
  sheetAfterClose = null;
  sheetBox.classList.remove("ai");                                   // окно чата ИИ высокое — у остальных окон этого класса нет
  sheetBox.style.transition = ""; sheetBox.style.transform = "";   // след прошлого свайпа вниз
  // окно перестраивается при каждом нажатии внутри него — запоминаем, какая кнопка была в фокусе
  const btns = () => [...sheetBox.querySelectorAll("button")];
  const focusedIdx = btns().indexOf(document.activeElement);
  sheetBox.replaceChildren();
  build(sheetBox);
  const title = sheetBox.querySelector("h2");
  if (title) { title.id = "sheetTitle"; sheetBox.setAttribute("aria-labelledby", "sheetTitle"); }
  sheetEl.dataset.closable = closable ? "1" : "";
  clearTimeout(sheetTimer);
  if (sheetEl.hidden) {
    sheetReturnFocus = document.activeElement;
    sheetEl.hidden = false;
    for (const n of behindSheet()) n.inert = true;
    sheetBox.focus({ preventScroll: true });
    void sheetEl.offsetHeight;                 // чтобы переход проигрался с начала
  } else if (focusedIdx >= 0) {
    btns()[focusedIdx]?.focus({ preventScroll: true });
  }
  // если окно прокручивается — касанием двигаем содержимое, иначе — тянем окно вниз (закрыть)
  sheetBox.style.touchAction = sheetBox.scrollHeight > sheetBox.clientHeight + 1 ? "pan-y" : "none";
  sheetEl.classList.add("show");
}
const sheetClose = () => {
  sheetEl.classList.remove("show");
  clearTimeout(sheetTimer);
  sheetTimer = setTimeout(() => { sheetEl.hidden = true; }, 400);
  for (const n of behindSheet()) n.inert = false;
  if (sheetReturnFocus?.isConnected) sheetReturnFocus.focus({ preventScroll: true });
  sheetReturnFocus = null;
  const after = sheetAfterClose;               // что сделать после закрытия (любым способом)
  sheetAfterClose = null;
  after?.();
};

// ---------- режим «что учить»: кнопка в правом нижнем углу карточки, выбор видов ----------
const KINDS = [
  ["word", "Слова"], ["phrasal verb", "Фразовые глаголы"], ["conversational", "Фразы"],
  ["idiom", "Идиомы"], ["slang", "Сленг"], ["proverb", "Пословицы"],
];

const LEVELS = ["A2", "B1", "B2"];   // A1 в базе нет

/** Набор выбранных уровней или null, если выбраны все (тогда уровень не фильтруется). */
function allowedLevels() {
  const l = settings().levels;
  if (!Array.isArray(l)) return null;
  const set = new Set(l.filter((x) => LEVELS.includes(x)));
  return set.size && set.size < LEVELS.length ? set : null;
}

const filterOn = () => !!(allowedTypes() || allowedLevels());
/** Подходит ли запись под выбранные виды и уровни. */
const fits = (p) => (!allowedTypes() || allowedTypes().has(p.type)) && (!allowedLevels() || allowedLevels().has(p.level));

/** Набор выбранных видов или null, если выбраны все (тогда ничего не фильтруется). */
function allowedTypes() {
  const k = settings().kinds;
  if (!Array.isArray(k)) return null;
  const set = new Set(k.filter((t) => KINDS.some(([v]) => v === t)));
  return set.size && set.size < KINDS.length ? set : null;
}

const refreshModeBtn = () => {
  el.mode.classList.toggle("on", filterOn());
  el.mode.setAttribute("aria-pressed", String(filterOn()));
};

/** После закрытия окна выбора: если текущая карточка не подходит (или карточек не было) — взять новую. */
function applyModes() {
  refreshModeBtn();
  if (session) return;                          // сессия «Повтор» живёт по своим правилам
  if (!cur || !fits(progress.phrases.get(cur) || {})) nextCard();
}

function openModes() {
  const everyKind = () => new Set(KINDS.map(([v]) => v)), everyLevel = () => new Set(LEVELS);
  const kindSel = allowedTypes() || everyKind(), levelSel = allowedLevels() || everyLevel();
  const kindsAll = kindSel.size === KINDS.length, levelsAll = levelSel.size === LEVELS.length;
  // числа на кнопках учитывают второй фильтр: сколько записей этого вида при выбранных уровнях и наоборот
  const kindCount = {}, levelCount = {};
  for (const p of progress.phrases.values()) {
    if (levelSel.has(p.level)) kindCount[p.type] = (kindCount[p.type] || 0) + 1;
    if (kindSel.has(p.type)) levelCount[p.level] = (levelCount[p.level] || 0) + 1;
  }
  const save = (kinds, levels) => {
    const s = settings();
    s.kinds = kinds.size === KINDS.length ? null : [...kinds];
    s.levels = levels.size === LEVELS.length ? null : [...levels];
    progress.save(); refreshModeBtn(); markExplored("mode"); openModes();
  };
  /** Блок кнопок: «Все …» и по одной на значение; из «Все» выбор начинается с нуля, хотя бы одно значение остаётся выбранным. */
  const group = (title, allLabel, items, sel, isAll, counts, cls, apply) => {
    const wrap = make("div", "kindsec");
    wrap.append(make("div", "kindlabel", title));
    const grid = make("div", "kindgrid" + cls);
    const all = make("button", "btn all" + (isAll ? " on" : ""), allLabel);
    all.setAttribute("aria-pressed", String(isAll));
    all.addEventListener("click", () => apply(new Set(items.map(([v]) => v))));
    grid.append(all);
    for (const [value, label] of items) {
      const on = !isAll && sel.has(value);
      const b = make("button", "btn" + (on ? " on" : ""));
      b.setAttribute("aria-pressed", String(on));
      b.append(label, make("small", "", String(counts[value] || 0)));
      b.addEventListener("click", () => {
        const next = new Set(isAll ? [] : sel);
        if (next.has(value)) next.delete(value); else next.add(value);
        if (next.size) apply(next);
      });
      grid.append(b);
    }
    wrap.append(grid);
    return wrap;
  };
  sheetOpen((box) => {
    box.append(make("h2", "", "Что учить"));
    box.append(make("p", "", "Выберите виды и уровни, можно по нескольку. Карточки будут только из выбранных."));
    box.append(group("Виды", "Все виды", KINDS, kindSel, kindsAll, kindCount, "", (k) => save(k, levelSel)));
    box.append(group("Уровень", "Все уровни", LEVELS.map((l) => [l, l]), levelSel, levelsAll, levelCount, " levels", (l) => save(kindSel, l)));
    box.append(make("p", "levelnote", "A2 — попроще, B1 — средний, B2 — выше среднего."));
    const done = make("button", "btn primary wide", "Готово");
    done.addEventListener("click", sheetClose);
    box.append(done);
  }, true);
  sheetAfterClose = applyModes;
}

// ---------- задний фон: «Анимация» / «Без движения» / «Выкл» (настройка bg) ----------
let bgCtl = null;
let appActive = true;   // false, пока Телеграм прислал «deactivated» (приложение свёрнуто); фон тогда стоит на паузе
function applyBg() {
  const mode = settings().bg || "anim";
  if (mode === "off") { bgCtl?.stop(); bgCtl = null; return; }
  if (!bgCtl) { try { bgCtl = startMolten(); bgCtl?.suspend(!appActive); } catch { bgCtl = null; } }   // без WebGL2 фона просто нет
  bgCtl?.setStill(mode === "still");
}

/** Ряд кнопок-переключателей: options = [[значение, подпись], ...]. */
function segRow(options, current, onPick) {
  const seg = make("div", "seg");
  for (const [value, label] of options) {
    const b = make("button", "segbtn" + (value === current ? " on" : ""), label);
    b.setAttribute("aria-pressed", String(value === current));
    b.addEventListener("click", () => onPick(value));
    seg.append(b);
  }
  return seg;
}

function setRow(label, control) {
  const r = make("div", "setrow");
  control.setAttribute("role", "group");
  control.setAttribute("aria-label", label);
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

/**
 * Раскрытие карточки настройки. Перенос анимации появления из CardNav (React Bits): высота панели — пружина с лёгким
 * отскоком (жёсткость 160, bounce 0.2), внутри кнопки «поднимаются» по очереди (эффект rise: сдвиг 26 px, масштаб 0.97→1,
 * прозрачность; задержка между кнопками 0.12). При «уменьшить движение» — без пружины и сдвигов.
 */
function attachReveal(head, panel, inner, items) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const K = 160, BOUNCE = 0.2, STAGGER = 0.12;
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const S = { p: 0, v: 0 };
  let raf = 0, last = 0, open = false;

  const render = () => {
    panel.style.height = `${Math.max(0, S.p) * inner.offsetHeight}px`;
    // обрезка не по самой панели, а с запасом 24 px (сверху и по бокам всегда, снизу — по мере раскрытия), чтобы свечение выбранной кнопки не обрезалось «квадратом»
    panel.style.clipPath = `inset(-24px -24px ${-24 * clamp(S.p, 0, 1)}px -24px)`;
    const n = items.length, lag = n > 1 ? Math.min(STAGGER, 0.7 / (n - 1)) : 0, span = 1 - lag * (n - 1);
    items.forEach((el, i) => {
      const local = clamp((S.p - i * lag) / Math.max(span, 0.05), 0, 1), e = 1 - (1 - local) ** 3;
      el.style.transform = e < 1 && !reduce ? `translateY(${(1 - e) * 26}px) scale(${0.97 + 0.03 * e})` : "";
      el.style.opacity = e < 1 ? String(e) : "";
    });
  };
  const tick = (now) => {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    const target = open ? 1 : 0;
    if (reduce) { S.p = target; S.v = 0; }
    else {
      const zeta = open ? 1 - 0.68 * BOUNCE : 1;
      const steps = Math.ceil(dt / (1 / 240)), h = dt / steps;
      for (let i = 0; i < steps; i++) {
        S.v += (-K * (S.p - target) - 2 * zeta * Math.sqrt(K) * S.v) * h;
        S.p += S.v * h;
      }
    }
    const done = Math.abs(S.p - target) < 0.0005 && Math.abs(S.v) < 0.002;
    if (done) { S.p = target; S.v = 0; }
    render();
    if (done && !open) panel.classList.remove("vis");   // закрыто — кнопки недоступны ни мышью, ни с клавиатуры
    if (!done) raf = requestAnimationFrame(tick);
  };
  head.addEventListener("click", () => {
    open = !open;
    head.setAttribute("aria-expanded", String(open));
    if (open) panel.classList.add("vis");
    if (!raf) { last = 0; raf = requestAnimationFrame(tick); }
  });
  render();
}

/**
 * Белая «плашка» выбора, которая переезжает между вариантами. Перенос анимации RubberSegment (React Bits) на обычный JS, без Motion:
 * при нажатии плашка растягивается (stretch 15%, 0.19 с, ease-out) и «приземляется» пружиной (0.3 с, bounce 0): передний край приходит
 * первым, задний догоняет без отскока и сжатия (в оригинале есть «сжатие» на 3 px — по просьбе убрано); скорость 1.15. Тёмный текст внутри плашки рисует копия
 * подписей, обрезанная по плашке (clip-path), поэтому цвет букв меняется ровно по мере проезда. При «уменьшить движение» плашка прыгает.
 * Не перенесено: перетаскивание плашки пальцем (резиновые края, бросок) — по просьбе только анимация.
 */
function cubicBezier(x1, y1, x2, y2) {
  const at = (a, b, t) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
  return (x) => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (at(x1, x2, mid) < x) lo = mid; else hi = mid; }
    return at(y1, y2, (lo + hi) / 2);
  };
}
const EASE_THUMB = cubicBezier(0.23, 1, 0.32, 1);

function attachThumb(seg, labels, startIdx) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const STRETCH = 0.15, SPEED = 1.15, DILATE = 0.19, HANDOFF = 0.15, INSET = 4;
  const t = (sec) => sec / SPEED;
  const glow = make("div", "thumbglow"), thumb = make("div", "thumb");
  thumb.setAttribute("aria-hidden", "true");
  const btns = [...seg.querySelectorAll(".segbtn")];
  labels.forEach((text, i) => {                           // тёмная копия подписи для белой плашки; значок кнопки (если есть) — тоже
    const copy = make("span", "thumbcopy", text);
    const icon = btns[i] && btns[i].querySelector("svg");
    if (icon) copy.prepend(icon.cloneNode(true));
    thumb.append(copy);
  });
  seg.append(glow, thumb);

  const L = { x: 0, v: 0, m: null }, R = { x: 0, v: 0, m: null };
  let slots = [], innerW = 0, idx = startIdx, handoff = 0, gen = 0, raf = 0, last = 0;

  const render = () => {
    thumb.style.clipPath = `inset(0 ${Math.max(0, innerW - R.x)}px 0 ${Math.max(0, L.x)}px round 999px)`;
    glow.style.left = `${INSET + L.x}px`;
    glow.style.width = `${Math.max(0, R.x - L.x)}px`;
  };
  const measure = () => {   // offsetLeft не зависит от сдвигов и масштаба карточки во время раскрытия
    slots = btns.map((b) => ({ l: b.offsetLeft - INSET, r: b.offsetLeft - INSET + b.offsetWidth }));
    innerW = thumb.clientWidth;
  };
  const jump = (i) => {
    const sl = slots[i];
    if (!sl) return;
    clearTimeout(handoff); gen++;
    L.x = sl.l; R.x = sl.r; L.v = R.v = 0; L.m = R.m = null;
    render();
  };

  const step = (e, now, dt) => {
    const m = e.m;
    if (!m) return;
    if (m.type === "tw") {
      const p = Math.min(1, (now - m.t0) / m.dur), nx = m.from + (m.to - m.from) * EASE_THUMB(p);
      e.v = dt ? (nx - e.x) / dt : 0;
      e.x = nx;
      if (p >= 1) e.m = null;
    } else {
      const n = Math.ceil(dt / (1 / 240)), h = dt / n;
      for (let i = 0; i < n; i++) { e.v += (-m.k * (e.x - m.to) - m.c * e.v) * h; e.x += e.v * h; }
      if (Math.abs(e.x - m.to) < 0.01 && Math.abs(e.v) < 0.05) { e.x = m.to; e.v = 0; e.m = null; m.done?.(); }
    }
  };
  const tick = (now) => {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    step(L, now, dt); step(R, now, dt);
    render();
    if (L.m || R.m) raf = requestAnimationFrame(tick);
  };
  const wake = () => { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } };
  const tween = (e, to, sec) => { e.m = { type: "tw", from: e.x, to, t0: performance.now(), dur: sec * 1000 }; wake(); };
  const spring = (e, to, sec, done) => {
    const w = (2 * Math.PI) / sec;                        // bounce 0 = критическое затухание
    e.v = Math.min(2000, Math.max(-2000, e.v));
    e.m = { type: "sp", to, k: w * w, c: 2 * w, done };
    wake();
  };

  /** Приземление: передний край приходит первым, задний доезжает следом (без отскока). */
  const land = (to) => {
    const b = slots[to];
    ++gen;
    if (!b) return;
    const dir = Math.sign((b.l + b.r) / 2 - (L.x + R.x) / 2) || 1;
    const [lead, leadTo, trail, trailTo] = dir > 0 ? [R, b.r, L, b.l] : [L, b.l, R, b.r];
    spring(lead, leadTo, t(0.3));
    spring(trail, trailTo, t(0.3));                       // без «сжатия» и отскока в конце: края просто доезжают до места
  };

  const shown = (on) => { thumb.style.opacity = glow.style.opacity = on ? "" : "0"; };   // прозрачность плавная (см. .thumb в style.css)
  if (startIdx < 0) shown(false);                                                         // стартуем без выбранного — плашки нет
  new ResizeObserver(() => { measure(); jump(idx); }).observe(seg);   // сработает и когда экран станет видимым
  return {
    go(to) {
      if (to === idx) return;
      measure();
      const a = slots[idx], b = slots[to];
      idx = to;
      if (!b) { shown(false); return; }                       // ничего не выбрано — плашка плавно тает на месте
      if (!a) { jump(to); shown(true); return; }              // плашки не было — встаёт на место, пока прозрачна, и плавно проявляется
      if (reduce) { jump(to); return; }
      clearTimeout(handoff); gen++;
      tween(L, b.l + (Math.min(a.l, b.l) - b.l) * STRETCH, t(DILATE));
      tween(R, b.r + (Math.max(a.r, b.r) - b.r) * STRETCH, t(DILATE));
      handoff = setTimeout(() => land(to), t(HANDOFF) * 1000);
    },
  };
}

const ONOFF = [[true, "Вкл"], [false, "Выкл"]];

/** Поле настройки: подпись (необязательная) и переключатель с переезжающей белой плашкой. */
function field(label, options, current, onPick, groupName) {
  const seg = segRow(options, current, (v) => {
    onPick(v);
    play("set");
    [...seg.querySelectorAll(".segbtn")].forEach((b, i) => {   // карточки не перестраиваются — раскрытие не сбрасывается
      const on = options[i][0] === v;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    thumb.go(options.findIndex((o) => o[0] === v));            // белая плашка переезжает на выбранный вариант
  });
  const thumb = attachThumb(seg, options.map((o) => o[1]), options.findIndex((o) => o[0] === current));
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", groupName || label || "");
  const f = make("div", "field");
  if (label) f.append(make("div", "fieldlabel", label));
  f.append(seg);
  return f;
}

const ASK_PRESETS = [15, 30, 45, 60];   // быстрые кнопки под ползунком

/** «Время на ответ»: ползунок от ASK_MIN до ASK_MAX секунд (шаг 1) и под ним быстрые кнопки 15s / 30s / 45s / 60s. Значение сохраняется сразу; действует со следующей карточки. */
function askSlider() {
  const f = make("div", "field askfield");
  const value = make("div", "askvalue");
  const range = make("input");
  const start = Math.min(ASK_MAX, Math.max(ASK_MIN, settings().ask || ASK_DEFAULT));
  Object.assign(range, { type: "range", min: ASK_MIN, max: ASK_MAX, step: 1, value: start });
  range.setAttribute("aria-label", "Время на ответ, секунд");
  const quick = segRow(ASK_PRESETS.map((n) => [n, n + "s"]), start, (n) => { apply(n, true); play("set"); });
  quick.setAttribute("role", "group");
  quick.setAttribute("aria-label", "Быстро выбрать время на ответ");
  const thumb = attachThumb(quick, ASK_PRESETS.map((n) => n + "s"), ASK_PRESETS.indexOf(start));   // нет в списке — плашки нет
  const place = (v) => {                                   // ползунок и его заливка стоят на значении v (можно дробном)
    range.value = v;
    range.style.setProperty("--p", `${((v - ASK_MIN) / (ASK_MAX - ASK_MIN)) * 100}%`);
  };
  let glideRaf = 0;
  /** Плавно довезти ползунок до значения n (кнопки 15s…60s): ~0,4 с, замедление к концу; step="any" — чтобы шёл не целыми секундами, а непрерывно. */
  const glide = (n) => {
    cancelAnimationFrame(glideRaf);
    const from = Number(range.value), t0 = performance.now(), dur = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 400;
    range.step = "any";
    const run = (now) => {
      const p = dur ? Math.min(1, (now - t0) / dur) : 1;
      place(from + (n - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) glideRaf = requestAnimationFrame(run);
      else { range.step = 1; place(n); }
    };
    glideRaf = requestAnimationFrame(run);
  };
  const apply = (n, smooth = false) => {                   // показать, сохранить, подсветить подходящую быструю кнопку
    value.textContent = `${n}s`;
    if (smooth) glide(n);
    else { cancelAnimationFrame(glideRaf); range.step = 1; place(n); }
    settings().ask = n; progress.save();
    const at = ASK_PRESETS.indexOf(n);
    [...quick.querySelectorAll(".segbtn")].forEach((b, k) => { b.classList.toggle("on", k === at); b.setAttribute("aria-pressed", String(k === at)); });
    thumb.go(at);
  };
  range.addEventListener("input", () => apply(Number(range.value)));
  value.textContent = `${start}s`;
  range.style.setProperty("--p", `${((start - ASK_MIN) / (ASK_MAX - ASK_MIN)) * 100}%`);
  f.append(value, range, quick, make("p", "asknote", "Время начнёт действовать со следующей карточки."));
  return f;
}

/** «Дневная серия»: цель дня и награда за неё. Одни и те же два раздела — в «Больше → Настройки» и во всплывающем окне у серии (⋯). */
function streakSections() {
  const goal = make("div", "section");
  goal.append(
    make("div", "sechead", "Цель на день"),
    field("Верных ответов", GOALS.map((n) => [n, String(n)]), progress.goal(), (n) => {
      progress.data.goal = n; progress.save(); updateGoal();
    }, "Цель на день, верных ответов"));
  const reward = make("div", "section");
  reward.append(
    make("div", "sechead", "При достижении цели"),
    field("Звук", ONOFF, settings().goalSound !== false, (v) => { settings().goalSound = v; progress.save(); }),
    field("Конфетти", ONOFF, settings().confetti !== false, (v) => { settings().confetti = v; progress.save(); }));
  return [goal, reward];
}

/** «Больше → Настройки»: каждая настройка — отдельная карточка (как слово в «Закладках»); варианты спрятаны и всплывают по нажатию. */
function renderGeneral() {
  const body = $("generalBody");
  const card = (title, nodes, icon) => {
    const id = "set" + Math.random().toString(36).slice(2, 8);
    const head = make("button", "sethead");
    head.setAttribute("aria-expanded", "false");
    head.setAttribute("aria-controls", id);
    const ico = make("span", "mico");                       // значок слева от названия настройки
    ico.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">${icon}</svg>`;
    const left = make("span", "sethl");
    left.append(ico, make("span", "setlabel", title));
    head.append(left);
    head.insertAdjacentHTML("beforeend", '<svg class="chev" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>');
    const inner = make("div", "setinner");
    inner.append(...nodes);
    const panel = make("div", "setpanel");
    panel.id = id;
    panel.append(inner);
    const c = make("div", "item setcard");
    c.append(head, panel);
    attachReveal(head, panel, inner, [...inner.children]);   // всплывают поля по очереди (в каждом — полоска с плашкой)
    return c;
  };
  body.replaceChildren(
    card("Дневная серия", streakSections(), `<path d="${FLAME_PATH}"/>`),
    card("Звук", [field(null, ONOFF, settings().sound !== false, (v) => { settings().sound = v; progress.save(); })],
      '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
    card("Задний фон", [field(null, [["anim", "Анимация"], ["still", "Без движения"], ["off", "Выкл"]], settings().bg || "anim", (v) => {
      settings().bg = v; progress.save(); applyBg();
    })], '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4"/>'),
    card("Время на ответ", [askSlider()], '<circle cx="12" cy="13.5" r="7"/><path d="M12 10v4l2.5 1.5M9.5 3.5h5"/>'),
    card("Напоминания", [                                    // в «Больше»: точка у «Повтора» (есть что повторять) и у «Достижений» (есть новое)
      field("Повтор", ONOFF, settings().dotRev !== false, (v) => { settings().dotRev = v; progress.save(); }),
      field("Достижения", ONOFF, settings().dotAch !== false, (v) => { settings().dotAch = v; progress.save(); }),
      field("Прогресс", ONOFF, settings().dotProg !== false, (v) => { settings().dotProg = v; progress.save(); }),
      make("p", "asknote remnote", "Напоминания — это красные точки в разделе «Больше». У «Повтора» точка горит, пока есть что повторять. У «Достижений» — когда получено новое достижение, которое вы ещё не просмотрели; она гаснет, как только вы откроете «Достижения». У «Прогресса» — когда ваша серия выросла с прошлого захода в «Прогресс»; она гаснет, как только вы его откроете."),
    ], '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'));
  $("generalNote").replaceChildren(
    make("p", "diag", diagText()));
  animateList(body, { entrance: true, bottomEl: $("bar") });
}

// «Инвентарь»: переключатель разделов (Закладки · Трудные · Учу · Выучено) — та же переезжающая плашка, что в «Общих»
const invSeg = document.querySelector("#inv .seg");
const invThumb = attachThumb(invSeg, [...invSeg.querySelectorAll(".segbtn")].map((b) => b.textContent.trim()), 0);

// ---------- три точки у серии: всплывающее окно с теми же настройками «Дневной серии» ----------
function openStreakPop() {
  const wrap = $("spopWrap"), box = $("spop"), more = $("chipMore");
  if (!wrap.hidden) return;
  box.replaceChildren(...streakSections().map((sec) => {
    const c = make("div", "item setcard spopcard");
    c.append(sec);
    return c;
  }));
  wrap.hidden = false;
  const r = more.getBoundingClientRect(), m = r;
  const w = Math.min(340, window.innerWidth - 24);
  const left = Math.max(12, Math.min(r.right - w, window.innerWidth - w - 12));
  box.style.width = `${w}px`;
  box.style.left = `${left}px`;
  box.style.top = `${r.bottom + 8}px`;
  box.style.transformOrigin = `${m.left + m.width / 2 - left}px 0`;   // вырастает из самих трёх точек
  more.setAttribute("aria-expanded", "true");
  void wrap.offsetHeight;                                             // чтобы переход проигрался с начала
  wrap.classList.add("show");
  box.focus({ preventScroll: true });
}
function closeStreakPop() {
  const wrap = $("spopWrap");
  if (wrap.hidden) return;
  wrap.classList.remove("show");
  $("chipMore").setAttribute("aria-expanded", "false");
  $("chipMore").focus({ preventScroll: true });
  setTimeout(() => { if (!wrap.classList.contains("show")) wrap.hidden = true; }, 260);
}

/** Первый запуск: выбрать цель на день. */
function openWelcome(then) {
  sheetOpen((box) => {
    box.append(make("h2", "", "Цель на день"));
    box.append(make("p", "", "Сколько верных ответов в день вы хотите давать? Выполнили цель — дни считаются в серию. Потом это можно изменить: Больше → Настройки."));
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

// ---------- «Переводчик» (вкладка; логика — translator.js, перевод делает DeepL через посредника) ----------
// «Живой» режим: кнопки нет, перевод запускается сам через TR_DELAY мс после последней введённой буквы; если текст успел
// измениться, прошлый запрос отменяется (ответ не тратит лимит и не перетирает новое). Одинаковый текст заново не отправляется.
const TR_DELAY = 700;
function setupTranslator() {
  const input = $("trInput"), res = $("trResult"), err = $("trErr"), status = $("trStatus"), foot = $("trFoot"), clear = $("trClear");
  let dir = "ru";                                           // "ru" — с русского на английский
  let timer = 0, ctl = null, done = "";                     // done — для какого текста и направления сейчас показан перевод
  const key = () => dir + "|" + input.value.trim();
  const setStatus = (busy) => { status.classList.toggle("busy", busy); };   // текст «Перевожу…» всегда в разметке: плавно проявляется и тает через CSS
  const showResult = (text) => { res.textContent = text; foot.hidden = !text; err.hidden = true; };
  const showError = (msg) => { res.textContent = ""; foot.hidden = true; err.textContent = msg; err.hidden = false; };
  const stop = () => { clearTimeout(timer); if (ctl) { ctl.abort(); ctl = null; } };
  const refresh = () => {
    $("trFrom").textContent = dir === "ru" ? "Русский" : "English";
    $("trTo").textContent = dir === "ru" ? "English" : "Русский";
    input.placeholder = dir === "ru" ? "Введите текст на русском" : "Type text in English";
    $("trCount").textContent = String(input.value.length);
    clear.hidden = !input.value;
  };
  const run = async () => {
    const text = input.value.trim();
    if (!text) return;
    const k = key();
    if (k === done) { setStatus(false); return; }
    stop();
    ctl = new AbortController();
    const mine = ctl;
    setStatus(true); err.hidden = true;
    try {
      const out = await translate(text, dir, { signal: mine.signal });
      if (ctl !== mine) return;
      showResult(out); done = k;
    } catch (e) {
      if (ctl !== mine || (e instanceof TranslateError && e.code === "cancelled")) return;
      showError(e instanceof TranslateError ? e.message : "Что-то пошло не так. Попробуйте ещё раз.");
    }
    if (ctl === mine) { ctl = null; setStatus(false); }
  };
  const schedule = () => {                                  // вызывается при каждом изменении текста
    refresh();
    stop();
    if (!input.value.trim()) { done = ""; showResult(""); setStatus(false); return; }
    if (key() === done) { setStatus(false); return; }
    setStatus(true);
    timer = setTimeout(run, TR_DELAY);
  };
  input.setAttribute("maxlength", String(MAX_CHARS));
  input.addEventListener("input", schedule);
  clear.addEventListener("click", () => { input.value = ""; schedule(); input.focus(); });
  // подсказки («Введите текст…» в поле и «Перевод появится здесь») при смене языков не меняются скачком, а плавно проявляются:
  // подсказка в поле на миг становится прозрачной (класс phhide) и возвращается через CSS-переход; подсказка результата перезапускает свою анимацию (display: none → обратно)
  const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hintsOut = () => { if (calm()) return; input.classList.add("phhide"); res.style.display = "none"; };
  const hintsIn = () => { if (calm()) return; void input.offsetWidth; input.classList.remove("phhide"); res.style.display = ""; };
  let swapTurns = 0;
  $("trSwap").addEventListener("click", () => {
    const had = res.textContent;
    dir = dir === "ru" ? "en" : "ru";
    const arrows = $("trSwap").querySelector("svg");   // стрелки поворачиваются на пол-оборота при каждом нажатии и остаются так (значок симметричный — выглядит так же, но «поменялись местами»)
    swapTurns += 1; arrows.style.transform = `rotate(${swapTurns * 180}deg)`;
    if (had && err.hidden) input.value = had;    // готовый перевод становится новым текстом — сразу переводим обратно
    done = "";
    hintsOut(); refresh(); stop(); hintsIn();
    if (input.value.trim()) { setStatus(true); run(); } else { showResult(""); setStatus(false); }
  });
  // Перевод по фото: кнопка-камера открывает обычное окно телефона (камера / галерея), снимок читает посредник, текст попадает в поле и переводится сам
  const photo = $("trPhoto"), pick = $("trFile"), shim = status.querySelector(".trshim");
  photo.addEventListener("click", () => pick.click());
  pick.addEventListener("change", async () => {
    const file = pick.files && pick.files[0];
    pick.value = "";                                        // чтобы то же фото можно было выбрать снова
    if (!file) return;
    stop(); photo.disabled = true; err.hidden = true;
    shim.textContent = "Читаю текст на фото…"; setStatus(true);
    try {
      const text = await recognizeText(file);
      dir = guessDir(text);                                 // кириллица — «с русского», иначе «с английского»
      input.value = text; done = "";
      shim.textContent = "Перевожу…"; refresh(); run();
    } catch (e) {
      shim.textContent = "Перевожу…"; setStatus(false);
      showError(e instanceof TranslateError ? e.message : "Что-то пошло не так. Попробуйте ещё раз.");
    }
    photo.disabled = false;
  });
  $("trCopy").addEventListener("click", async () => {
    const copy = $("trCopy");
    try { await navigator.clipboard.writeText(res.textContent); }
    catch { const r = document.createRange(); r.selectNodeContents(res); const s = getSelection(); s.removeAllRanges(); s.addRange(r); try { document.execCommand("copy"); } catch { /* не страшно */ } }
    copy.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';                                // подтверждение — галочка вместо значка на 1,5 секунды
    copy.setAttribute("aria-label", "Скопировано");
    setTimeout(() => { copy.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3.5" y="8.5" width="12" height="12" rx="3.2"/><path d="M8.5 8.3V6.7a3.2 3.2 0 0 1 3.2-3.2h5.6a3.2 3.2 0 0 1 3.2 3.2v5.6a3.2 3.2 0 0 1-3.2 3.2h-1.6"/></svg>'; copy.setAttribute("aria-label", "Скопировать перевод"); }, 1500);
  });
  refresh();
}

// ---------- жесты ----------
// 1) свайп влево/вправо по экрану — соседняя вкладка (влево — следующая, вправо — предыдущая);
// 2) свайп вниз по окну («Что учить») — закрыть его.
function setupGestures() {
  const SKIP = "input, textarea, select, .swipe-toast, .sheet, .spopwrap, #bar, .dkinds";   // отсюда свайп вкладок не начинаем
  let st = null;
  document.addEventListener("pointerdown", (e) => {
    st = e.button === 0 && sheetEl.hidden && !e.target.closest(SKIP)
      ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), lock: null } : null;
  });
  document.addEventListener("pointermove", (e) => {
    if (!st || st.id !== e.pointerId || st.lock) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (Math.hypot(dx, dy) > 10) st.lock = Math.abs(dx) > Math.abs(dy) * 1.3 ? "h" : "v";   // «вбок» или «вверх-вниз»
  });
  document.addEventListener("pointerup", (e) => {
    const s = st;
    st = null;
    if (!s || s.id !== e.pointerId || s.lock !== "h") return;
    const dx = e.clientX - s.x, fast = performance.now() - s.t < 250;
    if (Math.abs(dx) < (fast ? 40 : 70)) return;                    // нужен либо длинный, либо быстрый свайп
    if (tabOf(view) !== view && dx > 0) { showView(BACK_OF[view] || "more"); return; }   // из раздела «Настроек» свайп вправо = назад
    const i = TABS.indexOf(tabOf(view)) + (dx < 0 ? 1 : -1);
    if (i >= 0 && i < TABS.length) showView(TABS[i]);
  });
  document.addEventListener("pointercancel", () => { st = null; });

  let sd = null;
  const resetBox = () => { sheetBox.style.transition = ""; sheetBox.style.transform = ""; };
  sheetBox.addEventListener("pointerdown", (e) => {
    sd = e.button === 0 && sheetEl.dataset.closable && sheetEl.classList.contains("show") && sheetBox.scrollTop === 0 && !e.target.closest(".aimsgs, textarea, input")
      && !(e.pointerType === "touch" && sheetEl.classList.contains("aiopen"))   // пальцем окно ИИ тянет touch-код в setupAi (иначе двойная обработка)
      ? { id: e.pointerId, y: e.clientY, dy: 0, t: performance.now(), moved: false } : null;
  });
  sheetBox.addEventListener("pointermove", (e) => {
    if (!sd || sd.id !== e.pointerId) return;
    const dy = e.clientY - sd.y;
    if (!sd.moved) {
      if (dy < 8) return;
      sd.moved = true;
      try { sheetBox.setPointerCapture(e.pointerId); } catch { /* не страшно */ }
      sheetBox.style.transition = "none";
    }
    sd.dy = Math.max(0, dy);
    sheetBox.style.transform = `translateY(${sd.dy}px)`;
  });
  const endSheetDrag = (e) => {
    if (!sd || sd.id !== e.pointerId) return;
    const s = sd;
    sd = null;
    try { sheetBox.releasePointerCapture(e.pointerId); } catch { /* не страшно */ }
    if (!s.moved) return;
    if (s.dy > 90 || (s.dy > 40 && performance.now() - s.t < 300)) {  // длинный или быстрый свайп вниз — закрыть
      sheetBox.style.transition = "transform .28s cubic-bezier(.4, 0, 1, 1)";
      sheetBox.style.transform = "translateY(100%)";
      sheetClose();
      setTimeout(resetBox, 450);
    } else {                                                           // не дотянули — вернуть на место
      sheetBox.style.transition = "transform .35s cubic-bezier(.23, 1, .32, 1)";
      sheetBox.style.transform = "translateY(0)";
      setTimeout(resetBox, 380);
    }
  };
  sheetBox.addEventListener("pointerup", endSheetDrag);
  sheetBox.addEventListener("pointercancel", endSheetDrag);
}

// ---------- «ИИ-помощник»: плавающая кнопка и окно чата (логика — ai.js) ----------
// Как у Binance: маленькая кнопка всегда на экране (её можно перетащить к любому краю), по нажатию на почти весь экран выезжает окно чата — как окно «Что учить».
// Подключается Google Gemini: у каждого пользователя СВОЙ бесплатный ключ (один раз вставить в окне подключения). Ключ лежит в его настройках (settings.aiKey,
// облако Телеграма) и уходит только в Google; без ключа чат не открывается — только окно подключения. Переписка хранится до закрытия приложения.
const AI = { msgs: [], busy: false, ctl: null, token: 0, gen: 0 };
const aiKey = () => settings().aiKey || "";
const SVG_TRASH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 7h14M10 7V4.8h4V7M7 7l.8 12.2h8.4L17 7M10.2 10.5v5.5M13.8 10.5v5.5"/></svg>';
const SVG_KEY = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="7.6" cy="16.4" r="4.4"/><circle cx="7.6" cy="16.4" r="1.4"/><path d="M10.8 13.2L20.6 3.4M17.4 6.6l2.8 2.8M14.2 9.8l2.3 2.3"/></svg>';
const SVG_X = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const SVG_PLUS = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const SVG_PDF = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"/><path d="M14 3.5V8h4"/></svg>';
const SVG_SEND = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';

const openLink = (url) => { const tg = window.Telegram && window.Telegram.WebApp; if (tg && tg.openLink) tg.openLink(url); else window.open(url, "_blank", "noopener"); };
const aiIconBtn = (svg, label, fn) => { const b = make("button", "aiicon"); b.innerHTML = svg; b.setAttribute("aria-label", label); b.addEventListener("click", fn); return b; };

/** Окно ИИ: обычное окно снизу, но подгоняется под видимую область (когда выезжает клавиатура, поле ввода остаётся над ней). */
function aiFit() {
  if (!sheetEl.classList.contains("aiopen")) return;
  const vv = window.visualViewport;
  sheetEl.style.top = (vv ? vv.offsetTop : 0) + "px";
  sheetEl.style.height = (vv ? vv.height : window.innerHeight) + "px";
  sheetEl.style.bottom = "auto";
}
function aiClosed() {
  detachSpecular("aibox");
  AI.cleanup?.(); AI.cleanup = null;
  sheetEl.classList.remove("aiopen");
  sheetEl.style.top = sheetEl.style.height = sheetEl.style.bottom = "";
  AI.token++;                                              // незаконченная проверка ключа больше ничего не откроет
}
function aiSheet(build) {
  sheetOpen(build, true);
  sheetEl.classList.add("aiopen");
  sheetAfterClose = aiClosed;
  sheetBox.style.touchAction = "none";                     // иначе телефон забирает вертикальный жест себе, и свайп вниз (закрыть) не доходит до окна; список сообщений листается сам (.aimsgs: pan-y)
  aiFit();
}

function openAi() { if (aiKey()) openAiChat(); else openAiSetup(); }

/** Окно подключения: инструкция, поле для ключа, проверка. Без ключа это единственное, что открывается. */
function openAiSetup() {
  const token = ++AI.token;
  aiSheet((box) => {
    const head = make("div", "aihead");
    head.append(make("h2", "", aiKey() ? "Ключ ИИ" : "Подключите ИИ"), aiIconBtn(SVG_X, "Закрыть", sheetClose));
    box.append(head,
      make("p", "", "Здесь можно спросить про английский: правила, разницу между словами, почему ответ неправильный. Для этого нужен бесплатный ключ Google — получить его надо один раз, это пара минут."));
    const steps = make("ol", "aisteps");
    for (const t of ["Нажмите кнопку ниже — откроется Google AI Studio.", "Войдите в аккаунт Google и нажмите «Create API key» («Создать ключ»).", "Скопируйте ключ и вставьте его в поле ниже."]) steps.append(make("li", "", t));
    const open = make("button", "btn wide", "Открыть Google AI Studio");
    open.addEventListener("click", () => openLink(KEY_PAGE));
    const field = make("input", "aikey");
    Object.assign(field, { type: "password", placeholder: "Вставьте ключ сюда", autocomplete: "off", autocapitalize: "off", autocorrect: "off", spellcheck: false });
    field.setAttribute("aria-label", "Ключ Google AI Studio");
    const msg = make("div", "aimsgerr"); msg.hidden = true;
    const save = make("button", "btn primary wide", "Проверить и сохранить");
    const go = async () => {
      const key = field.value.trim();
      if (key.length < 20) { msg.textContent = "Вставьте ключ целиком — он длинный, обычно около 40 знаков."; msg.hidden = false; return; }
      msg.hidden = true; save.disabled = true; save.textContent = "Проверяю…";
      try {
        const models = await checkKey(key);
        if (token !== AI.token) return;                    // окно закрыли, пока шла проверка
        settings().aiKey = key; settings().aiModels = models; settings().aiModelsV = 2; settings().aiModel = null; progress.save();
        AI.msgs = [];
        openAiChat();
      } catch (e) {
        if (token !== AI.token) return;
        msg.textContent = e.message || "Не получилось проверить ключ."; msg.hidden = false;
        save.disabled = false; save.textContent = "Проверить и сохранить";
      }
    };
    save.addEventListener("click", go);
    field.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    box.append(steps, open, field, msg, save,
      make("p", "aisafe", "Ключ хранится только у вас, в вашем Телеграме, и отправляется только в Google. Вопросы тратят бесплатный лимит вашего аккаунта Google. Если Google недоступен в вашей стране, ИИ работать не будет."));
    if (aiKey()) {
      const back = make("button", "btn wide", "Вернуться к чату");
      back.addEventListener("click", openAiChat);
      const del = make("button", "btn wide aidel", "Удалить сохранённый ключ");
      del.addEventListener("click", () => { settings().aiKey = null; settings().aiModels = null; settings().aiModel = null; progress.save(); AI.msgs = []; openAiSetup(); });
      box.append(back, del);
    }
  });
}

/** Бегущий градиент для названия: перенос GradientText (React Bits, вариант «flow», без реакции на мышь) — три цветных пятна плывут по основному градиенту.
 *  Каждый кадр пишет в --gt-gradient элемента; цикл сам кончается, когда окно закрыто или заголовок убран из страницы. */
function gradientText(root, { colors, speed, scale, angle }) {
  const TAU = Math.PI * 2;
  let t = 0, last = performance.now();
  const paint = () => {
    const cycle = t / speed, spin = cycle * TAU;
    const blobs = colors.map((color, i) => {
      const rate = 0.55 + ((i * 0.618) % 1) * 0.5;
      const x = 50 + 44 * Math.sin(spin * rate + i * 2.1), y = 50 + 40 * Math.sin(spin * (rate * 0.83 + 0.21) + i * 1.3);
      return `radial-gradient(ellipse ${(22 + 12 * scale).toFixed(1)}% ${(60 + 30 * scale).toFixed(1)}% at ${x.toFixed(2)}% ${y.toFixed(2)}%, ${color} 0%, transparent 100%)`;
    });
    root.style.setProperty("--gt-gradient", `${blobs.join(", ")}, linear-gradient(${angle}deg, ${colors.join(", ")})`);
  };
  const tick = (now) => {
    if (!root.isConnected || sheetEl.hidden) return;
    t += Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    paint();
    requestAnimationFrame(tick);
  };
  paint();
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) requestAnimationFrame(tick);
}

/** Окно чата: переписка, быстрые вопросы, поле ввода. */
function openAiChat() {
  AI.token++;
  aiSheet((box) => {
    box.classList.add("ai");
    const head = make("div", "aihead");
    const btns = make("div", "aibtns");
    btns.append(
      aiIconBtn(SVG_TRASH, "Очистить переписку", () => { AI.ctl?.abort(); AI.gen++; AI.msgs = []; AI.busy = false; send.disabled = false; fill(); }),
      aiIconBtn(SVG_KEY, "Ключ ИИ", openAiSetup),
      aiIconBtn(SVG_X, "Закрыть", sheetClose));
    // название ИИ: слева значок со «звёздочками» (как на кнопке вызова ИИ), справа слово «Donald Ai»; цветной градиент «flow» течёт по обоим (GradientText, см. gradientText ниже),
    // под ними такая же копия, размытая — это свечение (glow 0,65)
    const title = make("h2", "aititle gradient-text"), inner = make("span", "gradient-text__inner"), glow = make("span", "gradient-text__inner gradient-text__glow");
    for (const part of [inner, glow]) {
      const spark = make("span", "aispark"); spark.setAttribute("aria-hidden", "true");
      part.append(spark, make("span", "aiword", "Donald Ai"));
    }
    glow.setAttribute("aria-hidden", "true");
    title.append(inner, glow, make("span", "aibeta", "beta"));   // мелкая полупрозрачная пометка рядом с названием (вне градиента)
    gradientText(title, { colors: ["#ffeddd", "#FF9FFC", "#dbb5ff"], speed: 6, scale: 3, angle: 90 });
    head.append(title, btns);
    const list = make("div", "aimsgs");
    list.setAttribute("aria-live", "polite");
    // строка ввода как в чате Claude: одна скруглённая рамка — сверху вложения и текст, внизу слева «+» (приложить фото или PDF), справа кнопка отправки
    const bar = make("div", "aibox");
    const hint = make("div", "ainote"); hint.hidden = true;     // короткое сообщение над полем («слишком большой файл» и т. п.)
    let hintTimer = 0;
    const note = (t) => { hint.textContent = t; hint.hidden = false; clearTimeout(hintTimer); hintTimer = setTimeout(() => { hint.hidden = true; }, 3500); };
    const files = make("div", "aifiles"); files.hidden = true;
    const input = make("textarea");
    Object.assign(input, { rows: 1, placeholder: "Спросите про английский…", maxLength: 1500 });
    input.setAttribute("aria-label", "Ваш вопрос");
    const tools = make("div", "aitools");
    const picker = make("input"); Object.assign(picker, { type: "file", accept: "image/*,application/pdf", multiple: true, hidden: true });
    const plus = make("button", "aiplus"); plus.innerHTML = SVG_PLUS; plus.setAttribute("aria-label", "Приложить фото или PDF");
    plus.addEventListener("click", () => picker.click());
    const send = make("button", "aisend"); send.innerHTML = SVG_SEND; send.setAttribute("aria-label", "Отправить");
    // Уровень размышления: кнопка рядом с «+» показывает текущий; по нажатию над строкой ввода выезжают плашки «Быстро / Обычно / Глубоко» (в духе PillNav из React Bits:
    // плашки раскрываются по ширине и появляются по очереди, выбранная заливается белым снизу, под ней точка-индикатор). Исходник компонента не присылали — это приближение.
    const lvl = () => settings().aiLevel || AI_DEFAULT;
    const levelBtn = make("button", "ailevel");
    levelBtn.setAttribute("aria-haspopup", "listbox"); levelBtn.setAttribute("aria-expanded", "false");
    levelBtn.innerHTML = '<i class="aidot"></i><span></span>';
    const paintLevel = () => { const L = AI_LEVELS.find((x) => x.id === lvl()) || AI_LEVELS[0]; levelBtn.lastChild.textContent = L.label; levelBtn.setAttribute("aria-label", "Уровень размышления: " + L.label + ". Сменить"); };
    const menu = make("div", "aimenu"); menu.hidden = true;
    const pills = make("div", "aipills"); pills.setAttribute("role", "listbox"); pills.setAttribute("aria-label", "Уровень размышления");
    for (const L of AI_LEVELS) {
      const b = make("button", "aipill"); b.dataset.level = L.id; b.title = L.hint; b.setAttribute("role", "option");
      b.innerHTML = '<span class="aifillc"></span><span class="ailabel"></span><i class="aipdot"></i>';
      b.querySelector(".ailabel").textContent = L.label;
      b.addEventListener("click", () => choose(L.id));
      pills.append(b);
    }
    menu.append(pills);
    const calmMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let menuOpen = false, closing = 0;
    const markOn = () => { for (const b of pills.children) { const on = b.dataset.level === lvl(); b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); } };
    const openMenu = () => {
      clearTimeout(closing); menuOpen = true; menu.hidden = false; levelBtn.setAttribute("aria-expanded", "true");
      for (const b of pills.children) b.classList.remove("on");              // заливка выбранной плашки запускается чуть позже — как «fill» у PillNav
      if (calmMotion()) { markOn(); return; }
      pills.style.width = "";
      const w = pills.offsetWidth;
      pills.animate([{ width: "0px", opacity: 0.2 }, { width: w + "px", opacity: 1 }], { duration: 650, easing: "cubic-bezier(.215, .61, .355, 1)" });   // раскрывается по ширине слева направо
      [...pills.children].forEach((b, i) => b.animate([{ opacity: 0, transform: "translateX(-16px) scale(.9)" }, { opacity: 1, transform: "none" }],
        { duration: 420, delay: 90 + i * 80, easing: "cubic-bezier(.215, .61, .355, 1)", fill: "backwards" }));
      setTimeout(() => { if (menuOpen) markOn(); }, 380);
    };
    const closeMenu = () => {
      if (!menuOpen) return;
      menuOpen = false; levelBtn.setAttribute("aria-expanded", "false");
      if (calmMotion()) { menu.hidden = true; return; }
      const w = pills.offsetWidth;
      pills.animate([{ width: w + "px", opacity: 1 }, { width: "0px", opacity: 0 }], { duration: 320, easing: "cubic-bezier(.4, 0, 1, 1)", fill: "forwards" });
      closing = setTimeout(() => { menu.hidden = true; pills.getAnimations().forEach((a) => a.cancel()); }, 330);
    };
    const choose = (id) => {
      settings().aiLevel = id; progress.save(); paintLevel(); markOn();       // плашка заливается, затем меню закрывается
      setTimeout(closeMenu, calmMotion() ? 0 : 380);
    };
    levelBtn.addEventListener("click", () => (menuOpen ? closeMenu() : openMenu()));
    const outside = (e) => { if (menuOpen && !menu.contains(e.target) && !levelBtn.contains(e.target)) closeMenu(); };   // нажатие в стороне закрывает меню
    AI.cleanup?.(); box.addEventListener("pointerdown", outside); AI.cleanup = () => box.removeEventListener("pointerdown", outside);
    paintLevel();
    const left = make("div", "aileft"); left.append(plus, levelBtn);
    tools.append(left, send);
    bar.append(hint, files, input, tools, picker, menu);
    // Когда курсор в поле ввода, по кромке рамки бегут два блика — как у карточки «Учить», но заметно тусклее (яркость 0,6); плавно проявляются и гаснут
    let glowTimer = 0;
    const rim = () => bar.querySelector(":scope > .specular-light");
    input.addEventListener("focus", () => {
      clearTimeout(glowTimer);
      attachSpecular(bar, "aibox", { intensity: 0.6 });
      const c = rim();
      if (!c) return;
      c.style.transition = "opacity .5s ease"; c.style.opacity = "0"; void c.offsetWidth; c.style.opacity = "1";
    });
    input.addEventListener("blur", () => {
      const c = rim();
      if (!c) return;
      c.style.opacity = "0";
      glowTimer = setTimeout(() => detachSpecular("aibox"), 520);
    });
    let pending = [];                                         // приложенные, но ещё не отправленные файлы: { name, mime, data, thumb }
    const syncSend = () => send.classList.toggle("idle", !input.value.trim() && !pending.length);   // пока нечего отправлять, кнопка приглушена
    const drawFiles = () => {
      files.replaceChildren(); files.hidden = !pending.length; syncSend();
      for (const f of pending) {
        const t = make("div", "aifile");
        if (f.thumb) { const im = make("img"); im.src = f.thumb; im.alt = f.name; t.append(im); }
        else { const d = make("div", "aipdf"); d.innerHTML = SVG_PDF; d.append(make("span", "", f.name)); t.append(d); }
        const x = make("button", "aifilex"); x.innerHTML = SVG_X; x.setAttribute("aria-label", "Убрать файл " + f.name);
        x.addEventListener("click", () => { pending = pending.filter((p) => p !== f); drawFiles(); });
        t.append(x); files.append(t);
      }
    };
    picker.addEventListener("change", async () => {
      const chosen = [...(picker.files || [])]; picker.value = "";
      for (const file of chosen) {
        if (pending.length >= MAX_FILES) { note("Можно приложить не больше " + MAX_FILES + " файлов"); break; }
        try {
          if (file.type === "application/pdf") {
            if (file.size > MAX_PDF_BYTES) { note("PDF слишком большой (больше 6 МБ)"); continue; }
            pending.push({ name: file.name, mime: file.type, data: await toBase64(file), thumb: "" });
          } else {
            const blob = await prepareImage(file);                // фото сжимается до 1600 px и 800 КБ
            pending.push({ name: file.name || "фото.jpg", mime: "image/jpeg", data: await toBase64(blob), thumb: URL.createObjectURL(blob) });
          }
        } catch { note("Не получилось открыть файл " + (file.name || "")); }
      }
      drawFiles();
    });
    box.append(head, list, bar);

    const toEnd = (smooth) => list.scrollTo({ top: list.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    /** Содержимое пузыря ответа ИИ из текста (с жирным и пунктами списка). */
    const fillModel = (b, text) => {
      b.replaceChildren();
      for (const ln of richLines(text)) {
        const d = make("div", ln.li ? "li" : "");
        for (const p of ln.parts) d.append(p.b ? make("b", "", p.t) : document.createTextNode(p.t));
        b.append(d);
      }
    };
    const bubble = (role, text, atts = []) => {
      const b = make("div", "aimsg " + role);
      if (role === "model") fillModel(b, text);
      else {
        if (atts.length) {                                   // приложенные к вопросу фото и PDF — мелкими плитками над текстом
          const row = make("div", "aiattach");
          for (const f of atts) {
            if (f.thumb) { const im = make("img"); im.src = f.thumb; im.alt = f.name; row.append(im); }
            else { const d = make("div", "aipdf"); d.innerHTML = SVG_PDF; d.append(make("span", "", f.name)); row.append(d); }
          }
          b.append(row);
        }
        if (text) b.append(make("div", "aitext", text));
      }
      list.append(b); toEnd(true);
      return b;
    };
    /** Пустая переписка: подсказка и быстрые вопросы. */
    function fill() {
      list.replaceChildren();
      if (!AI.msgs.length) {
        list.append(make("div", "aihint", "Спросите что угодно про английский: правила, разницу между словами, почему ответ оказался неправильным."));
        const chips = make("div", "aichips");
        const quick = ["Чем отличается Present Perfect от Past Simple?", "Когда нужны артикли a, an и the?", "Проверь моё предложение: I am agree with you"];
        const p = cur && view === "learn" ? progress.phrases.get(cur) : null;
        if (p) quick.unshift(`Объясни «${p.en}» и дай примеры`);
        for (const q of quick) { const c = make("button", "aichip", q); c.addEventListener("click", () => submit(q)); chips.append(c); }
        list.append(chips);
      } else for (const m of AI.msgs) bubble(m.role, m.role === "user" ? m.shown : m.text, m.files);
    }
    async function submit(preset) {
      const typed = (preset ?? input.value).trim();               // быстрые вопросы (preset) уходят без файлов, обычная отправка — с приложенными
      const sent = preset === undefined ? pending : [];
      if ((!typed && !sent.length) || AI.busy) return;
      const text = typed || FILE_QUESTION;                         // файл есть, а вопроса нет — спрашиваем «что здесь и что делать»
      if (!AI.msgs.length) list.replaceChildren();
      input.value = ""; input.style.height = "";
      if (sent.length) { pending = []; drawFiles(); } else syncSend();
      AI.msgs.push({ role: "user", text, shown: typed, files: sent }); const mine = bubble("user", typed, sent);
      AI.busy = true; send.disabled = true;
      const typing = make("div", "aimsg model typing"); typing.innerHTML = "<span></span><span></span><span></span>"; list.append(typing); toEnd(true);
      const ctl = AI.ctl = new AbortController();
      let tick = 0;                                                // цикл «печати» ответа (останавливается при любой ошибке)
      try {
        // основная модель и запасные (у старых сохранённых ключей список ещё не записан — берём одну прежнюю)
        if (!settings().aiModels || settings().aiModelsV !== 2) {   // ключ сохранён старой версией (без запасных моделей или с прежним порядком) — составляем список заново (запрос списка лимит не тратит)
          try { settings().aiModels = await checkKey(aiKey(), { signal: ctl.signal }); settings().aiModelsV = 2; progress.save(); } catch (e) { if (e.code === "cancelled") throw e; }
        }
        let models = settings().aiModels || (settings().aiModel ? [settings().aiModel] : []), res;
        // Ответ приходит потоком (кусками по мере написания), а на экране «печатается» плавно: отдельный цикл подтягивает показанный текст к полученному —
        // не быстрее, чем читается, но и не отставая (скорость растёт, если накопилось много непоказанного). Пока текста нет — три точки.
        const gen = ++AI.gen;
        let live = null, full = "", shown = 0, ended = false, finishTyping;
        const typedOut = new Promise((r) => { finishTyping = r; });
        const soft = (t) => { if ((t.match(/\*\*/g) || []).length % 2) { const i = t.lastIndexOf("**"); return t.slice(0, i) + t.slice(i + 2); } return t; };   // недописанное «**жирное» не показываем со звёздочками
        /** Последние несколько знаков «проявляются»: чем ближе к краю печати, тем прозрачнее — край текста не «рубится», а растворяется. */
        const fadeTail = (root, k) => {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          let last = null;
          for (let n = walker.nextNode(); n; n = walker.nextNode()) last = n;
          if (!last || !last.nodeValue) return;
          const t = last.nodeValue, tail = [...t].slice(-k), head = t.slice(0, t.length - tail.join("").length), ref = last.nextSibling, parent = last.parentNode;
          last.nodeValue = head;
          tail.forEach((ch, i) => { const sp = document.createElement("span"); sp.style.opacity = String(0.12 + 0.88 * (i / tail.length)); sp.textContent = ch; parent.insertBefore(sp, ref); });
        };
        const paint = () => {
          const near = list.scrollHeight - list.scrollTop - list.clientHeight < 90;
          fillModel(live, soft(full.slice(0, shown)));
          if (!calmMotion() && (shown < full.length || !ended)) fadeTail(live, 10);
          if (near) list.scrollTop = list.scrollHeight;
        };
        const startTyper = () => {
          typing.remove(); live = make("div", "aimsg model"); list.append(live);
          tick = setInterval(() => {
            if (gen !== AI.gen || !live.isConnected) { clearInterval(tick); finishTyping(); return; }   // переписку очистили или окно перестроили
            const backlog = full.length - shown;
            if (backlog > 0) { shown += calmMotion() ? backlog : Math.min(backlog, Math.max(3, Math.ceil(backlog / 25))); paint(); }   // ≥ 3 знаков за кадр (~190 знаков/с), при большом остатке — быстрее
            else if (ended) { clearInterval(tick); finishTyping(); }
          }, 16);
        };
        const onText = (t) => { full = t; if (!live) startTyper(); };
        const run = () => askWithFallback(aiKey(), models, AI.msgs, { signal: ctl.signal, level: lvl(), onText });
        try { res = await run(); }
        catch (e) {
          if (e.code === "server") {                       // Google перегружен («high demand») — всплески обычно короткие: пауза и ещё круг по моделям, до двух раз; точки на экране всё это время крутятся
            for (let n = 0; n < 2 && !res; n++) {
              await new Promise((r) => setTimeout(r, 2500));
              if (ctl.signal.aborted) throw Object.assign(new Error("отмена"), { code: "cancelled" });   // run() с уже отменённым сигналом не заметил бы отмену
              try { res = await run(); } catch (e2) { if (e2.code !== "server") throw e2; }
            }
            if (!res) throw e;
          } else if (e.code === "model") {                 // все модели пропали из списка — подбираем заново и пробуем ещё раз
            models = settings().aiModels = await checkKey(aiKey(), { signal: ctl.signal }); settings().aiModelsV = 2; progress.save();
            res = await run();
          } else throw e;
        }
        if (gen !== AI.gen) return;                        // пока ждали, переписку очистили
        AI.msgs.push({ role: "model", text: res.text });
        full = res.text; ended = true;
        if (!live) startTyper();                           // ответ пришёл сразу целиком — всё равно печатаем плавно
        await typedOut;
        if (live.isConnected) {
          fillModel(live, res.text);                       // в конце — полный текст без «обрезков» разметки
          live.append(make("small", "aimeta", `${res.model} · ${AI_LEVELS.find((x) => x.id === lvl())?.label} · ${(res.ms / 1000).toFixed(1).replace(".", ",")} с`));   // какая модель и за сколько ответила — мелко и бледно
          list.scrollTop = list.scrollHeight;
        }
      } catch (e) {
        clearInterval(tick); typing.remove();
        if (e.code === "cancelled") return;
        AI.msgs.pop(); mine.remove(); input.value = typed;   // вопрос не ушёл — убираем его из переписки и возвращаем в поле (с файлами), чтобы можно было отправить ещё раз
        if (sent.length) { pending = sent; drawFiles(); }
        const b = bubble("err", e.message || "Что-то пошло не так. Попробуйте ещё раз.");
        if (e.code === "badkey") b.append(" Значок ключа вверху — ввести новый.");
        const g = googleMessage(e);                        // что именно ответил Google — мелко под нашим сообщением (помогает понять причину)
        if (g) b.append(make("small", "aigoogle", "Google: " + g));
      } finally { if (AI.ctl === ctl) { AI.busy = false; send.disabled = false; AI.ctl = null; } }
    }
    send.addEventListener("click", () => submit());
    input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 120) + "px"; syncSend(); });
    // на компьютере Enter отправляет, Ctrl+Enter (на Mac — Cmd+Enter) и Shift+Enter — новая строка; на телефоне Enter — новая строка, отправка кнопкой
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.isComposing || touch) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        input.setRangeText("\n", input.selectionStart, input.selectionEnd, "end");   // браузер сам перенос по Ctrl+Enter не ставит
        input.dispatchEvent(new Event("input"));
      } else submit();
    });
    fill(); syncSend();
    setTimeout(() => toEnd(false), 0);
  });
}

/** Окно ИИ открывается из «Больше → Donald Ai» (плавающую кнопку убрали по просьбе). Здесь — подгонка окна под видимую область (клавиатура) и жесты пальцем. */
function setupAi() {
  $("aiRow").addEventListener("click", openAi);
  if (window.visualViewport) { window.visualViewport.addEventListener("resize", aiFit); window.visualViewport.addEventListener("scroll", aiFit); }
  // Жесты на окне ИИ ведём сами через touch-события. На iPhone `touch-action: none` страницу не держит: она ездила под окном (карточки вверх-вниз, окно «съезжало» вместе с visualViewport),
  // а родной жест отменял pointer-события, и свайп вниз не доходил до закрытия. Теперь touchmove отменяем везде, кроме мест, которые листаются сами (список сообщений, длинный текст в поле,
  // ряд файлов вбок); вниз тянем само окно — отпустили далеко или быстро = закрыть. Пальцы на странице за окном не двигают ничего.
  let tgs = null;
  const resetBox = () => { sheetBox.style.transition = ""; sheetBox.style.transform = ""; };
  sheetEl.addEventListener("touchstart", (e) => {
    tgs = sheetEl.classList.contains("aiopen") && e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now(), dy: 0, drag: false, el: e.target } : null;
  }, { passive: true });
  sheetEl.addEventListener("touchmove", (e) => {
    if (!tgs) return;
    const dx = e.touches[0].clientX - tgs.x, dy = e.touches[0].clientY - tgs.y, el = tgs.el;
    if (!tgs.drag) {
      const area = el.closest("textarea"), sc = el.closest(".aimsgs") || (sheetBox.classList.contains("ai") ? null : sheetBox);   // окно подключения целиком листается само
      if (area && area.scrollHeight > area.clientHeight + 1) return;
      if (el.closest(".aifiles") && Math.abs(dx) > Math.abs(dy)) return;
      const top = !sc || sc.scrollTop <= 0, bottom = !sc || sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1;
      if (sc && !(top && dy > 0) && !(bottom && dy < 0)) return;      // список можно листать в эту сторону — пусть листается
      if (dy <= 8 || !top) { e.preventDefault(); return; }             // вверх или ещё рано тянуть — страницу не двигаем
      tgs.drag = true; sheetBox.style.transition = "none";
    }
    e.preventDefault();
    tgs.dy = Math.max(0, dy);
    sheetBox.style.transform = `translateY(${tgs.dy}px)`;
  }, { passive: false });
  const touchEnd = () => {
    const s = tgs; tgs = null;
    if (!s || !s.drag) return;
    if (s.dy > 90 || (s.dy > 40 && performance.now() - s.t < 300)) {
      sheetBox.style.transition = "transform .28s cubic-bezier(.4, 0, 1, 1)"; sheetBox.style.transform = "translateY(100%)";
      sheetClose(); setTimeout(resetBox, 450);
    } else {
      sheetBox.style.transition = "transform .35s cubic-bezier(.23, 1, .32, 1)"; sheetBox.style.transform = "translateY(0)";
      setTimeout(resetBox, 380);
    }
  };
  sheetEl.addEventListener("touchend", touchEnd);
  sheetEl.addEventListener("touchcancel", touchEnd);
}

// ---------- запуск ----------
async function boot() {
  attachSpecular(document.querySelector("#learn .glass"), "card");   // два блика бегут по кромке карточки (specular.js)
  attachSpecular(document.querySelector("#moreBody .tplace"), "more");   // и по кромке блока «Настройки» в «Больше» — как у «Получено N из M» в «Достижениях»
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
      // серия и «⋯» остаются в шапке рядом с целью дня (как на компьютере), а не в верхней полосе с кнопками Телеграма;
      // верхняя полоса просто пустая — место под «Закрыть» и «…» Телеграма оставляет отступ экрана (body.fs .view)
      document.body.classList.toggle("fs", !!tg.isFullscreen);
    };
    const refit = () => { applyFullscreen(); fit(); };
    tg.onEvent("fullscreenChanged", refit);
    tg.onEvent("safeAreaChanged", fit);
    tg.onEvent("contentSafeAreaChanged", fit);
    // Telegram 8.0+: приложение свернули / вернули (на некоторых клиентах вкладка при этом «не скрыта», и visibilitychange молчит)
    tg.onEvent("deactivated", () => { appActive = false; bgCtl?.suspend(true); });
    tg.onEvent("activated", () => { appActive = true; bgCtl?.suspend(document.hidden); });
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
    fetch("data/phrases.json?v=27").then((r) => r.json()),
    fetch("data/aspect.json?v=27").then((r) => r.json()),
    Store.load(),
  ]);
  phrases = list;
  Core.setAspect(aspect);
  progress = new Core.Progress(phrases, saved, Store.save);
  initAchSeen(progress);   // что получено до обновления — считается просмотренным, красная точка только для новых
  initProgSeen(progress);  // то же для «Прогресса»: сравниваем с состоянием на момент первого запуска
  if (Store.usingCloud) Store.save(progress.data); // если локальная копия была новее — подтянуть облако
  applyBg();
  refreshModeBtn();
  el.mode.addEventListener("click", openModes);
  setupGestures();

  el.check.addEventListener("click", submit);
  $("endSessBtn").addEventListener("click", endSession);
  el.show.addEventListener("click", giveUp);
  el.hintBtn.addEventListener("mousedown", (e) => e.preventDefault());   // нажатие не снимает фокус с поля и не закрывает клавиатуру
  el.hintBtn.addEventListener("click", onHint);
  el.back.addEventListener("click", () => { play("fill"); back(); });
  el.next.addEventListener("click", () => { play("next"); nextCard(); }); // звук «Дальше» — только по клику
  el.known.addEventListener("click", onKnown);
  el.easy.addEventListener("click", () => onRate("easy"));
  el.normal.addEventListener("click", () => onRate("normal"));
  el.hard.addEventListener("click", () => onRate("hard"));
  el.fav.addEventListener("click", toggleFav);
  for (const b of document.querySelectorAll(".tabbtn")) b.addEventListener("click", () => { if (view !== b.dataset.view) play("tab"); showView(b.dataset.view); });   // звук — только при нажатии (не при свайпе) и не на уже открытой вкладке
  for (const b of document.querySelectorAll(".segbtn")) {
    b.addEventListener("click", () => { if (invTab !== b.dataset.tab) play("tab"); invTab = b.dataset.tab; renderInv(); });
  }
  $("invSearch").addEventListener("input", () => renderInv(false));
  $("favFilterBtn").addEventListener("click", () => { favOpen = !favOpen; slideFavFilters(favOpen); });
  $("achSearchBtn").addEventListener("click", () => setAchSearchOpen($("achSearchWrap").hidden));
  $("achSearch").addEventListener("input", renderAch);
  $("achSearch").addEventListener("keydown", (e) => { if (e.key === "Escape") setAchSearchOpen(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("spopWrap").hidden) { closeStreakPop(); return; }
    if (e.key === "Escape" && !sheetEl.hidden && sheetEl.dataset.closable) { sheetClose(); return; }
    if (e.key === "Enter" && view === "learn" && sheetEl.hidden) { e.preventDefault(); onEnter(); }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) Store.flush();
    else loop();
  });
  window.addEventListener("pagehide", Store.flush);

  $("chipMore").addEventListener("click", () => { if ($("spopWrap").hidden) openStreakPop(); else closeStreakPop(); });
  $("spopWrap").addEventListener("pointerdown", (e) => { if (e.target === $("spopWrap")) closeStreakPop(); });   // тап мимо окна — закрыть
  for (const b of document.querySelectorAll("[data-go]")) b.addEventListener("click", () => showView(b.dataset.go));   // блоки «Больше» и кнопки «назад»
  for (const b of $("moreBody").querySelectorAll("button")) b.addEventListener("click", () => play("tab"));   // блоки «Больше» звучат как вкладки (кнопки «назад» — по-прежнему notch)
  $("dictRow").addEventListener("click", () => { invTab = "dict"; showView("inv"); });   // «Словарь» в «Настройках» — переход в «Инвентарь → Словарь»
  setupTranslator();
  setupAi();
  sheetEl.addEventListener("click", (e) => { if (e.target === sheetEl && sheetEl.dataset.closable) sheetClose(); });

  // телефон: тап по пустому месту убирает клавиатуру; пока печатают, панель вкладок прячется
  el.entry.addEventListener("pointerdown", () => { keepFocus = true; });
  document.addEventListener("click", (e) => {
    if (!touch || e.target.closest("input, textarea, button, .item, .sheetbox")) return;   // textarea (поле переводчика) тоже: иначе тап по нему сразу убирал фокус
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
