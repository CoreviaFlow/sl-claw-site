#!/usr/bin/env node
/* SEO/GEO build: статические страницы ниш в 3 гео-версиях + sitemap + posts-plan.
   Гео: ru-UA (/n/<slug>/), uk-UA (/ua/<slug>/). Только Украина, два языка. Другие страны — отдельные субдомены.
   Запуск: node seo-build.js   (читает niches.json, пишет статические папки + sitemap.xml + posts-plan.json) */
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'niches.json'), 'utf8'));
const { repace } = require('./schedule-posts.js'); // мягкий разгон расписания
const { phoneHTML } = require('./phone-demo-render.js'); // демо-диалог в телефоне (Telegram-стиль)
const { coverSVG } = require('./cover-svg.js'); // SVG-обложка ниши (картинка в теле + Google Images)
const BASE = 'https://sl-claw.tech';

// Перевод отрасли (sector) на укр — на uk-страницах «Галузь» не должна быть на русском
const SECTOR_UK = {"B2B-дистрибуция":"B2B-дистрибуція","E-commerce":"E-commerce","Event":"Event","HR":"HR","HoReCa":"HoReCa","IT":"IT","IT / консалтинг":"IT / консалтинг","IT/SaaS":"IT/SaaS","Авто":"Авто","Агро":"Агро","Безопасность":"Безпека","Дети":"Діти","Здоровье":"Здоров'я","Зоотовары":"Зоотовари","Интерьер":"Інтер'єр","Консалтинг":"Консалтинг","Косметика":"Косметика","Коучинг":"Коучинг","Красота":"Краса","Логистика":"Логістика","Маркетинг":"Маркетинг","Мебель":"Меблі","Мебель и интерьер":"Меблі та інтер'єр","Медицина":"Медицина","Медоборудование":"Медобладнання","Мода":"Мода","Недвижимость":"Нерухомість","Оборудование":"Обладнання","Образование":"Освіта","Полиграфия":"Поліграфія","Производство":"Виробництво","Промоборудование":"Промобладнання","Спецтехника":"Спецтехніка","Спорт":"Спорт","Строительство":"Будівництво","Стройматериалы":"Будматеріали","Туризм":"Туризм","Услуги":"Послуги","Финансы":"Фінанси","Фитнес":"Фітнес","Электроника":"Електроніка","Энергетика":"Енергетика","Юр. услуги":"Юр. послуги"};
const secOf = (s, lang) => lang === 'uk' ? (SECTOR_UK[s] || s) : s;

// Цены (зеркало window.PROMO в i18n.js): скидка только на Pro
const PRICES = { Lite:{price:'$249'}, Std:{price:'$449'}, Pro:{price:'$999', sale:'$499', off:50} };
const PROMO_ON = Date.now() < new Date('2026-06-10T23:59:59+03:00').getTime();

const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const jset = o => JSON.stringify(o).replace(/</g,'\\u003c');

// 3 гео-варианта
const VARIANTS = [
  { key:'ru',   dir:'n',    lang:'ru', hl:'ru-UA', geoWord:'в Украине',        geoTitle:'в Украине' },
  { key:'uk',   dir:'ua',   lang:'uk', hl:'uk-UA', geoWord:'в Україні',         geoTitle:'в Україні' },
];
const urlFor = (v, slug) => `${BASE}/${v.dir}/${slug}/`;

// Блог-посты живут только в гео ru → /n/, uk → /ua/ (заполняет publish.js).
const DIR = lang => (lang === 'uk' ? 'ua' : 'n');
// posts-plan.json — живые статусы публикаций. На самой первой сборке файла ещё нет.
let PLAN = {};
try { PLAN = (JSON.parse(fs.readFileSync(path.join(ROOT, 'posts-plan.json'), 'utf8')).niches) || {}; } catch (e) {}
// Только РЕАЛЬНО опубликованные посты ниши на этом языке, свежие сверху.
function publishedPosts(slug, lang){
  const np = PLAN[slug]; if(!np) return [];
  return (np.posts || []).filter(p => p.status === 'published' && p.lang === lang && p.slug)
    .sort((a, b) => (b.publishedAt || b.publish).localeCompare(a.publishedAt || a.publish));
}

// поля под язык
function F(n, lang){
  const u = lang==='uk' && n.uk ? n.uk : null;
  const d = lang==='uk' && n.uk && n.uk.depth ? n.uk.depth : (n.depth||{});
  return {
    name: u? u.name : n.name,
    tagline: u? u.tagline : n.tagline,
    cta: u? u.cta : n.cta,
    does: (u? u.does : n.does) || [],
    demo: (u? u.demo : n.demo) || {them:'',bot:''},
    objections: d.objections||[], knows: d.knows||[], market: d.market||[],
    enrich: (u? u.enrich : n.enrich) || null, // уник. контент ниши (анти-thin), может отсутствовать
  };
}

