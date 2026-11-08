// Adres van de API (zie instellingen.js)
const API = window.KK_API || 'api.php';
const apiUrl = q => API + (API.includes('?') ? '&' : '?') + q;

// Gedeelde hulpfuncties voor de leden- en beheerpagina
const MAANDEN = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
const MND = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
const DAGEN = ['zo','ma','di','wo','do','vr','za'];

// ---------- soorten activiteiten (komen van de server; standaard die van een koor) ----------
// Rollen: wekelijks (vervalt in vakanties), hoogtepunt (eerstvolgende, programma), voorbehoud, vakantie
const STANDAARD_SOORTEN = [{naam:'Repetitie',kleur:'#cfe0f3',rol:'wekelijks'},{naam:'Extra repetitie',kleur:'#8fd3cf',rol:''},{naam:'Optreden',kleur:'#f4a6a0',rol:'hoogtepunt'},
  {naam:'Onder voorbehoud',kleur:'#ffe45c',rol:'voorbehoud'},{naam:'Vergadering',kleur:'#c9b8e0',rol:''},{naam:'Vakantie',kleur:'#b7dd9a',rol:'vakantie'},{naam:'Overig',kleur:'#f8cbad',rol:''}];
let SOORTEN = [], VOORRANG = [], LABEL = {}, ROL = {}, KLEUR = {}, MEERVOUD = {}, PROGRAMMA = true;
const isRol = (s, rol) => ROL[s] === rol;
const metRol = rol => SOORTEN.find(s => ROL[s] === rol) || '';
const meervoud = s => MEERVOUD[s] || (/e$/i.test(s) ? s + 's' : s + 'en');
const WEKELIJKS = () => (metRol('wekelijks') || 'activiteit').toLowerCase();
function zetSoorten(defs, programma) {
  if (!Array.isArray(defs) || !defs.length || typeof defs[0] !== 'object') defs = STANDAARD_SOORTEN;
  if (programma !== undefined) PROGRAMMA = programma !== false;
  SOORTEN = defs.map(d => d.naam); ROL = {}; KLEUR = {}; MEERVOUD = {}; LABEL = {};
  for (const d of defs) { ROL[d.naam] = d.rol || ''; KLEUR[d.naam] = d.kleur; if (d.meervoud) MEERVOUD[d.naam] = d.meervoud; }
  const metR = r => SOORTEN.filter(s => ROL[s] === r);
  VOORRANG = [...metR('voorbehoud'), ...metR('hoogtepunt'), ...metR(''), ...metR('wekelijks'), ...metR('vakantie')];
  const w = metRol('wekelijks');
  for (const s of metR('vakantie')) LABEL[s] = s + (w ? ' (geen ' + w.toLowerCase() + ')' : '');
  for (const s of metR('voorbehoud')) LABEL[s] = /zeker/i.test(s) ? s : s + ' (nog niet zeker)';
  // Eigen soorten krijgen hun kleur via een stijlblok; de standaardsoorten hebben hun kleuren al in stijl.css
  const eigen = JSON.stringify(defs.map(d => [d.naam, d.kleur])) !== JSON.stringify(STANDAARD_SOORTEN.map(d => [d.naam, d.kleur]));
  let st = document.getElementById('soortkleuren');
  if (!eigen) { if (st) st.remove(); return; }
  if (!st) { st = document.createElement('style'); st.id = 'soortkleuren'; document.head.append(st); }
  const donker = pre => defs.map(d => pre + '.' + soortKlasse(d.naam) + '{background:color-mix(in srgb,' + d.kleur + ' 45%,#1b1b1b)}').join(' ');
  const sel = (k, rol) => ['.' + k, '.mini td button.' + k, '.maand td.' + k, 'table.klassiek td.' + k].concat(rol === 'vakantie' ? ['.groot td button.' + k] : []).join(',');
  st.textContent = defs.map(d => sel(soortKlasse(d.naam), d.rol) + '{background:' + d.kleur + '}').join('\n') +
    '\n@media (prefers-color-scheme:dark){' + donker(':root:not([data-theme="light"]):not(.licht) ') + '}\n' + donker(':root[data-theme="dark"] ');
}
zetSoorten(STANDAARD_SOORTEN);

