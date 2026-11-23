// «Переводчик» (отдельная вкладка): логика без экрана. Перевод делает DeepL через маленького посредника на Cloudflare
// (cloudflare/translate-worker.mjs): ключа DeepL в приложении нет и быть не должно. Адрес посредника — TRANSLATE_URL ниже;
// если он пустой, вкладка честно пишет «Переводчик ещё не подключён». Введённые тексты нигде не сохраняются.
export const TRANSLATE_URL = "https://translate.aipacanda.workers.dev/";            // сюда — адрес вида https://имя.workers.dev (не секрет)
export const MAX_CHARS = 500;               // столько символов за раз (так же ограничивает и посредник)
const TIMEOUT_MS = 15000;

export const ERROR_TEXT = {
  empty: "Введите текст для перевода.",
  toolong: `Слишком длинно: не больше ${MAX_CHARS} символов за раз.`,
  notconfigured: "Переводчик ещё не подключён.",
  quota: "Бесплатный лимит перевода на этот месяц закончился.",
  busy: "Слишком много запросов подряд. Подождите несколько секунд.",
  key: "Переводчик настроен неверно (проблема с ключом). Скажите владельцу бота.",
  bad: "Не удалось отправить этот текст.",
  offline: "Нет связи с интернетом. Проверьте подключение.",
  timeout: "Перевод не пришёл вовремя. Попробуйте ещё раз.",
  server: "Переводчик сейчас не отвечает. Попробуйте позже.",
  notext: "Текст на фото не найден. Попробуйте снять ближе и ровнее.",
  image: "Не удалось открыть это фото. Попробуйте другое.",
  nokey: "Распознавание текста на фото ещё не подключено.",
  cancelled: "",                                                        // запрос отменён, потому что текст уже изменился — пользователю ничего не показываем
};

export class TranslateError extends Error {
  constructor(code) { super(code in ERROR_TEXT ? ERROR_TEXT[code] : ERROR_TEXT.server); this.code = code; }
}

/**
 * dir: "ru" — с русского на английский, "en" — с английского на русский. Возвращает перевод или бросает TranslateError (в нём .code и готовый русский текст).
 * signal — необязательный внешний AbortSignal: «живой» режим отменяет прошлый запрос, когда текст уже поменялся (тогда код "cancelled", текста нет).
 */
export async function translate(text, dir, { url = TRANSLATE_URL, fetchFn = (...a) => fetch(...a), signal = null } = {}) {
  const t = String(text ?? "").trim();
  if (!t) throw new TranslateError("empty");
  if (t.length > MAX_CHARS) throw new TranslateError("toolong");
  if (!url) throw new TranslateError("notconfigured");
  if (signal && signal.aborted) throw new TranslateError("cancelled");   // уже отменено — даже не отправляем
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  if (signal && ctl) { if (signal.aborted) ctl.abort(); else signal.addEventListener("abort", () => ctl.abort(), { once: true }); }
  const timer = ctl ? setTimeout(() => ctl.abort(), TIMEOUT_MS) : 0;
  let res;
  try {
    res = await fetchFn(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t, from: dir === "en" ? "EN" : "RU" }), signal: ctl ? ctl.signal : undefined,
    });
  } catch (e) {
    if (signal && signal.aborted) throw new TranslateError("cancelled");
    throw new TranslateError(e && e.name === "AbortError" ? "timeout" : "offline");
  } finally { clearTimeout(timer); }
  const data = await res.json().catch(() => null);
  if (res.ok && data && typeof data.text === "string" && data.text) return data.text;
  throw new TranslateError(data && ERROR_TEXT[data.error] ? data.error : "server");
}

// ---------- перевод по фото ----------
// Фото сжимается в телефоне (до ~1600 px и ≤ 800 КБ: бесплатное распознавание OCR.space принимает до 1 МБ) и уходит тому же посреднику
// обычным телом image/jpeg; посредник (ключ OCR_KEY — в секретах Cloudflare) возвращает { text }. Дальше текст идёт в обычный перевод.
export const MAX_IMAGE_BYTES = 800 * 1024;
const OCR_TIMEOUT_MS = 40000;

/** Какой язык на фото: кириллицы больше, чем латиницы — "ru" (переводим на английский), иначе "en" (переводим на русский). */
export function guessDir(text) {
  const t = String(text ?? "");
  const cyr = (t.match(/[а-яё]/gi) || []).length, lat = (t.match(/[a-z]/gi) || []).length;
  return cyr > lat ? "ru" : "en";
}

/** Фото (File/Blob) → JPEG-Blob не больше MAX_IMAGE_BYTES: уменьшаем сторону и качество, пока не влезет. Повёрнутые снимки читаются как есть (EXIF учитывает браузер). */
export async function prepareImage(file) {
  let bmp = null, url = "";
  try { bmp = await createImageBitmap(file); } catch { /* старый браузер или необычный формат — пробуем через <img> */ }
  if (!bmp) {
    url = URL.createObjectURL(file);
    bmp = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new TranslateError("image")); im.src = url; });
  }
  try {
    const w0 = bmp.naturalWidth || bmp.width, h0 = bmp.naturalHeight || bmp.height;
    if (!w0 || !h0) throw new TranslateError("image");
    const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    let side = 1600, quality = 0.82;
    for (let i = 0; i < 6; i++) {
      const k = Math.min(1, side / Math.max(w0, h0));
      canvas.width = Math.max(1, Math.round(w0 * k)); canvas.height = Math.max(1, Math.round(h0 * k));
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);   // у PNG с прозрачностью фон иначе стал бы чёрным
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", quality));
      if (blob && blob.size <= MAX_IMAGE_BYTES) return blob;
      side *= 0.8; quality = Math.max(0.6, quality - 0.05);
    }
    throw new TranslateError("image");
  } finally { if (url) URL.revokeObjectURL(url); if (bmp.close) bmp.close(); }
}

/** Фото → распознанный текст (не длиннее MAX_CHARS) или TranslateError (.code: notext, image, nokey, busy, key, offline, timeout, server …). */
export async function recognizeText(file, { url = TRANSLATE_URL, fetchFn = (...a) => fetch(...a), prepare = prepareImage } = {}) {
  if (!url) throw new TranslateError("notconfigured");
  const blob = await prepare(file);
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), OCR_TIMEOUT_MS) : 0;
  let res;
  try {
    res = await fetchFn(url, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob, signal: ctl ? ctl.signal : undefined });
  } catch (e) {
    throw new TranslateError(e && e.name === "AbortError" ? "timeout" : "offline");
  } finally { clearTimeout(timer); }
  const data = await res.json().catch(() => null);
  if (res.ok && data && typeof data.text === "string") {
    const text = data.text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_CHARS);
    if (!text) throw new TranslateError("notext");
    return text;
  }
  throw new TranslateError(data && ERROR_TEXT[data.error] ? data.error : "server");
}
