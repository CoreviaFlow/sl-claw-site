# GEO Rules Update · 2026-05-28

Еженедельный мониторинг официальных GEO / AI-search правил.
Если что-то изменилось — возможно нужно обновить shop/seo-geo-guard.js или shop/llms.txt или shop/robots.txt.

**Checked:** 11 источников · **Changed:** 0 · **First seen:** 6 · **Errors:** 5

## 🆕 FIRST SEEN — Google AI Features в Search
- URL: https://developers.google.com/search/docs/appearance/ai-features
- Почему важно: Основной guide про AI Overviews / SGE — как Google использует AI для search results
- Baseline сохранён: 146eb1a1ab8cd808

## ⚠️ ERROR — Google Search Generative AI Updates
- URL: https://blog.google/products/search/google-search-generative-ai/
- Почему важно: Анонсы изменений в SGE/AIO — частота еженедельная
- Ошибка: HTTP 404

## ⚠️ ERROR — OpenAI GPTBot Documentation
- URL: https://platform.openai.com/docs/gptbot
- Почему важно: User-Agent, IP ranges, robots.txt rules для ChatGPT crawlers
- Ошибка: HTTP 403

## ⚠️ ERROR — OpenAI Bots Overview (GPTBot/OAI-SearchBot/ChatGPT-User)
- URL: https://platform.openai.com/docs/bots
- Почему важно: Три разных OpenAI бота — нужно блокировать/разрешать independently
- Ошибка: HTTP 403

## ⚠️ ERROR — OpenAI Usage Policies
- URL: https://openai.com/policies/usage-policies/
- Почему важно: Что OpenAI разрешает с web content (training vs answer-citation)
- Ошибка: HTTP 403

## 🆕 FIRST SEEN — Anthropic Crawler Policy
- URL: https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
- Почему важно: ClaudeBot, anthropic-ai, Claude-Web — как Claude crawl-ит web
- Baseline сохранён: a0d05f0114cf2726

## 🆕 FIRST SEEN — Perplexity Docs
- URL: https://docs.perplexity.ai/guides/getting-started
- Почему важно: Perplexity citation behavior, PerplexityBot rules
- Baseline сохранён: 995be1217c7db496

## 🆕 FIRST SEEN — Bing Webmaster Blog
- URL: https://blogs.bing.com/webmaster/
- Почему важно: Copilot / Bing AI updates для search
- Baseline сохранён: 8cfb5f18f65ea63f

## 🆕 FIRST SEEN — llms.txt Official Specification
- URL: https://llmstxt.org/
- Почему важно: Если spec меняется — нашему llms.txt нужно обновление
- Baseline сохранён: ae4c659cf8b6c65d

## 🆕 FIRST SEEN — Schema.org SoftwareApplication Type
- URL: https://schema.org/SoftwareApplication
- Почему важно: Тип который Google AIO использует для AI-tools — мы его используем
- Baseline сохранён: f0fb8eee62ed4ed5

## ⚠️ ERROR — Schema.org ChatBot Type
- URL: https://schema.org/ChatBot
- Почему важно: Новый тип для chat-агентов — если появится stable, надо использовать
- Ошибка: HTTP 404
