// «ИИ-помощник»: вопросы про английский к Google Gemini. Ключ у каждого пользователя свой (бесплатный, из Google AI Studio), хранится только в его настройках,
// запросы идут прямо с телефона в Google — наш сервер не участвует и ключ никуда, кроме Google, не отправляется. Только логика, без экрана.

export const API = "https://generativelanguage.googleapis.com/v1beta";
export const KEY_PAGE = "https://aistudio.google.com/apikey";
export const MAX_TURNS = 12;   // сколько последних реплик уходит в Google вместе с новым вопросом

export const SYSTEM = "Ты — репетитор американского английского для русскоязычного ученика уровня A2–B2. " +
  "Отвечай по-русски ОЧЕНЬ коротко и по делу: 1–3 предложения или один короткий пример с переводом. Только суть, без вступлений, повторов, пересказа вопроса и лишних советов. " +
  "Если ученик ошибся — дай исправленный вариант и одной фразой объясни почему. Подробно разбирай только если ученик прямо попросил «подробнее». " +
  "Если вопрос не про английский — одной фразой верни разговор к английскому. " +
  "Без таблиц, заголовков и списков длиннее трёх пунктов; **жирным** выделяй только ключевое слово. Не выдумывай: если не уверен, так и скажи.";

const MESSAGES = {
  badkey: "Ключ не подошёл. Проверьте, что скопировали его целиком, и вставьте ещё раз.",
  region: "Сервис Google недоступен в вашей стране или регионе. Попробуйте с другим подключением.",
  limit: "Лимит бесплатного тарифа на сейчас исчерпан. Подождите минуту (или до завтра) и спросите снова.",
  network: "Не удалось связаться с Google. Проверьте интернет и попробуйте ещё раз.",
  server: "Сервис Google временно не отвечает. Попробуйте чуть позже.",
  model: "Не нашлась подходящая модель ИИ для этого ключа.",
  blocked: "ИИ отказался отвечать на этот вопрос. Переформулируйте его.",
  empty: "ИИ вернул пустой ответ. Попробуйте спросить иначе.",
  cancelled: "Запрос отменён.",
  other: "Что-то пошло не так. Попробуйте ещё раз.",
};

export class AiError extends Error {
  constructor(code, detail = "") {
    super(MESSAGES[code] || MESSAGES.other);
    this.code = code;
    this.detail = detail;   // исходный текст ошибки Google (для диагностики, пользователю не показывается)
  }
}

/** Ответ Google с ошибкой → наш код ошибки. */
export function classify(status, text) {
  let msg = "";
  try { msg = JSON.parse(text)?.error?.message || ""; } catch { /* не JSON — ничего страшного */ }
  if (/location is not supported/i.test(msg)) return "region";
  if (status === 429 || /quota|rate limit|exhausted/i.test(msg)) return "limit";
  if (status === 401 || status === 403 || (status === 400 && /api key/i.test(msg))) return "badkey";
  if (status === 404) return "model";
  if (status >= 500) return "server";
  return "other";
}

/** Подходящие модели из списка Google в порядке «сначала самая быстрая»: «flash-lite-latest» (лёгкая и быстрая — для коротких ответов репетитора хватает), потом
 *  «gemini-flash-latest», «gemini-N-flash» от новых к старым и остальные лёгкие. У каждой модели свой бесплатный лимит и своя загруженность — если одна не отвечает, пробуем следующую. */
