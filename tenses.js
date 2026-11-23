// «Времена»: карта из 12 времён английского, мини-урок, тест на 10 вопросов и входной тест на 12.
// Данные — data/tenses.json (их делает miniapp_tests/make_tenses.py). Прогресс по временам — progress.data.tenses:
// { id: { best: лучший результат теста в %, last: последний результат, n: сколько раз проходили, place: 1/0 — итог входного теста } }.
// Логика ответов строгая (не «похоже на»): в грамматике «has lived» и «have lived» — разные ответы.
import { normalize } from "./core.js?v=20";
import { attachSpecular } from "./specular.js?v=20";

const ORDER = ["ps", "pc", "pas", "pp", "pac", "fs", "pap", "pcc", "fc", "fp", "pacc", "fpc"];   // в каком порядке советуем учить
const GROUPS = [["past", "Past"], ["present", "Present"], ["future", "Future"]];
const ASPECTS = ["Simple", "Continuous", "Perfect", "Perfect Continuous"];
const SENTENCE = { "+": "Утверждение", "−": "Отрицание", "?": "Вопрос" };
export const MASTERED = 80;     // от этого результата теста время считается освоенным
const ROUND = 10;        // вопросов в обычном тесте
const CHEV = '<svg class="chev" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

/**
 * Выровнять надпись в пропуске («пилюле») по самим буквам: расстояние от верхней границы до верха букв и от низа букв до нижней границы —
 * одинаковые (у слов с хвостиками вроде «up» и без них «out» центр свой, поэтому считается для каждого слова отдельно).
 */
export function fitBlanks(root) {
  const cv = fitBlanks.cv || (fitBlanks.cv = document.createElement("canvas").getContext("2d"));
  for (const b of root.querySelectorAll(".blank")) {
    const inner = b.firstElementChild;
    if (!inner) continue;
    inner.style.top = "0px";
    b.style.animation = "none";                       // замер без анимации масштаба
    const cs = getComputedStyle(inner);
    cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = cv.measureText(inner.textContent);
    const probe = document.createElement("i");        // точка на базовой линии строки
    probe.style.cssText = "display:inline-block;width:0;height:0";
    inner.append(probe);
    const base = probe.getBoundingClientRect().bottom, box = b.getBoundingClientRect();
    probe.remove();
    const d = ((base - m.actualBoundingBoxAscent - box.top) - (box.bottom - (base + m.actualBoundingBoxDescent))) / 2;   // >0 — буквы ниже середины
    inner.style.top = `${(-d).toFixed(2)}px`;
    b.style.animation = "";
  }
}

