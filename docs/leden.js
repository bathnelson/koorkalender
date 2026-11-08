let ITEMS = [], JAAR = new Date().getFullYear(), TAB = 'binnenkort', FILTER = null, GEKOZEN = null, MAAND = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
const inhoud = document.getElementById('inhoud');

function binnenkort() {
  const v = vandaagIso();
  const komend = ITEMS.filter(i => eind(i) >= v).slice(0, 12);
  const kaart = el('div', {class: 'kaart'}, komend.length ? komend.map(i => itemRij(i)) : el('p', {class: 'leeg'}, 'Er staan geen activiteiten meer gepland.'));
  const opt = ITEMS.find(i => eind(i) >= v && (isRol(i.soort, 'hoogtepunt') || isRol(i.soort, 'voorbehoud')));
  return [opt ? el('p', {class: 'meta', style: 'margin:0 4px 10px'}, 'Eerstvolgende ' + (metRol('hoogtepunt') || 'activiteit').toLowerCase() + ': ', el('b', {}, opt.titel + ' (' + kort(opt.datum) + ')')) : null, kaart];
}

function dagDetail() {
  if (!GEKOZEN) return [];
  const lijst = opDag(ITEMS, GEKOZEN);
  return [el('div', {id: 'dagdetail', class: 'kaart', role: 'region', 'aria-label': 'Details ' + kort(GEKOZEN)},
    el('button', {class: 'sluit', onclick: () => { const y = scrollY; GEKOZEN = null; teken(); scrollTo(0, y); }}, 'Sluiten'),
    lijst.length ? lijst.map(i => itemRij(i)) : el('p', {class: 'leeg'}, kort(GEKOZEN) + ': niets gepland.')), el('div', {class: 'ruimte'})];
}

function maand() {
  const J = MAAND.getFullYear(), m = MAAND.getMonth(), v = vandaagIso();
  const ga = n => { MAAND = new Date(J, m + n, 1); GEKOZEN = null; teken(); };
  const kop = el('div', {class: 'maandkop'},
    el('button', {onclick: () => ga(-1), 'aria-label': 'Vorige maand'}, '‹'),
    el('h2', {'aria-live': 'polite'}, MAANDEN[m] + ' ' + J),
    el('button', {onclick: () => ga(1), 'aria-label': 'Volgende maand'}, '›'));
  const nu = new Date();
  const naarNu = (J !== nu.getFullYear() || m !== nu.getMonth()) ? el('button', {class: 'naarnu', onclick: () => { MAAND = new Date(nu.getFullYear(), nu.getMonth(), 1); GEKOZEN = null; teken(); }}, 'Naar deze maand') : null;
  const eerste = new Date(J, m, 1), start = (eerste.getDay() + 6) % 7, dagen = new Date(J, m + 1, 0).getDate();
  const tbody = el('tbody'); let rij = el('tr');
  for (let k = 0; k < start; k++) rij.append(el('td'));
  for (let d = 1; d <= dagen; d++) {
    const iso = naarIso(new Date(J, m, d)), lijst = opDag(ITEMS, iso);
    const vak = lijst.some(i => isRol(i.soort, 'vakantie'));
    const chips = lijst.filter(i => !isRol(i.soort, 'vakantie')).slice(0, 3).map(i => el('span', {class: 'chipje ' + soortKlasse(i.soort)}, i.titel.replace(/^Wereldshot: /, '')));
    rij.append(el('td', {}, el('button', {
      class: [vak ? soortKlasse(metRol('vakantie')) : '', iso === v ? 'vandaag' : '', iso < v ? 'voorbij' : ''].join(' '),
      'aria-pressed': GEKOZEN === iso ? 'true' : 'false',
      'aria-label': kort(iso) + (lijst.length ? ': ' + lijst.map(i => i.titel).join(', ') : ''),
      onclick: () => { const y = scrollY; GEKOZEN = iso; teken(); scrollTo(0, y); }
    }, el('span', {class: 'nr'}, String(d)), chips)));
    if ((start + d) % 7 === 0) { tbody.append(rij); rij = el('tr'); }
  }
  if (rij.children.length) tbody.append(rij);
  const tabel = el('table', {class: 'groot'}, el('thead', {}, el('tr', {}, ['ma','di','wo','do','vr','za','zo'].map(x => el('th', {}, x)))), tbody);
  // Vegen naar links/rechts op de telefoon
  let sx = null, sy = null;
  tabel.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, {passive: true});
  tabel.addEventListener('touchend', e => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) ga(dx < 0 ? 1 : -1);
  });
  const van = naarIso(eerste), tot = naarIso(new Date(J, m, dagen));
  const inMaand = ITEMS.filter(i => i.datum <= tot && eind(i) >= van && !isRol(i.soort, 'wekelijks'));
  return [kop, naarNu, el('div', {class: 'kaart', style: 'padding:6px'}, tabel), legenda(),
    el('h2', {class: 'maand', style: 'text-transform:none'}, 'Bijzonderheden in ' + MAANDEN[m]),
    el('div', {class: 'kaart'}, inMaand.length ? inMaand.map(i => itemRij(i)) : el('p', {class: 'leeg'}, 'Alleen de gewone ' + meervoud(WEKELIJKS()) + '.')),
    ...dagDetail()];
}

