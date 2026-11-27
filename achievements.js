// «Достижения» (Настройки → Достижения). Только логика, без экрана.
// Выданное достижение не отбирается: progress.data.ach = { id: "ГГГГ-ММ-ДД" } (день получения).
// Счётчики: data.flawless = { pv: 1, dlg: 1 } — игры, пройденные без ошибок; data.flawRun — безупречных раундов подряд;
// data.run — верных ответов подряд в обычных карточках, data.explored — что уже пробовал («Исследователь»). Всё это надо добавлять и в pack/unpack (storage.js).
import { dayKey, HARD_MISSES, levelInfo } from "./core.js?v=31";
import { MASTERED } from "./tenses.js?v=31";

export const GAMES = ["pv", "dlg"];   // «Подставь частицу», «Диалоги»; новую игру добавить сюда, в ACHIEVEMENTS и вызывать recordRound
const TENSES = {                       // id времён из data/tenses.json по группам карты
  Past: ["pas", "pac", "pap", "pacc"],
  Present: ["ps", "pc", "pp", "pcc"],
  Future: ["fs", "fc", "fp", "fpc"],
};
const ALL_TENSES = Object.values(TENSES).flat();
const mastered = (p, ids) => ids.filter((id) => (p.data.tenses?.[id]?.best || 0) >= MASTERED).length;
const totalCorrect = (p) => Object.values(p.data.days || {}).reduce((s, d) => s + d.correct, 0);

const learned = (p) => p.keysByState("mastered");                       // вкладка «Выучено»
const KIND_TYPES = ["word", "phrasal verb", "conversational", "idiom", "slang", "proverb"];   // как в «Что учить»
const EXPLORE = ["pv", "dlg", "tenses", "rev", "mode"];                // что надо попробовать для «Исследователя»

/** Субботы и воскресенья, в которые выполнена цель дня: лучший результат за одни выходные (0, 1 или 2). */
function bestWeekend(p) {
  const goal = p.goal(), byWeekend = {};
  for (const [key, d] of Object.entries(p.data.days || {})) {
    if (d.correct < goal) continue;
    const [y, m, n] = key.split("-").map(Number), wd = new Date(y, m - 1, n, 12).getDay();   // 6 — суббота, 0 — воскресенье
    if (wd !== 6 && wd !== 0) continue;
    const sat = dayKey(new Date(y, m - 1, n - (wd === 0 ? 1 : 0), 12));
    (byWeekend[sat] || (byWeekend[sat] = new Set())).add(wd);
  }
  return Math.max(0, ...Object.values(byWeekend).map((s) => s.size));
}

/** Сколько видов, по которым выучено не меньше 10 записей. */
function kindsLearned(p, need = 10) {
  const n = {};
  for (const k of learned(p)) { const t = p.phrases.get(k).type; n[t] = (n[t] || 0) + 1; }
  return KIND_TYPES.filter((t) => (n[t] || 0) >= need).length;
}

// shortcut: «было трудным» считаем по карточке (отмечено «трудно» или ошибок от HARD_MISSES) — если потом нажать «Легко», слово перестанет считаться; точный счётчик — если станет важно
const wasHard = (c) => c.hard || (c.misses || 0) >= HARD_MISSES;

