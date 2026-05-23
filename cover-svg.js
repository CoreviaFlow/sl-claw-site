// Генератор SVG-обложек ниш/постов (1200×630). Используется как картинка в теле страницы
// (браузер рендерит SVG; Google Images индексирует). ~2 КБ, без зависимостей.
// Шрифты — системный fallback (внутри <img> SVG нет доступа к веб-шрифтам страницы).
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ARCH = {
  'product-sell': { bg:'#eff6ff', bd:'#bfdbfe', fg:'#1d4ed8' },
  'b2c-service' : { bg:'#fef2f7', bd:'#fbcfe8', fg:'#be185d' },
  'b2b-services': { bg:'#ecfdf5', bd:'#a7f3d0', fg:'#047857' },
};
function wrap(s, max){ const w=String(s).split(/\s+/); const out=[]; let cur='';
  for(const x of w){ if((cur+' '+x).trim().length>max){ if(cur)out.push(cur); cur=x; } else cur=(cur+' '+x).trim(); } if(cur)out.push(cur); return out; }
const SANS = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

function coverSVG({ eyebrow, title, sub, archLabel, archetype, term }){
  const a = ARCH[archetype] || ARCH['product-sell'];
  const W=1200, H=630, PAD=72;
  const allLines = wrap(title, title.length>34 ? 24 : 18);
  const lines = allLines.slice(0,4);
  if(allLines.length>4) lines[3] = lines[3].replace(/[\s—–-]+$/,'') + '…';
  const fs1 = lines.length>=4 ? 50 : lines.length===3 ? 58 : lines.length===2 ? 70 : 82;
  const lh = fs1*1.1;
  const titleY0 = 290 - (lines.length-1)*lh/2;
  const titleSvg = lines.map((l,i)=>`<text x="${PAD}" y="${titleY0+i*lh}" font-family="${SANS}" font-weight="800" font-size="${fs1}" fill="#0b0d10" letter-spacing="-1.5">${esc(l)}</text>`).join('');
  const subLines = wrap(sub, 52).slice(0,2);
  const subY0 = titleY0 + (lines.length-1)*lh + 54;
  const subSvg = subLines.map((l,i)=>`<text x="${PAD}" y="${subY0+i*34}" font-family="${SANS}" font-weight="400" font-size="25" fill="#5b6470">${esc(l)}</text>`).join('');
  const chip = esc(archLabel||'');
  const chipW = 30 + chip.length*11.5;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<rect x="0" y="0" width="10" height="${H}" fill="#10b981"/>
<rect x="1" y="1" width="${W-2}" height="${H-2}" fill="none" stroke="#e6e8ec" stroke-width="2"/>
<text x="${PAD}" y="98" font-family="${MONO}" font-weight="700" font-size="30" fill="#0b0d10" letter-spacing="-1">SL<tspan fill="#047857">_</tspan>CLAW</text>
<g transform="translate(${W-PAD-chipW},76)">
  <rect rx="999" ry="999" width="${chipW}" height="34" fill="${a.bg}" stroke="${a.bd}"/>
  <text x="${chipW/2}" y="23" text-anchor="middle" font-family="${MONO}" font-size="15" fill="${a.fg}">${chip}</text>
</g>
<text x="${PAD}" y="166" font-family="${MONO}" font-size="20" fill="#8a93a0" letter-spacing="1">${esc(eyebrow)}</text>
${titleSvg}
${subSvg}
<g transform="translate(${PAD},${H-104})">
  <rect rx="12" ry="12" width="430" height="56" fill="#0e1116"/>
  <text x="20" y="36" font-family="${MONO}" font-size="20"><tspan fill="#5be39a">$</tspan><tspan fill="#d7e0ea"> ${esc(term||'docker compose up -d')}</tspan></text>
</g>
<text x="${W-PAD}" y="${H-66}" text-anchor="end" font-family="${MONO}" font-weight="700" font-size="22" fill="#0b0d10">sl-claw.tech</text>
<text x="${W-PAD}" y="${H-40}" text-anchor="end" font-family="${SANS}" font-size="17" fill="#8a93a0">AI-продавец · продаёт в переписке 24/7</text>
</svg>`;
}
module.exports = { coverSVG };
