// «Ассоциации» (Больше → Ассоциации): запоминание слов методом ключевого слова — английское слово + похожее по звучанию русское +
// яркая сценка, где созвучие и смысл встречаются. Режимы: «Запомнить» (новые по 5), «Проверь себя» (по расписанию), своя ассоциация.
// Прогресс — progress.data.assoc: { en: { s: ступень, d: когда проверять (сек), m: своя ассоциация } }; в хранилище ключ "m".
// Разметка истории: [ключевое слово] — подсветка, *смысл* — жирным. Пустой «как звучит» (фразовые глаголы, пословицы) — строки нет,
// там приём другой: жизненная сценка, где английские слова буквально описывают происходящее, а из него следует смысл; CS2 — только где подходит точно.
import { checkAnswer, hintMask } from "./core.js?v=33";
import { animateList } from "./animlist.js?v=33";

export const ASSOC = [
  ["Claim", "КЛЕЙМ", "Фермер *требует* корову назад и *утверждает*, что она его: на боку его [клеймо].", "🐄"],
  ["Cure", "КЬЮР", "Мария [Кюри] открыла радий — им стали *лечить* рак.", "☢️"],
  ["Dare", "ДЭР", "Только [дерзкий] *осмелится* прыгнуть с этой скалы в море.", "🪂"],
  ["Heal", "ХИЛ", "[Хилер] в игре *исцеляет* команду — и раны *заживают* на глазах.", "❤️‍🩹"],
  ["Rescue", "РЕСкью", "Спасатель с [риском] для жизни *спасает* тонущего.", "🛟"],
  ["Spread", "СПРЕД", "[Спред] легко *намазывается* на хлеб, а слухи так же легко *распространяются* по городу.", "🧈"],
  ["Stare", "СТЭР", "[Старушка] на лавке *уставилась* на тебя и не сводит глаз.", "👵"],
  ["Beg", "БЕГ", "Пёс [бегом] несётся к столу и *умоляет* глазами: «Дай кусочек!»", "🐶"],
  ["Fade", "ФЕЙД", "[Фея] *угасает*, если в неё перестают верить.", "🧚"],
  ["Glance", "ГЛЭНС", "[Глянул] на часы *мельком* — и побежал дальше.", "👀"],
  ["Grab", "ГРЭБ", "[Грабитель] *хватает* сумку и убегает.", "👜"],
  ["Suffer", "САфер", "На [сафари] *страдаешь* от жары и москитов.", "🦒"],
  ["Dread", "ДРЕД", "*Со страхом жду*, когда мама увидит мои новые [дреды].", "😬"],
  ["Grumpy", "ГРАМпи", "*Ворчливый* дед с утра [громыхает]: «Опять всё не так!»", "⛈️"],
  ["Furious", "ФЬЮриэс", "*Взбешённая*, как [фурия], — лучше не попадаться ей на глаза.", "😡"],
  ["Gossip", "ГАсип", "*Сплетни* — как пожар: [гаси], пока не разгорелись.", "🗣️"],
  ["Rumor", "РУмер", "*Слух* разлетелся по району, будто его крикнули в [рупор].", "📢"],
  ["Eager", "Игер", "*Не терпится* начать [игру] — джойстик уже в руках!", "🕹️"],
  ["Tricky", "ТРИки", "Фокусник со своими [трюками] — *хитрый* малый.", "🃏"],
  ["Lousy", "ЛАУзи", "*Паршивый* день: с утра упал в [лужу].", "☔"],
  ["Sloppy", "СЛАпи", "Маляр *небрежно* [шлёпает] краску на стену как попало.", "🖌️"],
  ["Vivid", "ВИвид", "С горы открывается *яркий*, живой [вид].", "🏞️"],
  ["Burden", "БЁРден", "Тащить на спине [бурдюк] с водой через пустыню — настоящее *бремя*.", "🐪"],
  ["Suspect", "сэСПЕКТ", "[Инспектор] прищурился — он *подозревает* дворецкого. В обоих словах одно «спект».", "🕵️"],
  ["Encounter", "инКАУНтер", "Внутри слова спрятан [Counter] из Counter-Strike: выбежал из-за угла и *неожиданно столкнулся* с контром.", "🎯"],
  ["Undermine", "андэрМАЙН", "Under — под, [mine] — мина: сапёр закладывает мину под стену и *подрывает* её. Так и сплетни *подрывают* доверие.", "💣"],
  ["Force", "ФОРС", "[Форс]-бай в CS2: денег нет, а команда *заставляет* всех закупиться.", "💸"],
  ["Resist", "риЗИСТ", "[Резистор] в схеме *сопротивляется* току — отсюда и его название.", "🔌"],
  ["Compete", "кэмПИТ", "[Компетитив] в играх — режим, где *соревнуешься* с другими за ранг.", "🏅"],
  ["Mislead", "мисЛИД", "[Лидер] (lead — вести) ведёт группу туристов не туда (mis-) — *вводит в заблуждение*.", "🧭"],
  ["Neglect", "ниГЛЕКТ", "Хозяин [не глядит] за садом — *запустил* его, всё заросло.", "🥀"],
  ["Persuade", "пэрСУЭЙД", "Долго *уговаривал* её на [свадьбу] — и уговорил.", "💍"],
  ["Confess", "кэнФЕС", "Пришлось *признаться*, что [конфеты] из вазы съел ты.", "🍬"],
  ["Injure", "ИНджер", "Поскользнулся на раздавленном [инжире] и *травмировал* ногу.", "🤕"],
  ["Admire", "эдМАЙер", "Солдаты *восхищаются* бравым [майором].", "🎖️"],
  ["Prevent", "приВЕНТ", "Вовремя перекрыл [вентиль] — *предотвратил* потоп.", "🚰"],
  ["Rely", "риЛАЙ", "На [лайку] в упряжке можно *положиться* — довезёт.", "🐕‍🦺"],
  ["Capture", "КЭПчер", "[Кэп] пиратов *захватил* корабль.", "🏴‍☠️"],
  ["Overlook", "оуверЛУК", "[Look] — смотришь, over — поверх: смотришь поверх очков и *не замечаешь* ключи прямо под носом.", "🔑"],
  ["Dismiss", "дисМИС", "[Мисс] Вселенная *отмахнулась* от назойливого поклонника.", "👑"],
  ["Give up", "", "Руки [вверх] (up), [отдаёшь] (give) оружие — *сдаёшься*. Так же и с курением: give up smoking — *бросить*.", "🏳️"],
  ["Hold on", "", "Друг висит на краю скалы, кричишь: «[Держись]! (hold on)» — *подожди*, сейчас вытащу. По телефону «hold on» — *погоди секунду*.", "✋"],
  ["Hold back", "", "[Держишь] (hold) себя [сзади] (back), как пса за поводок, — *сдерживаешься*, чтобы не наорать.", "🦮"],
  ["Back out", "", "Заехал во двор, а места нет — [задом] (back) [наружу] (out): *дал задний ход*. Так же *отказываются от плана*.", "🚗"],
  ["Back up", "", "«Нужен [бэкап] на B!» — тиммейт прикрывает спину (back) и *поддерживает* тебя. А бэкап файлов — *резервная копия*.", "🤝"],
  ["Take over", "", "Водитель задремал — ты [берёшь] (take) руль [на себя] (over): *принимаешь управление*.", "🚌"],
  ["Pull off", "", "[Вытащил] (pull) клатч один против четырёх — *провернул* невозможное.", "🦾"],
  ["Mess up", "", "Пёк торт — на кухне [месиво] (mess) из муки и яиц, торт сгорел: *облажался*.", "🎂"],
  ["Freak out", "", "Увидел паука — и наружу (out) вылез внутренний [фрик] (freak): орёшь, прыгаешь — *психуешь*.", "🕷️"],
  ["Chicken out", "", "Обещал прыгнуть с тарзанки, а у края стал [цыплёнком] (chicken) и вышел (out) из очереди — *струсил*.", "🐔"],
  ["Blow up", "", "[Надуваешь] (blow up) шарик всё сильнее — и он *взрывается*: бах! Так же человек, которого довели, *вспыливает*.", "🎈"],
  ["Run out of", "", "Молоко [убежало] (run out) из кастрюли — и всё, молока *больше нет*: оно *закончилось*.", "🥛"],
  ["Kick out", "", "Голосование за [кик]: пинком (kick) наружу (out) — токсика *выгнали* из лобби.", "🦵"],
  ["Kick off", "", "[Пинок] (kick) по мячу в центре поля — мяч летит прочь (off): матч *начался*.", "⚽"],
  ["Line up", "", "В магазине люди встали в одну [линию] (line) — *выстроились в очередь* к кассе.", "🧍"],
  ["Stand by", "", "Пожарные [стоят] (stand) [рядом] (by) с машиной — *ждут наготове* вызова.", "🚒"],
  ["Rule out", "", "Детектив по линейке [проводит черту] (rule) через имя и вычёркивает (out) его из списка подозреваемых — *исключил* его.", "📏"],
  ["Sum up", "", "[Сумма] (sum) в конце чека — *подводишь итог* всем покупкам.", "🧾"],
  ["Cut off", "", "[Отрезал] (cut) провод — и звонок *прервался*, свет *отключился*.", "✂️"],
  ["Fall behind", "", "На пробежке [упал] (fall) — и все убежали вперёд, а ты [позади] (behind): *отстал*.", "🏃"],
  ["Catch up", "", "Группа ушла вперёд, а ты бежишь и [ловишь] (catch) её, пока не поравняешься (up) — *догнал*, *наверстал*. А с давним другом catch up — *пообщаться после перерыва*.", "📈"],
  ["Give in", "", "Ребёнок час ноет у прилавка — и мама [отдаёт] (give) шоколадку прямо [в] (in) руки: *сдалась*, *уступила*.", "🍫"],
  ["Get away with", "", "Ниндзя-дефуз прямо под носом у врага — [ушёл] (get away) с победой: *сошло с рук*.", "🥷"],
  ["Look out", "", "Мама из окна: «[Смотри] (look) [наружу] (out)! *Берегись*, машина!»", "⚠️"],
  ["Watch out", "", "Гололёд: [следи] (watch) за каждым шагом — *остерегайся*, упадёшь.", "🧊"],
  ["Zone out", "", "Учитель объясняет, а ты выпал из [зоны] (zone) — *отключился* и смотришь в окно.", "😶‍🌫️"],
  ["Speed up", "", "Водитель жмёт газ: [скорость] (speed) вверх (up) — *ускоряется*.", "🏎️"],
  ["Slow down", "", "Перед школой стрелка спидометра вниз (down), едешь [медленно] (slow) — *притормози*.", "🐢"],
  ["Show off", "", "Сосед устроил [шоу] (show) на новом мотоцикле на весь двор — *выпендривается*.", "🏍️"],
  ["Give away", "", "[Отдаёшь] (give) старые игрушки [прочь] (away) — *раздаёшь* соседским детям. А шпион, который проболтался, себя *выдал*.", "🎁"],
  ["Hand out", "", "Промоутер у метро протягивает [руку] (hand) [наружу] (out) с листовкой — *раздаёт* их прохожим.", "📄"],
  ["Burn out", "", "Свеча [горела] (burn) всю ночь и [погасла] (out) — так и ты после года без отпуска: *выгорел*.", "🕯️"],
  ["Save up", "", "Эко-раунд в CS2: ничего не покупаешь, [save] — *копишь деньги* на AK и броню.", "🐷"],
  ["Pay off", "", "[Заплатил] (pay) за дорогой абонемент в зал — а через полгода пресс: вложения *окупились*.", "💪"],
  ["Count on", "", "Друг обещает: «[Рассчитывай] (count) [на] (on) меня — приеду с машиной». Count — считать, как в рас-счит-ывать: *рассчитываешь на* друга.", "🔢"],
  ["Break in", "", "Вор [разбил] (break) окно и залез [внутрь] (in) — *вломился* в дом.", "🪟"],
  ["Step up", "", "Капитан ушёл — новенький делает [шаг] (step) вперёд — *берёт ответственность* на себя.", "🪜"],
  ["Stick to", "", "Как стикер, [прилип] (stick) [к] (to) плану диеты — *придерживаешься* его.", "📌"],
  ["Turn down", "", "[Повернул] (turn) ручку громкости [вниз] (down) — *убавил*. А предложение «turn down» — *отказать*.", "🔉"],
  ["Let down", "", "Друг страховал на скалодроме и [дал] (let) тебе упасть [вниз] (down) — *подвёл*.", "🧗"],
  ["Back down", "", "Подошёл к собаке, она зарычала — и ты [назад] (back), голову [вниз] (down): *пошёл на попятную*.", "🐕"],
  ["Fall apart", "", "Старый шкаф [упал] (fall) и разлетелся [на части] (apart) — *развалился*.", "🪑"],
  ["Fall for", "", "Рыбка [падает] (fall) [за] (for) червяком прямо на крючок — *купилась*. А fall for кого-то — *влюбиться*.", "🎣"],
  ["Fall through", "", "Старый мост [провалился] (fall) [насквозь] (through) — поездка *сорвалась*.", "🌉"],
  ["Get over", "", "Обида — как стена: нужно [перелезть] (get) [через] (over) неё — *оправиться* и жить дальше.", "🧱"],
  ["Get through", "", "[Пробрался] (get) [сквозь] (through) метель до дома — *выдержал*.", "❄️"],
  ["Turn out", "", "[Вывернул] (turn) кошелёк [наружу] (out) — и *оказалось*, что денег нет.", "👛"],
  ["End up", "", "Сел не на тот автобус — и в [конце] (end) пути *оказался* в другом городе.", "🚌"],
  ["Put up with", "", "Сосед сверлит каждое утро, а ты [кладёшь] (put) подушку на голову — *миришься с* этим.", "🛏️"],
  ["Stand up for", "", "Друга дразнят — ты [встаёшь] (stand up) [за] (for) него: *заступаешься*.", "🧑‍🤝‍🧑"],
  ["Stand out", "", "Все в чёрном, а ты в жёлтом [стоишь] (stand) [вне] (out) толпы — *выделяешься*.", "💛"],
  ["Point out", "", "[Тычешь] пальцем (point) [наружу] (out), в окно: «Смотри, радуга!» — *обращаешь внимание*.", "🌈"],
  ["Look into", "", "[Заглядываешь] (look) [внутрь] (into) капота — *разбираешься*, что сломалось.", "🔍"],
  ["Look forward to", "", "[Смотришь] (look) [вперёд] (forward), на дату в календаре: до отпуска три дня! *С нетерпением ждёшь*.", "🏖️"],
  ["Find out", "", "[Нашёл] (find) в мусорке и вытащил [наружу] (out) обёртку — *выяснил*, кто съел торт.", "🔎"],
  ["Figure out", "", "Собираешь шкаф: вертишь [фигуры] (figure) деталей, пока не *сообразишь*, что куда.", "🧩"],
  ["Come up with", "", "Стоишь под душем — и идея сама [всплыла] (come up) — *придумал*!", "💡"],
  ["Show up", "", "Опоздал на час, но наконец [показался] (show up) в дверях — *явился*.", "🚪"],
  ["Set up", "", "[Ставишь] (set) палатку [вверх] (up) — *устраиваешь* лагерь. Set up — *настроить, организовать*.", "⛺"],
  ["Work out", "", "[Работаешь] (work) в зале до пота — *тренируешься*. А задача «worked out» — *получилось*.", "🏋️"],
  ["Take off", "", "Самолёт [отрывается] (take off) от земли — *взлетает*. Пальто ты тоже take off — *снимаешь*.", "✈️"],
  ["Pick up", "", "[Подхватываешь] (pick up) друга у метро в машину — *забираешь* его.", "🚗"],
  ["Drop off", "", "[Высадил] (drop) друга у дома и уехал [прочь] (off) — *подбросил*.", "🚕"],
  ["Break down", "", "Машина [ломается] (break) и встаёт посреди трассы — *сломалась*. А человек «breaks down» — *расплакался*.", "🛠️"],
  ["Break up", "", "Сердце [разбилось] (break) на две половинки — пара *рассталась*.", "💔"],
  ["Calm down", "", "Выдох, плечи [вниз] (down), всё [спокойно] (calm) — *успокойся*.", "🧘"],
  ["Cheer up", "", "Друзья кричат «[Ура]!» (cheer) — и настроение [вверх] (up): *не унывай*!", "🙌"],
  ["Mix up", "", "[Смешал] (mix) носки из двух пар — *перепутал*.", "🧦"],
  ["Carry on", "", "Устал, но [несёшь] (carry) рюкзак [дальше] (on) — *продолжаешь* путь.", "🎒"],
  ["Carry out", "", "Курьер [выносит] (carry out) заказ со склада — *выполняет* задание.", "📦"],
  ["Settle down", "", "Птица [садится] (settle) на ветку и вьёт гнездо — *осела*, *остепенилась*.", "🪺"],
  ["Shut down", "", "[Закрыл] (shut) все программы и нажал «Завершение работы» — экран погас: *выключил* компьютер.", "💻"],
  ["Wrap up", "", "[Завернул] (wrap) последний подарок — работа *завершена*.", "🎀"],
  ["Run into", "", "[Бежишь] (run) за угол и врезаешься [в] (into) одноклассника — *случайно встретил*.", "💫"],
  ["Come across", "", "[Идёшь] (come) [через] (across) парк и *натыкаешься* на потерянный кошелёк.", "🌳"],
  ["Sort out", "", "[Сортируешь] (sort) бумаги, лишнее — [вон] (out) — и всё *уладил*.", "🗂️"],
  ["Bring up", "", "[Принёс] (bring) старую фотку и выложил [наверх] (up), на стол — *затронул тему*.", "💬"],
  ["Keep up with", "", "[Держишь] (keep) темп наравне [с] (with) бегунами — *не отстаёшь* от них.", "🏃‍♂️"],
  ["Opt out", "", "Выбираешь [опцию] (opt) «[выход]» (out) — *отказываешься участвовать*.", "🚫"],
  ["Go through", "", "[Идёшь] (go) [сквозь] (through) тёмный тоннель к свету — *переживаешь* трудное время.", "🚇"],
  ["Actions speak louder than words", "", "Он только обещает, а она каждый день помогает: её [дела] (actions) [говорят громче] (speak louder) [слов] (words). *Дела говорят громче слов*.", "🔊"],
  ["Don't judge a book by its cover", "", "Невзрачная [книга] (book) в серой [обложке] (cover) оказалась лучшей в жизни — не [суди] (judge) по ней. *Не суди по внешности*.", "📕"],
  ["Don't put all your eggs in one basket", "", "Несёшь все [яйца] (eggs) в одной [корзине] (basket), споткнулся — разбил все. *Не клади все яйца в одну корзину*.", "🥚"],
  ["The early bird catches the worm", "", "[Ранняя птичка] (early bird) встала на рассвете и первой [поймала червяка] (catches the worm). *Кто рано встаёт, тому Бог подаёт*.", "🐦"],
  ["Two heads are better than one", "", "Целый час мучился со шкафом один, а вдвоём — [две головы] (two heads) — собрали за десять минут. *Одна голова хорошо, а две лучше*.", "👥"],
  ["Honesty is the best policy", "", "Признался, что разбил вазу, — и тебя простили: [честность] (honesty) — лучшая [политика] (policy). *Честность — лучшая политика*.", "🏺"],
  ["Good things come to those who wait", "", "Рыбак [ждёт] (wait) часами — и [хорошее] (good things) само [приходит] (come): клюёт щука. *Всё приходит вовремя к тому, кто умеет ждать*.", "🎣"],
  ["Laughter is the best medicine", "", "Друзья рассмешили тебя в больнице — [смех] (laughter) помог лучше всякого [лекарства] (medicine). *Смех — лучшее лекарство*.", "😂"],
  ["No news is good news", "", "Сын в походе не звонит: [нет новостей] (no news) — значит, всё [хорошо] (good news). *Отсутствие новостей — хорошая новость*.", "📭"],
  ["There's no place like home", "", "После месяца в отелях падаешь на свой диван: [нет места] (no place) лучше, чем [дом] (like home). *В гостях хорошо, а дома лучше*.", "🏠"],
  ["Slow and steady wins the race", "", "Черепаха ползёт [медленно] (slow) и [ровно] (steady) — и [выигрывает гонку] (wins the race) у зайца. *Тише едешь — дальше будешь*.", "🐢"],
  ["Where there's a will, there's a way", "", "Нет денег на зал — бегаешь по лестнице в подъезде: есть [воля] (will) — найдётся и [путь] (way). *Хотеть — значит мочь*.", "🧗"],
  ["Where there's smoke, there's fire", "", "Сосед клянётся, что ничего не жарит, а из окна валит [дым] (smoke) — значит, где-то есть и [огонь] (fire). *Нет дыма без огня*.", "💨"],
  ["Don't cry over spilled milk", "", "Разлил [молоко] (spilled milk) — [плачь] (cry) не плачь, обратно в стакан не соберёшь. *Слезами горю не поможешь*.", "🥛"],
  ["Every dog has its day", "", "Дворняга, которую все гоняли, нашла потерявшегося ребёнка и стала героем: у [каждой собаки] (every dog) свой [день] (day). *Будет и на нашей улице праздник*.", "🐕"],
  ["Fortune favors the bold", "", "Только ты [смело] (bold) подошёл к звезде за автографом — и получил ещё и селфи: [удача] (fortune) [любит] (favors) смелых. *Смелым судьба помогает*.", "🍀"],
  ["A picture is worth a thousand words", "", "Десять минут объяснял дорогу — а скинул одну [картинку] (picture) карты, и всё ясно: она [стоит тысячи слов] (is worth a thousand words). *Лучше один раз увидеть, чем сто раз услышать*.", "🖼️"],
  ["Two wrongs don't make a right", "", "Брат сломал твою машинку, а ты в ответ — его? Теперь сломаны обе: [два зла] (two wrongs) не складываются в [правильное] (a right). *Зло злом не исправишь*.", "⚖️"],
  ["Haste makes waste", "", "Торопился и налил кофе мимо чашки: [спешка] (haste) — сплошной [убыток] (waste); haste и waste рифмуются. *Поспешишь — людей насмешишь*.", "☕"],
  ["Live and learn", "", "Постирал белую рубашку с красным носком — стала розовой: [живи] (live) и [учись] (learn). *Век живи — век учись*.", "🧺"],
  ["Strike while the iron is hot", "", "Кузнец [бьёт] (strike) молотом, пока [железо горячее] (the iron is hot), — остынет, уже не согнёшь. *Куй железо, пока горячо*.", "🔨"],
  ["Patience is a virtue", "", "Не открыл духовку раньше времени — и пирог поднялся: [терпение] (patience) — [добродетель] (virtue). *Терпение — добродетель*.", "🥧"],
  ["Every cloud has a silver lining", "", "Опоздал на поезд — зато в кафе встретил старого друга: у [каждой тучи] (every cloud) есть [серебряная кайма] (silver lining). *Нет худа без добра*.", "🌥️"],
  ["Look before you leap", "", "Лягушка [смотрит] (look), [прежде чем прыгнуть] (before you leap), — нет ли рядом цапли. *Семь раз отмерь, один раз отрежь*.", "🐸"],
  ["Rome wasn't built in a day", "", "[Рим] (Rome) [не построили] (wasn't built) [за день] (in a day) — и английский за неделю не выучишь. *Москва не сразу строилась*.", "🏛️"],
  ["What goes around comes around", "", "Бросил бумеранг — он [пролетел по кругу] (goes around) и [вернулся] (comes around) тебе же в лоб. *Что посеешь, то и пожнёшь*.", "🪃"],
  ["The grass is always greener on the other side", "", "Смотришь через забор: у соседа [трава] (grass) [зеленее] (greener) на [той стороне] (other side). А он думает так же про твою. *Там хорошо, где нас нет*.", "🌱"],
  ["Too many cooks spoil the broth", "", "[Слишком много поваров] (too many cooks), и каждый подсолил — [испортили бульон] (spoil the broth). *У семи нянек дитя без глазу*.", "👨‍🍳"],
  ["Out of sight, out of mind", "", "Убрал гантели под кровать — [с глаз] (out of sight) — и [из головы] (out of mind): про спорт забыл. *С глаз долой — из сердца вон*.", "🙈"],
  ["Curiosity killed the cat", "", "Кошка суёт нос в каждую щель — [любопытство] (curiosity) её и [погубило] (killed the cat). *Любопытство до добра не доведёт*.", "🐈‍⬛"],
  ["Don't count your chickens before they hatch", "", "Не [считай цыплят] (count your chickens), пока [не вылупились] (before they hatch), — не трать премию, которую ещё не дали. *Цыплят по осени считают*.", "🐣"],
  ["If it ain't broke, don't fix it", "", "Старый холодильник гудит, но морозит: [не сломан] (ain't broke) — [не чини] (don't fix it). *Работает — не трогай*.", "🔧"],
  ["It takes two to tango", "", "Для [танго] (tango) [нужны двое] (it takes two) — и в ссоре всегда виноваты оба. *Для ссоры нужны двое*.", "💃"],
  ["Once bitten, twice shy", "", "[Раз укусила] (once bitten) собака — и [вдвойне] (twice) [робеешь] (shy), обходишь её стороной. *Обжёгшись на молоке, дуешь на воду*.", "🐕‍🦺"],
  ["A friend in need is a friend indeed", "", "Ночью сломалась машина — приехал только один: [друг в беде] (a friend in need) — [настоящий друг] (a friend indeed). *Друг познаётся в беде*.", "🚗"],
].map(([en, sound, story, emoji]) => ({ en, sound, story, emoji }));