const naarDatum = s => { const [j,m,d] = s.split('-').map(Number); return new Date(j, m-1, d); };
const naarIso = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
const vandaagIso = () => naarIso(new Date());
const kort = s => { const d = naarDatum(s); return DAGEN[d.getDay()] + ' ' + d.getDate() + ' ' + MND[d.getMonth()]; };
const soortKlasse = s => 's-' + s.replace(/[^A-Za-z0-9_-]+/g, '-');
const eind = it => it.tm || it.datum;

function el(tag, attrs, ...kinderen) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kinderen.flat()) if (k != null && k !== false) e.append(k);
  return e;
}

function opDag(items, iso) { return items.filter(it => it.datum <= iso && eind(it) >= iso); }
function hoofdSoort(lijst) { for (const s of VOORRANG) if (lijst.some(i => i.soort === s)) return s; return null; }

function metaTekst(it) {
  const delen = [];
  if (it.tm) delen.push('t/m ' + kort(it.tm));
  if (it.tijd) delen.push(it.tijd.replace('-', ' – ') + ' uur');
  if (it.waar) delen.push(it.waar);
  if (it.opmerking) delen.push(it.opmerking);
  return delen.join(' · ');
}

function programma(it) {
  const lijst = (it.liedjes || '').split('\n').filter(Boolean);
  if (!lijst.length) return null;
  return el('details', {class: 'programma'}, el('summary', {}, 'Programma (' + lijst.length + (lijst.length === 1 ? ' liedje)' : ' liedjes)')),
    el('ol', {}, lijst.map(l => el('li', {}, l))));
}
function itemRij(it, extra) {
  const d = naarDatum(it.datum);
  return el('div', {class: 'item' + (eind(it) < vandaagIso() ? ' voorbij' : '')},
    el('div', {class: 'dag'}, el('span', {}, DAGEN[d.getDay()]), el('b', {}, String(d.getDate())), el('span', {}, MND[d.getMonth()])),
    el('div', {class: 'info'},
      el('div', {class: 'titel'}, it.titel),
      metaTekst(it) ? el('div', {class: 'meta'}, metaTekst(it)) : null,
      el('span', {class: 'chip ' + soortKlasse(it.soort)}, it.soort),
      programma(it)),
    extra || null);
}

function legenda() {
  return el('div', {class: 'legenda', 'aria-label': 'Legenda'},
    SOORTEN.map(s => el('span', {}, el('i', {class: soortKlasse(s)}), LABEL[s] || s)));
}

function jarenVan(items) {
  const set = new Set(items.flatMap(i => [Number(i.datum.slice(0,4)), Number(eind(i).slice(0,4))]));
  set.add(new Date().getFullYear());
  return [...set].sort();
}

// Repetities die in een vakantie vallen, vervallen vanzelf
function vervalt(it, items) {
  return isRol(it.soort, 'wekelijks') && items.some(v => isRol(v.soort, 'vakantie') && v.datum <= it.datum && eind(v) >= it.datum);
}
function zichtbaar(items) { return items.filter(i => !vervalt(i, items)); }

// ---------- toegang voor leden ----------
// Komt iemand binnen via de geheime ledenlink (?k=...), dan onthoudt de browser de sleutel en verdwijnt hij uit de adresbalk.
let LEDEN = ''; try { LEDEN = localStorage.getItem('kk-leden') || ''; } catch (e) {}
(function () {
  const u = new URL(location.href), k = u.searchParams.get('k');
  if (!k) return;
  LEDEN = k; try { localStorage.setItem('kk-leden', k); } catch (e) {}
  u.searchParams.delete('k'); history.replaceState(null, '', u.pathname + u.search + u.hash);
})();

