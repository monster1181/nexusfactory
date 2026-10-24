/* ===== NexusFactory: núcleo (datos, planificador, simulador) ===== */
const D = JSON.parse(document.getElementById('gamedata').textContent);
const ITEMS = D.items;              // id -> [en, es, liquid, sink, energyMJ]
const REC = {};                     // id -> recipe
D.recipes.forEach(r => { REC[r.id] = r; });
const MACH = D.machines;            // id -> {n, ne, p, s}
const RES = new Set(D.res);
const PRODUCERS = {};
D.recipes.forEach(r => r.out.forEach(([i]) => { (PRODUCERS[i] ??= []).push(r.id); }));
const USERS = {};
D.recipes.forEach(r => r.in.forEach(([i]) => { (USERS[i] ??= []).push(r.id); }));

const POW_EXP = 1.321928;
const BELTS = [60, 120, 270, 480, 780, 1200];
const PIPES = [300, 600];
/* Límites del mapa /min (de la hoja del equipo: wiki oficial, Resource node) */
const MAP_LIMIT = { OreIron: 92100, OreCopper: 36900, Stone: 69300, Coal: 42300, OreGold: 15000, RawQuartz: 13500,
  Sulfur: 10800, OreBauxite: 12300, SAM: 10200, LiquidOil: 12600, OreUranium: 2100, NitrogenGas: 12000 };
/* Extractores: ritmo base por nodo normal al 100% */
const EXTRACTORS = {
  MinerMk1: { n: 'Miner Mk.1', ne: 'Minero Mk.1', rate: 60, p: 5, solid: true },
  MinerMk2: { n: 'Miner Mk.2', ne: 'Minero Mk.2', rate: 120, p: 15, solid: true },
  MinerMk3: { n: 'Miner Mk.3', ne: 'Minero Mk.3', rate: 240, p: 45, solid: true },
  WaterPump: { n: 'Water Extractor', ne: 'Extractor de agua', rate: 120, p: 20, item: 'Water', nopurity: true },
  OilPump: { n: 'Oil Extractor', ne: 'Extractor de petróleo', rate: 120, p: 40, item: 'LiquidOil' },
  WellPressurizer: { n: 'Resource Well (1 satellite)', ne: 'Pozo de recursos (1 satélite)', rate: 60, p: 150, well: true }
};
const PURITY = [{ k: 0.5, n: 'Impure', ne: 'Impuro' }, { k: 1, n: 'Normal', ne: 'Normal' }, { k: 2, n: 'Pure', ne: 'Puro' }];
const SOLID_RES = ['OreIron', 'OreCopper', 'Stone', 'Coal', 'OreGold', 'RawQuartz', 'Sulfur', 'OreBauxite', 'SAM', 'OreUranium'];
const WELL_RES = ['LiquidOil', 'NitrogenGas', 'Water'];

/* Alternativas recomendadas en la hoja del equipo (Plan maestro, sección 5) */
const RECOMMENDED = {
  Alternate_PureIronIngot: 'Giosepe', Alternate_IronIngot_Leached: 'Giosepe', Alternate_PureCopperIngot: 'Jhafretd',
  Alternate_CopperIngot_Tempered: 'Jhafretd', Alternate_PureCateriumIngot: 'Jhafretd',
  Alternate_IngotSteel_1: 'Giosepe', Alternate_Screw_2: 'Giosepe / Tharvex', Alternate_Screw: 'Giosepe',
  Alternate_ReinforcedIronPlate_2: 'Tharvex', Alternate_CopperRotor: 'Tharvex', Alternate_FusedWire: 'Jhafretd',
  Alternate_WetConcrete: 'Giosepe', Alternate_CircuitBoard_1: 'Jhafretd', Alternate_DilutedFuel: 'Danida',
  Alternate_Plastic_1: 'Danida', Alternate_RecycledRubber: 'Danida', Alternate_SloppyAlumina: 'Danida'
};

let LANG = 'es';
const nameOf = i => ITEMS[i] ? (LANG === 'es' ? ITEMS[i][1] : ITEMS[i][0]) : i;
const isLiq = i => !!(ITEMS[i] && ITEMS[i][2]);
const recName = r => LANG === 'es' ? r.ne : r.n;
const machName = m => MACH[m] ? (LANG === 'es' ? MACH[m].ne : MACH[m].n) : (EXTRACTORS[m] ? (LANG === 'es' ? EXTRACTORS[m].ne : EXTRACTORS[m].n) : m);
const unitOf = i => isLiq(i) ? 'm³/min' : '/min';
const perMin = (r, amt) => amt * 60 / r.t;