export function pickModels(models) {
  const ok = (models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => String(m.name).replace(/^models\//, ""));
  const ver = (n) => parseFloat(n.split("-")[1]) || 0;
  const plain = ok.filter((n) => /^gemini-[\d.]+-flash$/.test(n)).sort((a, b) => ver(b) - ver(a));
  const lite = ok.filter((n) => /^gemini-[\d.]+-flash-lite$/.test(n)).sort((a, b) => ver(b) - ver(a));
  const list = [...(ok.includes("gemini-flash-lite-latest") ? ["gemini-flash-lite-latest"] : []), ...(ok.includes("gemini-flash-latest") ? ["gemini-flash-latest"] : []), ...plain, ...lite];
  if (!list.length) { const any = ok.find((n) => /flash/.test(n) && !/lite|image|tts|live|audio|thinking|exp|robotics/.test(n)); if (any) list.push(any); }
  return [...new Set(list)];
}
export const pickModel = (models) => pickModels(models)[0] || null;

/** Текст ошибки, как его прислал Google (для показа под нашим сообщением и диагностики). */
export function googleMessage(e) {
  try { return String(JSON.parse(e.detail)?.error?.message || "").slice(0, 200); } catch { return ""; }
}

/** Потоковый запрос (alt=sse): Google присылает ответ кусками, каждый кусок — строка «data: {json}». onData вызывается на каждый разобранный кусок. */
async function callStream(url, key, init, signal, fetchImpl, onData) {
  let res;
  try {
    res = await fetchImpl(url, { ...init, signal, headers: { "x-goog-api-key": key, ...(init.headers || {}) } });
  } catch (e) {
    if (e && e.name === "AbortError") throw new AiError("cancelled");
    throw new AiError("network", String(e && e.message));
  }
  if (!res.ok) { const text = await res.text(); throw new AiError(classify(res.status, text), text.slice(0, 300)); }
  const line = (l) => {
    if (!l.startsWith("data:")) return;
    const j = l.slice(5).trim();
    if (!j || j === "[DONE]") return;
    let d; try { d = JSON.parse(j); } catch { return; }
    onData(d);
  };
  if (!(res.body && res.body.getReader)) { for (const l of (await res.text()).split("\n")) line(l.trim()); return; }   // у браузера нет потока — разбираем ответ целиком
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) { line(buf.slice(0, i).trim()); buf = buf.slice(i + 1); }
    }
    buf += dec.decode();
    if (buf.trim()) line(buf.trim());
  } catch (e) {
    if (e && e.name === "AbortError") throw new AiError("cancelled");
    throw new AiError("network", String(e && e.message));
  }
}

async function call(url, key, init, signal, fetchImpl) {
  let res;
  try {
    res = await fetchImpl(url, { ...init, signal, headers: { "x-goog-api-key": key, ...(init.headers || {}) } });
  } catch (e) {
    if (e && e.name === "AbortError") throw new AiError("cancelled");
    throw new AiError("network", String(e && e.message));
  }
  const text = await res.text();
  if (!res.ok) throw new AiError(classify(res.status, text), text.slice(0, 300));
  try { return JSON.parse(text); } catch { throw new AiError("other", "не JSON"); }
}

/** Проверить ключ (запрос списка моделей — он не тратит лимит) и подобрать модели. Возвращает массив имён: первая — основная, остальные — запасные. */
export async function checkKey(key, { signal, fetchImpl = fetch } = {}) {
  const data = await call(`${API}/models?pageSize=200`, key.trim(), {}, signal, fetchImpl);
  const models = pickModels(data.models);
  if (!models.length) throw new AiError("model");
  return models;
}

/** Ошибка «Google не принял запрос» (400 INVALID_ARGUMENT и подобные) — не про ключ, страну или лимит. */
const isBadArgument = (e) => e instanceof AiError && e.code === "other" && /thinking|INVALID_ARGUMENT|"code":\s*400/i.test(e.detail);

// Уровень размышления (выбирает пользователь кнопкой в строке ввода): чем глубже, тем точнее на сложных вопросах, но дольше и быстрее уходит бесплатный лимит.
export const LEVELS = [
  { id: "fast", label: "Быстро", hint: "без размышления, ответ за пару секунд" },
  { id: "normal", label: "Обычно", hint: "короткое размышление" },
  { id: "deep", label: "Глубоко", hint: "долгое размышление, до 30 секунд" },
];
export const DEFAULT_LEVEL = "fast";
const levelOf = (l) => (LEVELS.some((x) => x.id === l) ? l : DEFAULT_LEVEL);

