// Хранение прогресса.
// В Телеграме — облачное хранилище самого Телеграма (у каждого пользователя своё, сервер не нужен;
// прогресс виден на любом его устройстве). Копия всегда лежит и в localStorage — как запас и
// для проверки вне Телеграма. При загрузке берётся более свежая версия.

const CHUNK = 3000;        // у Телеграма значение — до 4096 символов; берём с запасом
const STATE_CODE = { new: 0, learning: 1, mastered: 2, known: 3 };
const STATE_NAME = ["new", "learning", "mastered", "known"];
const LS_KEY = "english-miniapp-progress";

/** Компактная запись прогресса (карточки — короткими массивами, чтобы влезало в меньше кусков). */
export function pack(data, ts = Date.now()) {
  const cards = {};
  for (const [k, c] of Object.entries(data.cards)) {
    cards[k] = [STATE_CODE[c.state], c.streak, Math.round(c.due), c.fav ? 1 : 0, c.misses || 0, c.hard ? 1 : 0, ...(c.chk ? [c.chk] : [])];   // 7-й элемент (chk) — сколько проверок выученного пройдено, только если есть
  }
  const days = {};
  for (const [d, v] of Object.entries(data.days || {})) days[d] = [v.correct, v.answered];
  const out = { v: 1, ts, cards, recent: data.recent || [], days };
  if (data.goal != null) out.goal = data.goal;
  if (data.settings) out.s = data.settings;
  if (data.tenses) out.t = data.tenses;   // «Времена»: результаты тестов по каждому времени
  if (data.ach) out.a = data.ach;         // «Достижения»: id → день получения
  if (data.flawless) out.f = data.flawless;   // игры, пройденные без ошибок
  if (data.flawRun) out.w = data.flawRun;     // безупречных раундов игр подряд
  if (data.run) out.r = data.run;             // верных ответов подряд
  if (data.explored) out.x = data.explored;   // что уже пробовал («Исследователь»)
  if (data.achSeen) out.y = data.achSeen;     // какие достижения уже просмотрены (красная точка у «Достижений»)
  if (data.progSeen) out.z = data.progSeen;   // серия и точность при последнем заходе в «Прогресс» (точка и стрелки у «Прогресса»)
  if (data.xp) out.e = data.xp;               // опыт (верные ответы) для уровней
  if (data.lvlSeen) out.q = data.lvlSeen;
  if (data.assoc) out.m = data.assoc;         // «Ассоциации»: en → { s: ступень, d: срок проверки, m: своя ассоциация }     // уровень и опыт при последнем заходе на экран «Уровень» (точка и «таблетка»)
  return JSON.stringify(out);
}

export function unpack(text) {
  const o = JSON.parse(text);
  const cards = {};
  for (const [k, a] of Object.entries(o.cards || {})) {
    const c = { state: STATE_NAME[a[0]], streak: a[1], due: a[2], fav: !!a[3] };
    if (a[4]) c.misses = a[4];
    if (a[5]) c.hard = true;
    if (a[6]) c.chk = a[6];
    cards[k] = c;
  }
  const days = {};
  for (const [d, a] of Object.entries(o.days || {})) days[d] = { correct: a[0], answered: a[1] };
  const data = { cards, recent: o.recent || [], days };
  if (o.goal != null) data.goal = o.goal;
  if (o.s) data.settings = o.s;
  if (o.t) data.tenses = o.t;
  if (o.a) data.ach = o.a;
  if (o.f) data.flawless = o.f;
  if (o.w) data.flawRun = o.w;
  if (o.r) data.run = o.r;
  if (o.x) data.explored = o.x;
  if (o.y) data.achSeen = o.y;
  if (o.z) data.progSeen = o.z;
  if (o.e) data.xp = o.e;
  if (o.q) data.lvlSeen = o.q;
  if (o.m) data.assoc = o.m;
  return { data, ts: o.ts || 0 };
}

const tg = window.Telegram && window.Telegram.WebApp;
const cloud = tg && tg.initData && tg.CloudStorage ? tg.CloudStorage : null;

const call = (method, ...args) =>
  new Promise((resolve, reject) => {
    cloud[method](...args, (err, res) => (err ? reject(new Error(String(err))) : resolve(res)));
  });

export const usingCloud = !!cloud;

function readLocal() {
  try {
    const t = localStorage.getItem(LS_KEY);
    return t ? unpack(t) : null;
  } catch { return null; }
}

async function readCloud() {
  if (!cloud) return null;
  try {
    const meta = JSON.parse((await call("getItem", "m")) || "null");
    if (!meta || !meta.n) return null;
    const keys = Array.from({ length: meta.n }, (_, i) => "p" + i);
    const got = await call("getItems", keys);
    lastWritten = keys.map((k) => got[k] || "");
    return unpack(lastWritten.join(""));
  } catch { return null; }
}

/** Загрузить прогресс: берём более свежий из облака и локальной копии. */
export async function load() {
  const [c, l] = await Promise.all([readCloud(), Promise.resolve(readLocal())]);
  if (c && l) return c.ts >= l.ts ? c.data : l.data;
  return (c || l || { data: null }).data;
}

let lastWritten = [];   // что уже лежит в облаке (по кускам), чтобы писать только изменившееся
let timer = null, pending = null, writing = Promise.resolve();

async function writeCloud(text, ts) {
  const parts = [];
  for (let i = 0; i < text.length; i += CHUNK) parts.push(text.slice(i, i + CHUNK));
  for (let i = 0; i < parts.length; i++) {
    if (lastWritten[i] !== parts[i]) await call("setItem", "p" + i, parts[i]);
  }
  if (lastWritten.length > parts.length) {
    const stale = [];
    for (let i = parts.length; i < lastWritten.length; i++) stale.push("p" + i);
    await call("removeItems", stale);
  }
  await call("setItem", "m", JSON.stringify({ n: parts.length, ts }));
  lastWritten = parts;
}

function flushNow() {
  if (!pending) return;
  const data = pending;
  pending = null;
  const ts = Date.now();
  const text = pack(data, ts);
  try { localStorage.setItem(LS_KEY, text); } catch { /* память переполнена — не страшно */ }
  if (cloud) writing = writing.then(() => writeCloud(text, ts)).catch(() => { lastWritten = []; });
}

/** Сохранить с небольшой задержкой (ответы идут часто, облако не нужно дёргать каждый раз). */
export function save(data) {
  pending = data;
  clearTimeout(timer);
  timer = setTimeout(flushNow, 1500);
}

/** Записать немедленно (при сворачивании и закрытии). */
export function flush() {
  clearTimeout(timer);
  flushNow();
}