function machinePower(r) { // MW base al 100%
  if (r.pw && r.pw[1] > 0) return (r.pw[0] + r.pw[1]) / 2;
  return MACH[r.m].p;
}
function clockPower(base, clock, amp) { return base * Math.pow(clock / 100, POW_EXP) * Math.pow(amp, 2); }
function shardsFor(clock) { return clock > 100 + 1e-9 ? Math.ceil((clock - 100) / 50 - 1e-9) : 0; }
function beltFor(rate, liq) {
  const tiers = liq ? PIPES : BELTS;
  for (let k = 0; k < tiers.length; k++) if (rate <= tiers[k] + 1e-6) return { n: 1, tier: k + 1, cap: tiers[k] };
  const cap = tiers[tiers.length - 1];
  return { n: Math.ceil(rate / cap - 1e-9), tier: tiers.length, cap };
}

/* ---- Recetas por defecto ---- */
const DEFAULT_CACHE = {};
function defaultRecipe(i) {
  if (i in DEFAULT_CACHE) return DEFAULT_CACHE[i];
  let res = null;
  if (!RES.has(i)) {
    const non = (PRODUCERS[i] || []).map(id => REC[id]).filter(r => !r.alt);
    const main = non.filter(r => r.out[0][0] === i);
    const named = main.find(r => r.n === ITEMS[i][0]);
    const pref = main.filter(r => !/^(Unpackage|Residual)/.test(r.n) && r.m !== 'Converter');
    if (named) res = named.id;
    else if (pref.length) res = pref[0].id;
    else if (main.length) res = main[0].id;
    else if (non.length) res = non.filter(r => r.m !== 'Converter')[0]?.id || non[0].id;
  }
  return (DEFAULT_CACHE[i] = res);
}
function recipeOptions(i, unlocked) {
  return (PRODUCERS[i] || []).map(id => REC[id]).filter(r => !r.alt || unlocked.has(r.id));
}
function effectiveChoice(plan, i, unlocked) {
  const c = plan.choice?.[i];
  if (c === '@import' || c === '@raw') return c;
  if (c && REC[c] && (!REC[c].alt || unlocked.has(c))) return c;
  const d = defaultRecipe(i);
  return d || '@raw';
}

/* ---- Solucionador del plan ----
   Punto fijo: cada receta produce lo justo para cubrir la demanda neta de los objetos que se le asignaron. */