/** group — раздел на экране; value(p) — сколько уже есть; target — сколько нужно. */
export const ACHIEVEMENTS = [
  ...[[3, "Искра", "3 дня"], [7, "Неделя огня", "7 дней"], [14, "Две недели", "14 дней"], [30, "Месяц огня", "30 дней"], [100, "Стодневка", "100 дней"]]
    .map(([n, title, days]) => ({ id: `streak${n}`, group: "fire", title, text: `Серия огонька — ${days} подряд`, target: n, value: (p) => p.streak() })),
  { id: "weekend", group: "fire", title: "Выходной боец", text: "Выполнить цель дня и в субботу, и в воскресенье одной недели", target: 2, value: bestWeekend },
  ...[[100, "Сто верных"], [500, "Пятьсот верных"], [777, "Счастливые 777"], [1000, "Тысяча верных"]]
    .map(([n, title]) => ({ id: `correct${n}`, group: "answers", title, text: `${n} верных ответов за всё время`, target: n, value: totalCorrect })),
  ...[[5, "Разогрев"], [10, "Десятый уровень"], [25, "Четверть пути"], [50, "Полпути"], [77, "Счастливый уровень"], [100, "Легенда"]]
    .map(([n, title]) => ({ id: `level${n}`, group: "level", title, text: `Достичь ${n} уровня`, target: n, value: (p) => levelInfo(p.data.xp || 0).level })),
  { id: "run10", group: "answers", title: "Десять подряд", text: "10 верных ответов подряд без ошибок", target: 10, value: (p) => p.data.run || 0 },
  { id: "flawlessPv", group: "games", title: "Частица без ошибок", text: "Пройти раунд «Подставь частицу» без ошибок (от 10 вопросов)", target: 1, value: (p) => (p.data.flawless?.pv ? 1 : 0) },
  { id: "flawlessDlg", group: "games", title: "Диалоги без ошибок", text: "Пройти раунд «Диалоги» без ошибок (от 10 вопросов)", target: 1, value: (p) => (p.data.flawless?.dlg ? 1 : 0) },
  { id: "flawRun3", group: "games", title: "Хет-трик", text: "Пройти без ошибок 3 раунда игр подряд (от 10 вопросов)", target: 3, value: (p) => p.data.flawRun || 0 },
  { id: "tensePlace", group: "tenses", title: "Входной тест", text: "Пройти входной тест «Времён»", target: 1,
    value: (p) => (ALL_TENSES.some((id) => p.data.tenses?.[id]?.place !== undefined) ? 1 : 0) },
  ...Object.entries(TENSES).map(([name, ids]) => ({
    id: `tense${name}`, group: "tenses", title: `Все времена ${name}`, target: ids.length,
    text: `Освоить 4 времени группы ${name}`, value: (p) => mastered(p, ids) })),
  { id: "tenseAll", group: "tenses", title: "Все 12 времён", text: "Освоить все 12 времён", target: ALL_TENSES.length, value: (p) => mastered(p, ALL_TENSES) },
  ...Object.entries(TENSES).map(([name, ids]) => ({   // тест времени состоит из 10 вопросов, поэтому best = 100 — это 10 из 10
    id: `perfect${name}`, group: "tenses", title: { Past: "Прошлое без ошибок", Present: "Настоящее без ошибок", Future: "Будущее без ошибок" }[name],
    text: `Пройти тест любого времени группы ${name} на 10 из 10`, target: 1,
    value: (p) => (ids.some((id) => (p.data.tenses?.[id]?.best || 0) >= 100) ? 1 : 0) })),
  ...[[10, "Первый десяток"], [30, "Тридцать слов"], [50, "Полсотни"], [100, "Сотня слов"]]
    .map(([n, title]) => ({ id: `words${n}`, group: "words", title, text: `${n} слов во вкладке «Выучено»`, target: n,
      value: (p) => learned(p).length })),
  ...[[10, "Шнырь"], [25, "Кура"], [50, "Опытный курьер"]]
    .map(([n, title]) => ({ id: `saved${n}`, group: "saved", title, text: `${n} слов и фраз в закладках`, target: n, value: (p) => p.favorites().length })),
  { id: "fixErrors", group: "mastery", title: "Работа над ошибками", text: "Выучить 10 слов, которые были в «Трудных»", target: 10,
    value: (p) => learned(p).filter((k) => wasHard(p.cards[k])).length },
  { id: "firstTry", group: "mastery", title: "С первого раза", text: "Выучить 10 слов, ни разу не ошибившись в них", target: 10,
    value: (p) => learned(p).filter((k) => !p.cards[k].misses).length },
  { id: "stubborn", group: "mastery", title: "Упорный", text: "Выучить слово, на котором ошибся 5 раз и больше", target: 1,
    value: (p) => (learned(p).some((k) => (p.cards[k].misses || 0) >= 5) ? 1 : 0) },
  { id: "polyglot", group: "mastery", title: "Полиглот", text: "Выучить хотя бы по 10 записей каждого вида: слова, фразовые глаголы, фразы, идиомы, сленг, пословицы", target: KIND_TYPES.length, value: kindsLearned },
  { id: "idiomHunter", group: "mastery", title: "Охотник за идиомами", text: "Выучить 25 идиом", target: 25,
    value: (p) => learned(p).filter((k) => p.phrases.get(k).type === "idiom").length },
  { id: "explorer", group: "explore", title: "Исследователь", text: "Попробовать всё: обе игры, «Времена», «Повтор» и «Что учить»", target: EXPLORE.length,
    value: (p) => EXPLORE.filter((k) => p.data.explored?.[k]).length },
];

