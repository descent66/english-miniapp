// Экран Mini App: повторяет поведение настольного виджета (widget.py).
import * as Core from "./core.js";
import * as Store from "./storage.js";

const params = new URLSearchParams(location.search);
const ASK_SEC = Number(params.get("ask")) || 60;        // время на ответ
const REVEAL_SEC = Number(params.get("reveal")) || 10;  // сколько показывать ответ до новой фразы

const TYPE_RU = {
  idiom: "идиома", proverb: "пословица", "phrasal verb": "фразовый глагол",
  slang: "сленг", conversational: "разговорное", word: "слово",
};

const $ = (id) => document.getElementById(id);
const el = {
  tag: $("tag"), prompt: $("prompt"), entry: $("entry"), status: $("status"), answer: $("answer"),
  example: $("example"), countdown: $("countdown"), goal: $("goal"), fav: $("favBtn"),
  check: $("checkBtn"), show: $("showBtn"), back: $("backBtn"), next: $("nextBtn"),
  known: $("knownBtn"), easy: $("easyBtn"), normal: $("normalBtn"), hard: $("hardBtn"),
  inv: $("inv"), invBody: $("invBody"),
};
const actionBtns = [el.known, el.easy, el.normal, el.hard];

// ---------- звуки (файлы из виджета) ----------
const sounds = {};
for (const n of ["correct", "error", "next", "back", "fav"]) {
  const a = new Audio(`sounds/${n}.wav`);
  a.preload = "auto";
  sounds[n] = a;
}
function play(name) {
  try {
    const a = sounds[name];
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch { /* звук не критичен */ }
}

// ---------- состояние ----------
let progress, phrases;
let cur = null, direction = "en2ru", revealed = false;
let phase = "ask", nextAt = 0;

const recent = () => progress.data.recent;

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
  nextAt = Date.now() + seconds * 1000;
  updateCountdown();
}

function updateCountdown() {
  const left = Math.max(0, Math.round((nextAt - Date.now()) / 1000));
  el.countdown.textContent = phase === "ask"
    ? `Время на ответ: ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`
    : `Новая фраза через ${left} с`;
}

function updateGoal() {
  const n = progress.todayCorrect(), goal = progress.goal();
  if (n >= goal) {
    el.goal.textContent = `🔥 ${progress.streak()}`;
    el.goal.className = "done";
  } else {
    el.goal.textContent = `Сегодня ${n}/${goal}`;
    el.goal.className = "";
  }
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
  const key = progress.pick(recent());
  if (key === null) {
    cur = null;
    schedule(ASK_SEC, "ask");
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
  el.tag.textContent = "";
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
  const label = TYPE_RU[p.type] || p.type;
  const mode = dir === "en2ru" ? "EN → RU" : "RU → EN";
  el.tag.textContent = `${label} · ${p.level} · ${mode}${state === "learning" ? "  ·  повторение" : ""}`;
  el.prompt.textContent = dir === "en2ru" ? p.en : p.ru[0];
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
    el.entry.focus({ preventScroll: true });
    schedule(ASK_SEC, "ask");
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
    ? Core.checkAnswer(text, p.ru, false)
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
  schedule(REVEAL_SEC, "next");
  if (direction === "en2ru") {
    el.answer.textContent = p.ru.slice(0, 3).join(" / ");
  } else {
    el.answer.textContent = p.en + (p.en_alt.length ? `  (также: ${p.en_alt.slice(0, 2).join(", ")})` : "");
  }
  el.example.textContent = `${p.example_en}\n${p.example_ru}`;
  el.entry.readOnly = true; // не disabled: так на телефоне не закрывается клавиатура
  el.check.hidden = el.show.hidden = true;

  if (ok === null) { setStatus(""); return; }
  el.entry.className = ok ? "ok" : "bad";
  const before = progress.state(cur);
  const state = progress.record(cur, ok);
  progress.logAnswer(ok);
  updateGoal();
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

function refreshFav() {
  const on = cur && progress.isFav(cur);
  el.fav.textContent = on ? "★" : "☆";
  el.fav.classList.toggle("on", !!on);
}

function toggleFav() {
  if (!cur) return;
  play("fav");
  progress.toggleFav(cur);
  refreshFav();
}

// ---------- инвентарь и статистика ----------
let tab = "saved";

function renderInv() {
  for (const b of document.querySelectorAll(".tab")) b.classList.toggle("on", b.dataset.tab === tab);
  const body = el.invBody;
  body.replaceChildren();
  if (tab === "stats") {
    const s = progress.stats(), acc = progress.accuracy();
    const d = document.createElement("div");
    d.className = "stats";
    d.textContent =
      `Сегодня: ${progress.todayCorrect()} из ${progress.goal()} верных ответов\n` +
      `Серия: ${progress.streak()} дн. подряд\n` +
      `Точность ответов: ${acc !== null ? acc + "%" : "—"}\n` +
      `Трудных слов: ${progress.hardCards().length}\n\n` +
      `Ещё не показывались: ${s.unseen}\n` +
      `Видел, но не выучил: ${s.new}\n` +
      `Учу (проверки): ${s.learning}\n` +
      `Выучено (3 подряд): ${s.mastered}\n` +
      `Уже знал: ${s.known}`;
    body.append(d);
    return;
  }
  const keys = tab === "saved" ? progress.favorites() : progress.hardCards();
  if (!keys.length) {
    const e = document.createElement("div");
    e.className = "empty";
    e.textContent = tab === "saved"
      ? "Пока пусто.\nНажмите ☆ на карточке,\nчтобы сохранить фразу сюда."
      : "Трудных слов пока нет.\nОни появятся, если вы часто\nошибаетесь или нажмёте «Трудно».";
    body.append(e);
    return;
  }
  for (const key of keys) {
    const row = document.createElement("div");
    row.className = "item";
    const txt = document.createElement("div");
    txt.className = "txt";
    const en = document.createElement("div");
    en.className = "en";
    en.textContent = key;
    const ru = document.createElement("div");
    ru.className = "ru";
    ru.textContent = progress.phrases.get(key).ru.slice(0, 2).join(" / ");
    txt.append(en, ru);
    row.append(txt);
    if (tab === "saved") {
      const rm = document.createElement("button");
      rm.className = "rm";
      rm.textContent = "✕";
      rm.setAttribute("aria-label", "Убрать из сохранённых");
      rm.addEventListener("click", () => {
        progress.toggleFav(key);
        refreshFav();
        renderInv();
      });
      row.append(rm);
    } else {
      const side = document.createElement("div");
      side.className = "side";
      const m = progress.cards[key].misses || 0;
      side.textContent = m ? `ошибок: ${m}` : "трудно";
      row.append(side);
    }
    body.append(row);
  }
}

function openInv() {
  renderInv();
  el.inv.hidden = false;
}

// ---------- запуск ----------
async function boot() {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    try { tg.setHeaderColor("#120f17"); tg.setBackgroundColor("#120f17"); } catch { /* старый клиент */ }
    try { tg.disableVerticalSwipes(); } catch { /* старый клиент */ }
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
  $("invBtn").addEventListener("click", openInv);
  $("invClose").addEventListener("click", () => { el.inv.hidden = true; });
  for (const b of document.querySelectorAll(".tab")) {
    b.addEventListener("click", () => { tab = b.dataset.tab; renderInv(); });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && el.inv.hidden) { e.preventDefault(); onEnter(); }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) Store.flush();
    else loop();
  });
  window.addEventListener("pagehide", Store.flush);

  nextCard();
  setInterval(loop, 250);
}

boot();