function solvePlan(plan, unlocked) {
  const T = {}, SP = {};
  for (const t of plan.targets || []) if (t.item && +t.rate > 0) T[t.item] = (T[t.item] || 0) + +t.rate;
  for (const s of plan.supplies || []) if (s.item && +s.rate > 0) SP[s.item] = (SP[s.item] || 0) + +s.rate;
  const rOf = {}, recs = [], seen = new Set(), q = Object.keys(T);
  while (q.length) {
    const i = q.shift();
    if (seen.has(i)) continue; seen.add(i);
    const c = effectiveChoice(plan, i, unlocked);
    if (c[0] === '@') continue;
    rOf[i] = c; if (!recs.includes(c)) recs.push(c);
    for (const [j] of REC[c].in) q.push(j);
  }
  const amp = id => { const s = MACH[REC[id].m].s; const n = Math.min(+(plan.sloop?.[id] || 0), s); return s ? 1 + n / s : 1; };
  const OUT = {}, IN = {};
  for (const id of recs) {
    const r = REC[id], m = amp(id); OUT[id] = {}; IN[id] = {};
    r.out.forEach(([i, a]) => OUT[id][i] = (OUT[id][i] || 0) + perMin(r, a) * m);
    r.in.forEach(([i, a]) => IN[id][i] = (IN[id][i] || 0) + perMin(r, a));
  }
  // x = número de "máquinas al 100%" equivalentes
  const owners = {}; for (const i in rOf) (owners[rOf[i]] ??= []).push(i);
  const cons = {}, prods = {};
  for (const id of recs) { for (const i in IN[id]) (cons[i] ??= []).push(id); for (const i in OUT[id]) (prods[i] ??= []).push(id); }
  const x = {}; recs.forEach(id => x[id] = 0);
  let converged = false, diverged = false;
  for (let it = 0; it < 4000; it++) {
    let delta = 0;
    for (const id of recs) {
      let need = 0;
      for (const i of owners[id]) {
        let c = T[i] || 0;
        for (const r2 of cons[i] || []) if (r2 !== id) c += x[r2] * IN[r2][i];
        let p = SP[i] || 0;
        for (const r2 of prods[i] || []) if (r2 !== id) p += x[r2] * OUT[r2][i];
        const eff = OUT[id][i] - (IN[id][i] || 0);
        if (eff <= 1e-12) continue;
        need = Math.max(need, Math.max(0, c - p) / eff);
      }
      delta = Math.max(delta, Math.abs(need - x[id]) / Math.max(1, need));
      x[id] = need;
      if (need > 1e8) diverged = true;
    }
    if (diverged) break;
    if (delta < 1e-12) { converged = true; break; }
  }
  for (const id of recs) if (x[id] < 1e-9) x[id] = 0;
  // balances
  const prod = {}, use = {};
  for (const id of recs) {
    for (const i in OUT[id]) prod[i] = (prod[i] || 0) + x[id] * OUT[id][i];
    for (const i in IN[id]) use[i] = (use[i] || 0) + x[id] * IN[id][i];
  }
  const all = new Set([...Object.keys(prod), ...Object.keys(use), ...Object.keys(T), ...Object.keys(SP)]);
  const inputs = [], surplus = [], bal = {};
  for (const i of all) {
    const b = (prod[i] || 0) + (SP[i] || 0) - (use[i] || 0) - (T[i] || 0);
    bal[i] = b;
    if (b < -1e-7) {
      const c = effectiveChoice(plan, i, unlocked);
      inputs.push({ item: i, rate: -b, kind: c === '@import' ? 'import' : (RES.has(i) ? 'raw' : (defaultRecipe(i) ? 'import' : 'gather')) });
    } else if (b > 1e-7) surplus.push({ item: i, rate: b, fromSupply: (SP[i] || 0) > 0 && !(prod[i] > 0) });
  }
  // filas por receta
  const rows = [];
  for (const id of recs) {
    if (!(x[id] > 0)) continue;
    const r = REC[id];
    const clock = Math.min(250, Math.max(1, +(plan.clock?.[id] ?? plan.globalClock ?? 100)));
    const machines = x[id] / (clock / 100);
    const built = Math.ceil(machines - 1e-7);
    const balanced = built ? machines / built * clock : 0;
    const a = amp(id);
    const power = built * clockPower(machinePower(r), balanced, a);
    const io = {
      in: Object.entries(IN[id]).map(([i, v]) => ({ item: i, rate: v * x[id] })),
      out: Object.entries(OUT[id]).map(([i, v]) => ({ item: i, rate: v * x[id] }))
    };
    rows.push({ id, r, item: (owners[id] || [r.out[0][0]])[0], x: x[id], clock, machines, built, balanced, amp: a,
      sloops: built * Math.min(+(plan.sloop?.[id] || 0), MACH[r.m].s), shards: built * shardsFor(balanced), power, io });
  }
  const sortKey = rw => depthOf(rw, rows);
  rows.forEach(rw => rw.depth = sortKey(rw));
  rows.sort((a, b) => a.depth - b.depth || b.power - a.power);
  inputs.sort((a, b) => b.rate - a.rate); surplus.sort((a, b) => b.rate - a.rate);
  return { T, SP, rows, inputs, surplus, prod, use, bal, converged, diverged };
}
function depthOf(row, rows) { // distancia desde los objetivos (0 = producto final)
  const memo = depthOf.memo || (depthOf.memo = new WeakMap());
  let m = memo.get(rows); if (!m) { m = {}; memo.set(rows, m); }
  if (row.id in m) return m[row.id];
  m[row.id] = 0;
  let d = 0;
  for (const other of rows) {
    if (other === row) continue;
    if (other.io.in.some(e => row.io.out.some(o => o.item === e.item))) d = Math.max(d, depthOf(other, rows) + 1);
  }
  return (m[row.id] = d);
}