const MIN = 60, DAY = 86400;
const INTERVAL = [0, 0, 1 * DAY, 3 * DAY, 7 * DAY, 21 * DAY, 60 * DAY];   // ступень → через сколько следующая проверка
const RETRY = 10 * MIN;                        // ошибся — проверим снова через 10 минут
const nowSec = () => Math.floor(Date.now() / 1000);

const store = (p) => p.data.assoc || (p.data.assoc = {});
export const assocRec = (p, en) => (p.data.assoc && p.data.assoc[en]) || null;
/** Новые (ещё не «Запомнил»), к проверке сейчас, всего «запомнено». */
export function assocStatus(p, now = nowSec()) {
  const fresh = [], due = [];
  for (const a of ASSOC) {
    const r = assocRec(p, a.en);
    if (!r || !r.s) fresh.push(a);
    else if (r.d <= now) due.push(a);
  }
  return { fresh, due, learned: ASSOC.length - fresh.length };
}
/** «Запомнил»: слово попадает в «Проверь себя» сразу (первая проверка — в тот же день). */
export function assocRemember(p, en, now = nowSec()) {
  const r = store(p)[en] || (store(p)[en] = {});
  r.s = 1; r.d = now;
  p.save();
}
/** Ответ в «Проверь себя»: верно — следующая проверка позже (1, 3, 7, 21, 60 дней), неверно — снова через 10 минут. */
export function assocAnswer(p, en, ok, now = nowSec()) {
  const r = store(p)[en] || (store(p)[en] = { s: 1 });
  if (ok) { r.s = Math.min((r.s || 1) + 1, INTERVAL.length - 1); r.d = now + INTERVAL[r.s]; }
  else { r.s = 1; r.d = now + RETRY; }
  p.save();
}
/** Своя ассоциация (пустая строка — убрать и вернуть готовую). */
export function assocSetOwn(p, en, text) {
  const t = String(text || "").trim().slice(0, 240);
  const r = store(p)[en] || (store(p)[en] = { s: 0, d: 0 });
  if (t) r.m = t; else delete r.m;
  p.save();
}
export const assocCheck = (text, en) => checkAnswer(text, [en], true);