export const ATTEMPT_MS = 9000;   // сколько ждём одну модель на уровне «Быстро»; дольше — пробуем следующую (бесплатные модели иногда «висят» десятки секунд)
export const MAX_MODELS = 3;      // и больше трёх моделей за один вопрос не перебираем — иначе ждать пришлось бы минуту
export const TIMEOUT = { fast: ATTEMPT_MS, normal: 16000, deep: 40000 };   // сколько ждём одну модель на каждом уровне
const TRIES = { fast: MAX_MODELS, normal: MAX_MODELS, deep: 2 };            // сколько моделей перебираем на каждом уровне

/** Порядок моделей под уровень: на «Быстро» лёгкие первыми, на «Обычно» и «Глубоко» — наоборот (лёгкие хуже думают, остаются запасными). */
export function orderModels(models, level) {
  if (levelOf(level) === "fast") return models;
  return [...models.filter((m) => !/lite/.test(m)), ...models.filter((m) => /lite/.test(m))];
}

/** Задать вопрос с запасными моделями: если основная перегружена (5xx), исчерпала лимит (429), пропала (404) или не ответила за ATTEMPT_MS — пробуем следующую.
 *  Возвращает { text, model, ms } — какая модель ответила и за сколько миллисекунд. Другие ошибки (неверный ключ, страна, отмена) пробрасываются сразу. */
export async function askWithFallback(key, models, history, opts = {}) {
  let last = null;
  const level = levelOf(opts.level);
  for (const model of orderModels(models, level).slice(0, TRIES[level])) {
    const ctl = new AbortController();
    let timedOut = false;
    const onAbort = () => ctl.abort();
    opts.signal?.addEventListener("abort", onAbort);
    const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, opts.timeout ?? TIMEOUT[level]);
    const t0 = Date.now();
    const onStart = () => { clearTimeout(timer); opts.onStart?.(model); };   // текст пошёл — модель отвечает, ждать больше не нужно и менять её поздно
    try { return { text: await ask(key, model, history, { ...opts, signal: ctl.signal, onStart }), model, ms: Date.now() - t0 }; }
    catch (e) {
      if (timedOut && e instanceof AiError && e.code === "cancelled") { last = new AiError("server", "timeout"); continue; }
      if (!(e instanceof AiError) || (!["server", "limit", "model"].includes(e.code) && !isBadArgument(e))) throw e;   // «не принял запрос» — возможно, эта модель чего-то не умеет: пробуем следующую
      last = e;
    } finally { clearTimeout(timer); opts.signal?.removeEventListener("abort", onAbort); }
  }
  throw last || new AiError("model");
}

// «Размышления» модели. Способ задать уровень у моделей разный: у старых — число (thinkingBudget), у новых — слово (thinkingLevel). Пробуем по очереди, что понимает модель;
// неподходящий способ Google отклоняет общей ошибкой «недопустимый параметр» — тогда идём к следующему. Подошедший запоминаем на пару «модель + уровень».
const THINKING = {
  fast: [{ thinkingBudget: 0 }, { thinkingLevel: "minimal" }, { thinkingLevel: "low" }, null],
  normal: [{ thinkingLevel: "medium" }, { thinkingBudget: 2048 }, { thinkingLevel: "low" }, null],
  deep: [{ thinkingLevel: "high" }, { thinkingBudget: 8192 }, null],
};
const MAX_OUT = { fast: 700, normal: 1500, deep: 3000 };   // размышления тоже считаются в длину ответа, поэтому на глубоких уровнях места больше (сам ответ всё равно короткий)
const thinkingOf = new Map();

