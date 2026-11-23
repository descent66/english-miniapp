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