function jaar() {
  const v = vandaagIso();
  const raster = el('div', {class: 'jaar'});
  const nu = new Date();
  for (let n = 0; n < 12; n++) {
    const eerste = new Date(nu.getFullYear(), nu.getMonth() + n, 1), J = eerste.getFullYear(), m = eerste.getMonth();
    const start = (eerste.getDay() + 6) % 7, dagen = new Date(J, m + 1, 0).getDate();
    const tbody = el('tbody');
    let rij = el('tr');
    for (let k = 0; k < start; k++) rij.append(el('td'));
    for (let d = 1; d <= dagen; d++) {
      const iso = naarIso(new Date(J, m, d)), lijst = opDag(ITEMS, iso), s = hoofdSoort(lijst);
      const knop = el('button', {
        class: [s ? soortKlasse(s) : '', s && !isRol(s, 'vakantie') ? 'heeft' : '', iso === v ? 'vandaag' : ''].join(' '),
        'aria-label': kort(iso) + (lijst.length ? ': ' + lijst.map(i => i.titel).join(', ') : ''),
        'aria-pressed': GEKOZEN === iso ? 'true' : 'false',
        onclick: () => { const y = scrollY; GEKOZEN = iso; teken(); scrollTo(0, y); }
      }, String(d));
      rij.append(el('td', {}, knop));
      if ((start + d) % 7 === 0) { tbody.append(rij); rij = el('tr'); }
    }
    if (rij.children.length) tbody.append(rij);
    raster.append(el('section', {class: 'kaart mini' + (n === 0 ? ' deze-maand' : ''), 'aria-current': n === 0 ? 'date' : false}, el('h3', {}, el('button', {class: 'maandknop', title: 'Open ' + MAANDEN[m] + ' in de maandweergave', onclick: () => { MAAND = new Date(J, m, 1); TAB = 'maand'; GEKOZEN = null; teken(); scrollTo(0, 0); }}, MAANDEN[m] + ' ' + J + ' ›')),
      el('table', {}, el('thead', {}, el('tr', {}, ['ma','di','wo','do','vr','za','zo'].map(d => el('th', {}, d)))), tbody)));
  }
  return [el('div', {style: 'display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:0 4px 10px'},
      el('p', {class: 'meta', style: 'margin:0'}, 'De komende 12 maanden. Tik op een dag voor de details, of op de naam van een maand om die maand te openen.'),
      el('a', {class: 'knoplink', href: 'afdrukken.html'}, 'Afdrukken')), legenda(), raster, ...dagDetail()];
}

function lijst() {
  if (!FILTER) FILTER = new Set(SOORTEN.filter(s => !isRol(s, 'wekelijks')));
  const filters = el('div', {class: 'filters'}, SOORTEN.map(s => el('button', {
    class: soortKlasse(s), 'aria-pressed': FILTER.has(s) ? 'true' : 'false',
    onclick: () => { FILTER.has(s) ? FILTER.delete(s) : FILTER.add(s); teken(); }
  }, s)));
  const inJaar = ITEMS.filter(i => FILTER.has(i.soort));
  const delen = [filters, ...maandLijst(inJaar, it => itemRij(it))];
  if (!inJaar.length) delen.push(el('p', {class: 'leeg'}, 'Geen activiteiten gevonden.'));
  return delen;
}

function teken() {
  for (const t of ['binnenkort', 'maand', 'jaar', 'lijst']) document.getElementById('tab-' + t).setAttribute('aria-selected', String(t === TAB));
  inhoud.replaceChildren(...[].concat(TAB === 'binnenkort' ? binnenkort() : TAB === 'maand' ? maand() : TAB === 'jaar' ? jaar() : lijst()).filter(Boolean));
  try { localStorage.setItem('kk-tab', TAB); } catch (e) {}
}

for (const t of ['binnenkort', 'maand', 'jaar', 'lijst']) document.getElementById('tab-' + t).onclick = () => { TAB = t; GEKOZEN = null; teken(); };
try { TAB = localStorage.getItem('kk-tab') || TAB; } catch (e) {}


let NAAM_KOOR = '';
function zetAbonnement(sleutel) {
  const https = new URL(apiUrl('actie=ics&sleutel=' + sleutel), location.href).href, webcal = https.replace(/^https?:/, 'webcal:');
  document.getElementById('abo-webcal').href = webcal;
  document.getElementById('abo-google').href = 'https://calendar.google.com/calendar/render?cid=' + encodeURIComponent(webcal);
  document.getElementById('abo-kopie').onclick = async () => {
    const m = document.getElementById('abo-melding');
    try { await navigator.clipboard.writeText(https); m.textContent = 'Link gekopieerd. Plak hem in je agenda-app bij "abonnement", "agenda via URL" of "abonneren via internet".'; }
    catch (e) { m.textContent = https; }
    m.classList.remove('verborgen');
  };
  const knop = document.getElementById('abonneer');
  knop.classList.remove('verborgen');
  knop.onclick = () => document.getElementById('dlg-abo').showModal();
}
function start() {
  haalLijst().then(d => {
  ITEMS = zichtbaar(d.items || []);
  NAAM_KOOR = d.naam || '';
  if (!FILTER) FILTER = new Set(SOORTEN.filter(s => !isRol(s, 'wekelijks')));
  if (d.ics) zetAbonnement(d.ics);
  if (d.naam) { document.getElementById('naam').textContent = 'Jaarplanning ' + d.naam; document.title = 'Jaarplanning ' + d.naam; }
  teken();
}).catch(e => e.afgeschermd ? vraagLedencode(inhoud, start) : inhoud.replaceChildren(el('p', {class: 'melding'}, 'De planning kon niet geladen worden. Probeer het later opnieuw.')));
}
start();