// тексты UI под язык
const UI = {
  ru:{ catalog:'Каталог ниш', pricing:'Тарифы', how:'Как это работает', cabinet:'Кабинет ↗',
       seller:'продавец', does:'Что умеет бот в этой нише',
       fullseller:'Это полноценный продавец, а не приёмщик заявок: ведёт диалог, квалифицирует и доводит до сделки.',
       feed:'Готовые навыки продаж и экспертиза ниши — уже внутри. Вам остаётся загрузить свой каталог, цены и реквизиты компании — и бот сразу в работе.',
       handles:'Снимает возражения', knows:'Что бот знает в нише', demo:'Живой пример диалога',
       market:'Цифры рынка ниши', online:'в сети', getbot:'Получить бота', askconsult:'Спросить у консультанта', blog:'Полезные материалы',
       blogsub:'Статьи по автоматизации продаж в нише — обновляются регулярно.',
       blogsoon:'Первые материалы скоро — публикуем по мере готовности.',
       faqh:'Частые вопросы', buyerh:'Кому будет эффективно?', mistakesh:'Где обычно теряют продажи в нише', integh:'Интеграции в нише',
       trust:['Разовая оплата — без абонентки','Оплата работы ИИ по факту','Условия возврата — в оферте','Разворачивается примерно за час'],
       trustStrip:['Разово · без абонентки','ИИ по факту · от $0.50 за диалог','Готов за час','Гарантия возврата 14 дней'],
       guarBadge:'🛡 Гарантия возврата 14 дней',
       payperuse:'Бот покупаешь разово. ИИ платишь по факту через токен SL-CLAW — в среднем от $0.50 за полный диалог с клиентом. Без абонентки.',
       compareHint:'Также доступны: Core + Study $449 (+ методология SPIN) · Professional $499 ★ (−50% от $999, + экспертиза ниши)',
       compareMore:'Сравнить тарифы →',
       devDetails:'Для разработчика · развернуть за час',
       closerFaq:[
         {q:'А если не подойдёт — можно вернуть?', a:'Да, гарантия возврата 14 дней с момента оплаты. Не подошло — напишите в поддержку, оформим возврат в течение 24 часов. Условия — в оферте.'},
         {q:'А абонентка не вырастет со временем?', a:'Абонентки нет в принципе. Бот — разовая покупка ($249–$499 в зависимости от тарифа). Дальше платите только за работу ИИ через токен — в среднем от $0.50 за полный диалог с клиентом (короткие консультации ещё дешевле). Не общается бот — ничего не списывается.'},
         {q:'А если я не справлюсь с настройкой сам?', a:'Self-service по инструкции подходит большинству — разворачивается примерно за час. Если не хочется морочиться — есть «Под ключ» от $2000: настраиваем под ваш бизнес, делаем интеграции (CRM, 1С), наполняем знаниями, обучаем команду.'}
       ],
       closerh:'Доводит сделку до денег — и не бросает',
       closerlead:'Не автоответчик «приняли заявку», а полноценный продавец: ведёт клиента до оплаты, а если задумался — сам возвращается с напоминанием.',
       closer:['Дожимает: снимает последние возражения и спокойно подводит к оплате','Возвращается к «остывшим» — напоминает без давления, пока клиент не купит или явно не откажет','Помнит клиента и историю переписки — узнаёт по имени, бюджету и прошлым интересам, не начинает с нуля','Счёт, КП, договор, интеграция с CRM или 1С — отдельным внедрением под ваш бизнес'],
       capsh:'Что ещё умеет AI-продавец',
       caps:['Работает в Telegram, WhatsApp, Instagram и в виджете на сайте — текст и голос','Понимает голосовые и отвечает голосом — распознавание и синтез речи','Сам определяет этап сделки и ведёт по нему — 7 этапов до закрытия','Выявляет потребность клиента по технике SPIN — задаёт правильные вопросы','Отвечает по вашей базе знаний — каталог, прайс, PDF, сайт','Передаёт горячего лида и задачи менеджеру, уведомляет на «горячих» этапах','Пишет лида в CRM (HubSpot, Pipedrive), создаёт задачи и записывает на встречу','Понимает русский, украинский и английский','Сам подбирает «мощность» ИИ под сложность диалога — экономнее на простом'],
       deploy:'развернуть за час', pipe:'диалог → квалификация → снятие возражений → сделка · 24/7 во всех каналах',
       once:'разово', sale:'цена со скидкой', price:'цена',
       crumbHome:'Главная', crumbCat:'Каталог' },
  uk:{ catalog:'Каталог ніш', pricing:'Тарифи', how:'Як це працює', cabinet:'Кабінет ↗',
       seller:'продавець', does:'Що вміє бот у цій ніші',
       fullseller:'Це повноцінний продавець, а не приймальник заявок: веде діалог, кваліфікує та доводить до угоди.',
       feed:'Готові навички продажів та експертиза ніші — вже всередині. Вам залишається завантажити свій каталог, ціни й реквізити компанії — і бот одразу в роботі.',
       handles:'Знімає заперечення', knows:'Що бот знає в ніші', demo:'Живий приклад діалогу',
       market:'Цифри ринку ніші', online:'у мережі', getbot:'Отримати бота', askconsult:'Запитати у консультанта', blog:'Корисні матеріали',
       blogsub:'Статті з автоматизації продажів у ніші — оновлюються регулярно.',
       blogsoon:'Перші матеріали незабаром — публікуємо в міру готовності.',
       faqh:'Часті запитання', buyerh:'Кому буде ефективно?', mistakesh:'Де зазвичай втрачають продажі в ніші', integh:'Інтеграції в ніші',
       trust:['Разова оплата — без абонплати','Оплата роботи ШІ за фактом','Умови повернення — в оферті','Розгортається приблизно за годину'],
       trustStrip:['Разово · без абонплати','ШІ за фактом · від $0.50 за діалог','Готовий за годину','Гарантія повернення 14 днів'],
       guarBadge:'🛡 Гарантія повернення 14 днів',
       payperuse:'Бот купуєш разово. ШІ платиш за фактом через токен SL-CLAW — в середньому від $0.50 за повний діалог з клієнтом. Без абонплати.',
       compareHint:'Також доступні: Core + Study $449 (+ методологія SPIN) · Professional $499 ★ (−50% від $999, + експертиза ніші)',
       compareMore:'Порівняти тарифи →',
       devDetails:'Для розробника · розгорнути за годину',
       closerFaq:[
         {q:'А якщо не підійде — чи можу повернути?', a:'Так, гарантія повернення 14 днів з моменту оплати. Не підійшло — напишіть у підтримку, оформимо повернення протягом 24 годин. Умови — в оферті.'},
         {q:'А абонплата не виросте з часом?', a:'Абонплати немає в принципі. Бот — разова покупка ($249–$499 залежно від тарифу). Далі платите лише за роботу ШІ через токен — в середньому від $0.50 за повний діалог з клієнтом (короткі консультації ще дешевше). Не спілкується бот — нічого не списується.'},
         {q:'А якщо я не подужаю налаштувати сам?', a:'Self-service за інструкцією підходить більшості — розгортається приблизно за годину. Якщо не хочеться морочитися — є «Під ключ» від $2000: налаштовуємо під ваш бізнес, робимо інтеграції (CRM, 1С), наповнюємо знаннями, навчаємо команду.'}
       ],
       closerh:'Доводить угоду до грошей — і не кидає',
       closerlead:'Не автовідповідач «прийняли заявку», а повноцінний продавець: веде клієнта до оплати, а якщо задумався — сам повертається з нагадуванням.',
       closer:['Дотискає: знімає останні заперечення й спокійно підводить до оплати','Повертається до «охолоділих» — нагадує без тиску, поки клієнт не купить або явно не відмовиться','Памʼятає клієнта та історію листування — впізнає за імʼям, бюджетом і минулими інтересами, не починає з нуля','Рахунок, КП, договір, інтеграція з CRM або 1С — окремим впровадженням під ваш бізнес'],
       capsh:'Що ще вміє AI-продавець',
       caps:['Працює в Telegram, WhatsApp, Instagram і у віджеті на сайті — текст і голос','Розуміє голосові та відповідає голосом — розпізнавання і синтез мовлення','Сам визначає етап угоди і веде по ньому — 7 етапів до закриття','Виявляє потребу клієнта за технікою SPIN — ставить правильні запитання','Відповідає за вашою базою знань — каталог, прайс, PDF, сайт','Передає гарячого ліда та задачі менеджеру, сповіщає на «гарячих» етапах','Записує ліда в CRM (HubSpot, Pipedrive), створює задачі і записує на зустріч','Розуміє російську, українську та англійську','Сам підбирає «потужність» ШІ під складність діалогу — економніше на простому'],
       deploy:'розгорнути за годину', pipe:'діалог → кваліфікація → зняття заперечень → угода · 24/7 в усіх каналах',
       once:'одноразово', sale:'ціна зі знижкою', price:'ціна',
       crumbHome:'Головна', crumbCat:'Каталог' },
};

const archLabel = (a, lang) => (lang==='uk' ? (D.archetypes_uk||{}) : (D.archetypes||{}))[a] || a;