async function haalLijst() {
  const r = await fetch(apiUrl('actie=lijst'), {cache: 'no-store', headers: LEDEN ? {'X-Leden': LEDEN} : {}});
  const d = await r.json().catch(() => ({}));
  if (r.ok) zetSoorten(d.soorten, d.programma);
  if (r.status === 401 && d.afgeschermd) { const e = new Error(d.fout); e.afgeschermd = true; throw e; }
  if (!r.ok) throw new Error(d.fout || 'De planning kon niet geladen worden.');
  return d;
}

// Toont het invulveld voor de ledencode in 'doel' en roept 'verder' aan zodra de code klopt
function vraagLedencode(doel, verder) {
  const invoer = el('input', {type: 'text', autocomplete: 'off', autocapitalize: 'none', 'aria-label': 'Ledencode', required: true, style: 'flex:1 1 160px;width:auto'});
  const melding = el('p', {class: 'melding verborgen', role: 'alert'});
  const knop = el('button', {class: 'hoofd', type: 'submit'}, 'Open de kalender');
  const form = el('form', {class: 'kaart', style: 'padding:16px;max-width:460px'},
    el('h2', {style: 'margin:0 0 6px;font-size:1.1rem'}, 'Alleen voor leden'),
    el('p', {class: 'meta', style: 'margin:0 0 10px'}, 'Vul de ledencode in. Die vind je bij de link op de ledensite, of vraag hem aan de secretaris. Je hoeft dit maar één keer te doen.'),
    el('div', {class: 'balk'}, invoer, knop), melding);
  form.addEventListener('submit', async ev => {
    ev.preventDefault(); knop.disabled = true; melding.classList.add('verborgen');
    try {
      const r = await fetch(apiUrl('actie=ledencode'), {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code: invoer.value})});
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.fout || 'Er ging iets mis.');
      LEDEN = d.sleutel || ''; try { localStorage.setItem('kk-leden', LEDEN); } catch (e) {}
      verder();
    } catch (e) { melding.textContent = e.message; melding.classList.remove('verborgen'); knop.disabled = false; invoer.select(); }
  });
  doel.replaceChildren(form);
  invoer.focus();
}

// Lijst per maand. Wat voorbij is staat ingeklapt onder "Geweest".
// Zonder 'jaar' (ledenlijst): dit jaar staat open en latere jaren zijn ingeklapt. Met 'jaar' (beheer): alles van dat jaar open.
function maandLijst(items, rij, jaar) {
  const blokken = lijst => {
    const uit = []; let maand = null, kaart = null;
    for (const it of lijst) {
      const d = naarDatum(it.datum), mk = it.datum.slice(0, 7);
      if (mk !== maand) { maand = mk; uit.push(el('h2', {class: 'maand'}, MAANDEN[d.getMonth()] + (jaar && d.getFullYear() !== jaar ? ' ' + d.getFullYear() : ''))); kaart = el('div', {class: 'kaart'}); uit.push(kaart); }
      kaart.append(rij(it));
    }
    return uit;
  };
  const nu = vandaagIso(), ditJaar = Number(nu.slice(0, 4));
  const geweest = items.filter(i => eind(i) < nu), komend = items.filter(i => eind(i) >= nu);
  const delen = [];
  if (geweest.length) delen.push(el('details', {class: 'geweest'}, el('summary', {}, 'Geweest (' + geweest.length + ')'), blokken(geweest)));
  if (jaar) return delen.concat(blokken(komend));
  const jaren = [...new Set(komend.map(i => Math.max(ditJaar, Number(i.datum.slice(0, 4)))))].sort();
  for (const j of jaren) {
    const inJ = komend.filter(i => Math.max(ditJaar, Number(i.datum.slice(0, 4))) === j);
    if (j === ditJaar) delen.push(el('h2', {class: 'jaarkop'}, String(j)), ...blokken(inJ));
    else delen.push(el('details', {class: 'geweest jaar'}, el('summary', {}, String(j) + ' (' + inJ.length + ')'), blokken(inJ)));
  }
  return delen;
}
