#!/usr/bin/env node
/* Мягкий разгон расписания публикаций (глобальная дневная квота).
   Сохраняет уже опубликованные посты как есть; переставляет даты ТОЛЬКО у planned.
   Квота/день растёт плавно: 5 → +1 каждые 2 дня → потолок 35.
   Недели 1–3 ≈ 5–10/день, недели 4–8 ≈ 15–25/день, дальше до 35/день.

   Экспортирует repace(plan, opts) для seo-build.js.
   Прямой запуск: node schedule-posts.js  — перепакует ./posts-plan.json на месте. */
const fs = require('fs');
const path = require('path');

const START_PER_DAY = 5;     // постов в первый день
const MAX_PER_DAY = 35;      // потолок
const DAYS_PER_INC = 2;      // +1 пост/день каждые N дней
function quota(d){ return Math.min(MAX_PER_DAY, START_PER_DAY + Math.floor(d / DAYS_PER_INC)); }

// детерминированный «хаос» для постов без даты (свежая сборка)
function hashFloat(s){ let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }

function addDaysUTC(date, n){ const d = new Date(date.getTime()); d.setUTCDate(d.getUTCDate() + n); return d; }
const fmt = d => d.toISOString().slice(0, 10);

/** Глобально переназначает publish-даты для planned-постов. published не трогает. */
function repace(plan, opts = {}){
  const planned = [];
  let lastPub = '';
  for (const slug in plan.niches){
    for (const p of plan.niches[slug].posts){
      if (p.status === 'published'){
        // конец таймлайна определяет ЗАПЛАНИРОВАННЫЙ слот (publish), а не wall-clock publishedAt
        const dt = p.publish || (p.publishedAt ? p.publishedAt.slice(0,10) : '');
        if (dt > lastPub) lastPub = dt;
      } else {
        planned.push({ slug, p });
      }
    }
  }
  // порядок: по текущей дате (сохраняет интерливинг ниш из исходного планировщика),
  // у постов без даты — детерминированный хаос по slug+title
  planned.sort((a, b) => {
    const ka = a.p.publish || hashFloat(a.slug + '|' + a.p.lang + '|' + a.p.title).toFixed(8);
    const kb = b.p.publish || hashFloat(b.slug + '|' + b.p.lang + '|' + b.p.title).toFixed(8);
    return ka < kb ? -1 : ka > kb ? 1 : (a.slug < b.slug ? -1 : 1);
  });

  // старт: следующий день после последней публикации, либо завтра, либо opts.startDate
  let start;
  if (opts.startDate) start = new Date(opts.startDate + 'T00:00:00Z');
  else if (lastPub) start = addDaysUTC(new Date(lastPub + 'T00:00:00Z'), 1);
  else start = addDaysUTC(new Date(new Date().toISOString().slice(0,10) + 'T00:00:00Z'), 1);

  let i = 0, day = 0;
  while (i < planned.length){
    const q = quota(day);
    const ds = fmt(addDaysUTC(start, day));
    for (let k = 0; k < q && i < planned.length; k++, i++) planned[i].p.publish = ds;
    day++;
  }
  return { count: planned.length, days: day, start: fmt(start), lastDayQuota: quota(Math.max(0, day - 1)) };
}

module.exports = { repace, quota };

if (require.main === module){
  const PLAN = path.join(__dirname, 'posts-plan.json');
  const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'));
  const r = repace(plan, {});
  if (plan._meta) plan._meta.cadence = 'мягкий разгон: 5/день → +1 каждые 2 дня → потолок 35/день';
  fs.writeFileSync(PLAN, JSON.stringify(plan, null, 1));
  console.log(`[schedule] перепаковано planned: ${r.count}; дней: ${r.days}; старт ${r.start}; потолок к концу ${r.lastDayQuota}/день`);
}