// ── 50 SEO-постов на нишу (план) ──
function postTitles(name, lang){
  const RU = [
    `Как автоматизировать продажи в нише «${name}» — пошагово`,
    `Чат-бот для «${name}»: сколько стоит и как внедрить`,
    `AI-продавец для «${name}» против живого менеджера: что выгоднее`,
    `Как не терять заявки ночью в нише «${name}»`,
    `Скрипт продаж для бота в «${name}»: SPIN и работа с возражениями`,
    `Как поднять конверсию из чата в нише «${name}»`,
    `ИИ в продажах «${name}»: с чего начать малому бизнесу`,
    `Автоматизация отдела продаж «${name}» без роста штата`,
    `Чат-бот «${name}» в Telegram, WhatsApp и на сайте`,
    `Обработка лидов в «${name}» без менеджера 24/7`,
    `Сколько стоит автоматизация продаж в «${name}»`,
    `Как бот квалифицирует клиента в нише «${name}»`,
    `Топ ошибок при внедрении чат-бота в «${name}»`,
    `Кейс: AI-продавец для «${name}» — рост заявок`,
    `Как настроить бота под товары и цены в «${name}»`,
    `Бот для записи и заявок в нише «${name}»`,
    `Какие возражения снимает AI-продавец в «${name}»`,
    `Развернуть AI-продавца «${name}» за час: инструкция`,
    `Как обучить бота экспертизе ниши «${name}»`,
    `Автоворонка продаж для «${name}»: схема`,
    `ИИ-ассистент для бизнеса «${name}»: возможности`,
    `Бот vs форма заявки в «${name}»: что конвертит лучше`,
    `Как мерить эффективность бота в нише «${name}»`,
    `Интеграция чат-бота «${name}» с CRM`,
    `Голосовой агент для «${name}»: когда нужен апгрейд`,
  ];
  const UK = [
    `Як автоматизувати продажі в ніші «${name}» — покроково`,
    `Чат-бот для «${name}»: скільки коштує і як впровадити`,
    `AI-продавець для «${name}» проти живого менеджера: що вигідніше`,
    `Як не втрачати заявки вночі в ніші «${name}»`,
    `Скрипт продажів для бота в «${name}»: SPIN і робота із запереченнями`,
    `Як підняти конверсію з чату в ніші «${name}»`,
    `ШІ у продажах «${name}»: з чого почати малому бізнесу`,
    `Автоматизація відділу продажів «${name}» без зростання штату`,
    `Чат-бот «${name}» у Telegram, WhatsApp і на сайті`,
    `Обробка лідів у «${name}» без менеджера 24/7`,
    `Скільки коштує автоматизація продажів у «${name}»`,
    `Як бот кваліфікує клієнта в ніші «${name}»`,
    `Топ помилок при впровадженні чат-бота в «${name}»`,
    `Кейс: AI-продавець для «${name}» — зростання заявок`,
    `Як налаштувати бота під товари і ціни в «${name}»`,
    `Бот для запису і заявок у ніші «${name}»`,
    `Які заперечення знімає AI-продавець у «${name}»`,
    `Розгорнути AI-продавця «${name}» за годину: інструкція`,
    `Як навчити бота експертизі ніші «${name}»`,
    `Автоматична воронка продажів для «${name}»: схема`,
    `ШІ-асистент для бізнесу «${name}»: можливості`,
    `Бот vs форма заявки в «${name}»: що конвертує краще`,
    `Як вимірювати ефективність бота в ніші «${name}»`,
    `Інтеграція чат-бота «${name}» з CRM`,
    `Голосовий агент для «${name}»: коли потрібен апгрейд`,
  ];
  return lang==='uk' ? UK : RU;
}

// FAQ-вопросы ниши: единый источник для FAQPage-schema И видимого блока на странице.
// Google требует, чтобы контент FAQ-разметки был виден на странице — поэтому одни и те же данные.
function ensurePeriod(s){ return s && /[.!?]$/.test(s.trim()) ? s : s+'.'; }