/* Optimizador: elige la receta con menor costo en recursos ponderado por escasez */
function optimizeChoices(unlocked) {
  const w = {};
  for (const k of RES) w[k] = k === 'Water' ? 0.02 : (MAP_LIMIT[k] ? 10000 / MAP_LIMIT[k] : 1);
  const cost = {};
  for (const i in ITEMS) cost[i] = RES.has(i) ? w[i] : (PRODUCERS[i] ? Infinity : 5);
  const best = {};
  for (let it = 0; it < 80; it++) {
    let changed = false;
    for (const r of D.recipes) {
      if (r.alt && !unlocked.has(r.id)) continue;
      if (r.m === 'Converter') continue;
      let c = 0; for (const [i, a] of r.in) c += a * cost[i];
      if (!isFinite(c)) continue;
      // repartir costo entre productos según puntos de sumidero (aprox. valor)
      const outs = r.out;
      const val = outs.map(([i, a]) => a * Math.max(1, ITEMS[i][3] || 1));
      const tot = val.reduce((s, v) => s + v, 0);
      outs.forEach(([i, a], k) => {
        if (RES.has(i)) return;
        const ci = c * (val[k] / tot) / a + 1e-6 * machinePower(r) / perMin(r, a);
        if (ci < cost[i] - 1e-9) { cost[i] = ci; best[i] = r.id; changed = true; }
      });
    }
    if (!changed) break;
  }
  return best;
}

