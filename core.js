// Логика обучения — перенос core.py на JavaScript (то же поведение, те же числа).
// Окна здесь нет: только проверка ответов, повторения, цель дня и выбор карточки.

// ---------- Проверка ответа ----------

export const SIMILARITY = 0.75; // ответ засчитывается, если совпал минимум на 75%

// Пары русских глаголов («снимать» — «снять»); заполняются из data/aspect.json
let PARTNERS = {};
export function setAspect(obj) { PARTNERS = obj || {}; }

const WORDS = {
  wanna: "want to", gonna: "going to", gotta: "got to",
  gimme: "give me", lemme: "let me", kinda: "kind of",
  sorta: "sort of", outta: "out of", dunno: "do not know",
  yall: "you all", cannot: "can not",
  dont: "do not", doesnt: "does not", didnt: "did not",
  cant: "can not", wont: "will not", isnt: "is not",
  arent: "are not", wasnt: "was not", werent: "were not",
  hasnt: "has not", havent: "have not", couldnt: "could not",
  wouldnt: "would not", shouldnt: "should not",
  im: "i am", ive: "i have", youre: "you are",
  theyre: "they are", thats: "that is", whats: "what is",
};
const NO_APOS = [
  [/\bwon't\b/g, "will not"],
  [/\bcan't\b/g, "can not"],
  [/\by'all\b/g, "you all"],
  [/\blet's\b/g, "let us"],
  [/\b(it|that|what|he|she|there|here|who|where|how)'s\b/g, "$1 is"],
  [/n't\b/g, " not"],
  [/'re\b/g, " are"],
  [/'ve\b/g, " have"],
  [/'ll\b/g, " will"],
  [/'m\b/g, " am"],
  [/'d\b/g, " would"],
];

export function normalize(text, english) {
  let s = text.toLowerCase().replaceAll("ё", "е").replaceAll("’", "'").replaceAll("`", "'");
  if (english) for (const [re, repl] of NO_APOS) s = s.replace(re, repl);
  s = s.replace(/[^\p{L}\p{N}_\s]/gu, " ").replace(/\s+/gu, " ").trim();
  if (english) {
    s = s.split(" ").map((w) => (Object.hasOwn(WORDS, w) ? WORDS[w] : w)).join(" ");
    s = s.replaceAll("have got to", "got to");
    if (s.startsWith("to ") && s.split(" ").length > 1) s = s.slice(3);
  }
  return s;
}

function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)));
    }
    prev = cur;
  }
  return prev[prev.length - 1];
}

// Сумма совпавших блоков, как у difflib.SequenceMatcher (алгоритм Ratcliff/Obershelp)
function matchingChars(sa, sb) {
  const a = Array.from(sa), b = Array.from(sb);
  const b2j = new Map();
  b.forEach((ch, j) => {
    if (!b2j.has(ch)) b2j.set(ch, []);
    b2j.get(ch).push(j);
  });
  const stack = [[0, a.length, 0, b.length]];
  let total = 0;
  while (stack.length) {
    const [alo, ahi, blo, bhi] = stack.pop();
    let besti = alo, bestj = blo, bestsize = 0;
    let j2len = new Map();
    for (let i = alo; i < ahi; i++) {
      const newj2len = new Map();
      for (const j of b2j.get(a[i]) || []) {
        if (j < blo) continue;
        if (j >= bhi) break;
        const k = (j2len.get(j - 1) || 0) + 1;
        newj2len.set(j, k);
        if (k > bestsize) { besti = i - k + 1; bestj = j - k + 1; bestsize = k; }
      }
      j2len = newj2len;
    }
    if (bestsize) {
      total += bestsize;
      if (alo < besti && blo < bestj) stack.push([alo, besti, blo, bestj]);
      if (besti + bestsize < ahi && bestj + bestsize < bhi) stack.push([besti + bestsize, ahi, bestj + bestsize, bhi]);
    }
  }
  return total;
}

export function ratio(a, b) {
  const n = Array.from(a).length + Array.from(b).length;
  return n ? (2 * matchingChars(a, b)) / n : 1;
}

function close(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const la = Array.from(a).length, lb = Array.from(b).length;
  if (Math.min(la, lb) <= 3) return false;
  if (Math.max(la, lb) <= 8 && editDistance(Array.from(a), Array.from(b)) <= 1) return true; // одна опечатка
  return ratio(a, b) >= SIMILARITY;
}

/** true, если ответ совпал (или почти совпал) с любым допустимым вариантом. */
export function checkAnswer(answer, accepted, english) {
  const a = normalize(answer, english);
  if (!a) return false;
  for (const v of accepted) {
    // пояснение в скобках — «Признаться (в вине)» — не обязательно
    const plain = v.replace(/\s*\([^)]*\)/g, "");
    let candidates = [v, plain];
    if (!english) { // парная форма глагола: «снимать» принимает и «снять»
      const key = normalize(plain, false);
      if (Object.hasOwn(PARTNERS, key)) candidates = candidates.concat(PARTNERS[key]);
    }
    for (const variant of candidates) {
      if (close(a, normalize(variant, english))) return true;
    }
  }
  return false;
}

// ---------- Категории ----------

export const CATEGORY_WEIGHTS = { word: 75, phrase: 20, proverb: 5 };

/** word = слова и фразовые глаголы; phrase = фразы и идиомы; proverb = пословицы. */
export function category(p) {
  const t = p.type;
  if (t === "proverb") return "proverb";
  if (t === "word" || t === "phrasal verb" || (t === "slang" && !p.en.includes(" "))) return "word";
  return "phrase";
}

// ---------- Прогресс и повторения ----------

export const MIN = 60;
export const HOUR = 3600;
export const DAY = 86400;
export const RETRY_AFTER_MISS = 10 * MIN;  // ошибка -> вернётся через 10 минут
export const FIRST_REVIEW = 1 * HOUR;      // первая проверка через час
export const AFTER_CORRECT = [1 * DAY, 3 * DAY]; // после 1-го и 2-го верного ответа
export const NEEDED_STREAK = 3;            // верных подряд до «выучено»
export const RATING_FACTOR = { easy: 2.5, normal: 1.0, hard: 0.4 };
export const HARD_MISSES = 2;              // столько ошибок — и слово попадает в «трудные»
export const DAILY_GOAL = 20;              // верных ответов в день для серии
export const RECENT_SKIP = 40;             // не повторять 40 последних карточек

const nowSec = () => Date.now() / 1000;
const pad = (n) => String(n).padStart(2, "0");
/** Местная дата в виде «2026-11-22» (как date.today().isoformat() в Python). */
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(d, n) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
  return r;
}
const pick1 = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Progress {
  /** state: new (видели, но не нажали «Уже знал») | learning | mastered | known.
   *  Фразы без записи в данных ещё ни разу не показывались ("unseen"). */
  constructor(phrases, data = null, onSave = () => {}) {
    this.phrases = new Map(phrases.map((p) => [p.en, p]));
    this.data = { cards: {}, recent: [], days: {} };
    if (data) Object.assign(this.data, data);
    this.cards = this.data.cards;
    this.onSave = onSave;
  }

  save() { this.onSave(this.data); }

  state(key) {
    return Object.hasOwn(this.cards, key) ? this.cards[key].state : "unseen";
  }

  _card(key, now) {
    if (!Object.hasOwn(this.cards, key)) {
      this.cards[key] = { state: "new", streak: 0, due: now, fav: false };
    }
    return this.cards[key];
  }

  // --- выбор следующей карточки ---
  pick(recent = [], now = nowSec()) {
    const skip = new Set(recent.slice(-RECENT_SKIP));
    const dueLearning = [], dueNew = [], unseen = [], waiting = [];
    for (const key of this.phrases.keys()) {
      const st = this.state(key);
      if (st === "mastered" || st === "known") continue;
      const c = this.cards[key];
      if (st === "unseen") unseen.push(key);
      else if (c.due <= now) (st === "learning" ? dueLearning : dueNew).push([c.due, key]);
      else waiting.push([c.due, key]);
    }
    const sorted = (pairs) => [...pairs].sort((x, y) => x[0] - y[0] || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0));
    const free = (pairs) => sorted(pairs).map((x) => x[1]).filter((k) => !skip.has(k));

    // проверки «учу» (по расписанию) идут первыми, но среди них — случайно
    const due = free(dueLearning);
    if (due.length) return pick1(due);
    // остальное — один общий случайный пул: ещё не виденные + «новые» после ошибки
    const pool = unseen.filter((k) => !skip.has(k)).concat(free(dueNew));
    if (pool.length) return this._pickByCategory(pool);
    // всё на паузе: берём то, что наступит раньше всех
    for (const group of [dueLearning, dueNew, waiting]) {
      const keys = sorted(group).map((x) => x[1]);
      if (keys.length) return keys[0];
    }
    return unseen.length ? pick1(unseen) : null;
  }

  /** Выбрать категорию по долям 75/20/5, затем случайную фразу из неё. */
  _pickByCategory(keys) {
    const groups = new Map();
    for (const k of keys) {
      const c = category(this.phrases.get(k));
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c).push(k);
    }
    const cats = [...groups.keys()];
    const total = cats.reduce((s, c) => s + CATEGORY_WEIGHTS[c], 0);
    let r = Math.random() * total, chosen = cats[cats.length - 1];
    for (const c of cats) {
      r -= CATEGORY_WEIGHTS[c];
      if (r < 0) { chosen = c; break; }
    }
    return pick1(groups.get(chosen));
  }

  // --- результаты ---
  /** Записать ответ на карточку. Возвращает новое состояние. */
  record(key, correct, now = nowSec()) {
    const seenBefore = Object.hasOwn(this.cards, key);
    const c = this._card(key, now);
    if (!correct) c.misses = (c.misses || 0) + 1;
    if (c.state === "new" && correct && seenBefore) {
      // верно после прошлой встречи/ошибки -> уходит в повторения
      Object.assign(c, { state: "learning", streak: 0, due: now + FIRST_REVIEW });
    } else if (c.state === "learning") {
      if (correct) {
        c.streak += 1;
        if (c.streak >= NEEDED_STREAK) c.state = "mastered";
        else c.due = now + AFTER_CORRECT[Math.min(c.streak - 1, AFTER_CORRECT.length - 1)];
      } else {
        c.streak = 0;
        c.due = now + RETRY_AFTER_MISS;
      }
    } else if (c.state === "new") {
      c.streak = 0;
      c.due = now + RETRY_AFTER_MISS;
    }
    this.save();
    return c.state;
  }

  /** Оценка «легко / нормально / трудно» после верного ответа на повторение. */
  rate(key, rating, now = nowSec()) {
    const c = Object.hasOwn(this.cards, key) ? this.cards[key] : null;
    if (!c || c.state !== "learning") return;
    const base = Math.max(c.due - now, 0);
    c.due = now + Math.max(base * RATING_FACTOR[rating], 10 * MIN);
    if (rating === "hard") c.hard = true;
    else if (rating === "easy") c.hard = false;
    this.save();
  }

  /** «Трудные»: отмеченные «трудно» или с частыми ошибками, ещё не выученные. */
  hardCards() {
    return Object.keys(this.cards).filter((k) => {
      const c = this.cards[k];
      return this.phrases.has(k) && c.state !== "mastered" && c.state !== "known"
        && (c.hard || (c.misses || 0) >= HARD_MISSES);
    });
  }

  /** Что берёт сессия «Повтор»: «учу» со сроком, который уже настал, и «трудные». */
  reviewPool(now = nowSec()) {
    const set = new Set(this.hardCards());
    for (const k of Object.keys(this.cards)) {
      const c = this.cards[k];
      if (this.phrases.has(k) && c.state === "learning" && c.due <= now) set.add(k);
    }
    return [...set];
  }

  /** Фразы с заданными состояниями (для «Инвентаря»), в порядке появления. */
  keysByState(...states) {
    return Object.keys(this.cards).filter((k) => this.phrases.has(k) && states.includes(this.cards[k].state));
  }

  /** Сколько ответов и верных ответов было в этот день. */
  dayInfo(day) {
    const d = (this.data.days || {})[dayKey(day)];
    return d ? { correct: d.correct, answered: d.answered } : { correct: 0, answered: 0 };
  }

  // --- цель дня, серия, точность ---
  goal() { return this.data.goal ?? DAILY_GOAL; }

  logAnswer(correct, today = new Date()) {
    const day = dayKey(today);
    if (!this.data.days) this.data.days = {};
    const d = this.data.days[day] || (this.data.days[day] = { correct: 0, answered: 0 });
    d.answered += 1;
    d.correct += correct ? 1 : 0;
    this.save();
  }

  todayCorrect(today = new Date()) {
    const d = (this.data.days || {})[dayKey(today)];
    return d ? d.correct : 0;
  }

  /** Дней подряд, когда выполнена цель. Сегодняшний день ещё можно добрать. */
  streak(today = new Date()) {
    const hit = (d) => this.todayCorrect(d) >= this.goal();
    let d = hit(today) ? today : addDays(today, -1);
    let n = 0;
    while (hit(d)) { n++; d = addDays(d, -1); }
    return n;
  }

  accuracy() {
    const days = Object.values(this.data.days || {});
    const answered = days.reduce((s, d) => s + d.answered, 0);
    const correct = days.reduce((s, d) => s + d.correct, 0);
    return answered ? Math.round((100 * correct) / answered) : null;
  }

  markKnow(key, now = nowSec()) {
    Object.assign(this._card(key, now), { state: "learning", streak: 0, due: now + FIRST_REVIEW });
    this.save();
  }

  markKnown(key, now = nowSec()) {
    this._card(key, now).state = "known";
    this.save();
  }

  toggleFav(key, now = nowSec()) {
    const c = this._card(key, now);
    c.fav = !c.fav;
    this.save();
    return c.fav;
  }

  isFav(key) {
    return Object.hasOwn(this.cards, key) && !!this.cards[key].fav;
  }

  favorites() {
    return Object.keys(this.cards).filter((k) => this.cards[k].fav && this.phrases.has(k));
  }

  stats() {
    const counts = { unseen: 0, new: 0, learning: 0, mastered: 0, known: 0 };
    for (const key of this.phrases.keys()) counts[this.state(key)] += 1;
    return counts;
  }
}