export const GROUP_TITLES = { fire: "Огонёк", answers: "Ответы", level: "Уровень", games: "Игры", tenses: "Времена", words: "Выученные слова", saved: "Закладки", mastery: "Мастерство", explore: "Исследование" };

/** Игрок впервые попробовал что-то из списка EXPLORE ("pv", "dlg", "tenses", "rev", "mode"). true — это было в первый раз. */
export function recordExplored(p, key) {
  const x = p.data.explored || (p.data.explored = {});
  if (x[key]) return false;
  x[key] = 1;
  p.save();
  return true;
}

/** Ответ в обычной карточке: считает «верных подряд». Сохраняет logAnswer, который вызывается следом. */
export function recordAnswer(p, ok) {
  p.data.run = ok ? (p.data.run || 0) + 1 : 0;
  if (ok) p.data.xp = (p.data.xp || 0) + 1;   // опыт для уровней (считается с момента их появления)
}

/** Раунд игры закончен (один раз): запомнить «без ошибок» и посчитать безупречные раунды подряд. */
export function recordRound(p, game, perfect) {
  if (perfect) (p.data.flawless || (p.data.flawless = {}))[game] = 1;
  p.data.flawRun = perfect ? (p.data.flawRun || 0) + 1 : 0;
  p.save();
}

/** Выдать всё, что заслужено и ещё не выдано. Возвращает список только что полученных. */
export function checkAchievements(p, today = new Date()) {
  const got = p.data.ach || (p.data.ach = {});
  const fresh = ACHIEVEMENTS.filter((a) => !got[a.id] && a.value(p) >= a.target);
  for (const a of fresh) got[a.id] = dayKey(today);
  if (fresh.length) p.save();
  return fresh;
}

/** Состояние для экрана: сколько есть (не больше цели), получено ли и когда. */
export function achievementStatus(p) {
  const got = p.data.ach || {};
  return ACHIEVEMENTS.map((a) => ({ ...a, cur: Math.min(a.value(p), a.target), date: got[a.id] || null }));
}

// Красная точка на «Достижениях»: полученное, но ещё не показанное на экране «Достижения». Список просмотренного — data.achSeen (в хранилище — ключ y).
/** Один раз при запуске после обновления: всё, что уже получено до этого, считается просмотренным (точка нужна только новым). */
export function initAchSeen(p) {
  if (p.data.achSeen) return;
  p.data.achSeen = Object.keys(p.data.ach || {});
  p.save();
}

/** id полученных достижений, которых пользователь ещё не видел. */
export function unseenAchievements(p) {
  const seen = p.data.achSeen || [];
  return Object.keys(p.data.ach || {}).filter((id) => !seen.includes(id));
}

/** Открыт экран «Достижения» — всё полученное просмотрено. */
export function markAchievementsSeen(p) {
  if (!unseenAchievements(p).length && p.data.achSeen) return;
  p.data.achSeen = Object.keys(p.data.ach || {});
  p.save();
}

// «Прогресс»: снимок «серия и точность» на момент последнего захода на экран «Прогресс» — data.progSeen = { s, a } (в хранилище — ключ z).
// Красная точка у «Прогресса» горит, пока серия выше, чем была при том заходе; на экране — стрелка и разница.
/** Один раз после обновления: снимок = текущее состояние (точки и стрелок для старого прогресса нет). */
export function initProgSeen(p) {
  if (p.data.progSeen) return;
  p.data.progSeen = { s: p.streak(), a: p.accuracy() };
  p.save();
}

/** Что изменилось с прошлого захода в «Прогресс»: streak — на сколько дней серии (может быть < 0), acc — на сколько процентов точности (null — сравнить не с чем). */
export function progressChange(p) {
  const seen = p.data.progSeen || { s: p.streak(), a: p.accuracy() };
  const a = p.accuracy();
  return { streak: p.streak() - seen.s, acc: a !== null && seen.a != null ? a - seen.a : null };
}

/** Заход в «Прогресс» состоялся — запомнить текущие серию и точность. */
export function markProgressSeen(p) {
  p.data.progSeen = { s: p.streak(), a: p.accuracy() };
  p.save();
}