/* ===== Simulador del Taller ===== */
const NODE_KINDS = {
  machine: {}, extractor: {}, source: {}, splitter: {}, merger: {}, storage: {}, sink: {}
};
function nodePorts(n) {
  // devuelve {ins:[{k,item|null}], outs:[{k,item|null}]}
  if (n.kind === 'machine') {
    const r = REC[n.recipe];
    if (!r) return { ins: [], outs: [] };
    return { ins: r.in.map(([i], k) => ({ k, item: i })), outs: r.out.map(([i], k) => ({ k, item: i })) };
  }
  if (n.kind === 'extractor') return { ins: [], outs: [{ k: 0, item: n.item }] };
  if (n.kind === 'source') return { ins: [], outs: [{ k: 0, item: n.item }] };
  if (n.kind === 'splitter') return { ins: [{ k: 0, item: null }], outs: [0, 1, 2].map(k => ({ k, item: null })) };
  if (n.kind === 'merger') return { ins: [0, 1, 2].map(k => ({ k, item: null })), outs: [{ k: 0, item: null }] };
  if (n.kind === 'storage') return { ins: [0, 1].map(k => ({ k, item: null })), outs: [] };
  if (n.kind === 'sink') return { ins: [{ k: 0, item: null }], outs: [] };
  return { ins: [], outs: [] };
}
function edgeCap(e, item) {
  const liq = isLiq(item);
  const tiers = liq ? PIPES : BELTS;
  const t = Math.min(e.tier || (liq ? 2 : 3), tiers.length);
  return tiers[t - 1] * (e.lanes || 1);
}
function waterFill(total, caps) {
  const out = caps.map(() => 0); let left = total;
  let idx = caps.map((c, k) => k).filter(k => caps[k] > 1e-12);
  while (left > 1e-12 && idx.length) {
    const share = left / idx.length; const next = [];
    for (const k of idx) {
      const room = caps[k] - out[k]; const g = Math.min(room, share);
      out[k] += g; left -= g; if (caps[k] - out[k] > 1e-12) next.push(k);
    }
    if (next.length === idx.length && share <= 1e-12) break;
    idx = next;
  }
  return out;
}
/* Propaga qué objeto lleva cada cinta (para divisores/fusionadores) */
function edgeItems(build) {
  const nodes = Object.fromEntries(build.nodes.map(n => [n.id, n]));
  const item = {};
  const portItem = (n, side, k) => { const p = nodePorts(n)[side][k]; return p ? p.item : null; };
  for (let pass = 0; pass < 30; pass++) {
    let ch = false;
    for (const e of build.edges) {
      if (item[e.id]) continue;
      const a = nodes[e.from], b = nodes[e.to]; if (!a || !b) continue;
      let it = portItem(a, 'outs', e.fp) || portItem(b, 'ins', e.tp);
      if (!it && (a.kind === 'splitter' || a.kind === 'merger')) {
        const inc = build.edges.find(x => x.to === a.id && item[x.id]); if (inc) it = item[inc.id];
      }
      if (!it && (b.kind === 'splitter' || b.kind === 'merger')) {
        const og = build.edges.find(x => x.from === b.id && item[x.id]); if (og) it = item[og.id];
      }
      if (it) { item[e.id] = it; ch = true; }
    }
    if (!ch) break;
  }
  return item;
}
function extractorRate(n) {
  const ex = EXTRACTORS[n.ex]; if (!ex) return 0;
  const pur = ex.nopurity ? 1 : (+n.purity || 1);
  return ex.rate * pur * (+n.clock || 100) / 100 * (+n.count || 1);
}
function simulate(build) {
  const nodes = build.nodes, edges = build.edges;
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const eItem = edgeItems(build);
  const inE = {}, outE = {};
  nodes.forEach(n => { inE[n.id] = []; outE[n.id] = []; });
  edges.forEach(e => { if (byId[e.from] && byId[e.to]) { outE[e.from].push(e); inE[e.to].push(e); } });
  const cap = {}; edges.forEach(e => cap[e.id] = eItem[e.id] ? edgeCap(e, eItem[e.id]) : 0);
  const offer = {}, demand = {};
  edges.forEach(e => { offer[e.id] = 0; demand[e.id] = cap[e.id]; });
  const st = {};
  const portEdges = (list, key, k) => list.filter(e => e[key] === k);
  const order = topoOrder(nodes, edges);
  for (let it = 0; it < 120; it++) {
    let delta = 0;
    // pase hacia adelante
    for (const n of order) {
      const outs = outE[n.id], ins = inE[n.id];
      const setOffers = (list, total) => {
        const caps = list.map(e => Math.min(cap[e.id], demand[e.id]));
        const a = waterFill(total, caps);
        list.forEach((e, k) => { delta = Math.max(delta, Math.abs(offer[e.id] - a[k])); offer[e.id] = a[k]; });
        return a.reduce((s, v) => s + v, 0);
      };
      if (n.kind === 'source') { const sent = setOffers(outs, +n.rate || 0); st[n.id] = { rate: sent, max: +n.rate || 0 }; }
      else if (n.kind === 'extractor') { const mx = extractorRate(n); const sent = setOffers(outs, mx); st[n.id] = { rate: sent, max: mx }; }
      else if (n.kind === 'splitter' || n.kind === 'merger') {
        const S = ins.reduce((s, e) => s + offer[e.id], 0); const sent = setOffers(outs, S); st[n.id] = { rate: sent, max: S };
      } else if (n.kind === 'storage' || n.kind === 'sink') {
        st[n.id] = { rate: ins.reduce((s, e) => s + offer[e.id], 0) };
      } else if (n.kind === 'machine') {
        const r = REC[n.recipe]; if (!r) { st[n.id] = { rate: 0, max: 0 }; continue; }
        const mach = MACH[r.m]; const slots = mach.s; const am = slots ? 1 + Math.min(+n.sloop || 0, slots) / slots : 1;
        const cyc = 60 / r.t * (+n.clock || 100) / 100 * (+n.count || 1); // ciclos/min máximos
        let inLim = Infinity, outLim = Infinity, inR = null, outR = null;
        r.in.forEach(([i, a], k) => {
          const s = portEdges(ins, 'tp', k).reduce((t, e) => t + offer[e.id], 0);
          const lim = s / a; if (lim < inLim) { inLim = lim; inR = { t: 'in', item: i, none: !portEdges(ins, 'tp', k).length }; }
        });
        r.out.forEach(([i, a], k) => {
          const list = portEdges(outs, 'fp', k);
          const c = list.reduce((t, e) => t + Math.min(cap[e.id], demand[e.id]), 0);
          const lim = c / (a * am); if (lim < outLim) { outLim = lim; outR = { t: 'out', item: i, none: !list.length }; }
        });
        let rate = Math.max(0, Math.min(cyc, inLim, outLim)), reason = null;
        if (outLim < cyc - 1e-9 && outLim <= inLim + 1e-9) reason = outR;
        else if (inLim < cyc - 1e-9) reason = inR;
        r.out.forEach(([i, a], k) => setOffers(portEdges(outs, 'fp', k), rate * a * am));
        st[n.id] = { rate, max: cyc, reason, am };
      }
    }
    // pase hacia atrás (demanda)
    for (let k2 = order.length - 1; k2 >= 0; k2--) {
      const n = order[k2]; const ins = inE[n.id], outs = outE[n.id];
      const setDemand = (list, total) => {
        const caps = list.map(e => cap[e.id]);
        // repartir según lo ofrecido primero, luego lo que sobre
        const a = waterFill(total, list.map(e => Math.min(cap[e.id], Math.max(offer[e.id], 1e-9))));
        let left = total - a.reduce((s, v) => s + v, 0);
        const extra = waterFill(left, caps.map((c, k) => c - a[k]));
        list.forEach((e, k) => { const v = a[k] + extra[k]; delta = Math.max(delta, Math.abs(demand[e.id] - v)); demand[e.id] = v; });
      };
      if (n.kind === 'storage' || n.kind === 'sink') ins.forEach(e => { delta = Math.max(delta, Math.abs(demand[e.id] - cap[e.id])); demand[e.id] = cap[e.id]; });
      else if (n.kind === 'splitter' || n.kind === 'merger') setDemand(ins, outs.reduce((s, e) => s + Math.min(cap[e.id], demand[e.id]), 0));
      else if (n.kind === 'machine') {
        const r = REC[n.recipe]; if (!r) continue;
        const slots = MACH[r.m].s; const am = slots ? 1 + Math.min(+n.sloop || 0, slots) / slots : 1;
        let mx = 60 / r.t * (+n.clock || 100) / 100 * (+n.count || 1);
        r.out.forEach(([i, a], k) => {
          const c = portEdges(outs, 'fp', k).reduce((t, e) => t + Math.min(cap[e.id], demand[e.id]), 0);
          mx = Math.min(mx, c / (a * am));
        });
        r.in.forEach(([i, a], k) => setDemand(portEdges(ins, 'tp', k), Math.max(0, mx) * a));
      }
    }
    if (delta < 1e-9) break;
  }
  // resultados
  const flow = {}; edges.forEach(e => flow[e.id] = offer[e.id] || 0);
  const received = {}, consumedSrc = {}, issues = [];
  let power = 0, powerMax = 0, machines = 0, points = 0;
  for (const n of nodes) {
    const s = st[n.id] || { rate: 0 };
    if (n.kind === 'storage' || n.kind === 'sink') {
      for (const e of inE[n.id]) { const it = eItem[e.id]; if (!it) continue; received[it] = (received[it] || 0) + flow[e.id]; if (n.kind === 'sink' && !isLiq(it)) points += flow[e.id] * (ITEMS[it][3] || 0); }
    }
    if (n.kind === 'source' || n.kind === 'extractor') {
      const it = n.item; if (it) consumedSrc[it] = (consumedSrc[it] || 0) + s.rate;
      if (n.kind === 'extractor') {
        const ex = EXTRACTORS[n.ex]; const cnt = +n.count || 1;
        const pmax = cnt * clockPower(ex.p, +n.clock || 100, 1); powerMax += pmax; power += s.max ? pmax * s.rate / s.max : 0;
        machines += cnt;
        if (!outE[n.id].length) issues.push({ node: n.id, t: 'noout' });
      }
    }
    if (n.kind === 'machine') {
      const r = REC[n.recipe]; if (!r) { issues.push({ node: n.id, t: 'norecipe' }); continue; }
      const cnt = +n.count || 1; machines += cnt;
      const pmax = cnt * clockPower(machinePower(r), +n.clock || 100, s.am || 1);
      powerMax += pmax; power += s.max ? pmax * s.rate / s.max : 0;
      if (s.max && s.rate < s.max * 0.995) issues.push({ node: n.id, t: s.reason?.t || 'in', item: s.reason?.item, none: s.reason?.none, eff: s.rate / s.max });
    }
  }
  for (const e of edges) {
    const it = eItem[e.id]; if (!it) continue;
    if (cap[e.id] > 0 && flow[e.id] >= cap[e.id] - 1e-6) {
      // solo es problema si la cinta llena frena a alguien
      const a = byId[e.from], b = byId[e.to], sa = st[e.from], sb = st[e.to];
      const starved = b && b.kind === 'machine' && sb?.reason?.t === 'in' && sb.reason.item === it;
      const blocked = a && a.kind === 'machine' && sa?.reason?.t === 'out' && sa.reason.item === it;
      if (starved || blocked) issues.push({ edge: e.id, t: 'belt' });
    }
  }
  return { st, flow, cap, eItem, received, consumedSrc, power, powerMax, machines, points, issues };
}
function topoOrder(nodes, edges) {
  const indeg = {}; const adj = {};
  nodes.forEach(n => { indeg[n.id] = 0; adj[n.id] = []; });
  edges.forEach(e => { if (adj[e.from] && e.to in indeg) { adj[e.from].push(e.to); indeg[e.to]++; } });
  const q = nodes.filter(n => indeg[n.id] === 0).map(n => n.id); const out = []; const seen = new Set();
  while (q.length) { const id = q.shift(); if (seen.has(id)) continue; seen.add(id); out.push(id); for (const t of adj[id]) if (--indeg[t] <= 0) q.push(t); }
  nodes.forEach(n => { if (!seen.has(n.id)) out.push(n.id); }); // ciclos
  const by = Object.fromEntries(nodes.map(n => [n.id, n]));
  return out.map(id => by[id]);
}