// Нишево-уникальный p0-параграф под заголовком «Что умеет бот в этой нише».
// Раньше был жёстко зашит в UI (одинаковый на 83/125 ниш = дубль-контент).
// Теперь собирается из niche-specific does[]+name → уникален per niche автоматически.
function fullsellerFor(f, lang){
  const verbs = (f.does || []).slice(0,3).map(d => d.replace(/[.!?]+$/, '').trim()).filter(Boolean);
  if (verbs.length === 0) {
    return lang==='uk'
      ? `Це повноцінний AI-продавець для «${f.name}» — веде діалог, кваліфікує і доводить до угоди, а не просто фіксує заявки.`
      : `Это полноценный AI-продавец для «${f.name}» — ведёт диалог, квалифицирует и доводит до сделки, а не просто фиксирует заявки.`;
  }
  const lcVerbs = verbs.map(v => v.charAt(0).toLowerCase() + v.slice(1));
  const joined = lcVerbs.length === 1 ? lcVerbs[0]
    : lcVerbs.length === 2 ? `${lcVerbs[0]} и ${lcVerbs[1]}`
    : `${lcVerbs.slice(0,-1).join(', ')} и ${lcVerbs[lcVerbs.length-1]}`;
  const joinedUk = lcVerbs.length === 1 ? lcVerbs[0]
    : lcVerbs.length === 2 ? `${lcVerbs[0]} та ${lcVerbs[1]}`
    : `${lcVerbs.slice(0,-1).join(', ')} та ${lcVerbs[lcVerbs.length-1]}`;
  return lang==='uk'
    ? `AI-продавець для «${f.name}»: ${joinedUk}. Не просто фіксує заявки — веде діалог, кваліфікує, знімає заперечення й доводить до угоди.`
    : `AI-продавец для «${f.name}»: ${joined}. Не просто фиксирует заявки — ведёт диалог, квалифицирует, снимает возражения и доводит до сделки.`;
}
function faqItems(f, lang, n){
  const tier = n?.tier || 'Std';
  const tierName = tier === 'Lite' ? (lang==='uk'?'Лайт':'Лайт') : tier === 'Pro' ? (lang==='uk'?'Про':'Про') : (lang==='uk'?'Стандарт':'Стандарт');
  const firstDoes = (f.does && f.does[0]) ? f.does[0] : '';
  return lang==='uk' ? [
    [`Що вміє AI-продавець для «${f.name}»?`, ensurePeriod(f.tagline)+' Веде діалог, кваліфікує, знімає заперечення та доводить до угоди 24/7.'],
    [`Скільки коштує і як швидко впровадити для ніші «${f.name}»?`, `Готовий шаблон під «${f.name}» — разова покупка (тариф ${tierName}). Розгортається приблизно за годину за інструкцією. Спершу запускаємо ${firstDoes ? firstDoes.toLowerCase() : 'базовий потік'}, далі донастроюємо. Оплата роботи ШІ — за фактом використання.`],
    [`У яких каналах працює бот для «${f.name}»?`, `Telegram, віджет на сайт, WhatsApp, Instagram — один бот одразу в усіх текстових каналах. Голос — окрема опція.`],
  ] : [
    [`Что умеет AI-продавец для «${f.name}»?`, ensurePeriod(f.tagline)+' Ведёт диалог, квалифицирует, снимает возражения и доводит до сделки 24/7.'],
    [`Сколько стоит и как быстро внедрить для ниши «${f.name}»?`, `Готовый шаблон под «${f.name}» — разовая покупка (тариф ${tierName}). Разворачивается примерно за час по инструкции. Сначала запускаем ${firstDoes ? firstDoes.toLowerCase() : 'базовый поток'}, дальше донастраиваем. Оплата работы ИИ — по факту использования.`],
    [`В каких каналах работает бот для «${f.name}»?`, `Telegram, виджет на сайт, WhatsApp, Instagram — один бот сразу во всех текстовых каналах. Голос — отдельная опция.`],
  ];
}
// enrich-секции (кому/как настроить/интеграции), упакованные в FAQ-аккордеон.
// Один источник для видимого блока И для FAQPage-schema.
function enrichFaq(f, lang){
  if(!f.enrich) return [];
  const e=f.enrich, uk=lang==='uk', out=[];
  if((e.mistakes||[]).length){
    const q = e.mode==='setup'
      ? (uk?`Як налаштувати бота в ніші «${f.name}», щоб продавав`:`Как настроить бота в нише «${f.name}», чтобы продавал`)
      : (uk?`Де зазвичай втрачають продажі в ніші «${f.name}»`:`Где обычно теряют продажи в нише «${f.name}»`);
    const lead = uk
      ? `Щоб AI-продавець SL-CLAW у ніші «${f.name}» продавав, а не просто відповідав: `
      : `Чтобы AI-продавец SL-CLAW в нише «${f.name}» продавал, а не просто отвечал: `;
    out.push({ q, body:`<ul class="does${e.mode==='setup'?' setup':''}">${e.mistakes.map(m=>`<li>${esc(m)}</li>`).join('')}</ul>`, text: lead + e.mistakes.join(' ') });
  }
  if((e.integrations||[]).length){
    const lead = uk
      ? `AI-продавець SL-CLAW для ніші «${f.name}» інтегрується з усіма основними системами: `
      : `AI-продавец SL-CLAW для ниши «${f.name}» подключается ко всем основным системам: `;
    out.push({ q: uk?"З якими системами зв'язати бота?":'С какими системами связать бота?',
      body:`<ul class="does">${e.integrations.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`, text: lead + e.integrations.join('. ') + '.' });
  }
  return out;
}
function jsonld(n, v, f, u){
  const tier = PRICES[n.tier]||{price:'$249'};
  const price = (PROMO_ON && tier.sale ? tier.sale : tier.price).replace('$','');
  const today = new Date().toISOString().slice(0,10);
  const t = UI[v.lang];
  const product = { "@context":"https://schema.org","@type":"Product",
    name:`AI-${t.seller}: ${f.name}`, description:f.tagline,
    image:BASE+'/icon-512.png',
    brand:{"@type":"Brand",name:"SL-CLAW"}, category:secOf(n.sector, v.lang),
    offers:{"@type":"Offer", price:price, priceCurrency:"USD", availability:"https://schema.org/InStock", url:u,
      priceValidUntil:"2026-12-31", seller:{"@type":"Organization",name:"SL-CLAW"}},
    dateModified: today };
  // SoftwareApplication — Google AI Overviews предпочитает этот тип для AI-tools.
  // Параллельный schema-блок с тем же price/offer (Google объединяет по URL).
  const software = { "@context":"https://schema.org","@type":"SoftwareApplication",
    name:`AI-${t.seller}: ${f.name}`, description:f.tagline,
    applicationCategory:"BusinessApplication",
    operatingSystem:"Web, Telegram, WhatsApp, Instagram",
    offers:{"@type":"Offer", price:price, priceCurrency:"USD"},
    brand:{"@type":"Brand",name:"SL-CLAW"},
    dateModified: today };
  const crumbs = { "@context":"https://schema.org","@type":"BreadcrumbList", itemListElement:[
    {"@type":"ListItem",position:1,name:t.crumbHome,item:BASE+'/'},
    {"@type":"ListItem",position:2,name:t.crumbCat,item:BASE+'/catalog.html'},
    {"@type":"ListItem",position:3,name:f.name,item:u} ]};
  // closerFaq (refund / no-subscription / setup-help) — это самые trust-критичные FAQ-вопросы.
  // Раньше они были только в DOM (как <details>), теперь добавляем в FAQPage schema → видны
  // и Google Rich Results, и LLM (Claude/GPT/Perplexity) при цитировании.
  const closer = UI[v.lang].closerFaq || [];
  const faqs = [
    ...closer.map(it => [it.q, it.a]),
    ...enrichFaq(f, v.lang).map(it=>[it.q, it.text]),
    ...faqItems(f, v.lang, n)
  ];
  const faq = {"@context":"https://schema.org","@type":"FAQPage", mainEntity: faqs.map(([q,a])=>({"@type":"Question",name:q,acceptedAnswer:{"@type":"Answer",text:a}}))};
  return [product,software,crumbs,faq].map(x=>`<script type="application/ld+json">${jset(x)}</script>`).join('\n');
}

// Динамический closer-lead под нишу — раньше был идентичным на 125 страницах.
// Теперь использует f.cta (целевое действие ниши) → 125 разных вариантов.
function closerLeadFor(f, lang){
  const cta = (f.cta || '').toLowerCase().trim();
  if (!cta) {
    return lang==='uk'
      ? 'Не автовідповідач «прийняли заявку», а повноцінний продавець: веде клієнта до оплати, а якщо задумався — сам повертається з нагадуванням.'
      : 'Не автоответчик «приняли заявку», а полноценный продавец: ведёт клиента до оплаты, а если задумался — сам возвращается с напоминанием.';
  }
  return lang==='uk'
    ? `Не автовідповідач «прийняли заявку». Веде клієнта від першого питання до «${cta}» — а якщо задумався, сам повертається з нагадуванням.`
    : `Не автоответчик «приняли заявку». Ведёт клиента от первого вопроса до «${cta}» — а если задумался, сам возвращается с напоминанием.`;
}

