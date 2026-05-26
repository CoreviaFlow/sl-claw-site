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
       feed:'В комплекте — навыки продаж и экспертиза этой ниши. Свои товары, цены и данные о компании ты добавляешь сам и дальше обогащаешь.',
       handles:'Снимает возражения', knows:'Что бот знает в нише', demo:'Живой пример диалога',
       market:'Цифры рынка ниши', online:'в сети', getbot:'Получить бота', askconsult:'Спросить у консультанта', blog:'Полезные материалы',
       blogsub:'Статьи по автоматизации продаж в нише — обновляются регулярно.',
       blogsoon:'Первые материалы скоро — публикуем по мере готовности.',
       faqh:'Частые вопросы', buyerh:'Кому будет эффективно?', mistakesh:'Где обычно теряют продажи в нише', integh:'Интеграции в нише',
       trust:['Разовая оплата — без абонентки','Оплата работы ИИ по факту','Условия возврата — в оферте','Разворачивается примерно за час'],
       closerh:'Доводит сделку до денег — и не бросает',
       closerlead:'Это не автоответчик «приняли заявку», а продавец, который доводит до сделки и возвращается сам:',
       closer:['Дожимает сделку: снимает последние возражения и подводит к оплате','Возвращается через время — проверяет статус, переспрашивает по предложению и аккуратно тревожит «дозревающего» клиента, пока тот не купит или не откажет','Помнит клиента и историю переписки — узнаёт по имени, бюджету и прошлым интересам','Счёт, КП, драфт договора, интеграция с CRM или 1С — подключаем индивидуально, как доп. внедрение под ваш бизнес'],
       capsh:'Что ещё умеет AI-продавец',
       caps:['Работает в Telegram, WhatsApp, Instagram и в виджете на сайте — текст и голос','Понимает голосовые и отвечает голосом — распознавание и синтез речи','Сам определяет этап сделки и ведёт по нему — 7 этапов до закрытия','Выявляет потребность клиента по технике SPIN — задаёт правильные вопросы','Отвечает по вашей базе знаний — каталог, прайс, PDF, сайт','Передаёт горячего лида и задачи менеджеру, уведомляет на «горячих» этапах','Пишет лида в CRM (HubSpot, Pipedrive), создаёт задачи и записывает на встречу','Понимает русский, украинский и английский','Сам подбирает «мощность» ИИ под сложность диалога — экономнее на простом'],
       deploy:'развернуть за час', pipe:'диалог → квалификация → снятие возражений → сделка · 24/7 во всех каналах',
       once:'разово', sale:'цена со скидкой', price:'цена',
       crumbHome:'Главная', crumbCat:'Каталог' },
  uk:{ catalog:'Каталог ніш', pricing:'Тарифи', how:'Як це працює', cabinet:'Кабінет ↗',
       seller:'продавець', does:'Що вміє бот у цій ніші',
       fullseller:'Це повноцінний продавець, а не приймальник заявок: веде діалог, кваліфікує та доводить до угоди.',
       feed:'У комплекті — навички продажів та експертиза цієї ніші. Свої товари, ціни та дані про компанію ти додаєш сам і далі збагачуєш.',
       handles:'Знімає заперечення', knows:'Що бот знає в ніші', demo:'Живий приклад діалогу',
       market:'Цифри ринку ніші', online:'у мережі', getbot:'Отримати бота', askconsult:'Запитати у консультанта', blog:'Корисні матеріали',
       blogsub:'Статті з автоматизації продажів у ніші — оновлюються регулярно.',
       blogsoon:'Перші матеріали незабаром — публікуємо в міру готовності.',
       faqh:'Часті запитання', buyerh:'Кому буде ефективно?', mistakesh:'Де зазвичай втрачають продажі в ніші', integh:'Інтеграції в ніші',
       trust:['Разова оплата — без абонплати','Оплата роботи ШІ за фактом','Умови повернення — в оферті','Розгортається приблизно за годину'],
       closerh:'Доводить угоду до грошей — і не кидає',
       closerlead:'Це не автовідповідач «прийняли заявку», а продавець, який доводить до угоди й повертається сам:',
       closer:['Дотискає угоду: знімає останні заперечення й підводить до оплати','Повертається згодом — перевіряє статус, перепитує по пропозиції й акуратно турбує «дозріваючого» клієнта, поки той не купить або не відмовиться','Памʼятає клієнта та історію листування — впізнає за імʼям, бюджетом і минулими інтересами','Рахунок, КП, драфт договору, інтеграція з CRM або 1С — підключаємо індивідуально, як дод. впровадження під ваш бізнес'],
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
function faqItems(f, lang){
  return lang==='uk' ? [
    [`Що вміє AI-продавець для «${f.name}»?`, f.tagline+' Веде діалог, кваліфікує, знімає заперечення та доводить до угоди 24/7.'],
    [`Скільки коштує і як швидко впровадити?`, `Разова покупка готового бота, розгортається приблизно за годину за інструкцією. Оплата роботи ШІ — за фактом.`],
    [`У яких каналах працює бот?`, `Telegram, віджет на сайт, WhatsApp, Instagram — один бот одразу в усіх текстових каналах.`],
  ] : [
    [`Что умеет AI-продавец для «${f.name}»?`, f.tagline+' Ведёт диалог, квалифицирует, снимает возражения и доводит до сделки 24/7.'],
    [`Сколько стоит и как быстро внедрить?`, `Разовая покупка готового бота, разворачивается примерно за час по инструкции. Оплата работы ИИ — по факту.`],
    [`В каких каналах работает бот?`, `Telegram, виджет на сайт, WhatsApp, Instagram — один бот сразу во всех текстовых каналах.`],
  ];
}
// enrich-секции (кому/как настроить/интеграции), упакованные в FAQ-аккордеон.
// Один источник для видимого блока И для FAQPage-schema.
function enrichFaq(f, lang){
  if(!f.enrich) return [];
  const e=f.enrich, uk=lang==='uk', out=[];
  out.push({ q: uk?'Кому буде ефективно?':'Кому будет эффективно?',
    body:`<p>${esc(e.buyer)}</p>`, text:e.buyer });
  if((e.mistakes||[]).length){
    const q = e.mode==='setup'
      ? (uk?`Як налаштувати бота в ніші «${f.name}», щоб продавав`:`Как настроить бота в нише «${f.name}», чтобы продавал`)
      : (uk?`Де зазвичай втрачають продажі в ніші «${f.name}»`:`Где обычно теряют продажи в нише «${f.name}»`);
    out.push({ q, body:`<ul class="does${e.mode==='setup'?' setup':''}">${e.mistakes.map(m=>`<li>${esc(m)}</li>`).join('')}</ul>`, text:e.mistakes.join(' ') });
  }
  if((e.integrations||[]).length){
    out.push({ q: uk?"З якими системами зв'язати бота?":'С какими системами связать бота?',
      body:`<ul class="does">${e.integrations.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`, text:e.integrations.join(' ') });
  }
  return out;
}
function jsonld(n, v, f, u){
  const tier = PRICES[n.tier]||{price:'$249'};
  const price = (PROMO_ON && tier.sale ? tier.sale : tier.price).replace('$','');
  const product = { "@context":"https://schema.org","@type":"Product",
    name:`AI-${UI[v.lang].seller}: ${f.name}`, description:f.tagline,
    image:BASE+'/icon-512.png',
    brand:{"@type":"Brand",name:"SL-CLAW"}, category:secOf(n.sector, v.lang),
    offers:{"@type":"Offer", price:price, priceCurrency:"USD", availability:"https://schema.org/InStock", url:u,
      priceValidUntil:"2026-12-31", seller:{"@type":"Organization",name:"SL-CLAW"}} };
  const crumbs = { "@context":"https://schema.org","@type":"BreadcrumbList", itemListElement:[
    {"@type":"ListItem",position:1,name:UI[v.lang].crumbHome,item:BASE+'/'},
    {"@type":"ListItem",position:2,name:UI[v.lang].crumbCat,item:BASE+'/catalog.html'},
    {"@type":"ListItem",position:3,name:f.name,item:u} ]};
  const faqs = [...enrichFaq(f, v.lang).map(it=>[it.q, it.text]), ...faqItems(f, v.lang)];
  const faq = {"@context":"https://schema.org","@type":"FAQPage", mainEntity: faqs.map(([q,a])=>({"@type":"Question",name:q,acceptedAnswer:{"@type":"Answer",text:a}}))};
  return [product,crumbs,faq].map(x=>`<script type="application/ld+json">${jset(x)}</script>`).join('\n');
}

function page(n, v){
  const t = UI[v.lang], f = F(n, v.lang);
  const u = urlFor(v, n.slug);
  const sel = t.seller;
  const title = `AI-${sel} для «${f.name}» — продаёт в переписке 24/7 ${v.geoTitle} | SL-CLAW`;
  const titleUk = `AI-${sel} для «${f.name}» — продає в листуванні 24/7 ${v.geoTitle} | SL-CLAW`;
  const ttl = v.lang==='uk'? titleUk : title;
  const desc = `${f.tagline} Готовый AI-продавец для ниши «${f.name}» ${v.geoWord}: ведёт диалог, снимает возражения, доводит до сделки. Разверни за час, плати за работу ИИ по факту.`;
  const descUk = `${f.tagline} Готовий AI-продавець для ніші «${f.name}» ${v.geoWord}: веде діалог, знімає заперечення, доводить до угоди. Розгорни за годину.`;
  const description = v.lang==='uk'? descUk : desc;
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
<meta name="keywords" content="${esc(`AI-продавец для ${f.name}, чат-бот для ${f.name}, автоматизация продаж ${f.name}, ${f.name} бот ${v.geoWord}`)}">
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
<link rel="stylesheet" href="/styles.css?v=3">
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
    <p class="mono" style="color:var(--ink-faint);font-size:.82rem;margin-top:14px">${t.pipe}</p>
  </div>
  <div class="np-grid">
    <div class="main">
      <img class="cover" src="cover.svg" width="1200" height="630" alt="AI-${sel} для «${esc(f.name)}» — ${esc(f.tagline)}" loading="lazy">
      <h2>${t.does}</h2>
      <p class="muted" style="margin:-6px 0 14px;font-size:.92rem">${t.fullseller}</p>
      <ul class="does">${f.does.map(d=>`<li>${esc(d)}</li>`).join('')}</ul>
      <div class="promo-note" style="margin:4px 0 2px">${t.feed}</div>

      <div class="closer">
        <h2>${t.closerh}</h2>
        <p class="closer-lead">${t.closerlead}</p>
        <ul>${t.closer.map(c=>`<li>${esc(c)}</li>`).join('')}</ul>
      </div>

      <h2>${t.capsh}</h2>
      <ul class="does caps">${t.caps.map(c=>`<li>${esc(c)}</li>`).join('')}</ul>

      <h2>${t.faqh}</h2>
      <div class="faq">${enrichFaq(f,v.lang).map(it=>`<details class="faq-item"><summary><h3>${esc(it.q)}</h3></summary>${it.body}</details>`).join('')}${faqItems(f,v.lang).map(([q,a])=>`<details class="faq-item"><summary><h3>${esc(q)}</h3></summary><p>${esc(a)}</p></details>`).join('')}</div>

      <h2>${t.blog}</h2>
      <p class="muted" style="margin:-6px 0 12px;font-size:.9rem">${t.blogsub}</p>
      ${blogBlock}
    </div>

    <aside class="side">
      <div class="box box-price">
        <div class="muted mono" style="font-size:.78rem">${onSale?t.sale:t.price}</div>
        ${priceHtml}
        <div class="row2"><span>${v.lang==='uk'?'Галузь':'Отрасль'}</span><span>${esc(secOf(n.sector, v.lang))}</span></div>
        <div class="row2"><span>${v.lang==='uk'?'Можлива ціль':'Возможная цель'}</span><span>${esc(f.cta)}</span></div>
        <a class="btn btn-primary" style="width:100%;justify-content:center;margin-top:16px" href="/checkout.html?niche=${n.slug}&tier=${n.tier}">${t.getbot}</a>
        <button type="button" class="btn-ask" onclick="var b=document.querySelector('.dw-btn');if(b){b.click()}" style="width:100%;justify-content:center;margin-top:8px;background:none;border:0;color:#0b0f19;font:600 .82rem/1.2 inherit;cursor:pointer;padding:8px;text-decoration:underline;text-underline-offset:3px;opacity:.75">${t.askconsult}</button>
        <ul class="trust-list"><li>${t.trust[0]}</li><li>${t.trust[1]}</li><li><a href="/payment-refund.html">${t.trust[2]}</a></li><li>${t.trust[3]}</li></ul>
      </div>
      <div class="box">
        <div class="muted mono" style="font-size:.78rem">${t.deploy}</div>
        <div class="deploy"><span class="d">${v.lang==='uk'?'# доступ до бота — після оплати':'# доступ к боту — после оплаты'}</span>
<span class="c">$</span> cp .env.example .env
<span class="c">$</span> docker compose up -d</div>
      </div>
      <div class="side-demo">
        <h2 style="font-size:1.05rem;margin:0 0 10px">${t.demo}</h2>
        ${phoneHTML({ name:f.name, sel, lang:v.lang, them:f.demo.them, bot:f.demo.bot })}
      </div>
      ${f.objections.length?`<div class="box"><h2 style="font-size:1.05rem;margin:0 0 12px">${t.handles}</h2><div class="chips-row" style="margin:0">${f.objections.map(o=>`<span class="chipx">${esc(o)}</span>`).join('')}</div></div>`:''}
      ${f.knows.length?`<div class="box"><h2 style="font-size:1.05rem;margin:0 0 12px">${t.knows}</h2><div class="chips-row" style="margin:0">${f.knows.map(k=>`<span class="chipx soft">${esc(k)}</span>`).join('')}</div></div>`:''}
    </aside>
  </div>
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
    }));
    const html = page(n,v);
    fs.writeFileSync(path.join(dir,'index.html'), html);
    cnt++;
    sitemap.push(`  <url><loc>${urlFor(v,n.slug)}</loc>\n    <lastmod>${lastmodFor(urlFor(v,n.slug), html)}</lastmod>\n${altBlock}\n  </url>`);
  }
}
// статические корневые страницы
const staticUrls = ['/','/catalog.html','/pricing.html','/oferta.html','/privacy.html','/payment-refund.html','/contacts.html'];
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