export function initTenses(ctx) {
  const { make, play, $, getProgress, version, shuffle, animateList, showView, touchOnly, onResult } = ctx;
  let data = null;      // tenses.json
  let cur = null;       // { tense | null, kind: "lesson" | "test" | "place", items, i, right, picked, wrong }

  const P = () => getProgress();
  const recs = () => (P().data.tenses || (P().data.tenses = {}));
  const rec = (id) => recs()[id] || {};
  const byId = (id) => data.tenses.find((t) => t.id === id);
  const norm = (s) => normalize(String(s), true);
  const save = () => P().save();

  async function load() {
    if (!data) data = await fetch(`data/tenses.json?v=${version}`).then((r) => r.json());
    return data;
  }

  // ---------- карта ----------
  const status = (r) => r.best >= MASTERED ? ["освоено", "done"] : r.best > 0 ? ["учу", ""] : r.place === 0 ? ["слабое", "weak"] : r.place === 1 ? ["знаю", ""] : ["не начато", ""];

  function ring(pct) {
    const C = 2 * Math.PI * 18;
    return `<svg class="tring" viewBox="0 0 44 44" aria-hidden="true"><circle class="trk" cx="22" cy="22" r="18"/>${pct > 0 ? `<circle class="arc" cx="22" cy="22" r="18" stroke-dasharray="${(C * pct / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 22 22)"/>` : ""}</svg>`;
  }

  async function renderMap() {
    const body = $("tensesBody");
    if (!data) {
      body.replaceChildren(make("div", "empty", "Загрузка…"));
      try { await load(); } catch { body.replaceChildren(make("div", "empty", "Не удалось загрузить уроки.\nПроверьте интернет и откройте раздел ещё раз.")); return; }
    }
    const placed = data.tenses.some((t) => rec(t.id).place !== undefined);
    const place = make("button", "item tplace");
    place.innerHTML = '<span class="mico"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></span>';
    const txt = make("span", "ttxt");
    txt.append(make("span", "mtitle", "Входной тест"), make("span", "tsub muted", placed ? "Пройден: слабые времена отмечены на карте" : "12 вопросов — покажет, с чего начать"));
    place.append(txt);
    place.insertAdjacentHTML("beforeend", CHEV);
    place.addEventListener("click", startPlacement);

    const cols = make("div", "tcols");
    for (const [, name] of GROUPS) cols.append(make("span", "", name));
    const grid = make("div", "tgrid");
    for (const aspect of ASPECTS) {
      for (const [g] of GROUPS) {
        const t = data.tenses.find((x) => x.group === g && x.aspect === aspect);
        const r = rec(t.id), [label, cls] = status(r);
        const b = make("button", "item tcell" + (cls ? " " + cls : ""));
        b.setAttribute("aria-label", `${t.en}, ${t.ru}: ${label}${r.best ? ", " + r.best + "%" : ""}`);
        b.innerHTML = `<span class="tringbox">${ring(r.best || 0)}<span class="tpct">${r.best ? r.best : ""}</span></span>`;
        b.append(make("span", "tname", aspect === "Perfect Continuous" ? "Perfect Cont." : aspect), make("span", "tstat", label));
        b.addEventListener("click", () => openLesson(t.id));
        grid.append(b);
      }
    }
    body.replaceChildren(place, cols, grid,
      make("p", "tnote", `Кольцо — ваш лучший результат в тесте. От ${MASTERED}% время считается освоенным.`));
    animateList(body, { entrance: true, bottomEl: $("bar") });
    attachSpecular(place, "place");   // блик по кромке «Входного теста» (перенос SpecularButton)
  }

  // ---------- урок ----------
  function openLesson(id) { cur = { kind: "lesson", tense: byId(id) }; showView("tlesson"); }

  const card = (...kids) => { const c = make("div", "item tcard"); c.append(...kids); return c; };

  function renderLesson() {
    if (!cur) { showView("tenses"); return; }
    if (cur.kind !== "lesson") { renderTest(); return; }
    const t = cur.tense, body = $("tlessonBody"), r = rec(t.id);
    body.replaceChildren();
    const head = make("div", "thead");
    head.append(make("h2", "", t.en), make("div", "tru muted", t.ru), make("p", "tmean", t.meaning));
    const formula = card(make("div", "sechead", "Формула"));
    for (const line of t.formula) {                    // «+», «−», «?» из данных показываем словами: сразу понятно, что это за предложение
      const m = line.match(/^([+−?])\s+(.*)$/s);
      const row = make("div", "tfrow");
      row.append(make("div", "tflabel", m ? SENTENCE[m[1]] : ""), make("div", "tformula", m ? m[2] : line));
      formula.append(row);
    }
    body.append(head, formula);
    for (const u of t.uses) {
      body.append(card(make("div", "tusetitle", u.t), make("div", "ten", u.en), make("div", "tru muted", u.ru)));
    }
    const sig = make("div", "tsignals");
    for (const s of t.signals) sig.append(make("span", "pill", s));
    body.append(card(make("div", "sechead", "Слова-подсказки"), sig));
    const traps = card(make("div", "sechead", "Частые ошибки"));
    for (const x of t.traps) {
      const row = make("div", "ttrap");
      row.append(make("div", "tbad", "✗ " + x.bad), make("div", "tgood", "✓ " + x.good), make("div", "tnote2 muted", x.note));
      traps.append(row);
    }
    body.append(traps);
    if (r.best) body.append(make("p", "tnote", `Лучший результат: ${r.best}%`));
    const go = make("button", "btn primary wide", `Пройти тест · ${ROUND} вопросов`);
    go.addEventListener("click", () => startTest(t.id));
    body.append(go);
    animateList(body, { entrance: true, bottomEl: $("bar") });
    window.scrollTo(0, 0);
  }

  // ---------- тест ----------
  function startTest(id) {
    const t = byId(id), start = Math.random() < 0.5 ? 0 : 1;
    const items = shuffle(t.ex).map((e, i) => ({ ...e, tense: t, mode: (i + start) % 2 ? "type" : "choose" }));   // примерно половина — «впиши сам»
    cur = { kind: "test", tense: t, items, i: 0, right: 0, picked: null, wrong: [] };
    renderTest();
  }

  function startPlacement() {
    const items = shuffle(data.tenses.map((t) => ({ ...shuffle(t.ex)[0], tense: t, mode: "choose" })));
    cur = { kind: "place", tense: null, items, i: 0, right: 0, picked: null, wrong: [] };
    showView("tlesson");
  }

  function options(item) { return shuffle([item.a, ...item.d]); }

  function sentence(q, fill, cls) {
    const [a, b] = q.split("___");
    const s = make("div", "qsentence");
    const blank = make("span", "blank" + (cls ? " " + cls : ""));
    blank.append(make("span", "binner", fill || "?"));
    s.append(a, blank, b);
    return s;
  }

  function isRight(item, text) {
    const n = norm(text);
    return !!n && [item.a, ...(item.alt || [])].some((x) => norm(x) === n);
  }

  function renderTest() {
    const body = $("tlessonBody");
    body.replaceChildren();
    if (cur.i >= cur.items.length) { renderResult(body); return; }
    const item = cur.items[cur.i], answered = cur.picked !== null, ok = answered && isRight(item, cur.picked);
    if (!item.opts) item.opts = options(item);
    const box = make("div", "gamecard");
    const headRow = make("div", "gamehead");
    const quit = make("button", "gamequit");
    quit.setAttribute("aria-label", "Выйти из теста");
    quit.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    quit.addEventListener("click", () => leave());
    headRow.append(make("span", "muted", `Вопрос ${cur.i + 1} из ${cur.items.length}`), make("span", "muted", `Верно: ${cur.right}`), quit);
    const bar = make("div", "track"), fill = make("i");
    fill.style.width = `${(cur.i / cur.items.length) * 100}%`;
    bar.append(fill);
    box.append(headRow, bar,
      make("div", "qlabel", cur.kind === "place" ? "Входной тест · выберите верную форму" : `${cur.tense.en} · ${item.mode === "choose" ? "выберите верную форму" : "впишите верную форму"}`),
      sentence(item.q, answered ? item.a : "", answered ? "ok" : ""));
    let entry = null;
    if (item.mode === "type") {
      entry = make("input", "gameentry" + (answered ? (ok ? " ok" : " bad") : ""));
      Object.assign(entry, { type: "text", placeholder: "Впишите форму", autocomplete: "off", autocapitalize: "off", autocorrect: "off", spellcheck: false, enterKeyHint: "done" });
      entry.setAttribute("aria-label", "Пропущенная форма");
      if (answered) { entry.value = cur.picked; entry.readOnly = true; if (!cur.picked) entry.placeholder = "не знаю"; box.append(entry); }
      else {
        entry.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); answer(entry.value.trim()); } });
        const check = make("button", "btn primary wide", "Проверить");
        check.addEventListener("click", () => answer(entry.value.trim()));
        box.append(entry, check);
      }
    } else {
      const opts = make("div", "topts");
      for (const o of item.opts) {
        const b = make("button", "btn", o);
        if (answered) { b.disabled = true; if (o === item.a) b.classList.add("ok"); else if (o === cur.picked) b.classList.add("bad"); }
        else b.addEventListener("click", () => answer(o));
        opts.append(b);
      }
      box.append(opts);
    }
    if (answered) {
      box.append(make("div", "qfeedback " + (ok ? "ok" : "bad"), ok ? "Верно!" : `Неверно. Правильно: «${item.a}»`), make("div", "qnote muted", item.w));
      const last = cur.i + 1 >= cur.items.length;
      const next = make("button", "btn primary wide", last ? "Результат" : "Далее");
      next.addEventListener("click", () => { cur.i += 1; cur.picked = null; renderTest(); window.scrollTo(0, 0); });
      box.append(next);
    }
    body.append(box);
    fitBlanks(body);
    if (entry && !answered && !touchOnly()) entry.focus();
  }

  function answer(text) {
    if (!cur || cur.picked !== null) return;
    const item = cur.items[cur.i], ok = isRight(item, text);
    cur.picked = text;
    if (ok) cur.right += 1; else cur.wrong.push(item);
    item.okAnswer = ok;
    play(ok ? "correct" : "error");
    renderTest();
  }

  // ---------- итоги ----------
  function renderResult(body) {
    const total = cur.items.length, pct = Math.round((cur.right / total) * 100);
    const box = make("div", "gamecard");
    if (cur.kind === "test") {
      const r = { ...rec(cur.tense.id) };
      r.last = pct; r.best = Math.max(r.best || 0, pct); r.n = (r.n || 0) + 1;
      recs()[cur.tense.id] = r;
      save();
      onResult?.();   // достижения: «все времена группы освоены»
      const tail = pct >= 90 ? "Отлично!" : pct >= MASTERED ? "Хороший результат — время освоено" : pct >= 50 ? "Неплохо, но стоит повторить" : "Перечитайте урок и попробуйте ещё раз";
      box.append(make("h2", "", cur.tense.en), make("div", "gamescore", `${cur.right} из ${total}`), make("p", "", tail));
    } else {
      for (const it of cur.items) {                       // итог входного теста — по каждому времени
        const r = { ...rec(it.tense.id) };
        r.place = it.okAnswer ? 1 : 0;
        recs()[it.tense.id] = r;
      }
      save();
      onResult?.();   // достижение «Входной тест»
      box.append(make("h2", "", "Входной тест"), make("div", "gamescore", `${cur.right} из ${total}`));
      const weak = cur.wrong.map((it) => it.tense).sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
      box.append(make("p", "", weak.length ? "Слабые времена отмечены на карте. Начните с этих:" : "Все времена на месте! Закрепите их тестами."));
      for (const t of weak.slice(0, 3)) {
        const b = make("button", "btn wide", t.en);
        b.addEventListener("click", () => openLesson(t.id));
        box.append(b);
      }
    }
    if (cur.wrong.length && cur.kind === "test") {
      box.append(make("div", "qlabel", "Над чем поработать"));
      for (const it of cur.wrong) {
        const row = make("div", "twrong");
        row.append(sentence(it.q, it.a, "ok"), make("div", "qnote muted", it.w));
        box.append(row);
      }
    }
    const again = make("button", "btn primary wide", cur.kind === "test" ? "Ещё раз" : "К карте");
    again.addEventListener("click", () => (cur.kind === "test" ? startTest(cur.tense.id) : showView("tenses")));
    box.append(again);
    if (cur.kind === "test") {
      const lesson = make("button", "btn wide", "К уроку");
      lesson.addEventListener("click", () => openLesson(cur.tense.id));
      const map = make("button", "btn wide", "К карте");
      map.addEventListener("click", () => showView("tenses"));
      box.append(lesson, map);
    }
    body.append(box);
    fitBlanks(body);
    window.scrollTo(0, 0);
  }

  /** Выход из теста: из обычного — к уроку, из входного — к карте. */
  function leave() {
    if (cur.kind === "test") openLesson(cur.tense.id); else showView("tenses");
  }

  return { renderMap, renderLesson };
}