/** Экран «Ассоциации». ctx: make, play, $, getProgress, phrases (Map en → запись базы), shuffle, batch() — новых слов за раз, batchField() — ползунок для него,
 *  popIn — анимация появления (как у карточек), startsWord — поиск по началу слова (как в «Инвентаре»), bar() — нижняя панель (для выезда списка). */
export function initAssoc(ctx) {
  const { make, play, $, getProgress, shuffle } = ctx;
  const P = () => getProgress();
  const ru = (en) => ctx.phrases().get(en)?.ru[0] || "";
  const KIND = { word: "слово", "phrasal verb": "фразовый глагол", proverb: "пословица" };
  const isVerb = (p) => p.type === "word" && /(ть|ться|чь|ти)$/.test(p.ru[0].split(/[ (]/)[0]);   // в базе у глаголов вид «word» — узнаём по инфинитиву
  const kind = (en) => { const p = ctx.phrases().get(en); return p ? `${isVerb(p) ? "глагол" : KIND[p.type] || p.type} · ${p.level}` : ""; };
  const soundLine = (a) => a.sound ? make("div", "asound", `🔊 звучит как «${a.sound}»`) : null;
  // kind: "learn" | "check" | "loop" (повтор запомненного по кругу, без счёта) | "done" | "list" (все слова) | "view" (одно слово из списка)
  let run = null;
  let shownKey = "", popNodes = null;   // анимация появления: вся карточка — на новом экране/слове, после ответа — только новые части
  let enterAction = null;               // что делает Enter сейчас (после ответа — «Далее»)
  const learned = () => ASSOC.filter((a) => assocRec(P(), a.en)?.s);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.repeat || e.defaultPrevented || !enterAction || !$("assoc").offsetParent || e.target.closest?.("textarea")) return;
    e.preventDefault();
    enterAction();
  });

  /** История с подсветкой: [ключ] — светлый акцент, *смысл* — жирным. */
  function story(text) {
    const box = make("p", "astory");
    for (const part of text.split(/(\[[^\]]+\]|\*[^*]+\*)/)) {
      if (!part) continue;
      if (part[0] === "[") box.append(make("mark", "akey", part.slice(1, -1)));
      else if (part[0] === "*") box.append(make("b", "", part.slice(1, -1)));
      else box.append(part);
    }
    return box;
  }

  function quitBtn(label, onClick) {
    const quit = make("button", "gamequit");
    quit.setAttribute("aria-label", label);
    quit.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    quit.addEventListener("click", onClick);
    return quit;
  }

  function head(title) {
    const h = make("div", "gamehead");
    h.append(make("span", "muted", title), quitBtn("Выйти", () => { run = null; render(); }));
    const bar = make("div", "track"), fill = make("i");
    fill.style.width = `${(run.i / run.items.length) * 100}%`;
    bar.append(fill);
    return [h, bar];
  }

  /** Блок ассоциации: своя (если придумана) или готовая, плюс «Придумать свою» / правка. */
  function assocBlock(a) {
    const wrap = make("div", "aassoc");
    const own = assocRec(P(), a.en)?.m;
    if (run.edit) {
      const ta = make("textarea", "aown");
      Object.assign(ta, { rows: 3, maxLength: 240, placeholder: "Например: «Гейзер» — у него собираются туристы" });
      ta.value = own || "";
      ta.setAttribute("aria-label", "Своя ассоциация");
      const row = make("div", "arow");
      const save = make("button", "btn primary", "Сохранить"), cancel = make("button", "btn", "Отмена");
      save.addEventListener("click", () => { assocSetOwn(P(), a.en, ta.value); run.edit = false; play("set"); render(); });
      cancel.addEventListener("click", () => { run.edit = false; render(); });
      row.append(cancel, save);
      wrap.append(ta, row);
      setTimeout(() => ta.focus(), 0);
      return wrap;
    }
    if (own) { wrap.append(make("div", "alabel", "Ваша ассоциация"), make("p", "astory", own)); }
    else wrap.append(story(a.story));
    const edit = make("button", "alink", own ? "Изменить свою" : "Придумать свою");
    edit.addEventListener("click", () => { run.edit = true; render(); });
    wrap.append(edit);
    return wrap;
  }

  function wordHead(a, showWord) {
    const top = make("div", "aword");
    top.append(make("span", "aemoji", a.emoji));
    const t = make("div", "");
    if (showWord) t.append(make("div", "aen", a.en));
    t.append(make("div", showWord ? "aru muted" : "aen", ru(a.en)), make("div", "akind muted", kind(a.en)));
    top.append(t);
    return top;
  }

  function renderLearn(card) {
    const a = run.items[run.i];
    card.append(...head(`${run.i + 1} из ${run.items.length}`), wordHead(a, true), ...[soundLine(a)].filter(Boolean), assocBlock(a));
    if (run.edit) return;
    const step = (remember) => {
      if (remember) { assocRemember(P(), a.en); run.got = (run.got || 0) + 1; }
      else play("error");   // пропуск звучит, как «Показать ответ» в карточках
      run.i += 1;
      if (run.i >= run.items.length) run = run.got ? { kind: "done", n: run.got } : null;   // всё пропустил — сразу в меню
      render();
    };
    const ok = make("button", "btn primary wide", "Запомнил"), skip = make("button", "btn wide", "Пропустить");
    ok.addEventListener("click", () => step(true));
    skip.addEventListener("click", () => step(false));
    card.append(ok, skip);
  }

  /** Проверка (по расписанию) и повтор по кругу (loop: расписание не трогаем, слова идут по кругу до «Прекратить повтор»). */
  function renderCheck(card) {
    const loop = run.kind === "loop";
    const a = run.items[run.i], ans = run.answer;
    const title = loop ? `Повтор ${run.i + 1}/${run.items.length}` : `Проверка ${run.i + 1} из ${run.items.length}`;
    card.append(...head(title), make("div", "qlabel", "Вспомните по-английски"), wordHead(a, false));
    const stopBtn = () => {
      const stop = make("button", "btn wide", "Прекратить повтор");
      stop.addEventListener("click", () => { run = null; render(); });
      return stop;
    };
    const advance = () => {
      run.i += 1; run.answer = null; run.hint = false;
      if (run.i >= run.items.length) {
        if (loop) { run.items = shuffle(run.items); run.i = 0; }   // по кругу: новый круг в новом порядке
        else run = null;
      }
      render();
    };
    if (!ans) {
      const hint = make("button", "alink", run.hint ? (a.sound ? `Звучит как «${a.sound}»` : hintMask(a.en, 1)) : a.sound ? "Подсказка: как звучит" : "Подсказка: первые буквы");
      hint.addEventListener("click", () => { run.hint = true; render(); });
      const entry = make("input", "gameentry");
      Object.assign(entry, { type: "text", placeholder: "По-английски", autocomplete: "off", autocapitalize: "off", autocorrect: "off", spellcheck: false, enterKeyHint: "done" });
      entry.setAttribute("aria-label", "Ответ по-английски");
      const go = make("button", "btn primary wide", "Проверить");
      const submit = () => {
        const text = entry.value.trim(), ok = !!text && assocCheck(text, a.en);
        if (!loop) assocAnswer(P(), a.en, ok);
        const xp = ok && !loop ? ctx.gainXp() : "";   // опыт — только в проверке по расписанию (повтор по кругу — без счёта)
        play(ok ? "correct" : "error");
        run.answer = { text, ok, fresh: true, xp };
        render();
      };
      const skip = make("button", "btn wide", "Пропустить");
      skip.addEventListener("click", () => { play("error"); advance(); });   // без ответа: срок проверки не меняется
      go.addEventListener("click", submit);
      entry.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
      card.append(hint, entry, go, skip);
      if (loop) card.append(stopBtn());
      setTimeout(() => entry.focus({ preventScroll: true }), 0);
      return;
    }
    const entry = make("input", "gameentry " + (ans.ok ? "ok" : "bad"));
    entry.value = ans.text; entry.readOnly = true; if (!ans.text) entry.placeholder = "не знаю";
    const fb = make("div", "qfeedback " + (ans.ok ? "ok" : "bad"), ans.ok ? (a.en.includes(" ") ? `Верно! ${a.en}` : "Верно!") : `Правильно: ${a.en}`);
    if (ans.fresh && ans.xp && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) fb.append(make("span", "axpgain", ans.xp));   // «+10 xp» всплывает и тает, как у уровня на карточке
    const fresh = [fb, soundLine(a), assocBlock(a)].filter(Boolean);
    card.append(entry, ...fresh);
    if (run.edit) return;
    const last = !loop && run.i + 1 >= run.items.length;
    const next = make("button", "btn primary wide", last ? "Готово" : "Далее");
    next.addEventListener("click", advance);
    card.append(next);
    fresh.push(next);
    if (loop) { const s = stopBtn(); card.append(s); fresh.push(s); }
    enterAction = advance;
    if (ans.fresh) { ans.fresh = false; popNodes = fresh; }
  }

  /** Все слова «Ассоциаций»: поиск по началу слова, справа — статус; нажатие открывает слово с его ассоциацией. */
  function renderAll(body) {
    const card = make("div", "gamecard acard");
    const h = make("div", "gamehead");
    h.append(make("span", "muted", `Все слова · ${ASSOC.length}`), quitBtn("Назад", () => { run = null; render(); }));
    const search = make("input", "search");
    Object.assign(search, { type: "search", placeholder: "Поиск по слову", autocomplete: "off", value: run.q || "" });
    search.setAttribute("aria-label", "Поиск по словам ассоциаций");
    card.append(h, search);
    const list = make("div", "list alist");
    const now = Math.floor(Date.now() / 1000);
    const fill = (animate) => {
      const q = run.q.trim().toLowerCase();
      const items = q ? ASSOC.filter((a) => ctx.startsWord(a.en, q) || (ctx.phrases().get(a.en)?.ru || []).some((r) => ctx.startsWord(r, q))) : ASSOC;
      list.replaceChildren();
      if (!items.length) list.append(make("p", "muted anone", "Ничего не найдено."));
      for (const a of items) {
        const r = assocRec(P(), a.en);
        const row = make("div", "item");
        const txt = make("div", "txt");
        txt.append(make("div", "en", `${a.emoji} ${a.en}`), make("div", "ru", ru(a.en)));
        row.append(txt, make("div", "side", !r?.s ? "новое" : r.d <= now ? "проверить" : "запомнено"));
        row.addEventListener("click", () => { run = { kind: "view", a, q: run.q, items: [a], i: 0 }; render(); });
        list.append(row);
      }
      animateList(list, { entrance: animate, bottomEl: ctx.bar() });   // при открытии строки выезжают, при поиске — сразу
    };
    search.addEventListener("input", () => { run.q = search.value; fill(false); });
    body.append(card, list);
    fill(true);
  }

  function renderView(card) {
    const a = run.a;
    const h = make("div", "gamehead");
    const back = () => { run = { kind: "list", q: run.q }; render(); };
    h.append(make("span", "muted", "Все слова"), quitBtn("Назад к списку", back));
    card.append(h, wordHead(a, true), ...[soundLine(a)].filter(Boolean), assocBlock(a));
    if (run.edit) return;
    const b = make("button", "btn wide", "К списку");
    b.addEventListener("click", back);
    card.append(b);
  }

  function renderMenu(body) {
    const st = assocStatus(P()), known = learned();
    const card = make("div", "gamecard");
    card.append(make("p", "", "Глаголы B2, фразовые глаголы и пословицы — через созвучие и понятные жизненные сценки. Например, run out of — «молоко убежало»: молока больше нет, оно закончилось."),
      make("div", "gamemeta", `Запомнено: ${st.learned} из ${ASSOC.length} · проверить сейчас: ${st.due.length}`), ctx.batchField());
    const learn = make("button", "btn primary wide", st.fresh.length ? "Запомнить новые" : "Все слова уже изучены");
    learn.disabled = !st.fresh.length;
    learn.addEventListener("click", () => { run = { kind: "learn", items: shuffle(st.fresh).slice(0, ctx.batch()), i: 0 }; render(); });
    const check = make("button", "btn wide", st.due.length ? `Проверь себя (${st.due.length})` : "Проверь себя");
    check.disabled = !st.due.length;
    check.addEventListener("click", () => { run = { kind: "check", items: shuffle(st.due).slice(0, 10), i: 0, answer: null }; render(); });
    const loop = make("button", "btn wide", known.length ? `Повторить запомненное (${known.length})` : "Повторить запомненное");
    loop.disabled = !known.length;
    loop.addEventListener("click", () => { run = { kind: "loop", items: shuffle(learned()), i: 0, answer: null }; render(); });
    const all = make("button", "btn wide", "Все слова");
    all.addEventListener("click", () => { run = { kind: "list", q: "" }; render(); });
    card.append(learn, check, loop, all);
    body.append(card);
  }

  function render() {
    const body = $("assocBody");
    body.replaceChildren();
    enterAction = null; popNodes = null;
    const key = run ? `${run.kind}:${run.kind === "view" ? run.a.en : run.i}:${run.items?.length ?? ""}` : "menu";
    const isNew = key !== shownKey;
    shownKey = key;
    if (!run) { renderMenu(body); if (isNew) ctx.popIn([...body.firstChild.children]); return; }
    if (run.kind === "list") { renderAll(body); if (isNew) ctx.popIn([...body.firstChild.children]); return; }
    const card = make("div", "gamecard acard");
    if (run.kind === "done") {
      card.append(make("h2", "", "Отлично!"), make("p", "", `Запомнено слов: ${run.n}. Проверьте себя прямо сейчас — так ассоциация закрепится.`));
      const check = make("button", "btn primary wide", "Проверь себя");
      check.addEventListener("click", () => { const due = assocStatus(P()).due; run = { kind: "check", items: shuffle(due).slice(0, 10), i: 0, answer: null }; render(); });
      const menu = make("button", "btn wide", "К ассоциациям");
      menu.addEventListener("click", () => { run = null; render(); });
      card.append(check, menu);
    } else if (run.kind === "learn") renderLearn(card);
    else if (run.kind === "view") renderView(card);
    else renderCheck(card);
    body.append(card);
    if (isNew) ctx.popIn([...card.children]);
    else if (popNodes) ctx.popIn(popNodes);
  }

  return { render, reset: () => { run = null; shownKey = ""; } };
}
