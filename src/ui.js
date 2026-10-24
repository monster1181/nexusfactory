/* ===== NexusFactory: interfaz ===== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = (n, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString(LANG === 'es' ? 'es-CO' : 'en-US', { maximumFractionDigits: d });
const fmtR = (n, i) => `${fmt(n)} ${unitOf(i)}`;
const STORE_KEY = 'nexusfactory.v1';

/* ---- Datos de la hoja "Satisfactory – Plan del equipo" (Plan maestro) ---- */
const TEAM_DEFAULT = ['Tharvex', 'Giosepe', 'Jhafretd', 'Danida', 'Aleguies'];
const HUBS = {
  Giosepe: 'Hierro, carbón y caliza', Jhafretd: 'Cobre, caterio y cuarzo', Danida: 'Petróleo, bauxita, nitrógeno y uranio',
  Aleguies: 'SAM y la red de trenes', Tharvex: 'Ensamblaje final y coordinación'
};
const MASTER = [
  ['SpaceElevatorPart_1', 10, 'Tharvex', 'Nivel 2', 'Fase 1 y 2', 1050],
  ['SpaceElevatorPart_2', 20, 'Giosepe', 'Nivel 3', 'Fase 2 y 3', 3500],
  ['SpaceElevatorPart_3', 2.5, 'Jhafretd', 'Nivel 4', 'Fase 2', 100],
  ['SpaceElevatorPart_4', 5, 'Tharvex', 'Nivel 6', 'Fase 3', 500],
  ['SpaceElevatorPart_5', 2, 'Jhafretd', 'Nivel 6', 'Fase 3', 100],
  ['SpaceElevatorPart_7', 4, 'Jhafretd', 'Nivel 7', 'Fase 4', 500],
  ['SpaceElevatorPart_6', 5, 'Giosepe', 'Nivel 8', 'Fase 4', 500],
  ['SpaceElevatorPart_8', 2.5, 'Danida', 'Nivel 8', 'Fase 4', 250],
  ['SpaceElevatorPart_9', 10, 'Danida', 'Nivel 8', 'Fase 4 y 5', 1100],
  ['SpaceElevatorPart_10', 10, 'Aleguies', 'Nivel 9', 'Fase 5', 1000],
  ['SpaceElevatorPart_12', 2.5, 'Aleguies', 'Nivel 9', 'Fase 5', 256],
  ['SpaceElevatorPart_11', 2, 'Tharvex', 'Nivel 9', 'Fase 5', 200]
];
function newPlan(name, extra = {}) {
  return Object.assign({ id: uid(), name, owner: '', level: '', note: '', targets: [], supplies: [], choice: {}, clock: {}, sloop: {}, assign: {},
    globalClock: 100, miner: { ex: 'MinerMk2', purity: 1, clock: 100 }, build: { nodes: [], edges: [] } }, extra);
}
function initState() {
  const plans = MASTER.map(([item, rate, owner, level, phase, total], k) => newPlan(`${k + 1}. ${ITEMS[item][1]}`, {
    owner, level, note: `${phase} · ${fmt(total, 0)} en total · ${fmt(total / rate, 0)} min al ritmo objetivo`, targets: [{ item, rate }], sheet: true
  }));
  plans.push(newPlan('Ascensor completo (las 12 a la vez)', { owner: 'Tharvex', note: 'Todas las megafábricas del Plan maestro juntas', targets: MASTER.map(([item, rate]) => ({ item, rate })), sheet: true }));
  return { v: 1, lang: 'es', team: TEAM_DEFAULT.slice(), unlocked: [], plans, cur: plans[0].id, view: 'diagram', tab: 'plan' };
}
function load() { try { const s = JSON.parse(localStorage.getItem(STORE_KEY)); if (s && s.v === 1 && s.plans?.length) return s; } catch (e) { } return null; }
let S = load() || initState();
let UNLOCK = new Set(S.unlocked);
LANG = S.lang || 'es';
let saveT = 0;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { S.unlocked = [...UNLOCK]; try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { } }, 250); }
const plan = () => S.plans.find(p => p.id === S.cur) || S.plans[0];
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }

