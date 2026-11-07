// Adres van de API (zie instellingen.js)
const API = window.KK_API || 'api.php';
const apiUrl = q => API + (API.includes('?') ? '&' : '?') + q;

// Gedeelde hulpfuncties voor de leden- en beheerpagina
const SOORTEN = ['Repetitie','Extra repetitie','Optreden','Onder voorbehoud','Vergadering','Vakantie','Overig'];
const VOORRANG = ['Onder voorbehoud','Optreden','Vergadering','Extra repetitie','Overig','Repetitie','Vakantie'];
const MAANDEN = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
const MND = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
const DAGEN = ['zo','ma','di','wo','do','vr','za'];
const LABEL = {'Vakantie':'Vakantie (geen repetitie)','Onder voorbehoud':'Onder voorbehoud (nog niet zeker)'};

const naarDatum = s => { const [j,m,d] = s.split('-').map(Number); return new Date(j, m-1, d); };
const naarIso = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
const vandaagIso = () => naarIso(new Date());
const kort = s => { const d = naarDatum(s); return DAGEN[d.getDay()] + ' ' + d.getDate() + ' ' + MND[d.getMonth()]; };
const soortKlasse = s => 's-' + s.replace(/\s+/g, '-');
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

function itemRij(it, extra) {
  const d = naarDatum(it.datum);
  return el('div', {class: 'item' + (eind(it) < vandaagIso() ? ' voorbij' : '')},
    el('div', {class: 'dag'}, el('span', {}, DAGEN[d.getDay()]), el('b', {}, String(d.getDate())), el('span', {}, MND[d.getMonth()])),
    el('div', {class: 'info'},
      el('div', {class: 'titel'}, it.titel),
      metaTekst(it) ? el('div', {class: 'meta'}, metaTekst(it)) : null,
      el('span', {class: 'chip ' + soortKlasse(it.soort)}, it.soort)),
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
  return it.soort === 'Repetitie' && items.some(v => v.soort === 'Vakantie' && v.datum <= it.datum && eind(v) >= it.datum);
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

// Lijst per maand; wat al voorbij is komt in een ingeklapt blok "Geweest" bovenaan
function maandLijst(items, rij, jaar) {
  const blokken = lijst => {
    const uit = []; let maand = null, kaart = null;
    for (const it of lijst) {
      const d = naarDatum(it.datum), mk = it.datum.slice(0, 7);
      if (mk !== maand) { maand = mk; uit.push(el('h2', {class: 'maand'}, MAANDEN[d.getMonth()] + (d.getFullYear() !== jaar ? ' ' + d.getFullYear() : ''))); kaart = el('div', {class: 'kaart'}); uit.push(kaart); }
      kaart.append(rij(it));
    }
    return uit;
  };
  const nu = vandaagIso(), geweest = items.filter(i => eind(i) < nu), komend = items.filter(i => eind(i) >= nu);
  const delen = [];
  if (geweest.length) delen.push(el('details', {class: 'geweest'}, el('summary', {}, 'Geweest (' + geweest.length + ')'), blokken(geweest)));
  return delen.concat(blokken(komend));
}