function smartTrim(s, max){
  if (!s || s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return ((sp > max - 20 ? cut.slice(0, sp) : cut).replace(/[—,:;.\s]+$/,'')) + '…';
}

function page(n, v){
  const t = UI[v.lang], f = F(n, v.lang);
  const u = urlFor(v, n.slug);
  const sel = t.seller;
  // Title: target ≤60 chars (SERP truncation). Бренд-суффикс только если влезаем; для длинных ниш — natural smart-trim.
  const titleBase = v.lang==='uk' ? `AI-${sel} для «${f.name}»` : `AI-${sel} для «${f.name}»`;
  const ttl = (titleBase.length <= 50) ? smartTrim(titleBase + ' | SL-CLAW', 62) : smartTrim(titleBase, 62);
  // Description: ≤155 chars (SERP truncation). Начинаем с tagline (это hook); бренд/гео опущены — они в hreflang/og:locale.
  const descBase = v.lang==='uk'
    ? `${ensurePeriod(f.tagline)} Готовий AI-продавець: веде діалог, знімає заперечення, доводить до угоди. Розгортається за годину.`
    : `${ensurePeriod(f.tagline)} Готовый AI-продавец: ведёт диалог, снимает возражения, доводит до сделки. Разворачивается за час.`;
  const description = smartTrim(descBase, 155);
  const tier = PRICES[n.tier]||{price:'$249'};
  const onSale = PROMO_ON && tier.sale;
  const priceHtml = `<div class="np-price"><span class="now">${onSale?tier.sale:tier.price}</span>${onSale?`<span class="old">${tier.price}</span><span class="promo-badge">−${tier.off}%</span>`:''}<div class="small">${t.once}</div></div>`;
  // hreflang альтернативы
  const alts = VARIANTS.map(x=>`<link rel="alternate" hreflang="${x.hl}" href="${urlFor(x,n.slug)}">`).join('\n')
    + `\n<link rel="alternate" hreflang="x-default" href="${urlFor(VARIANTS[0],n.slug)}">`;
  // демо
  const greet = v.lang==='uk'?'Вітаю! Я Анна, AI-продавець. Чим допоможу?':'Здравствуйте! Я Анна, AI-продавец. Чем помогу?';
  const msgs = [['bot',greet],['them',f.demo.them],['bot',f.demo.bot]].filter(m=>m[1]);
  // Блок «Полезные материалы»: только реально опубликованные статьи (ссылками).
  // Если публикаций ещё нет — пустой список с пометкой «скоро». Разметка совместима
  // с regex в publish.js → дрип-публикатор будет наполнять её при выходе постов.
  const pubPosts = publishedPosts(n.slug, v.lang).slice(0, 12);
  const blogBlock = pubPosts.length
    ? `<ul class="blog-list">${pubPosts.map(p=>`<li><a href="/${DIR(v.lang)}/${n.slug}/blog/${p.slug}/">${esc(p.title)}</a></li>`).join('')}</ul>`
      + `<p style="margin-top:8px"><a href="/${DIR(v.lang)}/${n.slug}/blog/" class="mono" style="font-size:.85rem">${v.lang==='uk'?'Усі матеріали →':'Все материалы →'}</a></p>`
    : `<ul class="blog-list"><li class="muted">${t.blogsoon}</li></ul>`;
  const langSwitch = VARIANTS.map(x=>`<a href="${urlFor(x,n.slug)}"${x.key===v.key?' class="on"':''}>${x.hl}</a>`).join('');

  return `<!doctype html>
<html lang="${v.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="google-site-verification" content="513RYJQimjNBKuWqsZH8qfEB5tvn4ET6DFjHIXxSPeg">
<title>${esc(ttl)}</title>
<meta name="description" content="${esc(description)}">
<meta name="keywords" content="${esc(v.lang==='uk'?`AI-продавець для ${f.name}, чат-бот ${f.name}, автоматизація продажів ${f.name} ${v.geoWord}`:`AI-продавец для ${f.name}, чат-бот ${f.name}, автоматизация продаж ${f.name} ${v.geoWord}`)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${u}">
${alts}
<meta property="og:type" content="product">
<meta property="og:locale" content="${v.lang==='uk'?'uk_UA':'ru_UA'}">
<meta property="og:title" content="${esc(ttl)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${u}">
<meta property="og:image" content="${BASE}/og.png">
<meta property="og:site_name" content="SL-CLAW">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?v=2">
<link rel="icon" href="/favicon.ico?v=2" sizes="any">
<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=2">
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2">
<link rel="stylesheet" href="/styles.css?v=4">
<script src="/analytics.js" defer></script>
<script src="/phone-demo.js" defer></script>
<script src="/mobile-bar.js" defer></script>
${jsonld(n, v, f, u)}
</head>
<body>
<header class="nav"><div class="wrap row">
  <a class="logo" href="/">SL<b>_</b>CLAW</a>
  <nav>
    <a href="/catalog.html">${t.catalog}</a>
    <a href="/pricing.html">${t.pricing}</a>
    <a href="/#how">${t.how}</a>
    <a href="https://app.sl-claw.tech" target="_blank" rel="noopener">${t.cabinet}</a>
  </nav>
</div></header>

<section class="wrap"><div class="np-wrap">
  <nav class="crumb" aria-label="breadcrumb"><a href="/">${t.crumbHome}</a> / <a href="/catalog.html">${t.crumbCat}</a> / <span>${esc(f.name)}</span></nav>
  <div class="np-head">
    <span class="tag ${n.archetype}">${esc(archLabel(n.archetype, v.lang))}</span>
    <h1>AI-${sel} для «${esc(f.name)}» — ${v.lang==='uk'?'продає в листуванні':'продаёт в переписке'} 24/7</h1>
    <p class="lead">${esc(f.tagline)}</p>
    <ul class="trust-strip" aria-label="${v.lang==='uk'?'Ключові переваги':'Ключевые преимущества'}">${t.trustStrip.map(b=>`<li>✓ ${esc(b)}</li>`).join('')}</ul>
    <p class="mono" style="color:var(--ink-faint);font-size:.82rem;margin-top:14px">${t.pipe}</p>
  </div>
  <div class="np-grid">
    <div class="main">
      <img class="cover" src="cover.svg" width="1200" height="630" alt="AI-${sel} для «${esc(f.name)}» — ${esc(f.tagline)}" loading="lazy">
      <h2>${t.does}</h2>
      <ul class="does">${f.does.map(d=>`<li>${esc(d)}</li>`).join('')}</ul>
      <div class="promo-note" style="margin:4px 0 2px">${t.feed}</div>

      <div class="closer">
        <h2>${t.closerh}</h2>
        <p class="closer-lead">${esc(closerLeadFor(f, v.lang))}</p>
        <ul>${t.closer.map(c=>`<li>${esc(c)}</li>`).join('')}</ul>
      </div>

      <h2>${t.capsh}</h2>
      <ul class="does caps">${t.caps.map(c=>`<li>${esc(c)}</li>`).join('')}</ul>

      <h2>${t.faqh}</h2>
      <div class="faq">${t.closerFaq.map(it=>`<details class="faq-item faq-closer"><summary><h3>${esc(it.q)}</h3></summary><p>${esc(it.a)}</p></details>`).join('')}${enrichFaq(f,v.lang).map(it=>`<details class="faq-item"><summary><h3>${esc(it.q)}</h3></summary>${it.body}</details>`).join('')}${faqItems(f,v.lang,n).map(([q,a])=>`<details class="faq-item"><summary><h3>${esc(q)}</h3></summary><p>${esc(a)}</p></details>`).join('')}</div>

      <h2>${t.blog}</h2>
      <p class="muted" style="margin:-6px 0 12px;font-size:.9rem">${t.blogsub}</p>
      ${blogBlock}
    </div>

    <aside class="side">
      <div class="box box-price">
        <div class="muted mono" style="font-size:.78rem">${onSale?t.sale:t.price}</div>
        ${priceHtml}
        <div class="ppu-note">${esc(t.payperuse)}</div>
        <div class="guarantee-badge">${esc(t.guarBadge)}</div>
        <div class="row2"><span>${v.lang==='uk'?'Галузь':'Отрасль'}</span><span>${esc(secOf(n.sector, v.lang))}</span></div>
        <div class="row2"><span>${v.lang==='uk'?'Можлива ціль':'Возможная цель'}</span><span>${esc(f.cta)}</span></div>
        <a class="btn btn-primary" style="width:100%;justify-content:center;margin-top:16px" href="/checkout.html?niche=${n.slug}&tier=${n.tier}">${t.getbot}</a>
        <button type="button" class="btn-ask" onclick="var b=document.querySelector('.dw-btn');if(b){b.click()}" style="width:100%;justify-content:center;margin-top:8px;background:none;border:0;color:#0b0f19;font:600 .82rem/1.2 inherit;cursor:pointer;padding:8px;text-decoration:underline;text-underline-offset:3px;opacity:.75">${t.askconsult}</button>
        <div class="compare-hint">${t.compareHint} · <a href="/pricing.html">${t.compareMore}</a></div>
        <ul class="trust-list"><li>${t.trust[0]}</li><li>${t.trust[1]}</li><li><a href="/payment-refund.html">${t.trust[2]}</a></li><li>${t.trust[3]}</li></ul>
      </div>
      <details class="box dev-deploy">
        <summary>${esc(t.devDetails)}</summary>
        <div class="deploy"><span class="d">${v.lang==='uk'?'# доступ до бота — після оплати':'# доступ к боту — после оплаты'}</span>
<span class="c">$</span> cp .env.example .env
<span class="c">$</span> docker compose up -d</div>
      </details>
      <div class="side-demo">
        <h2 style="font-size:1.05rem;margin:0 0 10px">${t.demo}</h2>
        ${phoneHTML({ name:f.name, sel, lang:v.lang, them:f.demo.them, bot:f.demo.bot })}
      </div>
      ${f.objections.length?`<div class="box"><h2 style="font-size:1.05rem;margin:0 0 12px">${t.handles}</h2><div class="chips-row" style="margin:0">${f.objections.map(o=>`<span class="chipx">${esc(o)}</span>`).join('')}</div></div>`:''}
      ${f.knows.length?`<div class="box"><h2 style="font-size:1.05rem;margin:0 0 12px">${t.knows}</h2><div class="chips-row" style="margin:0">${f.knows.map(k=>`<span class="chipx soft">${esc(k)}</span>`).join('')}</div></div>`:''}
    </aside>
  </div>

  <section class="partners-section" aria-labelledby="partners-h">
    <h2 id="partners-h" class="partners-title">${v.lang==='uk'?'Під капотом':'Под капотом'}</h2>
    <div class="partners-grid">
      <a class="partner-card" href="https://www.anthropic.com" target="_blank" rel="noopener noreferrer" aria-label="Anthropic">
        <div class="pc-logo" style="--brand:#191919;--brand-soft:#f5f4f0"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"/></svg></div>
        <b>Anthropic</b>
      </a>
      <a class="partner-card" href="https://openai.com" target="_blank" rel="noopener noreferrer" aria-label="OpenAI">
        <div class="pc-logo" style="--brand:#0a0a0a;--brand-soft:#f4f4f4"><svg viewBox="0 0 41 41" fill="currentColor" aria-hidden="true"><path d="M37.5324 16.8707C37.9808 15.5241 38.1363 14.0974 37.9886 12.6859C37.8409 11.2744 37.3934 9.91076 36.676 8.68622C35.6126 6.83404 33.9882 5.3676 32.0373 4.4985C30.0864 3.62941 27.9098 3.40259 25.8215 3.85078C24.8796 2.7893 23.7219 1.94125 22.4257 1.36341C21.1295 0.785575 19.7249 0.491269 18.3058 0.500197C16.1708 0.495044 14.0893 1.16803 12.3614 2.42214C10.6335 3.67624 9.34853 5.44666 8.6917 7.47815C7.30085 7.76286 5.98686 8.3414 4.8377 9.17505C3.68854 10.0087 2.73073 11.0782 2.02839 12.312C0.956464 14.1591 0.498905 16.2988 0.721698 18.4228C0.944492 20.5467 1.83612 22.5449 3.268 24.1293C2.81966 25.4759 2.66413 26.9026 2.81182 28.3141C2.95951 29.7256 3.40701 31.0892 4.12437 32.3138C5.18791 34.1659 6.8123 35.6322 8.76321 36.5013C10.7141 37.3704 12.8907 37.5973 14.9789 37.1492C15.9208 38.2107 17.0786 39.0587 18.3747 39.6366C19.6709 40.2144 21.0755 40.5087 22.4946 40.4998C24.6307 40.5054 26.7133 39.8321 28.4418 38.5772C30.1704 37.3223 31.4556 35.5506 32.1119 33.5179C33.5027 33.2332 34.8167 32.6547 35.9659 31.821C37.115 30.9874 38.0728 29.9178 38.7752 28.684C39.8458 26.8371 40.3023 24.6979 40.0789 22.5748C39.8556 20.4517 38.9639 18.4544 37.5324 16.8707ZM22.4978 37.8849C20.7443 37.8874 19.0459 37.2733 17.6994 36.1501C17.7601 36.117 17.8666 36.0586 17.936 36.0161L25.9004 31.4156C26.1003 31.3019 26.2663 31.137 26.3813 30.9378C26.4964 30.7386 26.5563 30.5124 26.5549 30.2825V19.0542L29.9213 20.998C29.9389 21.0068 29.9541 21.0198 29.9656 21.0359C29.977 21.052 29.9842 21.0707 29.9867 21.0902V30.3889C29.9842 32.375 29.1946 34.2791 27.7909 35.6841C26.3872 37.0892 24.4838 37.8806 22.4978 37.8849ZM6.39227 31.0064C5.51397 29.4888 5.19742 27.7107 5.49804 25.9832C5.55718 26.0187 5.66048 26.0818 5.73461 26.1244L13.699 30.7248C13.8975 30.8408 14.1233 30.902 14.3532 30.902C14.583 30.902 14.8088 30.8408 15.0073 30.7248L24.731 25.1103V28.9979C24.7321 29.0177 24.7283 29.0376 24.7199 29.0556C24.7115 29.0736 24.6988 29.0893 24.6829 29.1012L16.6317 33.7497C14.9096 34.7416 12.8643 35.0097 10.9447 34.4954C9.02506 33.9811 7.38785 32.7263 6.39227 31.0064ZM4.29707 13.6194C5.17156 12.0998 6.55279 10.9364 8.19885 10.3327C8.19885 10.4013 8.19491 10.5228 8.19491 10.6071V19.808C8.19351 20.0378 8.25334 20.2638 8.36823 20.4629C8.48312 20.6619 8.64893 20.8267 8.84863 20.9404L18.5723 26.5542L15.206 28.4979C15.1894 28.5089 15.1703 28.5155 15.1505 28.5173C15.1307 28.5191 15.1107 28.516 15.0924 28.5082L7.04046 23.8557C5.32135 22.8601 4.06716 21.2235 3.55289 19.3046C3.03862 17.3858 3.30624 15.3413 4.29707 13.6194ZM31.955 20.0556L22.2312 14.4411L25.5976 12.4981C25.6142 12.4872 25.6333 12.4805 25.6531 12.4787C25.6729 12.4769 25.6928 12.4801 25.7111 12.4879L33.7631 17.1364C34.9967 17.849 36.0017 18.8982 36.6606 20.1613C37.3194 21.4244 37.6047 22.849 37.4832 24.2684C37.3617 25.6878 36.8382 27.0432 35.9743 28.1759C35.1103 29.3086 33.9415 30.1717 32.6047 30.6641C32.6047 30.5947 32.6047 30.4733 32.6047 30.3889V21.188C32.6066 20.9586 32.5474 20.7328 32.4332 20.5338C32.319 20.3348 32.154 20.1698 31.955 20.0556ZM35.3055 15.0128C35.2464 14.9765 35.1431 14.9142 35.069 14.8717L27.1045 10.2712C26.906 10.1554 26.6803 10.0943 26.4504 10.0943C26.2206 10.0943 25.9948 10.1554 25.7963 10.2712L16.0726 15.8858V11.9982C16.0715 11.9783 16.0753 11.9585 16.0837 11.9405C16.0921 11.9225 16.1048 11.9068 16.1207 11.8949L24.1719 7.25025C25.4053 6.53903 26.8158 6.19376 28.2383 6.25482C29.6608 6.31589 31.0364 6.78077 32.2044 7.59508C33.3723 8.40939 34.2842 9.53945 34.8334 10.8531C35.3826 12.1667 35.5464 13.6095 35.3055 15.0128ZM14.2424 21.9419L10.8752 19.9981C10.8576 19.9893 10.8423 19.9763 10.8309 19.9602C10.8195 19.9441 10.8122 19.9254 10.8098 19.9058V10.6071C10.8107 9.18295 11.2173 7.78848 11.9819 6.58696C12.7466 5.38544 13.8377 4.42659 15.1275 3.82264C16.4173 3.21869 17.8524 2.99464 19.2649 3.1767C20.6775 3.35876 22.0089 3.93941 23.1034 4.85067C23.0427 4.88379 22.937 4.94215 22.8668 4.98473L14.9024 9.58517C14.7025 9.69878 14.5366 9.86356 14.4215 10.0626C14.3065 10.2616 14.2466 10.4877 14.2479 10.7175L14.2424 21.9419ZM16.071 17.9991L20.4018 15.4978L24.7325 17.9975V22.9985L20.4018 25.4983L16.071 22.9985V17.9991Z"/></svg></div>
        <b>OpenAI</b>
      </a>
      <a class="partner-card" href="https://deepmind.google/technologies/gemini/" target="_blank" rel="noopener noreferrer" aria-label="Google Gemini">
        <div class="pc-logo" style="--brand:#8E75B2;--brand-soft:#f1edf7"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/></svg></div>
        <b>Google Gemini</b>
      </a>
      <a class="partner-card" href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
        <div class="pc-logo" style="--brand:#181717;--brand-soft:#f4f4f5"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg></div>
        <b>GitHub</b>
      </a>
    </div>
  </section>
</div></section>

${footerHTML(v.lang)}
</body>
</html>`;
}

const VISA='<svg class="pay-ic" viewBox="0 0 48 30" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Visa"><rect width="47" height="29" x="0.5" y="0.5" rx="4" fill="#fff" stroke="#e6e8ec"/><text x="24" y="20" text-anchor="middle" font-family="Arial" font-weight="700" font-style="italic" font-size="12" fill="#1A1F71">VISA</text></svg>';
const MC='<svg class="pay-ic" viewBox="0 0 48 30" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mastercard"><rect width="47" height="29" x="0.5" y="0.5" rx="4" fill="#fff" stroke="#e6e8ec"/><circle cx="20" cy="15" r="7.5" fill="#EB001B"/><circle cx="28" cy="15" r="7.5" fill="#F79E1B"/><path d="M24 9.7a7.5 7.5 0 010 10.6 7.5 7.5 0 010-10.6z" fill="#FF5F00"/></svg>';
const LEGAL={entity:'ТОВ «Корвія Флоу»', edrpou:'3420600578', email:'support@sl-claw.tech'};
function footerHTML(lang){
  const uk=lang==='uk';
  const t=uk?{tag:'AI-продавці під нішу',accept:'Приймаємо до оплати',mh:'Маркетплейс',cat:'Каталог ніш',price:'Тарифи',how:'Як це працює',cab:'Кабінет ↗',blog:'Блог',dh:'Документи',oferta:'Публічна оферта',privacy:'Політика конфіденційності',pay:'Оплата, доставка та повернення',contacts:'Контакти та реквізити',ch:'Контакти',edr:'ЄДРПОУ: ',geo:'Послуги недоступні для резидентів рф та рб'}
    :{tag:'AI-продавцы под нишу',accept:'Принимаем к оплате',mh:'Маркетплейс',cat:'Каталог ниш',price:'Тарифы',how:'Как это работает',cab:'Кабинет ↗',blog:'Блог',dh:'Документы',oferta:'Публичная оферта',privacy:'Политика конфиденциальности',pay:'Оплата, доставка и возврат',contacts:'Контакты и реквизиты',ch:'Контакты',edr:'ЕГРПОУ: ',geo:'Услуги недоступны для резидентов рф и рб'};
  return `<footer class="foot-site"><div class="wrap foot-grid">
    <div class="fcol fcol-brand"><span class="logo">SL<b>_</b>CLAW</span><p class="fc-sub mono">${t.tag} · COREVIA FLOW</p><div class="fc-sub mono">${t.accept}:</div><div class="pay-badges">${VISA}${MC}</div></div>
    <div class="fcol"><div class="fc-h">${t.mh}</div><a href="/catalog.html">${t.cat}</a><a href="/pricing.html">${t.price}</a><a href="/#how">${t.how}</a><a href="/blog/">${t.blog}</a><a href="https://app.sl-claw.tech" target="_blank" rel="noopener">${t.cab}</a></div>
    <div class="fcol"><div class="fc-h">${t.dh}</div><a href="/oferta.html">${t.oferta}</a><a href="/privacy.html">${t.privacy}</a><a href="/payment-refund.html">${t.pay}</a><a href="/contacts.html">${t.contacts}</a></div>
    <div class="fcol"><div class="fc-h">${t.ch}</div><a href="mailto:${LEGAL.email}">${LEGAL.email}</a><div class="fc-sub mono">${LEGAL.entity}</div></div>
  </div>
  <div class="wrap foot-bottom mono"><span>© 2026 ${LEGAL.entity}</span><span class="geo-note">${t.geo}</span></div></footer>`;
}

// ── генерация ──
// ── планировщик публикаций: через ~2 дня, хаотично, детерминированно (seed по slug) ──
function fmtDate(d){ return d.toISOString().slice(0,10); }
function rng(seed){ let h=1779033703^seed.length; for(let i=0;i<seed.length;i++){ h=Math.imul(h^seed.charCodeAt(i),3432918353); h=h<<13|h>>>19; }
  return function(){ h=Math.imul(h^h>>>16,2246822507); h=Math.imul(h^h>>>13,3266489909); h^=h>>>16; return (h>>>0)/4294967296; }; }
// Заготовка постов ниши: ru[i] и uk[i] — одна тема (поле theme=i). Даты ставит pairRamp.
function schedule(titlesRu, titlesUk){
  const posts = [];
  titlesRu.forEach((t,i)=>posts.push({ title:t, lang:'ru', theme:i, status:'planned' }));
  titlesUk.forEach((t,i)=>posts.push({ title:t, lang:'uk', theme:i, status:'planned' }));
  return posts;
}
// Раскладывает план ПАРАМИ: ru[i] и uk[i] одной темы → один день, разное время суток
// (ru в одну cron-волну, uk в другую → hreflang ru↔uk работает сразу). Мягкий разгон по парам.
function pairRamp(plan){
  const h32 = s => { let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; };
  const p2 = x => String(x).padStart(2,'0');
  const units = [];
  for(const slug in plan.niches){
    const byTheme = {};
    for(const p of plan.niches[slug].posts){ (byTheme[p.theme] = byTheme[p.theme]||{})[p.lang] = p; }
    for(const idx in byTheme){ const g = byTheme[idx];
      units.push(g.ru&&g.uk ? {slug,idx:+idx,ru:g.ru,uk:g.uk} : {slug,idx:+idx,one:g.ru||g.uk}); }
  }
  units.sort((a,b)=>h32(a.slug+'|'+a.idx) - h32(b.slug+'|'+b.idx));
  let d = new Date('2026-05-26T00:00:00Z'), dayIdx=0, used=0, count=0;
  const cap = i => Math.min(17, 3 + Math.floor(i/2));   // пар/день: 3 → +1 каждые 2 дня → потолок 17
  const setT = (p,date,hh,mm) => { p.publish=date; p.publishAt=date+'T'+p2(hh)+':'+p2(mm)+':00Z'; delete p.theme; };
  for(const u of units){
    if(used>=cap(dayIdx)){ d=new Date(d.getTime()+86400000); dayIdx++; used=0; }
    const date=d.toISOString().slice(0,10), h=h32(u.slug+'|'+u.idx);
    const hourA=7+(h%8), hourB=16+((h>>>3)%7), mA=h%60, mB=(h>>>5)%60;  // ранняя и поздняя волна
    if(u.ru&&u.uk){ if(h&1){ setT(u.ru,date,hourA,mA); setT(u.uk,date,hourB,mB); } else { setT(u.uk,date,hourA,mA); setT(u.ru,date,hourB,mB); } count+=2; }
    else { setT(u.one,date,(h&1)?hourA:hourB,mA); count++; }
    used++;
  }
  return { count, days:dayIdx+1, start:'2026-05-26' };
}

let cnt=0;
const today = new Date().toISOString().slice(0,10);
const sitemap=[];
// lastmod по реальным изменениям: храним хэш контента → дату меняем только при изменении страницы
const crypto = require('crypto');
const LMPATH = path.join(ROOT, 'lastmod-cache.json');
let LM = {}; try { LM = JSON.parse(fs.readFileSync(LMPATH, 'utf8')); } catch(e){}
const LMnext = {};
function lastmodFor(url, html){
  const h = crypto.createHash('sha1').update(html || '').digest('hex');
  const prev = LM[url];
  const d = (prev && prev.h === h) ? prev.d : today;
  LMnext[url] = { h, d };
  return d;
}
const postsPlan={ _meta:{ generated:fmtDate(new Date()), per_niche:50, cadence:'каждую нишу — через день, хаотично (1–3 дня)',
  rules:'Только настоящие цифры с источниками (Statista, Eurostat, Держстат, World Bank, NAR и т.п. — без РФ/Беларуси). Каждый текст уникальный, без плагиата. E-E-A-T.',
  geo:'Украина: RU (/n/) и UK (/ua/). Другие страны — отдельные субдомены.' }, niches:{} };
for(const n of D.niches){
  postsPlan.niches[n.slug] = { niche:n.name, posts: schedule(postTitles(n.name,'ru'), postTitles((n.uk&&n.uk.name)||n.name,'uk'), n.slug) };
  const altBlock = VARIANTS.map(v=>`    <xhtml:link rel="alternate" hreflang="${v.hl}" href="${urlFor(v,n.slug)}"/>`).join('\n')
    + `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor(VARIANTS[0],n.slug)}"/>`;
  for(const v of VARIANTS){
    const dir = path.join(ROOT, v.dir, n.slug);
    fs.mkdirSync(dir, {recursive:true});
    const fc = F(n, v.lang);
    fs.writeFileSync(path.join(dir,'cover.svg'), coverSVG({
      eyebrow: v.lang==='uk' ? '// AI-продавець під нішу' : '// AI-продавец под нишу',
      title: fc.name, sub: fc.tagline,
      archLabel: archLabel(n.archetype, v.lang), archetype: n.archetype,
      lang: v.lang,
    }));
    const html = page(n,v);
    fs.writeFileSync(path.join(dir,'index.html'), html);
    cnt++;
    sitemap.push(`  <url><loc>${urlFor(v,n.slug)}</loc>\n    <lastmod>${lastmodFor(urlFor(v,n.slug), html)}</lastmod>\n${altBlock}\n  </url>`);
  }
}
// статические корневые страницы
// oferta.html и privacy.html намеренно НЕ включены в sitemap — это legal-only
// страницы без SEO-value. Они доступны через footer-ссылки и имеют meta noindex.
const staticUrls = ['/','/catalog.html','/pricing.html','/payment-refund.html','/contacts.html'];
const head = staticUrls.map(p=>{
  const fp = p==='/' ? 'index.html' : p.replace(/^\//,'');
  let c=''; try{ c=fs.readFileSync(path.join(ROOT, fp),'utf8'); }catch(e){}
  return `  <url><loc>${BASE}${p}</loc><lastmod>${lastmodFor(BASE+p, c)}</lastmod><priority>${p==='/'?'1.0':'0.8'}</priority></url>`;
}).join('\n');
fs.writeFileSync(path.join(ROOT,'sitemap.xml'),
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${head}
${sitemap.join('\n')}
</urlset>
`);
fs.writeFileSync(LMPATH, JSON.stringify(LMnext));
// posts-plan.json — НЕ перезаписываем, если уже есть (там живые статусы published + расписание).
// Расписанием управляют schedule-posts.js (разгон) и publish.js (публикация).
const planFile = path.join(ROOT,'posts-plan.json');
if(fs.existsSync(planFile)){
  console.log('posts-plan.json существует — пропускаю (живой план). Для разгона: node schedule-posts.js');
} else {
  const sch = pairRamp(postsPlan);              // пары ru+uk одной темы → один день, разное время
  postsPlan._meta.cadence = 'пары ru+uk одной темы — в один день, разное время; разгон 3→17 пар/день';
  console.log('расписание (пары):', sch.count, 'постов за', sch.days, 'дней, старт', sch.start);
  fs.writeFileSync(planFile, JSON.stringify(postsPlan,null,1));
}
console.log('страниц ниш сгенерировано:', cnt, '(', D.niches.length, 'ниш ×', VARIANTS.length, 'гео )');
console.log('sitemap URL:', staticUrls.length + sitemap.length);
console.log('posts-plan: 50 заголовков/нишу (', Object.keys(postsPlan).length, 'ниш )');