/* ---- Íconos de objeto (placa de color con iniciales) ---- */
function hueOf(id) { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
function initials(i) {
  const w = nameOf(i).replace(/[()]/g, '').split(/[\s-]+/).filter(x => x && !/^(de|del|la|el|y|of|the|en)$/i.test(x));
  return ((w[0]?.[0] || '') + (w[1]?.[0] || w[0]?.[1] || '')).toUpperCase();
}
function icon(i, lg) {
  if (!ITEMS[i]) return `<span class="ic${lg ? ' lg' : ''}" style="background:#777">?</span>`;
  const liq = isLiq(i), h = hueOf(i);
  const bg = liq ? `hsl(${200 + h % 40} 60% 42%)` : `hsl(${h} 38% 40%)`;
  return `<span class="ic${liq ? ' liq' : ''}${lg ? ' lg' : ''}" style="background:${bg}" aria-hidden="true">${esc(initials(i))}</span>`;
}

/* ---- Categorías para el selector ---- */
const ELEVATOR = new Set(MASTER.map(m => m[0]));
function catOf(i) {
  if (RES.has(i)) return 'Recursos del mapa';
  if (ELEVATOR.has(i)) return 'Piezas del Ascensor espacial';
  const n = ITEMS[i][0];
  if (/^Packaged/.test(n)) return 'Empaquetados';
  if (isLiq(i)) return 'Fluidos';
  if (/Ingot/.test(n)) return 'Lingotes';
  if (/Nobelisk|Rebar|Ammo/.test(n)) return 'Munición';
  if (/Uranium|Plutonium|Ficsonium|Fuel Rod|Waste|Nuclear/.test(n)) return 'Nuclear';
  if (!PRODUCERS[i]) return 'Recolectables';
  return 'Piezas y componentes';
}
const CAT_ORDER = ['Piezas del Ascensor espacial', 'Piezas y componentes', 'Lingotes', 'Recursos del mapa', 'Fluidos', 'Nuclear', 'Empaquetados', 'Munición', 'Recolectables'];
const PICKABLE = Object.keys(ITEMS).filter(i => PRODUCERS[i] || RES.has(i) || USERS[i]);

/* ---- Modal genérico ---- */
function modal(title, bodyHtml, onMount) {
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h3>${esc(title)}</h3><button class="iconbtn" data-x aria-label="Cerrar">✕</button></header><div class="mb">${bodyHtml}</div></div>`;
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-x]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(ov); onMount && onMount(ov, close);
  return close;
}
function pickItem(cb, opts = {}) {
  modal(opts.title || 'Elegir objeto', `<input class="search" id="pk-q" type="text" placeholder="Busca por nombre, en español o inglés" autocomplete="off"><div class="plist" id="pk-l"></div>`, (ov, close) => {
    const q = $('#pk-q', ov), l = $('#pk-l', ov); let kb = 0;
    const pool = (opts.pool || PICKABLE);
    const draw = () => {
      const t = q.value.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
      const m = pool.filter(i => !t || (ITEMS[i][0] + ' ' + ITEMS[i][1]).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(t));
      const g = {}; m.forEach(i => (g[catOf(i)] ??= []).push(i));
      let h = '', n = 0;
      for (const c of CAT_ORDER) if (g[c]) {
        h += `<div class="grp">${esc(c)}</div>`;
        g[c].sort((a, b) => nameOf(a).localeCompare(nameOf(b))).forEach(i => { h += `<button data-i="${i}" class="${n === kb ? 'kb' : ''}">${icon(i)}<span>${esc(nameOf(i))}</span><span class="hint" style="margin-left:auto">${esc(LANG === 'es' ? ITEMS[i][0] : ITEMS[i][1])}</span></button>`; n++; });
      }
      l.innerHTML = h || `<p class="empty-note">No hay objetos con ese nombre.</p>`;
    };
    q.addEventListener('input', () => { kb = 0; draw(); });
    q.addEventListener('keydown', e => {
      const bs = $$('button[data-i]', l);
      if (e.key === 'ArrowDown') { kb = Math.min(bs.length - 1, kb + 1); draw(); $$('button[data-i]', l)[kb]?.scrollIntoView({ block: 'nearest' }); e.preventDefault(); }
      if (e.key === 'ArrowUp') { kb = Math.max(0, kb - 1); draw(); $$('button[data-i]', l)[kb]?.scrollIntoView({ block: 'nearest' }); e.preventDefault(); }
      if (e.key === 'Enter' && bs[kb]) { cb(bs[kb].dataset.i); close(); }
    });
    l.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) { cb(b.dataset.i); close(); } });
    draw(); setTimeout(() => q.focus(), 30);
  });
}

/* =================== PESTAÑAS =================== */
function setTab(t) {
  S.tab = t; save();
  $$('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  $$('.view').forEach(v => v.hidden = v.id !== 'v-' + t);
  if (t === 'plan') renderPlan();
  if (t === 'build') renderBuild();
  if (t === 'recipes') renderLib();
  if (t === 'alts') renderAlts();
  if (t === 'calc') renderCalc();
}

/* =================== PLANIFICADOR =================== */
let SOL = null, selNode = null;
function renderPlanBar() {
  const p = plan();
  const own = S.plans.filter(x => x.sheet), mine = S.plans.filter(x => !x.sheet);
  const opt = x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`;
  $('#planSel').innerHTML = (own.length ? `<optgroup label="Megafábricas (hoja del equipo)">${own.map(opt).join('')}</optgroup>` : '') + (mine.length ? `<optgroup label="Mis planes">${mine.map(opt).join('')}</optgroup>` : '');
  const meta = [];
  if (p.owner) meta.push(`<span class="badge">${esc(p.owner)}</span>`);
  if (p.level) meta.push(`<span class="badge alt">Desde ${esc(p.level)}</span>`);
  $('#planMeta').innerHTML = meta.join(' ') + (p.note ? ` <span class="hint">${esc(p.note)}</span>` : '');
}
function lineHtml(kind, row, k) {
  const it = row.item;
  return `<div class="line" data-kind="${kind}" data-k="${k}">
    <button class="pick ${it ? '' : 'empty'}" data-act="pick">${it ? icon(it) : '<span class="ic" style="background:var(--line)"></span>'}<span class="nm">${it ? esc(nameOf(it)) : 'Elegir objeto…'}</span></button>
    <div class="ratebox"><input type="number" min="0" step="any" value="${row.rate ?? ''}" data-act="rate" aria-label="Ritmo por minuto"><span>${it && isLiq(it) ? 'm³' : '/min'}</span></div>
    <button class="iconbtn" data-act="del" aria-label="Quitar">✕</button></div>`;
}
function renderInputsPanel() {
  const p = plan();
  $('#targets').innerHTML = p.targets.map((t, k) => lineHtml('targets', t, k)).join('') || `<p class="hint">Añade lo que quieres producir por minuto.</p>`;
  $('#supplies').innerHTML = p.supplies.map((t, k) => lineHtml('supplies', t, k)).join('') || `<p class="hint">Ej.: los lingotes que ya manda el hub de Giosepe. Se restan de lo que hay que fabricar.</p>`;
  $('#gClock').value = p.globalClock;
  $('#owner').innerHTML = `<option value="">Sin responsable</option>` + S.team.map(n => `<option ${n === p.owner ? 'selected' : ''}>${esc(n)}</option>`).join('');
  $('#minerEx').value = p.miner.ex; $('#minerPur').value = String(p.miner.purity); $('#minerClk').value = p.miner.clock;
}
function renderPlan() {
  renderPlanBar(); renderInputsPanel(); recompute();
}
function recompute() {
  const p = plan();
  SOL = solvePlan(p, UNLOCK);
  renderStats(); renderFlows();
  const v = S.view || 'diagram';
  $$('#viewSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
  $('#pane-diagram').hidden = v !== 'diagram'; $('#pane-table').hidden = v !== 'table'; $('#pane-team').hidden = v !== 'team';
  if (v === 'diagram') renderDiagram(); else if (v === 'table') renderTable(); else renderTeam();
  $('#warn').hidden = !(SOL.diverged || !SOL.converged);
  $('#warn').textContent = SOL.diverged ? 'Hay un ciclo de recetas que no se equilibra (una receta consume más de lo que produce de sí misma). Cambia alguna receta del ciclo.' : 'Los cálculos no terminaron de equilibrarse; revisa las recetas con subproductos en ciclo.';
}
function extractorSuggest(item, rate) {
  const p = plan();
  if (item === 'Water') { const ex = EXTRACTORS.WaterPump; const per = ex.rate * p.miner.clock / 100; const n = rate / per; return { n, label: `${fmt(n, 1)} × ${machName('WaterPump')}`, mw: Math.ceil(n - 1e-9) * clockPower(ex.p, p.miner.clock, 1) }; }
  if (item === 'LiquidOil') { const ex = EXTRACTORS.OilPump; const per = ex.rate * p.miner.purity * p.miner.clock / 100; const n = rate / per; return { n, label: `${fmt(n, 1)} × ${machName('OilPump')} (${PURITY.find(x => x.k === p.miner.purity).ne.toLowerCase()})`, mw: Math.ceil(n - 1e-9) * clockPower(ex.p, p.miner.clock, 1) }; }
  if (item === 'NitrogenGas') { const n = rate / 60; return { n, label: `${fmt(n, 1)} satélites normales de pozo`, mw: 0 }; }
  if (SOLID_RES.includes(item)) {
    const ex = EXTRACTORS[p.miner.ex]; const per = ex.rate * p.miner.purity * p.miner.clock / 100; const n = rate / per;
    return { n, label: `${fmt(n, 1)} nodos ${PURITY.find(x => x.k === p.miner.purity).ne.toLowerCase()}s · ${machName(p.miner.ex)} al ${p.miner.clock}%`, mw: Math.ceil(n - 1e-9) * clockPower(ex.p, p.miner.clock, 1) };
  }
  return null;
}
function renderStats() {
  const s = SOL;
  const built = s.rows.reduce((a, r) => a + r.built, 0);
  const mw = s.rows.reduce((a, r) => a + r.power, 0);
  let exMw = 0; s.inputs.forEach(i => { const e = i.kind === 'raw' && extractorSuggest(i.item, i.rate); if (e) exMw += e.mw; });
  const pts = Object.entries(s.T).reduce((a, [i, r]) => a + (isLiq(i) ? 0 : r * (ITEMS[i][3] || 0)), 0);
  const shards = s.rows.reduce((a, r) => a + r.shards, 0), sl = s.rows.reduce((a, r) => a + r.sloops, 0);
  const types = {}; s.rows.forEach(r => types[r.r.m] = (types[r.r.m] || 0) + r.built);
  $('#stats').innerHTML = `
   <div class="stat hl"><span class="lbl">Máquinas a construir</span><span class="v num">${fmt(built, 0)}</span><span class="s">${Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, n]) => `${n} ${machName(m).toLowerCase()}`).join(' · ') || '—'}</span></div>
   <div class="stat"><span class="lbl">Energía de producción</span><span class="v num">${fmt(mw, mw < 100 ? 1 : 0)}<small>MW</small></span><span class="s">+ ${fmt(exMw, 0)} MW de extracción</span></div>
   <div class="stat"><span class="lbl">Recursos distintos</span><span class="v num">${s.inputs.length}</span><span class="s">${fmt(s.inputs.filter(i => !isLiq(i.item)).reduce((a, i) => a + i.rate, 0), 0)} sólidos/min</span></div>
   <div class="stat"><span class="lbl">Puntos AWESOME</span><span class="v num">${fmt(pts, 0)}<small>/min</small></span><span class="s">${shards || sl ? `${shards} fragmentos · ${sl} somersloops` : 'si todo va al triturador'}</span></div>`;
}
function renderFlows() {
  const s = SOL;
  const li = (i, rate, sub, badge) => `<div class="fl">${icon(i)}<span class="nm">${esc(nameOf(i))} ${badge || ''}</span><span class="q">${fmtR(rate, i)}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</div>`;
  $('#inputsList').innerHTML = s.inputs.map(x => {
    let sub = '', badge = '';
    if (x.kind === 'raw') {
      const e = extractorSuggest(x.item, x.rate); const lim = MAP_LIMIT[x.item];
      sub = (e ? esc(e.label) : '') + (lim ? ` · <b>${fmt(x.rate / lim * 100, 1)}%</b> del límite del mapa` : '');
      if (lim && x.rate / lim > 0.6) badge = `<span class="badge warn">escaso</span>`;
    } else if (x.kind === 'import') { sub = 'Viene de otra fábrica o tren'; badge = `<span class="badge alt">importado</span>`; }
    else { sub = 'Se recolecta a mano o de criaturas'; }
    return li(x.item, x.rate, sub, badge);
  }).join('') || `<p class="empty-note">Sin entradas: añade un objetivo.</p>`;
  const out = Object.entries(s.T).map(([i, r]) => li(i, r, '', `<span class="badge">objetivo</span>`));
  const sur = s.surplus.map(x => li(x.item, x.rate, x.fromSupply ? 'Suministro que sobra' : (isLiq(x.item) ? 'Subproducto fluido: úsalo en otra receta (p. ej. combustible) o empaquétalo' : 'Subproducto: llévalo al triturador, a un almacén o úsalo en otra receta'), `<span class="badge warn">sobra</span>`));
  $('#surplusList').innerHTML = out.concat(sur).join('') || `<p class="empty-note">Nada todavía.</p>`;
}

/* ---- Selector de receta por objeto ---- */
function recipeSelect(item, selected, attrs = '') {
  const opts = recipeOptions(item, UNLOCK);
  const lbl = r => {
    const main = r.out[0][0] === item; const pm = r.out.find(o => o[0] === item);
    return `${recName(r)}${r.alt ? ' (alt.)' : ''}${RECOMMENDED[r.id] ? ' ★' : ''} — ${machName(r.m)}, ${fmt(perMin(r, pm[1]))}/min${main ? '' : ' (subproducto)'}`;
  };
  let h = opts.map(r => `<option value="${r.id}" ${r.id === selected ? 'selected' : ''}>${esc(lbl(r))}</option>`).join('');
  if (RES.has(item)) h = `<option value="@raw" ${selected === '@raw' ? 'selected' : ''}>Extraer del mapa</option>` + h;
  h += `<option value="@import" ${selected === '@import' ? 'selected' : ''}>Traer de otra fábrica (no fabricar aquí)</option>`;
  return `<select data-recipe-for="${item}" ${attrs}>${h}</select>`;
}
function setChoice(item, val) {
  const p = plan(); const d = defaultRecipe(item) || '@raw';
  if (val === d) delete p.choice[item]; else p.choice[item] = val;
  save(); recompute();
}

/* ---- Tabla ---- */
function renderTable() {
  const p = plan(), s = SOL;
  const beltChip = (i, rate) => { const b = beltFor(rate, isLiq(i)); const name = isLiq(i) ? `Tub. Mk.${b.tier}` : `Mk.${b.tier}`; return `<span class="belt ${isLiq(i) ? 'liq' : ''} ${b.n > 1 ? 'over' : ''}" title="${isLiq(i) ? 'Tubería' : 'Cinta'} necesaria">${b.n > 1 ? b.n + '× ' : ''}${name}</span>`; };
  const ioHtml = list => list.map(e => `<span>${icon(e.item)}<span class="q">${fmt(e.rate)}</span>${esc(nameOf(e.item))} ${beltChip(e.item, e.rate)}</span>`).join('');
  const rows = s.rows.map(rw => {
    const r = rw.r, slots = MACH[r.m].s;
    const fix = rw.built ? `${rw.built} × ${fmt(rw.balanced, 2)}%` : '';
    const full = Math.floor(rw.machines + 1e-7), part = (rw.machines - full) * rw.clock;
    const alt2 = part > 0.01 && full > 0 ? `o ${full} × ${fmt(rw.clock, 0)}% + 1 × ${fmt(part, 1)}%` : '';
    return `<tr data-row="${rw.id}">
      <td><div class="prod">${icon(rw.item, true)}<div style="display:flex;flex-direction:column;gap:4px;min-width:0"><b>${esc(nameOf(rw.item))}</b>${recipeSelect(rw.item, rw.id)}${r.alt ? `<span><span class="badge alt">alternativa</span>${RECOMMENDED[r.id] ? ` <span class="badge">★ ${esc(RECOMMENDED[r.id])}</span>` : ''}</span>` : ''}</div></div></td>
      <td class="mc"><b class="num">${fmt(rw.machines, 2)}</b><div class="s">${esc(machName(r.m))}</div><div class="s">Construir ${fix}</div>${alt2 ? `<div class="s">${alt2}</div>` : ''}</td>
      <td><div class="cl"><label class="lbl" for="ck-${rw.id}">Reloj %</label><input id="ck-${rw.id}" type="number" min="1" max="250" step="any" value="${p.clock?.[rw.id] ?? ''}" placeholder="${p.globalClock}" data-clock="${rw.id}">
        ${slots ? `<label class="lbl" for="sl-${rw.id}">Somersloop</label><select id="sl-${rw.id}" data-sloop="${rw.id}">${Array.from({ length: slots + 1 }, (_, k) => `<option ${(+p.sloop?.[rw.id] || 0) === k ? 'selected' : ''} value="${k}">${k}/${slots}${k ? ` (×${fmt(1 + k / slots, 2)})` : ''}</option>`).join('')}</select>` : ''}
        ${rw.shards ? `<span class="badge warn">${rw.shards} fragmentos</span>` : ''}</div></td>
      <td><div class="io">${ioHtml(rw.io.in)}</div></td>
      <td><div class="io">${ioHtml(rw.io.out)}</div></td>
      <td class="num">${fmt(rw.power, 1)} MW</td>
      <td><select data-assign="${rw.id}" aria-label="Responsable"><option value="">—</option>${S.team.map(n => `<option ${(p.assign[rw.id] ?? p.owner) === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></td></tr>`;
  });
  const raws = s.inputs.map(x => `<tr class="raw"><td><div class="prod">${icon(x.item, true)}<div style="display:flex;flex-direction:column;gap:4px"><b>${esc(nameOf(x.item))}</b>${PRODUCERS[x.item] ? recipeSelect(x.item, effectiveChoice(p, x.item, UNLOCK)) : '<span class="hint">Recolectable</span>'}</div></div></td>
     <td class="mc" colspan="2"><span class="s">${esc(extractorSuggest(x.item, x.rate)?.label || (x.kind === 'import' ? 'Importado' : '—'))}</span></td><td></td><td><div class="io"><span>${icon(x.item)}<span class="q">${fmt(x.rate)}</span>${esc(nameOf(x.item))} ${beltChip(x.item, x.rate)}</span></div></td><td></td><td></td></tr>`);
  $('#table').innerHTML = `<table class="steps"><thead><tr><th>Producto y receta</th><th>Máquinas</th><th>Ajustes</th><th>Entra /min</th><th>Sale /min</th><th>Energía</th><th>Responsable</th></tr></thead><tbody>${rows.join('')}${raws.join('')}</tbody></table>`;
  if (!s.rows.length) $('#table').innerHTML = `<p class="empty-note" style="padding:14px">Añade un objetivo para ver las máquinas.</p>`;
}

/* ---- Vista por responsable ---- */
function renderTeam() {
  const p = plan(), s = SOL; const g = {};
  s.rows.forEach(rw => { const w = p.assign[rw.id] ?? p.owner ?? ''; (g[w || 'Sin asignar'] ??= []).push(rw); });
  const names = [...S.team.filter(n => g[n]), ...Object.keys(g).filter(n => !S.team.includes(n))];
  $('#team').innerHTML = names.map(n => {
    const list = g[n]; const mw = list.reduce((a, r) => a + r.power, 0), mc = list.reduce((a, r) => a + r.built, 0);
    return `<div class="who"><h4>${esc(n)}<span class="sp">${mc} máq · ${fmt(mw, 0)} MW</span></h4>${HUBS[n] ? `<span class="hint">Hub: ${esc(HUBS[n])}</span>` : ''}
      <ul>${list.map(rw => `<li>${icon(rw.item)}<span>${esc(nameOf(rw.item))}</span><span class="q">${rw.built} × ${esc(machName(rw.r.m))}</span></li>`).join('')}</ul></div>`;
  }).join('') || `<p class="empty-note">Añade un objetivo para repartir el trabajo.</p>`;
}

/* ---- Diagrama de flujo ---- */
const DG = { k: 1, x: 0, y: 0, nodes: [], edges: [] };
function buildGraph(sol) {
  const N = [], E = [];
  const nid = {};
  const add = (id, type, data) => { nid[id] = N.length; N.push(Object.assign({ id, type }, data)); };
  sol.rows.forEach(rw => add('R:' + rw.id, 'recipe', { row: rw, item: rw.item }));
  sol.inputs.forEach(x => add('IN:' + x.item, x.kind === 'import' ? 'imp' : 'raw', { item: x.item, rate: x.rate }));
  Object.entries(sol.SP).forEach(([i, r]) => add('SUP:' + i, 'sup', { item: i, rate: r }));
  Object.entries(sol.T).forEach(([i, r]) => add('OUT:' + i, 'out', { item: i, rate: r }));
  sol.surplus.forEach(x => add('EX:' + x.item, 'ex', { item: x.item, rate: x.rate }));
  const items = new Set([...Object.keys(sol.prod), ...Object.keys(sol.use), ...Object.keys(sol.T), ...Object.keys(sol.SP)]);
  for (const i of items) {
    const src = [], snk = [];
    sol.rows.forEach(rw => { const o = rw.io.out.find(e => e.item === i); if (o && o.rate > 1e-9) src.push(['R:' + rw.id, o.rate]); const u = rw.io.in.find(e => e.item === i); if (u && u.rate > 1e-9) snk.push(['R:' + rw.id, u.rate]); });
    if (sol.SP[i]) src.push(['SUP:' + i, sol.SP[i]]);
    const inp = sol.inputs.find(x => x.item === i); if (inp) src.push(['IN:' + i, inp.rate]);
    if (sol.T[i]) snk.push(['OUT:' + i, sol.T[i]]);
    const ex = sol.surplus.find(x => x.item === i); if (ex) snk.push(['EX:' + i, ex.rate]);
    const tot = src.reduce((a, s) => a + s[1], 0); if (tot <= 1e-9) continue;
    for (const [a, ra] of src) for (const [b, rb] of snk) {
      if (a === b) continue; const f = ra * rb / tot; if (f < 1e-6) continue;
      E.push({ from: a, to: b, item: i, rate: f });
    }
  }
  return { N, E };
}
function layoutGraph(N, E, opt = {}) {
  const W = opt.W || 224, GX = opt.GX || 120, GY = opt.GY || 26;
  const byId = Object.fromEntries(N.map(n => [n.id, n]));
  const out = {}, inc = {}; N.forEach(n => { out[n.id] = []; inc[n.id] = []; });
  E.forEach(e => { if (byId[e.from] && byId[e.to]) { out[e.from].push(e.to); inc[e.to].push(e.from); } });
  // romper ciclos con DFS
  const state = {}, back = new Set();
  const dfs = u => { state[u] = 1; for (const v of out[u]) { if (state[v] === 1) back.add(u + '>' + v); else if (!state[v]) dfs(v); } state[u] = 2; };
  N.filter(n => !inc[n.id].length).forEach(n => !state[n.id] && dfs(n.id)); N.forEach(n => !state[n.id] && dfs(n.id));
  const rank = {}; const order = [];
  const vis = {}; const topo = u => { vis[u] = 1; for (const v of out[u]) if (!back.has(u + '>' + v) && !vis[v]) topo(v); order.push(u); };
  N.forEach(n => !vis[n.id] && topo(n.id)); order.reverse();
  order.forEach(u => { rank[u] = rank[u] || 0; for (const v of out[u]) if (!back.has(u + '>' + v)) rank[v] = Math.max(rank[v] || 0, rank[u] + 1); });
  // empujar entradas a la izquierda justo antes de su primer uso, y salidas al final
  let maxR = 0; N.forEach(n => maxR = Math.max(maxR, rank[n.id]));
  N.forEach(n => { if (n.type === 'out' || n.type === 'ex') rank[n.id] = maxR + (out[n.id].length ? 0 : 0); });
  N.forEach(n => { if (n.type === 'raw' || n.type === 'imp' || n.type === 'sup') { const m = Math.min(...out[n.id].map(v => rank[v]).filter(x => x !== undefined)); rank[n.id] = isFinite(m) ? Math.max(0, m - 1) : 0; } });
  maxR = 0; N.forEach(n => maxR = Math.max(maxR, rank[n.id]));
  N.forEach(n => { if (n.type === 'out' || n.type === 'ex') rank[n.id] = maxR; });
  const cols = []; N.forEach(n => (cols[rank[n.id]] ??= []).push(n));
  const H = n => n.h || (n.type === 'recipe' ? 74 : 54);
  const pos = {};
  // orden inicial y barycentro
  cols.forEach((c, k) => c && c.forEach((n, j) => pos[n.id] = j));
  for (let sweep = 0; sweep < 6; sweep++) {
    const dir = sweep % 2 === 0;
    const seq = dir ? cols.map((c, k) => k) : cols.map((c, k) => k).reverse();
    for (const k of seq) {
      const c = cols[k]; if (!c) continue;
      c.forEach(n => { const nb = dir ? inc[n.id] : out[n.id]; const v = nb.filter(x => pos[x] !== undefined); n._b = v.length ? v.reduce((a, x) => a + pos[x], 0) / v.length : pos[n.id]; });
      c.sort((a, b) => a._b - b._b); c.forEach((n, j) => pos[n.id] = j);
    }
  }
  let maxH = 0;
  cols.forEach(c => { if (c) maxH = Math.max(maxH, c.reduce((a, n) => a + H(n) + GY, 0)); });
  const colX = []; let acc = 0;
  cols.forEach((c, k) => { colX[k] = acc; acc += (c ? Math.max(...c.map(n => n.w || W)) : W) + GX; });
  cols.forEach((c, k) => {
    if (!c) return; const tot = c.reduce((a, n) => a + H(n) + GY, 0) - GY; let y = (maxH - tot) / 2;
    c.forEach(n => { n.x = colX[k]; n.y = y; n.w = n.w || W; n.h = H(n); y += n.h + GY; });
  });
  return { W: acc, H: maxH, back };
}
function renderDiagram() {
  const svg = $('#dsvg');
  const { N, E } = buildGraph(SOL);
  DG.nodes = N; DG.edges = E;
  if (!N.length) { svg.innerHTML = `<text x="50%" y="50%" text-anchor="middle" fill="currentColor" style="font:14px var(--f-body);fill:var(--muted)">Añade un objetivo para ver el flujo de producción.</text>`; $('#detail').hidden = true; return; }
  const L = layoutGraph(N, E);
  const byId = Object.fromEntries(N.map(n => [n.id, n]));
  // puertos por lado
  const outs = {}, ins = {};
  E.forEach(e => { (outs[e.from] ??= []).push(e); (ins[e.to] ??= []).push(e); });
  Object.values(outs).forEach(l => l.sort((a, b) => byId[a.to].y - byId[b.to].y));
  Object.values(ins).forEach(l => l.sort((a, b) => byId[a.from].y - byId[b.from].y));
  const py = (n, list, e) => { const k = list.indexOf(e), m = list.length; return n.y + n.h * (k + 1) / (m + 1); };
  const maxRate = Math.max(...E.map(e => e.rate), 1);
  let eh = '', lh = '';
  E.forEach((e, k) => {
    const a = byId[e.from], b = byId[e.to];
    const x1 = a.x + a.w, y1 = py(a, outs[e.from], e), x2 = b.x, y2 = py(b, ins[e.to], e);
    const sw = 1.4 + 6 * Math.sqrt(e.rate / maxRate);
    let d, lx, ly;
    if (x2 > x1 + 4) { const c = Math.max(40, (x2 - x1) / 2); d = `M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2},${y2}`; lx = (x1 + x2) / 2; ly = (y1 + y2) / 2; }
    else { const dy = Math.max(a.y + a.h, b.y + b.h) + 50; d = `M${x1},${y1} C${x1 + 90},${y1} ${x1 + 90},${dy} ${(x1 + x2) / 2},${dy} S${x2 - 90},${y2} ${x2},${y2}`; lx = (x1 + x2) / 2; ly = dy; }
    const label = `${fmt(e.rate, 1)} ${nameOf(e.item)}`;
    const lw = Math.min(190, label.length * 6.2 + 10);
    eh += `<g class="edge ${isLiq(e.item) ? 'liq' : ''}" data-from="${esc(e.from)}" data-to="${esc(e.to)}"><path d="${d}" stroke-width="${sw.toFixed(1)}"/></g>`;
    lh += `<g class="edge ${isLiq(e.item) ? 'liq' : ''}" data-from="${esc(e.from)}" data-to="${esc(e.to)}"><rect x="${lx - lw / 2}" y="${ly - 9}" width="${lw}" height="17" rx="3"/><text x="${lx}" y="${ly + 4}" text-anchor="middle">${esc(label.length > 30 ? label.slice(0, 29) + '…' : label)}</text></g>`;
  });
  let nh = '';
  const tag = { raw: 'EXTRAER', imp: 'IMPORTAR', sup: 'SUMINISTRO', out: 'OBJETIVO', ex: 'SOBRA' };
  const tagColor = { raw: 'var(--good)', imp: 'var(--warn)', sup: 'var(--liquid)', out: 'var(--accent)', ex: 'var(--muted)' };
  N.forEach(n => {
    const ic = `<foreignObject x="${n.x + 10}" y="${n.y + (n.type === 'recipe' ? 12 : 14)}" width="26" height="26"><div xmlns="http://www.w3.org/1999/xhtml">${icon(n.item)}</div></foreignObject>`;
    let body;
    if (n.type === 'recipe') {
      const rw = n.row; const nm = nameOf(rw.item);
      body = `<text class="t1" x="${n.x + 44}" y="${n.y + 22}">${esc(nm.length > 24 ? nm.slice(0, 23) + '…' : nm)}</text>
        <text class="t2" x="${n.x + 44}" y="${n.y + 39}">${esc(machName(rw.r.m))}${rw.r.alt ? ' · alt.' : ''}</text>
        <text class="t3" x="${n.x + 44}" y="${n.y + 58}">${rw.built} × ${fmt(rw.balanced, 1)}% · ${fmt(rw.power, 0)} MW</text>
        <text class="t3" x="${n.x + n.w - 10}" y="${n.y + 22}" text-anchor="end" style="font-weight:700;fill:var(--ink)">${fmt(rw.machines, 2)}</text>`;
    } else {
      const nm = nameOf(n.item);
      body = `<text class="tag" x="${n.x + 44}" y="${n.y + 19}" style="fill:${tagColor[n.type]}">${tag[n.type]}</text>
        <text class="t1" x="${n.x + 44}" y="${n.y + 36}">${esc(nm.length > 22 ? nm.slice(0, 21) + '…' : nm)}</text>
        <text class="t3" x="${n.x + n.w - 10}" y="${n.y + 19}" text-anchor="end">${fmt(n.rate, 1)} ${unitOf(n.item)}</text>`;
    }
    nh += `<g class="node ${n.type}${selNode === n.id ? ' sel' : ''}" data-id="${esc(n.id)}" tabindex="0"><rect class="b" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="6"/>${ic}${body}</g>`;
  });
  svg.innerHTML = `<g id="dview">${eh}${lh}${nh}</g>`;
  svg.dataset.w = L.W; svg.dataset.h = L.H;
  if (!DG.fitted) { fitDiagram(); DG.fitted = true; } else applyDG();
  renderDetail();
}
function applyDG() { const g = $('#dview'); if (g) g.setAttribute('transform', `translate(${DG.x},${DG.y}) scale(${DG.k})`); }
function fitDiagram() {
  const svg = $('#dsvg'); const box = svg.parentElement; const w = +svg.dataset.w || 1, h = +svg.dataset.h || 1;
  const width = box.getBoundingClientRect().width;
  let k = Math.min(1, Math.max(0.5, (width - 40) / w));
  const maxH = Math.max(380, Math.min(720, window.innerHeight * 0.75));
  let H = Math.min(maxH, Math.max(360, h * k + 90));
  if (h * k + 90 > H) k = Math.max(0.35, (H - 90) / h);
  box.style.height = H + 'px';
  DG.k = k; DG.x = w * k + 40 < width ? (width - w * k) / 2 : 20; DG.y = Math.max(20, (H - h * k) / 2 - 10); applyDG();
}
function panZoom(svg, V, apply, opts = {}) {
  const pts = new Map(); let last = null, pinch = null, moved = false;
  svg.addEventListener('wheel', e => {
    e.preventDefault(); const r = svg.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top;
    const f = Math.exp(-e.deltaY * 0.0015); const k = Math.min(3, Math.max(0.1, V.k * f));
    V.x = mx - (mx - V.x) * k / V.k; V.y = my - (my - V.y) * k / V.k; V.k = k; apply();
  }, { passive: false });
  svg.addEventListener('pointerdown', e => {
    if (opts.skip && opts.skip(e)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); svg.setPointerCapture(e.pointerId); moved = false;
    if (pts.size === 1) last = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY };
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: V.k }; }
    svg.classList.add('drag');
  });
  svg.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const r = svg.getBoundingClientRect(); const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top; const k = Math.min(3, Math.max(0.1, pinch.k * d / pinch.d)); V.x = mx - (mx - V.x) * k / V.k; V.y = my - (my - V.y) * k / V.k; V.k = k; apply(); moved = true; return; }
    if (last) { const dx = e.clientX - last.x, dy = e.clientY - last.y; if (Math.abs(e.clientX - last.sx) + Math.abs(e.clientY - last.sy) > 4) moved = true; V.x += dx; V.y += dy; last.x = e.clientX; last.y = e.clientY; apply(); }
  });
  const end = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) { last = null; svg.classList.remove('drag'); } };
  svg.addEventListener('pointerup', e => { const wasMoved = moved; end(e); if (!wasMoved && opts.click) opts.click(e); });
  svg.addEventListener('pointercancel', end);
}
function renderDetail() {
  const box = $('#detail');
  const n = DG.nodes.find(x => x.id === selNode);
  $$('#dsvg .node').forEach(g => g.classList.toggle('sel', g.dataset.id === selNode));
  $$('#dsvg .edge').forEach(g => { const on = selNode && (g.dataset.from === selNode || g.dataset.to === selNode); g.classList.toggle('hi', !!on); g.classList.toggle('dim', !!selNode && !on); });
  if (!n) { box.hidden = true; return; }
  box.hidden = false;
  const p = plan();
  if (n.type === 'recipe') {
    const rw = n.row, r = rw.r;
    box.innerHTML = `<div class="row">${icon(rw.item, true)}<div class="grow"><b style="font:700 19px var(--f-display);letter-spacing:.03em">${esc(nameOf(rw.item))}</b><div class="hint">${esc(recName(r))} · ${esc(machName(r.m))} · ${fmt(r.t, 2)} s por ciclo</div></div><button class="btn sm" data-goto-table>Ver en la tabla</button></div>
      <div class="row">${recipeSelect(rw.item, rw.id, 'class="grow"')}</div>
      <div class="kv"><div><span class="lbl">Máquinas exactas</span><b>${fmt(rw.machines, 3)}</b></div><div><span class="lbl">Construir</span><b>${rw.built} × ${fmt(rw.balanced, 2)}%</b></div><div><span class="lbl">Energía</span><b>${fmt(rw.power, 1)} MW</b></div>
      ${rw.io.in.map(e => `<div><span class="lbl">Entra · ${esc(nameOf(e.item))}</span><b>${fmtR(e.rate, e.item)}</b></div>`).join('')}${rw.io.out.map(e => `<div><span class="lbl">Sale · ${esc(nameOf(e.item))}</span><b>${fmtR(e.rate, e.item)}</b></div>`).join('')}</div>`;
  } else {
    const ex = n.type === 'raw' ? extractorSuggest(n.item, n.rate) : null;
    box.innerHTML = `<div class="row">${icon(n.item, true)}<div class="grow"><b style="font:700 19px var(--f-display)">${esc(nameOf(n.item))}</b><div class="hint">${fmtR(n.rate, n.item)}${ex ? ' · ' + esc(ex.label) : ''}${MAP_LIMIT[n.item] && n.type === 'raw' ? ` · ${fmt(n.rate / MAP_LIMIT[n.item] * 100, 1)}% del mapa` : ''}</div></div></div>
      ${PRODUCERS[n.item] && (n.type === 'raw' || n.type === 'imp') ? `<div class="row"><span class="hint">Cómo conseguirlo:</span>${recipeSelect(n.item, effectiveChoice(p, n.item, UNLOCK), 'class="grow"')}</div>` : ''}`;
  }
}

/* =================== TALLER (constructor visual) =================== */
const BV = { k: 0.8, x: 40, y: 40 };
let BSEL = null, BSIM = null, BCONN = null;
const PALETTE = [
  ['Extracción', [['extractor:MinerMk2', 'Minero'], ['extractor:WaterPump', 'Extractor de agua'], ['extractor:OilPump', 'Extractor de petróleo'], ['extractor:WellPressurizer', 'Pozo de recursos'], ['source', 'Entrada (tren / otro hub)']]],
  ['Producción', Object.keys(MACH).map(m => ['machine:' + m, machName(m)])],
  ['Logística', [['splitter', 'Divisor'], ['merger', 'Fusionador'], ['storage', 'Almacén'], ['sink', 'Triturador AWESOME']]]
];
const NW = 214;
const LOGW = 96;
function bGeom(n) {
  const p = nodePorts(n); const k = Math.max(p.ins.length, p.outs.length, 1);
  if (n.kind === 'splitter' || n.kind === 'merger') return { w: LOGW, h: 30 + k * 16, top: 28, step: 16 };
  return { w: NW, h: 62 + k * 22, top: 58, step: 22 };
}
function bNodeSize(n) { const g = bGeom(n); return { w: g.w, h: g.h }; }
function bTitle(n) {
  if (n.kind === 'machine') return REC[n.recipe] ? nameOf(REC[n.recipe].out[0][0]) : machName(n.m);
  if (n.kind === 'extractor') return `${machName(n.ex)}`;
  if (n.kind === 'source') return n.label || 'Entrada';
  return { splitter: 'Divisor', merger: 'Fusionador', storage: n.label || 'Almacén', sink: 'Triturador AWESOME' }[n.kind];
}
function bSub(n) {
  if (n.kind === 'machine') return `${n.count > 1 ? n.count + ' × ' : ''}${machName(n.m)} · ${fmt(+n.clock || 100, 1)}%`;
  if (n.kind === 'extractor') { const ex = EXTRACTORS[n.ex]; return `${n.item ? nameOf(n.item) : '—'}${ex.nopurity ? '' : ' · ' + PURITY.find(x => x.k === +n.purity)?.ne}${n.count > 1 ? ' · ×' + n.count : ''}`; }
  if (n.kind === 'source') return n.item ? `${nameOf(n.item)} · ${fmt(+n.rate || 0)} ${unitOf(n.item)}` : 'Elige qué entra';
  return '';
}
function addBNode(spec, at) {
  const p = plan(); const b = p.build;
  const svg = $('#bsvg'); const r = svg.getBoundingClientRect();
  const cx = at ? at.x : (r.width / 2 - BV.x) / BV.k - NW / 2 + (Math.random() * 40 - 20), cy = at ? at.y : (r.height / 2 - BV.y) / BV.k - 50 + (Math.random() * 40 - 20);
  const [kind, sub] = spec.split(':');
  const n = { id: uid(), kind, x: Math.round(cx / 10) * 10, y: Math.round(cy / 10) * 10, clock: 100, count: 1 };
  if (kind === 'machine') { n.m = sub; const first = D.recipes.find(rr => rr.m === sub && !rr.alt && defaultRecipe(rr.out[0][0]) === rr.id) || D.recipes.find(rr => rr.m === sub && !rr.alt); n.recipe = first?.id; n.sloop = 0; }
  if (kind === 'extractor') { n.ex = sub; n.purity = 1; n.item = EXTRACTORS[sub].item || (EXTRACTORS[sub].well ? 'NitrogenGas' : 'OreIron'); }
  if (kind === 'source') { n.item = null; n.rate = 60; }
  b.nodes.push(n); BSEL = { node: n.id }; save(); renderBuild();
  if (kind === 'source') pickItem(i => { n.item = i; save(); renderBuild(); }, { title: '¿Qué entra por aquí?' });
}
function portPos(n, side, k) { const g = bGeom(n); return { x: n.x + (side === 'in' ? 0 : g.w), y: n.y + g.top + k * g.step + 4 }; }
function renderBuild() {
  const p = plan(); const b = p.build;
  $('#bPlanName').textContent = p.name;
  // paleta
  if (!$('#palette').dataset.ok) {
    $('#palette').innerHTML = PALETTE.map(([g, list]) => `<div class="lbl" style="margin-top:6px">${g}</div>${list.map(([k, l]) => `<button class="btn sm" data-add="${k}" style="justify-content:flex-start">＋ ${esc(l)}</button>`).join('')}`).join('');
    $('#palette').dataset.ok = 1;
  }
  BSIM = simulate(b);
  drawBuild();
  renderBInspector(); renderBSummary();
}
function edgeSvg(e, a, c, sim) {
  const p1 = portPos(a, 'out', e.fp), p2 = portPos(c, 'in', e.tp);
  const dx = Math.max(40, Math.abs(p2.x - p1.x) / 2);
  const it = sim.eItem[e.id], f = sim.flow[e.id] || 0, cp = sim.cap[e.id] || 0;
  const sat = cp && f >= cp - 1e-6, idle = f < 1e-6;
  const color = !it ? 'var(--bad)' : sat ? 'var(--bad)' : isLiq(it) ? 'var(--liquid)' : 'var(--muted)';
  const d = `M${p1.x},${p1.y} C${p1.x + dx},${p1.y} ${p2.x - dx},${p2.y} ${p2.x},${p2.y}`;
  const tier = it ? (isLiq(it) ? `Tub. Mk.${Math.min(e.tier || 2, 2)}` : `Mk.${Math.min(e.tier || 3, 6)}`) + (e.lanes > 1 ? ` ×${e.lanes}` : '') : '¿?';
  const lbl = `${fmt(f, 1)}/${fmt(cp, 0)} · ${tier}`;
  const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2; const lw = lbl.length * 6.3 + 10;
  const sel = BSEL?.edge === e.id;
  const short = Math.hypot(p2.x - p1.x, p2.y - p1.y) < lw + 30 && !sel;
  return `<g class="bedge" data-edge="${e.id}"><path d="${d}" fill="none" stroke="transparent" stroke-width="14"/><path d="${d}" fill="none" stroke="${sel ? 'var(--accent)' : color}" stroke-width="${sel ? 4 : 2.6}" ${idle ? 'stroke-dasharray="6 5"' : ''} stroke-opacity="${idle ? .6 : .9}"/>
      ${short ? '' : `<rect x="${mx - lw / 2}" y="${my - 9}" width="${lw}" height="17" rx="3" fill="var(--panel)" stroke="${sat ? 'var(--bad)' : 'var(--line)'}"/><text x="${mx}" y="${my + 4}" text-anchor="middle" style="font:600 10.5px var(--f-mono);fill:${sat ? 'var(--bad)' : 'var(--ink)'}">${esc(lbl)}</text>`}</g>`;
}
function drawBuild() {
  const p = plan(), b = p.build, sim = BSIM;
  const by = Object.fromEntries(b.nodes.map(n => [n.id, n]));
  let eh = '', nh = '';
  for (const e of b.edges) { const a = by[e.from], c = by[e.to]; if (a && c) eh += edgeSvg(e, a, c, sim); }
  for (const n of b.nodes) {
    const g = bGeom(n), st = sim.st[n.id] || {}, ports = nodePorts(n);
    const isSM = n.kind === 'splitter' || n.kind === 'merger';
    const sel = BSEL?.node === n.id;
    if (isSM) {
      const it = sim.eItem[(b.edges.find(e => e.to === n.id || e.from === n.id) || {}).id];
      let h = `<g class="bnode" data-node="${n.id}" transform="translate(${n.x},${n.y})"><rect width="${g.w}" height="${g.h}" rx="5" fill="var(--panel2)" stroke="${sel ? 'var(--accent)' : 'var(--line)'}" stroke-width="${sel ? 2.4 : 1.2}"/>
        <text x="${g.w / 2}" y="17" text-anchor="middle" style="font:700 11px var(--f-mono);letter-spacing:.06em;fill:var(--muted)">${n.kind === 'splitter' ? 'DIVISOR' : 'FUSIONADOR'}</text>
        <text x="${g.w / 2}" y="${g.h - 8}" text-anchor="middle" style="font:600 10.5px var(--f-mono);fill:var(--ink)">${fmt(st.rate || 0, 1)}</text>`;
      ports.ins.forEach(pt => { const yy = g.top + pt.k * g.step + 4; h += `<g class="port" data-port="in" data-k="${pt.k}"><rect x="-5" y="${yy - 5}" width="10" height="10" rx="2" fill="var(--panel)" stroke="${it && isLiq(it) ? 'var(--liquid)' : 'var(--ink)'}" stroke-width="1.4"/></g>`; });
      ports.outs.forEach(pt => { const yy = g.top + pt.k * g.step + 4; h += `<g class="port" data-port="out" data-k="${pt.k}"><rect x="${g.w - 6}" y="${yy - 6}" width="12" height="12" rx="2" fill="var(--accent)" style="cursor:crosshair"/></g>`; });
      nh += h + '</g>'; continue;
    }
    const eff = st.max ? st.rate / st.max : (n.kind === 'storage' || n.kind === 'sink' ? 1 : 0);
    const col = !st.max && n.kind !== 'storage' && n.kind !== 'sink' ? 'var(--muted)' : eff >= 0.995 ? 'var(--good)' : eff > 0.01 ? 'var(--warn)' : 'var(--bad)';
    const isLog = n.kind === 'storage' || n.kind === 'sink';
    const mainItem = n.kind === 'machine' ? REC[n.recipe]?.out[0][0] : n.item;
    let h = `<g class="bnode" data-node="${n.id}" transform="translate(${n.x},${n.y})">
      <rect width="${g.w}" height="${g.h}" rx="6" fill="var(--panel)" stroke="${sel ? 'var(--accent)' : 'var(--line)'}" stroke-width="${sel ? 2.4 : 1.2}"/>
      <rect width="${g.w}" height="5" rx="2" fill="${isLog ? 'var(--muted)' : col}"/>
      ${mainItem ? `<foreignObject x="10" y="13" width="26" height="26"><div xmlns="http://www.w3.org/1999/xhtml">${icon(mainItem)}</div></foreignObject>` : ''}
      <text x="${mainItem ? 42 : 12}" y="28" style="font:700 13px var(--f-body);fill:var(--ink)">${esc(trunc(bTitle(n), 22))}</text>
      <text x="${mainItem ? 42 : 12}" y="44" style="font:11px var(--f-body);fill:var(--muted)">${esc(trunc(bSub(n), 30))}</text>`;
    if (!isLog && st.max !== undefined) h += `<text x="${g.w - 10}" y="28" text-anchor="end" style="font:700 12px var(--f-mono);fill:${col}">${fmt(eff * 100, 0)}%</text>`;
    if (isLog) h += `<text x="${g.w - 10}" y="28" text-anchor="end" style="font:700 12px var(--f-mono);fill:var(--ink)">${fmt(st.rate || 0, 1)}/min</text>`;
    ports.ins.forEach(pt => {
      const yy = g.top + pt.k * g.step + 4; const it = pt.item; const lq = it && isLiq(it);
      h += `<g class="port" data-port="in" data-k="${pt.k}"><${lq ? 'circle cx="0" cy="' + yy + '" r="6"' : 'rect x="-6" y="' + (yy - 6) + '" width="12" height="12" rx="2"'} fill="var(--panel2)" stroke="${lq ? 'var(--liquid)' : 'var(--ink)'}" stroke-width="1.5"/>
        <text x="12" y="${yy + 4}" style="font:11px var(--f-body);fill:var(--muted)">${esc(it ? trunc(nameOf(it), 16) : 'entrada ' + (pt.k + 1))}</text></g>`;
    });
    ports.outs.forEach(pt => {
      const yy = g.top + pt.k * g.step + 4; const it = pt.item; const lq = it && isLiq(it);
      h += `<g class="port" data-port="out" data-k="${pt.k}"><text x="${g.w - 12}" y="${yy + 4}" text-anchor="end" style="font:11px var(--f-body);fill:var(--muted)">${esc(it ? trunc(nameOf(it), 16) : 'salida ' + (pt.k + 1))}</text>
        <${lq ? 'circle cx="' + g.w + '" cy="' + yy + '" r="7"' : 'rect x="' + (g.w - 7) + '" y="' + (yy - 7) + '" width="14" height="14" rx="2"'} fill="var(--accent)" stroke="var(--accent)" style="cursor:crosshair"/></g>`;
    });
    nh += h + '</g>';
  }
  const empty = !b.nodes.length ? `<text x="0" y="0" style="font:14px var(--f-body);fill:var(--muted)"><tspan x="20" dy="20">Taller vacío. Añade máquinas desde la izquierda,</tspan><tspan x="20" dy="20">o pulsa «Generar desde el plan» para armarlo solo.</tspan></text>` : '';
  $('#bsvg').innerHTML = `<g id="bview">${empty}<g id="bedges">${eh}</g>${nh}<path id="bconn" d="" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-dasharray="6 4"/></g>`;
  applyBV();
}
function moveNodeFast(n) { // al arrastrar: mover solo el nodo y sus cintas
  const g = $(`#bsvg .bnode[data-node="${n.id}"]`); if (g) g.setAttribute('transform', `translate(${n.x},${n.y})`);
  const b = plan().build; const by = {}; b.nodes.forEach(x => by[x.id] = x);
  for (const e of b.edges) {
    if (e.from !== n.id && e.to !== n.id) continue;
    const old = $(`#bsvg .bedge[data-edge="${e.id}"]`); if (!old || !by[e.from] || !by[e.to]) continue;
    const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'g'); tmp.innerHTML = edgeSvg(e, by[e.from], by[e.to], BSIM);
    old.replaceWith(tmp.firstElementChild);
  }
}
const trunc = (s, n) => (s || '').length > n ? s.slice(0, n - 1) + '…' : (s || '');
function applyBV() { const g = $('#bview'); if (g) g.setAttribute('transform', `translate(${BV.x},${BV.y}) scale(${BV.k})`); }
function fitBuild() {
  const b = plan().build; const svg = $('#bsvg'); const r = svg.getBoundingClientRect();
  if (!b.nodes.length) { BV.k = 0.9; BV.x = 30; BV.y = 30; applyBV(); return; }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  b.nodes.forEach(n => { const s = bNodeSize(n); x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + s.w); y1 = Math.max(y1, n.y + s.h); });
  const k = Math.min(1.1, Math.max(0.4, Math.min((r.width - 60) / (x1 - x0), (r.height - 60) / (y1 - y0))));
  const cw = (x1 - x0) * k, ch = (y1 - y0) * k;
  BV.k = k; BV.x = (cw < r.width ? (r.width - cw) / 2 : 20) - x0 * k; BV.y = (ch < r.height ? (r.height - ch) / 2 : 20) - y0 * k; applyBV();
}
function toWorld(e) { const r = $('#bsvg').getBoundingClientRect(); return { x: (e.clientX - r.left - BV.x) / BV.k, y: (e.clientY - r.top - BV.y) / BV.k }; }
function itemOfNode(b, n) { // objeto que circula por un divisor/fusionador
  const items = edgeItems(b);
  const e = b.edges.find(x => (x.to === n.id || x.from === n.id) && items[x.id]); return e ? items[e.id] : null;
}
function tryConnect(fromN, fp, toN, tp) {
  const b = plan().build;
  if (fromN.id === toN.id) return;
  const pf = nodePorts(fromN).outs[fp], pt = nodePorts(toN).ins[tp];
  let it = pf.item || itemOfNode(b, fromN);
  const want = pt.item || itemOfNode(b, toN);
  if (it && want && it !== want) { toast(`No encaja: sale ${nameOf(it)} y esa entrada usa ${nameOf(want)}.`); return; }
  it = it || want;
  if (b.edges.some(e => e.from === fromN.id && e.fp === fp && e.to === toN.id && e.tp === tp)) return;
  b.edges.push({ id: uid(), from: fromN.id, fp, to: toN.id, tp, tier: it && isLiq(it) ? 2 : (S.defBelt || 3) });
  save(); renderBuild();
}
function bindBuild() {
  const svg = $('#bsvg');
  let drag = null;
  svg.addEventListener('pointerdown', e => {
    const port = e.target.closest('.port'), node = e.target.closest('.bnode'), edge = e.target.closest('.bedge');
    const b = plan().build;
    if (port && port.dataset.port === 'out') {
      const n = b.nodes.find(x => x.id === node.dataset.node); const k = +port.dataset.k;
      BCONN = { n, k }; svg.setPointerCapture(e.pointerId); e.stopPropagation(); return;
    }
    if (node) {
      const n = b.nodes.find(x => x.id === node.dataset.node); const w = toWorld(e);
      drag = { n, ox: w.x - n.x, oy: w.y - n.y, moved: false }; svg.setPointerCapture(e.pointerId); e.stopPropagation();
      if (BSEL?.node !== n.id) { BSEL = { node: n.id }; renderBInspector(); drawBuild(); }
      return;
    }
    if (edge) { BSEL = { edge: edge.dataset.edge }; drawBuild(); renderBInspector(); e.stopPropagation(); }
  }, true);
  svg.addEventListener('pointermove', e => {
    if (BCONN) {
      const p1 = portPos(BCONN.n, 'out', BCONN.k), w = toWorld(e); const dx = Math.max(40, Math.abs(w.x - p1.x) / 2);
      $('#bconn')?.setAttribute('d', `M${p1.x},${p1.y} C${p1.x + dx},${p1.y} ${w.x - dx},${w.y} ${w.x},${w.y}`); return;
    }
    if (drag) { const w = toWorld(e); drag.n.x = Math.round((w.x - drag.ox) / 10) * 10; drag.n.y = Math.round((w.y - drag.oy) / 10) * 10; drag.moved = true; moveNodeFast(drag.n); }
  });
  svg.addEventListener('pointerup', e => {
    if (BCONN) {
      const el = document.elementFromPoint(e.clientX, e.clientY); const port = el?.closest?.('.port'); const node = el?.closest?.('.bnode');
      if (port && node && port.dataset.port === 'in') { const b = plan().build; const to = b.nodes.find(x => x.id === node.dataset.node); tryConnect(BCONN.n, BCONN.k, to, +port.dataset.k); }
      else if (node && !port) { const b = plan().build; const to = b.nodes.find(x => x.id === node.dataset.node); const ports = nodePorts(to).ins; const it = nodePorts(BCONN.n).outs[BCONN.k].item || itemOfNode(b, BCONN.n);
        const target = ports.find(pt => (pt.item === it || !pt.item) && !b.edges.some(x => x.to === to.id && x.tp === pt.k)) || ports.find(pt => pt.item === it || !pt.item);
        if (target) tryConnect(BCONN.n, BCONN.k, to, target.k); else if (ports.length) toast('Esa máquina no usa ese objeto.'); }
      BCONN = null; $('#bconn')?.setAttribute('d', ''); return;
    }
    if (drag) { if (drag.moved) save(); drag = null; }
  });
  panZoom(svg, BV, applyBV, { skip: e => !!(e.target.closest('.bnode') || e.target.closest('.port') || e.target.closest('.bedge')), click: e => { if (!e.target.closest('.bnode') && !e.target.closest('.bedge') && BSEL) { BSEL = null; drawBuild(); renderBInspector(); } } });
  document.addEventListener('keydown', e => {
    if (S.tab !== 'build' || !BSEL) return; if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { deleteBSel(); e.preventDefault(); }
  });
}
function deleteBSel() {
  const b = plan().build;
  if (BSEL?.node) { b.nodes = b.nodes.filter(n => n.id !== BSEL.node); b.edges = b.edges.filter(e => e.from !== BSEL.node && e.to !== BSEL.node); }
  if (BSEL?.edge) b.edges = b.edges.filter(e => e.id !== BSEL.edge);
  BSEL = null; save(); renderBuild();
}
function pruneEdges(n) { // quita cintas que ya no encajan tras cambiar receta
  const b = plan().build; const P = nodePorts(n);
  b.edges = b.edges.filter(e => {
    if (e.from === n.id) return e.fp < P.outs.length && (!P.outs[e.fp].item || !edgeItems(b)[e.id] || true) ;
    if (e.to === n.id) return e.tp < P.ins.length;
    return true;
  });
  const items = edgeItems(b);
  b.edges = b.edges.filter(e => {
    const a = b.nodes.find(x => x.id === e.from), c = b.nodes.find(x => x.id === e.to); if (!a || !c) return false;
    const ia = nodePorts(a).outs[e.fp]?.item, ic = nodePorts(c).ins[e.tp]?.item;
    return !(ia && ic && ia !== ic);
  });
}
function renderBInspector() {
  const box = $('#binsp'); const b = plan().build;
  if (!BSEL) { box.innerHTML = `<p class="hint">Toca una máquina o una cinta para ajustarla. Arrastra desde un puerto naranja (salida) hasta una entrada para conectar. Rueda o pellizco para acercar.</p>`; return; }
  if (BSEL.edge) {
    const e = b.edges.find(x => x.id === BSEL.edge); if (!e) { BSEL = null; return renderBInspector(); }
    const it = BSIM.eItem[e.id]; const liq = it && isLiq(it); const tiers = liq ? PIPES : BELTS;
    box.innerHTML = `<div class="row">${it ? icon(it) : ''}<b>${it ? esc(nameOf(it)) : 'Cinta sin objeto'}</b></div>
      <div class="form"><label for="bt-tier">${liq ? 'Tubería' : 'Cinta'}</label><select id="bt-tier">${tiers.map((c, k) => `<option value="${k + 1}" ${(e.tier || (liq ? 2 : 3)) === k + 1 ? 'selected' : ''}>Mk.${k + 1} · ${c} ${liq ? 'm³' : ''}/min</option>`).join('')}</select>
      <label for="bt-lanes">Líneas en paralelo</label><input id="bt-lanes" type="number" min="1" max="20" value="${e.lanes || 1}"></div>
      <p class="hint">Lleva ${fmt(BSIM.flow[e.id] || 0, 2)} de ${fmt(BSIM.cap[e.id] || 0, 0)} ${it ? unitOf(it) : '/min'}.</p>
      <button class="btn danger sm" data-bdel>Quitar ${liq ? 'tubería' : 'cinta'}</button>`;
    return;
  }
  const n = b.nodes.find(x => x.id === BSEL.node); if (!n) { BSEL = null; return renderBInspector(); }
  const st = BSIM.st[n.id] || {};
  let h = `<div class="row"><b style="font:700 18px var(--f-display);letter-spacing:.03em">${esc(bTitle(n))}</b></div>`;
  if (n.kind === 'machine') {
    const recs = D.recipes.filter(r => r.m === n.m && (!r.alt || UNLOCK.has(r.id)));
    const r = REC[n.recipe]; const slots = MACH[n.m].s;
    h += `<div class="form"><label for="bm-m">Máquina</label><select id="bm-m">${Object.keys(MACH).map(m => `<option value="${m}" ${m === n.m ? 'selected' : ''}>${esc(machName(m))}</option>`).join('')}</select>
      <label for="bm-r">Receta</label><select id="bm-r">${recs.sort((a, c) => recName(a).localeCompare(recName(c))).map(x => `<option value="${x.id}" ${x.id === n.recipe ? 'selected' : ''}>${esc(recName(x))}${x.alt ? ' (alt.)' : ''}</option>`).join('')}</select>
      <label for="bm-c">Cantidad</label><input id="bm-c" type="number" min="1" max="500" value="${n.count || 1}">
      <label for="bm-k">Reloj %</label><input id="bm-k" type="number" min="1" max="250" step="any" value="${n.clock || 100}">
      ${slots ? `<label for="bm-s">Somersloop</label><select id="bm-s">${Array.from({ length: slots + 1 }, (_, k) => `<option value="${k}" ${(+n.sloop || 0) === k ? 'selected' : ''}>${k}/${slots}</option>`).join('')}</select>` : ''}</div>`;
    if (r) {
      const util = st.max ? st.rate / st.max : 0; const am = st.am || 1;
      h += `<div class="kv"><div><span class="lbl">Rendimiento</span><b style="color:${util >= .995 ? 'var(--good)' : util > .01 ? 'var(--warn)' : 'var(--bad)'}">${fmt(util * 100, 1)}%</b></div><div><span class="lbl">Energía (máx.)</span><b>${fmt((+n.count || 1) * clockPower(machinePower(r), +n.clock || 100, am), 1)} MW</b></div></div>
        <div class="io">${r.in.map(([i, a]) => `<span>${icon(i)}<span class="q">${fmt(st.rate * a || 0)} / ${fmt(perMin(r, a) * (+n.clock || 100) / 100 * (+n.count || 1))}</span>${esc(nameOf(i))}</span>`).join('')}
        ${r.out.map(([i, a]) => `<span>${icon(i)}<span class="q">→ ${fmt((st.rate || 0) * a * am)} / ${fmt(perMin(r, a) * am * (+n.clock || 100) / 100 * (+n.count || 1))}</span>${esc(nameOf(i))}</span>`).join('')}</div>`;
      if (st.reason) h += `<p class="note">${reasonText(st.reason)}</p>`;
    }
  } else if (n.kind === 'extractor') {
    const ex = EXTRACTORS[n.ex];
    const resList = ex.solid ? SOLID_RES : ex.well ? WELL_RES : [ex.item];
    h += `<div class="form"><label for="be-x">Extractor</label><select id="be-x">${Object.keys(EXTRACTORS).map(k => `<option value="${k}" ${k === n.ex ? 'selected' : ''}>${esc(machName(k))}</option>`).join('')}</select>
      <label for="be-i">Recurso</label><select id="be-i">${resList.map(i => `<option value="${i}" ${i === n.item ? 'selected' : ''}>${esc(nameOf(i))}</option>`).join('')}</select>
      ${ex.nopurity ? '' : `<label for="be-p">Pureza</label><select id="be-p">${PURITY.map(pp => `<option value="${pp.k}" ${+n.purity === pp.k ? 'selected' : ''}>${pp.ne}</option>`).join('')}</select>`}
      <label for="be-c">Cantidad</label><input id="be-c" type="number" min="1" max="200" value="${n.count || 1}">
      <label for="be-k">Reloj %</label><input id="be-k" type="number" min="1" max="250" step="any" value="${n.clock || 100}"></div>
      <div class="kv"><div><span class="lbl">Saca</span><b>${fmt(st.rate || 0)} / ${fmt(extractorRate(n))} ${unitOf(n.item)}</b></div><div><span class="lbl">Energía (máx.)</span><b>${fmt((+n.count || 1) * clockPower(ex.p, +n.clock || 100, 1), 1)} MW</b></div></div>
      ${extractorRate(n) / (+n.count || 1) > (isLiq(n.item) ? 600 : 1200) ? `<p class="note">Un solo extractor no puede sacar más de ${isLiq(n.item) ? '600 m³' : '1200'}/min: es el máximo de la mejor ${isLiq(n.item) ? 'tubería' : 'cinta'}.</p>` : ''}`;
  } else if (n.kind === 'source') {
    h += `<div class="form"><label>Objeto</label><button class="pick" id="bs-pick">${n.item ? icon(n.item) : ''}<span class="nm">${n.item ? esc(nameOf(n.item)) : 'Elegir…'}</span></button>
      <label for="bs-r">Ritmo</label><input id="bs-r" type="number" min="0" step="any" value="${n.rate ?? 0}">
      <label for="bs-l">Nombre</label><input id="bs-l" type="text" value="${esc(n.label || '')}" placeholder="Ej.: Estación HIERRO-NORTE-Giosepe"></div>
      <p class="hint">Sale ${fmt(st.rate || 0)} de ${fmt(+n.rate || 0)} ${n.item ? unitOf(n.item) : '/min'}.</p>`;
  } else {
    const items = edgeItems(b); const inc = b.edges.filter(e => e.to === n.id);
    if (n.kind === 'storage') h += `<div class="form"><label for="bs-l">Nombre</label><input id="bs-l" type="text" value="${esc(n.label || '')}" placeholder="Ej.: Almacén central"></div>`;
    h += `<div class="io">${inc.map(e => items[e.id] ? `<span>${icon(items[e.id])}<span class="q">${fmt(BSIM.flow[e.id] || 0)}</span>${esc(nameOf(items[e.id]))}</span>` : '').join('') || '<span class="hint">Nada conectado todavía.</span>'}</div>`;
    if (n.kind === 'splitter') h += `<p class="hint">Reparte en partes iguales entre sus salidas; si una se llena, lo sobrante va a las demás.</p>`;
  }
  h += `<div class="row">${(n.kind === 'machine' || n.kind === 'extractor') && (+n.count || 1) > 1 ? `<button class="btn sm pri" data-bsplit>Separar en ${n.count} máquinas</button>` : ''}<button class="btn sm" data-bdup>Duplicar</button><button class="btn danger sm" data-bdel>Eliminar</button></div>`;
  box.innerHTML = h;
}
function reasonText(r) {
  if (!r) return '';
  if (r.t === 'out') return r.none ? `La salida de ${esc(nameOf(r.item))} no está conectada: la máquina se llena y se detiene. Llévala a un almacén o al triturador.` : `La salida de ${esc(nameOf(r.item))} está atascada (cinta llena o nadie la usa).`;
  return r.none ? `Falta conectar la entrada de ${esc(nameOf(r.item))}.` : `No le llega suficiente ${esc(nameOf(r.item))}.`;
}
function renderBSummary() {
  const sim = BSIM, b = plan().build;
  const li = (i, v) => `<div class="fl">${icon(i)}<span class="nm">${esc(nameOf(i))}</span><span class="q">${fmtR(v, i)}</span></div>`;
  const rec = Object.entries(sim.received).filter(([, v]) => v > 1e-6).sort((a, c) => c[1] - a[1]);
  const src = Object.entries(sim.consumedSrc).filter(([, v]) => v > 1e-6).sort((a, c) => c[1] - a[1]);
  const by = Object.fromEntries(b.nodes.map(n => [n.id, n]));
  const issues = sim.issues.slice(0, 40).map(x => {
    if (x.edge) { const e = b.edges.find(y => y.id === x.edge); const it = sim.eItem[x.edge]; return `<button class="btn ghost sm" data-goto-edge="${x.edge}" style="justify-content:flex-start;text-align:left"><span class="badge warn">cinta</span> ${it ? esc(nameOf(it)) : ''}: ${isLiq(it) ? 'tubería' : 'cinta'} llena (${fmt(sim.cap[x.edge], 0)}/min). Sube de nivel o añade otra línea.</button>`; }
    const n = by[x.node]; if (!n) return '';
    if (x.t === 'norecipe') return `<button class="btn ghost sm" data-goto-node="${n.id}"><span class="badge warn">receta</span> ${esc(bTitle(n))}: elige una receta.</button>`;
    if (x.t === 'noout') return `<button class="btn ghost sm" data-goto-node="${n.id}"><span class="badge warn">salida</span> ${esc(bTitle(n))}: no está conectado a nada.</button>`;
    return `<button class="btn ghost sm" data-goto-node="${n.id}" style="justify-content:flex-start;text-align:left"><span class="badge ${x.eff < 0.01 ? 'warn' : 'alt'}">${fmt(x.eff * 100, 0)}%</span> ${esc(bTitle(n))}: ${reasonText({ t: x.t, item: x.item, none: x.none })}</button>`;
  });
  $('#bstats').innerHTML = `
    <div class="stat hl"><span class="lbl">Máquinas</span><span class="v num">${fmt(sim.machines, 0)}</span><span class="s">${b.nodes.length} bloques · ${b.edges.length} conexiones</span></div>
    <div class="stat"><span class="lbl">Energía real</span><span class="v num">${fmt(sim.power, 0)}<small>MW</small></span><span class="s">máximo ${fmt(sim.powerMax, 0)} MW</span></div>
    <div class="stat"><span class="lbl">Problemas</span><span class="v num" style="color:${sim.issues.length ? 'var(--warn)' : 'var(--good)'}">${sim.issues.length}</span><span class="s">${sim.issues.length ? 'revísalos abajo' : 'todo fluye'}</span></div>
    <div class="stat"><span class="lbl">Al triturador</span><span class="v num">${fmt(sim.points, 0)}<small>pts/min</small></span><span class="s">puntos AWESOME</span></div>`;
  $('#bout').innerHTML = rec.map(([i, v]) => li(i, v)).join('') || `<p class="empty-note">Conecta algo a un almacén o al triturador para ver la producción.</p>`;
  $('#bin').innerHTML = src.map(([i, v]) => li(i, v)).join('') || `<p class="empty-note">Sin extractores ni entradas.</p>`;
  $('#bissues').innerHTML = issues.join('') || `<p class="empty-note">Sin problemas: todas las máquinas van al 100%.</p>`;
}
/* Separa un bloque de N máquinas iguales en N máquinas con divisores y fusionadores */
function groupDims(n) {
  const c = Math.round(+n.count || 1), P = nodePorts(n), g = bGeom(n);
  const rowH = g.h + 16;
  const leftW = P.ins.length ? P.ins.length * 120 + 40 : 0, rightW = P.outs.length ? P.outs.length * 120 + 40 : 0;
  return { c, P, g, rowH, leftW, rightW, height: c > 1 ? c * rowH - 16 : g.h, width: (c > 1 ? leftW + rightW : 0) + g.w };
}
function expandGroup(b, n) {
  const { c, P, g, rowH } = groupDims(n); if (c <= 1) return null;
  const r = n.kind === 'machine' ? REC[n.recipe] : null;
  const am = r && MACH[r.m].s ? 1 + Math.min(+n.sloop || 0, MACH[r.m].s) / MACH[r.m].s : 1;
  const per = (side, k) => n.kind === 'extractor' ? extractorRate(Object.assign({}, n, { count: 1 })) : perMin(r, (side === 'in' ? r.in : r.out)[k][1]) * (+n.clock || 100) / 100 * (side === 'out' ? am : 1);
  const tf = (item, rate) => { const bt = beltFor(rate, isLiq(item)); return { tier: bt.tier, lanes: bt.n }; };
  const copies = Array.from({ length: c }, (_, i) => Object.assign({}, n, { id: uid(), count: 1, y: n.y + i * rowH }));
  const nn = [...copies], ne = [];
  const E = (from, fp, to, tp, item, rate) => ne.push(Object.assign({ id: uid(), from, fp, to, tp }, tf(item, rate)));
  P.ins.forEach((pt, k) => {
    const item = pt.item, pm = per('in', k);
    const sx = n.x - 40 - LOGW - (P.ins.length - 1 - k) * 120;
    const spl = Array.from({ length: c - 1 }, (_, i) => ({ id: uid(), kind: 'splitter', x: sx, y: copies[i].y + Math.max(0, (g.h - 78) / 2) }));
    spl.forEach((s, i) => {
      E(s.id, 0, copies[i].id, k, item, pm);
      if (i < c - 2) E(s.id, 1, spl[i + 1].id, 0, item, pm * (c - 1 - i)); else E(s.id, 1, copies[c - 1].id, k, item, pm);
    });
    b.edges.forEach(e => { if (e.to === n.id && e.tp === k) { e.to = spl[0].id; e.tp = 0; } });
    nn.push(...spl);
  });
  P.outs.forEach((pt, k) => {
    const item = pt.item, pm = per('out', k);
    const mx = n.x + g.w + 40 + k * 120;
    const mer = Array.from({ length: c - 1 }, (_, i) => ({ id: uid(), kind: 'merger', x: mx, y: copies[i + 1].y + Math.max(0, (g.h - 78) / 2) }));
    E(copies[0].id, k, mer[0].id, 1, item, pm);
    for (let i = 1; i < c; i++) { E(copies[i].id, k, mer[i - 1].id, 0, item, pm); if (i < c - 1) E(mer[i - 1].id, 0, mer[i].id, 1, item, pm * (i + 1)); }
    b.edges.forEach(e => { if (e.from === n.id && e.fp === k) { e.from = mer[c - 2].id; e.fp = 0; } });
    nn.push(...mer);
  });
  b.nodes = b.nodes.filter(x => x.id !== n.id).concat(nn); b.edges.push(...ne);
  return { copies, height: c * rowH - 16 };
}
/* Genera la construcción a partir del plan resuelto */
function generateBuild() {
  const p = plan(); const sol = solvePlan(p, UNLOCK);
  if (!sol.rows.length) { toast('El plan no tiene máquinas todavía.'); return; }
  const grouped = !!S.groupBuild;
  const { N, E } = buildGraph(sol);
  // nodos del taller (agrupados) para medir
  const nodes = [], edges = [], map = {};
  N.forEach(n => {
    const base = { id: uid(), x: 0, y: 0, clock: 100, count: 1 };
    let nd;
    if (n.type === 'recipe') { const rw = n.row; nd = Object.assign(base, { kind: 'machine', m: rw.r.m, recipe: rw.id, count: Math.max(1, rw.built), clock: +rw.balanced.toFixed(4), sloop: +(p.sloop?.[rw.id] || 0) }); }
    else if (n.type === 'raw' && (SOLID_RES.includes(n.item) || n.item === 'Water' || n.item === 'LiquidOil')) {
      const ex = n.item === 'Water' ? 'WaterPump' : n.item === 'LiquidOil' ? 'OilPump' : p.miner.ex;
      const per = EXTRACTORS[ex].rate * (EXTRACTORS[ex].nopurity ? 1 : p.miner.purity) * p.miner.clock / 100;
      nd = Object.assign(base, { kind: 'extractor', ex, item: n.item, purity: p.miner.purity, clock: p.miner.clock, count: Math.max(1, Math.ceil(n.rate / per - 1e-9)) });
    }
    else if (n.type === 'raw' || n.type === 'imp' || n.type === 'sup') nd = Object.assign(base, { kind: 'source', item: n.item, rate: +n.rate.toFixed(4), label: n.type === 'sup' ? 'Suministro' : n.type === 'imp' ? 'Importado' : 'Entrada' });
    else if (n.type === 'out') nd = Object.assign(base, { kind: 'storage', label: 'Objetivo: ' + nameOf(n.item) });
    else nd = Object.assign(base, { kind: isLiq(n.item) ? 'storage' : 'sink', label: 'Sobrante' });
    map[n.id] = nd; nodes.push(nd);
    const d = grouped ? { width: bGeom(nd).w, height: bGeom(nd).h, leftW: 0 } : groupDims(nd);
    n.w = d.width; n.h = d.height; n._left = (!grouped && d.c > 1) ? d.leftW : 0;
  });
  layoutGraph(N, E, { W: NW, GX: 150, GY: 40 });
  N.forEach(n => { const nd = map[n.id]; nd.x = Math.round((n.x + n._left) / 10) * 10; nd.y = Math.round(n.y / 10) * 10; });
  E.forEach(e => {
    const a = map[e.from], c = map[e.to]; if (!a || !c) return;
    const fp = a.kind === 'machine' ? REC[a.recipe].out.findIndex(o => o[0] === e.item) : 0;
    let tp = 0;
    if (c.kind === 'machine') tp = REC[c.recipe].in.findIndex(o => o[0] === e.item);
    else if (c.kind === 'storage') { tp = Math.min(1, edges.filter(x => x.to === c.id).length); }
    const bt = beltFor(e.rate, isLiq(e.item));
    edges.push({ id: uid(), from: a.id, fp, to: c.id, tp, tier: bt.tier, lanes: bt.n });
  });
  const b = { nodes, edges };
  if (!grouped) nodes.slice().forEach(n => { if ((n.kind === 'machine' || n.kind === 'extractor') && n.count > 1) expandGroup(b, n); });
  p.build = b; BSEL = null; save(); renderBuild(); setTimeout(fitBuild, 30);
  const mc = b.nodes.filter(n => n.kind === 'machine' || n.kind === 'extractor').length;
  toast(`Construcción generada: ${mc} máquinas, ${b.nodes.length - mc} divisores, fusionadores y almacenes.`);
}
function splitSelected() {
  const b = plan().build; const n = b.nodes.find(x => x.id === BSEL?.node); if (!n) return;
  const d = groupDims(n); const old = bGeom(n).h; const x0 = n.x - d.leftW, x1 = n.x + bGeom(n).w + d.rightW;
  const others = b.nodes.filter(x => x.id !== n.id);
  const res = expandGroup(b, n); if (!res) return;
  const extra = res.height - old;
  others.forEach(o => { const w = bGeom(o).w; if (o.y > n.y && o.x < x1 && o.x + w > x0) o.y += extra + 20; });
  BSEL = { node: res.copies[0].id }; save(); renderBuild(); toast(`Separado en ${res.copies.length} máquinas.`);
}

/* =================== RECETAS =================== */
let LIBSEL = 'IronPlate';
function renderLib() {
  const q = ($('#libq').value || '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const list = PICKABLE.filter(i => !q || (ITEMS[i][0] + ' ' + ITEMS[i][1]).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(q));
  const g = {}; list.forEach(i => (g[catOf(i)] ??= []).push(i));
  $('#libList').innerHTML = CAT_ORDER.filter(c => g[c]).map(c => `<div class="grp">${c}</div>` + g[c].sort((a, b) => nameOf(a).localeCompare(nameOf(b))).map(i => `<button data-lib="${i}" aria-current="${i === LIBSEL}">${icon(i)}<span>${esc(nameOf(i))}</span></button>`).join('')).join('');
  const i = LIBSEL; const it = ITEMS[i];
  const card = r => {
    const locked = r.alt && !UNLOCK.has(r.id);
    const p = machinePower(r);
    return `<div class="rcard ${locked ? 'locked' : ''}"><h4>${esc(recName(r))}${r.alt ? '<span class="badge alt">alternativa</span>' : ''}${RECOMMENDED[r.id] ? `<span class="badge">★ ${esc(RECOMMENDED[r.id])}</span>` : ''}</h4>
      <span class="mach">${esc(machName(r.m))} · ${fmt(r.t, 2)} s · ${fmt(p, 0)} MW${r.pw ? ' (variable ' + r.pw[0] + '–' + r.pw[1] + ')' : ''}</span>
      <div class="cols"><div class="io"><span class="lbl">Entra /min</span>${r.in.map(([x, a]) => `<span>${icon(x)}<span class="q">${fmt(perMin(r, a))}</span><button class="btn ghost sm" data-lib="${x}">${esc(nameOf(x))}</button></span>`).join('')}</div>
      <div class="io"><span class="lbl">Sale /min</span>${r.out.map(([x, a]) => `<span>${icon(x)}<span class="q">${fmt(perMin(r, a))}</span><button class="btn ghost sm" data-lib="${x}">${esc(nameOf(x))}</button></span>`).join('')}</div></div>
      ${r.alt ? `<label class="toggle"><input type="checkbox" data-unlock="${r.id}" ${UNLOCK.has(r.id) ? 'checked' : ''}> Ya la tenemos desbloqueada</label>` : ''}</div>`;
  };
  const prod = (PRODUCERS[i] || []).map(id => REC[id]).sort((a, b) => a.alt - b.alt);
  const uses = (USERS[i] || []).map(id => REC[id]).sort((a, b) => a.alt - b.alt);
  $('#libDetail').innerHTML = `<div class="box"><header>${icon(i, true)}<div><h2>${esc(nameOf(i))}</h2><span class="hint">${esc(LANG === 'es' ? it[0] : it[1])}${it[3] && !it[2] ? ` · ${fmt(it[3], 0)} puntos AWESOME` : ''}${it[4] ? ` · ${fmt(it[4], 0)} MJ${it[2] ? '/m³' : ''}` : ''}${MAP_LIMIT[i] ? ` · Límite del mapa ${fmt(MAP_LIMIT[i], 0)}/min` : ''}</span></div><span class="sp"></span><button class="btn pri sm" data-addtarget="${i}">Añadir al plan</button></header>
    <div class="bd"><span class="lbl">Se fabrica con (${prod.length})</span><div class="rcards">${prod.map(card).join('') || `<p class="empty-note">${RES.has(i) ? 'Se extrae de nodos del mapa.' : 'No se fabrica: se recolecta.'}</p>`}</div>
    <span class="lbl" style="margin-top:8px">Se usa en (${uses.length})</span><div class="rcards">${uses.map(card).join('') || '<p class="empty-note">No se usa en ninguna máquina.</p>'}</div></div></div>`;
}

/* =================== ALTERNATIVAS =================== */
function renderAlts() {
  const q = ($('#altq').value || '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const onlyRec = $('#altRec').checked;
  const alts = D.recipes.filter(r => r.alt).filter(r => !onlyRec || RECOMMENDED[r.id]).filter(r => !q || (r.n + ' ' + r.ne + ' ' + r.out.map(o => ITEMS[o[0]][0] + ' ' + ITEMS[o[0]][1]).join(' ')).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(q));
  alts.sort((a, b) => (RECOMMENDED[b.id] ? 1 : 0) - (RECOMMENDED[a.id] ? 1 : 0) || nameOf(a.out[0][0]).localeCompare(nameOf(b.out[0][0])));
  $('#altCount').textContent = `${UNLOCK.size} de ${D.recipes.filter(r => r.alt).length} desbloqueadas`;
  $('#altGrid').innerHTML = alts.map(r => `<label class="altrow ${UNLOCK.has(r.id) ? 'on' : ''}"><input type="checkbox" data-unlock="${r.id}" ${UNLOCK.has(r.id) ? 'checked' : ''}>${icon(r.out[0][0])}<span class="t"><b>${esc(recName(r))}${RECOMMENDED[r.id] ? ' ★' : ''}</b><small>${esc(nameOf(r.out[0][0]))} · ${esc(machName(r.m))}${RECOMMENDED[r.id] ? ' · para ' + esc(RECOMMENDED[r.id]) : ''} · ${r.in.map(([i, a]) => fmt(perMin(r, a)) + ' ' + nameOf(i)).join(' + ')} → ${r.out.map(([i, a]) => fmt(perMin(r, a)) + ' ' + nameOf(i)).join(' + ')}</small></span></label>`).join('') || `<p class="empty-note">No hay alternativas con ese nombre.</p>`;
}

/* =================== CALCULADORAS =================== */
function renderCalc() {
  // extracción
  const ex = $('#cx-ex').value, ed = EXTRACTORS[ex];
  const resSel = $('#cx-res'); const list = ed.solid ? SOLID_RES : ed.well ? WELL_RES : [ed.item];
  if (resSel.dataset.for !== ex) { resSel.innerHTML = list.map(i => `<option value="${i}">${esc(nameOf(i))}</option>`).join(''); resSel.dataset.for = ex; }
  $('#cx-pur').disabled = !!ed.nopurity;
  const pur = ed.nopurity ? 1 : +$('#cx-pur').value, clk = Math.min(250, Math.max(1, +$('#cx-clk').value || 100));
  const rate = ed.rate * pur * clk / 100; const item = resSel.value; const liq = isLiq(item);
  const capMax = liq ? 600 : 1200; const real = Math.min(rate, capMax);
  const need = +$('#cx-need').value || 0;
  $('#cx-out').innerHTML = `<div class="big num">${fmt(real, 1)}<small>${unitOf(item)}</small></div>
    <div class="outgrid"><div><span class="lbl">Energía</span><b class="num">${fmt(clockPower(ed.p, clk, 1), 1)} MW</b></div><div><span class="lbl">Fragmentos</span><b class="num">${shardsFor(clk)}</b></div>
    <div><span class="lbl">Cinta mínima</span><b>${liq ? 'Tubería' : 'Cinta'} Mk.${beltFor(real, liq).tier}</b></div><div><span class="lbl">Para ${fmt(need, 0)}/min</span><b class="num">${need ? fmt(Math.ceil(need / real - 1e-9), 0) + ' extractores' : '—'}</b></div></div>
    ${rate > capMax ? `<p class="note">Saldría ${fmt(rate, 0)}/min, pero la mejor ${liq ? 'tubería' : 'cinta'} solo lleva ${capMax}/min.</p>` : ''}
    ${MAP_LIMIT[item] ? `<p class="hint">${esc(nameOf(item))}: el mapa da como máximo ${fmt(MAP_LIMIT[item], 0)}/min entre todos los nodos.</p>` : ''}`;
  // energía
  const g = D.gens.find(x => x.id === $('#cg-gen').value);
  const fs = $('#cg-fuel'); if (fs.dataset.for !== g.id) { fs.innerHTML = g.f.filter(i => ITEMS[i]).map(i => `<option value="${i}">${esc(nameOf(i))}</option>`).join(''); fs.dataset.for = g.id; }
  const fuel = fs.value; const mj = ITEMS[fuel]?.[4] || 1; const gclk = Math.min(250, Math.max(1, +$('#cg-clk').value || 100));
  const mwEach = g.mw * gclk / 100; const target = +$('#cg-mw').value || 0; const n = target ? Math.ceil(target / mwEach - 1e-9) : 1;
  const fuelEach = mwEach / mj * 60; const waterEach = g.w ? g.mw * g.w * 60 / 1000 * gclk / 100 : 0;
  $('#cg-out').innerHTML = `<div class="big num">${fmt(n, 0)}<small>${esc(LANG === 'es' ? g.ne : g.n)}</small></div>
    <div class="outgrid"><div><span class="lbl">Energía total</span><b class="num">${fmt(n * mwEach, 0)} MW</b></div><div><span class="lbl">Por generador</span><b class="num">${fmt(mwEach, 1)} MW</b></div>
    <div><span class="lbl">${esc(nameOf(fuel))}</span><b class="num">${fmt(n * fuelEach, 2)} ${unitOf(fuel)}</b></div><div><span class="lbl">Agua</span><b class="num">${waterEach ? fmt(n * waterEach, 1) + ' m³/min' : 'no usa'}</b></div></div>
    ${waterEach ? `<p class="hint">Necesitas ${fmt(Math.ceil(n * waterEach / 120 - 1e-9), 0)} extractores de agua al 100%.</p>` : ''}
    ${g.id === 'GeneratorNuclear' ? `<p class="note">Cada barra deja residuo radiactivo: planea dónde guardarlo o reprocesarlo.</p>` : ''}`;
}

/* =================== EVENTOS =================== */
function bind() {
  $('.tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) setTab(b.dataset.tab); });
  $('#langBtn').addEventListener('click', () => { LANG = LANG === 'es' ? 'en' : 'es'; S.lang = LANG; save(); $('#langBtn').textContent = LANG === 'es' ? 'Nombres: ES' : 'Nombres: EN'; $('#palette').dataset.ok = ''; setTab(S.tab); });
  $('#langBtn').textContent = LANG === 'es' ? 'Nombres: ES' : 'Nombres: EN';
  // plan bar
  $('#planSel').addEventListener('change', e => { S.cur = e.target.value; selNode = null; DG.fitted = false; save(); renderPlan(); });
  $('#planNew').addEventListener('click', () => { const p = newPlan('Plan nuevo'); S.plans.push(p); S.cur = p.id; DG.fitted = false; save(); renderPlan(); setTimeout(() => $('#planName').focus(), 50); editName(); });
  $('#planDup').addEventListener('click', () => { const c = JSON.parse(JSON.stringify(plan())); c.id = uid(); c.name = plan().name + ' (copia)'; c.sheet = false; S.plans.push(c); S.cur = c.id; save(); renderPlan(); toast('Plan duplicado'); });
  $('#planRen').addEventListener('click', editName);
  $('#planDel').addEventListener('click', e => {
    const b = e.currentTarget;
    if (b.dataset.confirm) { if (S.plans.length === 1) { toast('Debe quedar al menos un plan.'); return; } S.plans = S.plans.filter(p => p.id !== S.cur); S.cur = S.plans[0].id; b.dataset.confirm = ''; b.textContent = 'Eliminar'; DG.fitted = false; save(); renderPlan(); toast('Plan eliminado'); return; }
    b.dataset.confirm = 1; b.textContent = '¿Seguro?'; setTimeout(() => { b.dataset.confirm = ''; b.textContent = 'Eliminar'; }, 3000);
  });
  $('#owner').addEventListener('change', e => { plan().owner = e.target.value; save(); renderPlanBar(); recompute(); });
  // listas objetivo/suministro
  const lists = e => {
    const line = e.target.closest('.line'); if (!line) return null;
    return { p: plan(), arr: plan()[line.dataset.kind], k: +line.dataset.k, kind: line.dataset.kind };
  };
  ['#targets', '#supplies'].forEach(sel => {
    $(sel).addEventListener('click', e => {
      const L = lists(e); if (!L) return; const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'pick') pickItem(i => { L.arr[L.k].item = i; save(); renderInputsPanel(); recompute(); });
      if (act === 'del') { L.arr.splice(L.k, 1); save(); renderInputsPanel(); recompute(); }
    });
    let t; $(sel).addEventListener('input', e => { const L = lists(e); if (!L || e.target.dataset.act !== 'rate') return; L.arr[L.k].rate = e.target.value === '' ? '' : +e.target.value; save(); clearTimeout(t); t = setTimeout(recompute, 160); });
  });
  $('#addTarget').addEventListener('click', () => pickItem(i => { plan().targets.push({ item: i, rate: isLiq(i) ? 60 : 10 }); DG.fitted = false; save(); renderInputsPanel(); recompute(); }, { title: '¿Qué quieres producir?' }));
  $('#addSupply').addEventListener('click', () => pickItem(i => { plan().supplies.push({ item: i, rate: 60 }); save(); renderInputsPanel(); recompute(); }, { title: '¿Qué ya te llega?' }));
  $('#gClock').addEventListener('change', e => { plan().globalClock = Math.min(250, Math.max(1, +e.target.value || 100)); save(); recompute(); });
  ['#minerEx', '#minerPur', '#minerClk'].forEach(s => $(s).addEventListener('change', () => { const m = plan().miner; m.ex = $('#minerEx').value; m.purity = +$('#minerPur').value; m.clock = Math.min(250, Math.max(1, +$('#minerClk').value || 100)); save(); recompute(); }));
  $('#optBtn').addEventListener('click', () => {
    const best = optimizeChoices(UNLOCK); const p = plan(); let n = 0;
    for (const i in best) { const d = defaultRecipe(i); if (best[i] !== d) { if (p.choice[i] !== best[i]) n++; p.choice[i] = best[i]; } else if (p.choice[i] && p.choice[i][0] !== '@') delete p.choice[i]; }
    save(); recompute(); toast(UNLOCK.size ? `Recetas elegidas para ahorrar recursos (${n} cambios).` : 'Marca primero las alternativas que tienen desbloqueadas.');
  });
  $('#resetBtn').addEventListener('click', () => { plan().choice = {}; plan().clock = {}; plan().sloop = {}; save(); recompute(); toast('Recetas estándar restablecidas.'); });
  $('#viewSeg').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; S.view = b.dataset.v; save(); recompute(); });
  // cambios en selects de receta / reloj / responsable (delegado)
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('[data-recipe-for]')) setChoice(t.dataset.recipeFor, t.value);
    else if (t.matches('[data-clock]')) { const p = plan(); if (t.value === '') delete p.clock[t.dataset.clock]; else p.clock[t.dataset.clock] = Math.min(250, Math.max(1, +t.value)); save(); recompute(); }
    else if (t.matches('[data-sloop]')) { plan().sloop[t.dataset.sloop] = +t.value; save(); recompute(); }
    else if (t.matches('[data-assign]')) { const p = plan(); if (t.value === (p.owner || '')) delete p.assign[t.dataset.assign]; else p.assign[t.dataset.assign] = t.value; save(); }
    else if (t.matches('[data-unlock]')) { t.checked ? UNLOCK.add(t.dataset.unlock) : UNLOCK.delete(t.dataset.unlock); save(); if (S.tab === 'alts') renderAlts(); if (S.tab === 'recipes') renderLib(); }
  });
  // diagrama
  const dsvg = $('#dsvg');
  panZoom(dsvg, DG, applyDG, { click: e => { const g = e.target.closest('.node'); selNode = g ? (selNode === g.dataset.id ? null : g.dataset.id) : null; renderDetail(); } });
  $('#dFit').addEventListener('click', fitDiagram);
  $('#dIn').addEventListener('click', () => { DG.k = Math.min(3, DG.k * 1.25); applyDG(); });
  $('#dOut').addEventListener('click', () => { DG.k = Math.max(0.1, DG.k / 1.25); applyDG(); });
  $('#detail').addEventListener('click', e => { if (e.target.closest('[data-goto-table]')) { const id = selNode.slice(2); S.view = 'table'; save(); recompute(); const tr = $(`tr[data-row="${id}"]`); if (tr) { tr.scrollIntoView({ block: 'center' }); tr.classList.add('flash'); } } });
  // equipo
  $('#teamBtn').addEventListener('click', () => modal('Equipo', `<p class="hint">Nombres para repartir las máquinas. Vienen de la hoja del equipo.</p>${S.team.map((n, k) => `<div class="row"><input type="text" class="grow" data-tm="${k}" value="${esc(n)}"><span class="hint">${esc(HUBS[n] || '')}</span></div>`).join('')}<div class="row"><button class="btn sm" id="tmAdd">＋ Añadir persona</button></div>`, (ov, close) => {
    ov.addEventListener('input', e => { const k = e.target.dataset.tm; if (k !== undefined) { S.team[+k] = e.target.value; save(); } });
    $('#tmAdd', ov).addEventListener('click', () => { S.team.push('Nuevo'); save(); close(); $('#teamBtn').click(); });
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-x]')) { S.team = S.team.filter(x => x.trim()); save(); recompute(); } });
  }));
  // compartir
  $('#shareBtn').addEventListener('click', () => {
    const code = btoa(unescape(encodeURIComponent(JSON.stringify({ nf: 1, plan: plan(), unlocked: [...UNLOCK] }))));
    modal('Compartir plan', `<p class="hint">Copia este código y pásaselo a tu equipo. Ellos lo pegan en «Importar» y les aparece el plan con su construcción.</p><textarea id="shCode" rows="6" readonly>${code}</textarea><div class="row"><button class="btn pri" id="shCopy">Copiar código</button></div>
      <hr style="border:0;border-top:1px solid var(--line);width:100%"><span class="lbl">Importar</span><textarea id="imCode" rows="4" placeholder="Pega aquí un código de NexusFactory"></textarea><div class="row"><button class="btn" id="imGo">Importar como plan nuevo</button><label class="toggle"><input type="checkbox" id="imAlts" checked> También sus alternativas</label></div>`, (ov, close) => {
      $('#shCopy', ov).addEventListener('click', () => { const ta = $('#shCode', ov); navigator.clipboard?.writeText(ta.value).then(() => toast('Código copiado'), () => { ta.select(); toast('Selecciona y copia el código'); }) ?? (ta.select(), toast('Selecciona y copia el código')); });
      $('#imGo', ov).addEventListener('click', () => {
        try { const o = JSON.parse(decodeURIComponent(escape(atob($('#imCode', ov).value.trim())))); if (!o.nf || !o.plan) throw 0;
          const p = Object.assign(newPlan(''), o.plan, { id: uid(), sheet: false }); S.plans.push(p); S.cur = p.id;
          if ($('#imAlts', ov).checked) (o.unlocked || []).forEach(x => REC[x] && UNLOCK.add(x));
          DG.fitted = false; save(); close(); setTab('plan'); toast(`Plan «${p.name}» importado`);
        } catch (err) { toast('Ese código no es válido. Cópialo completo e inténtalo otra vez.'); }
      });
    });
  });
  // recetas
  $('#libq').addEventListener('input', renderLib);
  $('#v-recipes').addEventListener('click', e => {
    const b = e.target.closest('[data-lib]'); if (b) { LIBSEL = b.dataset.lib; renderLib(); $('#libDetail').scrollIntoView({ block: 'nearest' }); return; }
    const a = e.target.closest('[data-addtarget]'); if (a) { plan().targets.push({ item: a.dataset.addtarget, rate: 10 }); DG.fitted = false; save(); setTab('plan'); toast(`Añadido a «${plan().name}»`); }
  });
  // alternativas
  $('#altq').addEventListener('input', renderAlts); $('#altRec').addEventListener('change', renderAlts);
  $('#altAll').addEventListener('click', () => { D.recipes.filter(r => r.alt).forEach(r => UNLOCK.add(r.id)); save(); renderAlts(); });
  $('#altRecOn').addEventListener('click', () => { Object.keys(RECOMMENDED).forEach(r => UNLOCK.add(r)); save(); renderAlts(); });
  $('#altNone').addEventListener('click', () => { UNLOCK.clear(); save(); renderAlts(); });
  // calculadoras
  $('#v-calc').addEventListener('input', renderCalc); $('#v-calc').addEventListener('change', renderCalc);
  // taller
  bindBuild();
  $('#palette').addEventListener('click', e => { const b = e.target.closest('[data-add]'); if (b) addBNode(b.dataset.add); });
  $('#bGen').addEventListener('click', e => {
    const b = e.currentTarget;
    if (plan().build.nodes.length && !b.dataset.confirm) { b.dataset.confirm = 1; b.textContent = '¿Reemplazar lo actual?'; setTimeout(() => { b.dataset.confirm = ''; b.textContent = 'Generar desde el plan'; }, 3500); return; }
    b.dataset.confirm = ''; b.textContent = 'Generar desde el plan'; generateBuild();
  });
  $('#bFit').addEventListener('click', fitBuild);
  $('#bClear').addEventListener('click', e => {
    const b = e.currentTarget;
    if (!b.dataset.confirm) { b.dataset.confirm = 1; b.textContent = '¿Vaciar todo?'; setTimeout(() => { b.dataset.confirm = ''; b.textContent = 'Vaciar'; }, 3000); return; }
    plan().build = { nodes: [], edges: [] }; b.dataset.confirm = ''; b.textContent = 'Vaciar'; BSEL = null; save(); renderBuild();
  });
  $('#bGroup').checked = !!S.groupBuild; $('#bGroup').addEventListener('change', e => { S.groupBuild = e.target.checked; save(); });
  $('#bBelt').value = S.defBelt || 3; $('#bBelt').addEventListener('change', e => { S.defBelt = +e.target.value; save(); });
  $('#binsp').addEventListener('change', e => {
    const b = plan().build; const t = e.target;
    if (BSEL?.edge) { const ed = b.edges.find(x => x.id === BSEL.edge); if (t.id === 'bt-tier') ed.tier = +t.value; if (t.id === 'bt-lanes') ed.lanes = Math.max(1, +t.value || 1); save(); renderBuild(); return; }
    const n = b.nodes.find(x => x.id === BSEL?.node); if (!n) return;
    if (t.id === 'bm-m') { n.m = t.value; const r = D.recipes.find(rr => rr.m === n.m && !rr.alt); n.recipe = r?.id; n.sloop = 0; pruneEdges(n); }
    if (t.id === 'bm-r') { n.recipe = t.value; pruneEdges(n); }
    if (t.id === 'bm-c' || t.id === 'be-c') n.count = Math.max(1, Math.round(+t.value || 1));
    if (t.id === 'bm-k' || t.id === 'be-k') n.clock = Math.min(250, Math.max(1, +t.value || 100));
    if (t.id === 'bm-s') n.sloop = +t.value;
    if (t.id === 'be-x') { n.ex = t.value; const ex = EXTRACTORS[n.ex]; if (ex.item) n.item = ex.item; else if (ex.well && !WELL_RES.includes(n.item)) n.item = 'NitrogenGas'; else if (ex.solid && !SOLID_RES.includes(n.item)) n.item = 'OreIron'; pruneEdges(n); }
    if (t.id === 'be-i') { n.item = t.value; pruneEdges(n); }
    if (t.id === 'be-p') n.purity = +t.value;
    if (t.id === 'bs-r') n.rate = Math.max(0, +t.value || 0);
    if (t.id === 'bs-l') n.label = t.value;
    save(); renderBuild();
  });
  $('#binsp').addEventListener('click', e => {
    if (e.target.closest('[data-bsplit]')) { splitSelected(); return; }
    if (e.target.closest('[data-bdel]')) deleteBSel();
    if (e.target.closest('[data-bdup]')) { const b = plan().build; const n = b.nodes.find(x => x.id === BSEL.node); const c = Object.assign({}, n, { id: uid(), x: n.x + 30, y: n.y + 30 }); b.nodes.push(c); BSEL = { node: c.id }; save(); renderBuild(); }
    if (e.target.closest('#bs-pick')) { const n = plan().build.nodes.find(x => x.id === BSEL.node); pickItem(i => { n.item = i; pruneEdges(n); save(); renderBuild(); }); }
  });
  $('#bissues').addEventListener('click', e => {
    const a = e.target.closest('[data-goto-node]'), b2 = e.target.closest('[data-goto-edge]');
    if (a) BSEL = { node: a.dataset.gotoNode }; else if (b2) BSEL = { edge: b2.dataset.gotoEdge }; else return;
    const b = plan().build; const n = BSEL.node ? b.nodes.find(x => x.id === BSEL.node) : b.nodes.find(x => x.id === b.edges.find(y => y.id === BSEL.edge)?.from);
    if (n) { const r = $('#bsvg').getBoundingClientRect(); BV.k = Math.max(BV.k, 0.7); BV.x = r.width / 2 - (n.x + NW / 2) * BV.k; BV.y = r.height / 2 - (n.y + 60) * BV.k; }
    drawBuild(); renderBInspector(); $('#bsvg').scrollIntoView({ block: 'nearest' });
  });
  window.addEventListener('resize', () => { if (S.tab === 'plan' && S.view === 'diagram') fitDiagram(); });
}
function editName() {
  const p = plan(); const box = $('#planMeta');
  box.innerHTML = `<div class="row" style="width:100%"><input id="planName" type="text" class="grow" value="${esc(p.name)}" aria-label="Nombre del plan"><button class="btn sm pri" id="planNameOk">Guardar</button></div>`;
  const ok = () => { p.name = $('#planName').value.trim() || p.name; save(); renderPlanBar(); };
  $('#planNameOk').addEventListener('click', ok); $('#planName').addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
  $('#planName').focus(); $('#planName').select();
}

bind();
setTab(S.tab || 'plan');