/** Задать вопрос. history — [{ role: "user" | "model", text }], последняя реплика — новый вопрос. level — "fast" | "normal" | "deep". Возвращает текст ответа. */
export async function ask(key, model, history, { signal, fetchImpl = fetch, level: lvl, onText, onStart } = {}) {
  const level = levelOf(lvl), chain = THINKING[level], memo = model + "|" + level;
  const recent = history.slice(-MAX_TURNS);
  const contents = recent.map((m, i) => {
    const files = m.files || [];
    if (!files.length) return { role: m.role, parts: [{ text: m.text }] };
    // файлы целиком уходят только с последним вопросом; в прежних репликах остаётся пометка, иначе каждый запрос тянул бы все картинки заново
    if (i < recent.length - 1) return { role: m.role, parts: [{ text: `${m.text} [приложено: ${files.map((f) => f.name).join(", ")}]` }] };
    return { role: m.role, parts: [...files.map((f) => ({ inlineData: { mimeType: f.mime, data: f.data } })), { text: m.text }] };
  });
  // с onText ответ приходит потоком (текст появляется по мере написания), без него — одним куском
  const url = `${API}/models/${encodeURIComponent(model)}:${onText ? "streamGenerateContent?alt=sse" : "generateContent"}`;
  let data, streamed = "", last = null;
  for (let i = thinkingOf.get(memo) || 0; i < chain.length; i++) {
    const generationConfig = { temperature: 0.3, maxOutputTokens: MAX_OUT[level] };
    if (chain[i]) generationConfig.thinkingConfig = chain[i];
    const body = { systemInstruction: { parts: [{ text: SYSTEM }] }, contents, generationConfig };
    try {
      const init = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
      if (!onText) data = await call(url, key.trim(), init, signal, fetchImpl);
      else {
        streamed = ""; last = null;
        try {
          await callStream(url, key.trim(), init, signal, fetchImpl, (d) => {
            last = d;
            const part = (d.candidates?.[0]?.content?.parts || []).map((x) => x.text || "").join("");
            if (!part) return;
            if (!streamed) onStart?.();
            streamed += part; onText(streamed);
          });
        } catch (e) {
          if (!(e instanceof AiError && e.code === "network" && streamed)) throw e;   // связь оборвалась посреди ответа — показываем то, что успело прийти
        }
        data = last;
      }
      thinkingOf.set(memo, i);
      break;
    } catch (e) {
      // Google часто отвечает на неподходящую настройку размышлений общим «Request contains an invalid argument» (слова thinking в тексте нет) —
      // поэтому любая ошибка «недопустимый параметр» (400) отправляет к следующему способу; на последнем (без настройки) — настоящая ошибка
      if (!isBadArgument(e) || i === chain.length - 1) throw e;
    }
  }
  const text = (onText ? streamed : (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("")).trim();
  if (text) return text;
  if (data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason === "SAFETY") throw new AiError("blocked");
  throw new AiError("empty");
}

export const MAX_FILES = 3;                         // сколько файлов можно приложить к одному вопросу
export const MAX_PDF_BYTES = 6 * 1024 * 1024;       // PDF крупнее не берём (фото сжимаются до 800 КБ при добавлении)
export const FILE_QUESTION = "Что здесь написано и что нужно сделать? Ответь коротко.";   // если файл приложен, а вопрос не написан

/** Blob → base64 без префикса data:…, как требует Google. */
export function toBase64(blob) {
  return new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] || "");
    r.onerror = () => no(new AiError("other", "файл не прочитался"));
    r.readAsDataURL(blob);
  });
}

/** Текст ответа → строки для показа: { li: пункт списка?, parts: [{ t, b: жирный? }] }. Лишняя разметка (#, `, *курсив*) убирается. */
export function richLines(text) {
  const out = [];
  for (let line of String(text).split("\n")) {
    line = line.replace(/^\s*#{1,6}\s+/, "").replace(/`/g, "");
    const li = /^\s*[*\-•]\s+/.test(line);
    if (li) line = line.replace(/^\s*[*\-•]\s+/, "");
    line = line.replace(/(^|[\s(])\*(?!\*)([^*\n]+?)\*(?=[\s).,!?:;]|$)/g, "$1$2");   // *курсив* → просто текст
    if (!line.trim()) continue;
    const parts = [];
    line.split(/\*\*(.+?)\*\*/).forEach((t, i) => { if (t) parts.push({ t, b: i % 2 === 1 }); });
    out.push({ li, parts });
  }
  return out;
}
