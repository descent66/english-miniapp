// Анимация списка «pop» — перенос из компонента AnimatedList (React Bits) на обычный JS.
// Что взято из оригинала: пружина выезда (linear(...), 620 мс), «исчезновение» элементов, которые ушли за край экрана
// (scale 0.8, сдвиг на 12 px, прозрачность 0), появление снова при прокрутке, задержка 0.05 с между соседними
// элементами при входе, режим fade при «уменьшить анимацию», яркость при наведении и нажатии.
// Чего нет (в приложении нет выбора строки): рамка-индикатор выбора, стрелки клавиатуры, градиентная маска у краёв прокрутки
// (прокручивается вся страница, а не окошко со списком).
// Использование: animateList(контейнер, { entrance: true|false, bottomEl: нижняя панель }) после того, как строки (.item) добавлены.

const HIDDEN = {
  pop: { above: "translate3d(0, -12px, 0) scale(0.8)", below: "translate3d(0, 12px, 0) scale(0.8)" },
  fade: { above: "translate3d(0, -4px, 0)", below: "translate3d(0, 4px, 0)" },
};
const SPRING =
  "linear(0, 0.0603, 0.2033, 0.3821, 0.5633, 0.7258, 0.8584, 0.9574, 1.0242, 1.0634, 1.0809, 1.0828, 1.0747, 1.0613, 1.046, 1.0313, 1.0186, 1.0085, 1.0012, 0.9965, 0.994, 0.9931, 0.9933, 0.9941, 0.9953, 0.9966, 0.9978, 0.9988, 1)";
const STAGGER = 0.05;   // секунд между соседними строками при входе

let current = null;     // управление прошлым списком (чтобы снять его обработчики прокрутки)

export function animateList(body, { entrance = true, bottomEl = null } = {}) {
  current?.stop();
  current = null;
  const items = [...body.querySelectorAll(".item")];
  if (!items.length) { body.removeAttribute("data-animated"); return; }

  const mode = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "fade" : "pop";
  const springEase = CSS.supports?.("transition-timing-function", "linear(0, 1)") ? SPRING : "cubic-bezier(0.34, 1.4, 0.64, 1)";
  const transition = `transform 620ms ${springEase}, opacity 300ms cubic-bezier(0.22, 1, 0.36, 1), filter 200ms ease`;

  const apply = (el, state) => {
    el.dataset.state = state;
    const pose = state !== "in" ? HIDDEN[mode][state] : "";
    el.style.transform = pose;
    el.style.opacity = pose ? "0" : "";
  };

  /** Какие строки видны на экране (не меньше половины) — те «в игре», остальные спрятаны сверху или снизу. */
  const reveal = (withEntrance) => {
    if (!body.offsetParent) return;                                   // экран сейчас скрыт — считать нечего
    const bar = bottomEl && getComputedStyle(bottomEl).display !== "none" ? bottomEl.getBoundingClientRect().top : window.innerHeight;
    const top = 0, bottom = Math.max(top + 1, Math.min(window.innerHeight, bar)), view = bottom - top;
    const baseTop = body.getBoundingClientRect().top - body.offsetTop;   // позиции берём без учёта сдвига/масштаба самих строк
    let order = 0;
    for (const item of items) {
      if (!item.isConnected) continue;
      const y = baseTop + item.offsetTop, h = item.offsetHeight;
      const overlap = Math.min(bottom, y + h) - Math.max(top, y);
      const hidden = overlap < Math.min(h, view) * 0.5;
      const state = hidden ? (y + h / 2 < top + view / 2 ? "above" : "below") : "in";
      if (state === item.dataset.state) continue;
      const delay = withEntrance && !hidden ? (order++ * STAGGER).toFixed(3) : 0;
      item.style.transitionDelay = delay ? `${delay}s, ${delay}s, 0s` : "";
      apply(item, state);
    }
  };

  const setTransition = (value) => { for (const item of items) item.style.transition = value; };
  body.dataset.animated = "";

  let raf = 0, raf2 = 0, ticking = 0;
  if (entrance) {
    setTransition("none");
    for (const item of items) apply(item, "below");                  // сначала все спрятаны, потом по очереди выезжают
    void body.offsetHeight;
    setTransition(transition);
    // экран мог быть ещё скрыт (переход между вкладками) — считаем положение через два кадра, когда раскладка готова
    raf = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => reveal(true)); });
  } else {                                                           // перерисовка (поиск, удаление): без «выезда», сразу как есть
    setTransition("none");
    reveal(false);
    void body.offsetHeight;
    setTransition(transition);
  }

  const onScroll = () => {
    if (ticking) return;
    ticking = requestAnimationFrame(() => { ticking = 0; reveal(false); });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  current = {
    stop() {
      cancelAnimationFrame(raf); cancelAnimationFrame(raf2); cancelAnimationFrame(ticking);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    },
  };
}
