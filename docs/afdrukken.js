let ALLES = [], NAAM = '';
const $ = id => document.getElementById(id);

function periodes() {
  const nu = new Date(), opties = [{label: 'Komende 12 maanden', start: new Date(nu.getFullYear(), nu.getMonth(), 1)}];
  for (const j of jarenVan(ALLES)) opties.push({label: 'Kalenderjaar ' + j, start: new Date(j, 0, 1)});
  return opties;
}

function maandTabel(J, m, items) {
  const eerste = new Date(J, m, 1), start = (eerste.getDay() + 6) % 7, dagen = new Date(J, m + 1, 0).getDate();
  const tbody = el('tbody'); let rij = el('tr');
  for (let k = 0; k < start; k++) rij.append(el('td', {class: 'leegvak'}));
  for (let d = 1; d <= dagen; d++) {
    const iso = naarIso(new Date(J, m, d)), s = hoofdSoort(opDag(items, iso));
    rij.append(el('td', {class: (s ? soortKlasse(s) : '') + (s && s !== 'Vakantie' ? ' heeft' : '')}, String(d)));
    if ((start + d) % 7 === 0) { tbody.append(rij); rij = el('tr'); }
  }
  if (rij.children.length) { while (rij.children.length < 7) rij.append(el('td', {class: 'leegvak'})); tbody.append(rij); }
  return el('div', {class: 'maand'}, el('h2', {}, MAANDEN[m] + ' ' + J),
    el('table', {}, el('thead', {}, el('tr', {}, ['ma','di','wo','do','vr','za','zo'].map(x => el('th', {}, x)))), tbody));
}

// Meest voorkomende tijd/plaats van de gewone repetities, voor één regel onder het overzicht
function vasteRepetitie(items) {
  const reps = items.filter(i => i.soort === 'Repetitie');
  if (!reps.length) return null;
  const tel = {};
  for (const r of reps) { const k = DAGEN[naarDatum(r.datum).getDay()] + '|' + r.tijd + '|' + r.waar; tel[k] = (tel[k] || 0) + 1; }
  const [dag, tijd, waar] = Object.entries(tel).sort((a, b) => b[1] - a[1])[0][0].split('|');
  const naam = {ma:'maandag',di:'dinsdag',wo:'woensdag',do:'donderdag',vr:'vrijdag',za:'zaterdag',zo:'zondag'}[dag];
  return 'Gewone repetities: ' + naam + 'avond' + (tijd ? ' ' + tijd.replace('-', '–') + ' uur' : '') + (waar ? ', ' + waar : '') + '. In vakanties is er geen repetitie.';
}

function teken() {
  const p = periodes()[Number($('periode').value) || 0];
  const van = naarIso(p.start), totDatum = new Date(p.start.getFullYear(), p.start.getMonth() + 12, 0), tot = naarIso(totDatum);
  const items = zichtbaar(ALLES).filter(i => eind(i) >= van && i.datum <= tot);
  const titel = 'Jaarplanning ' + NAAM;
  const sub = MAANDEN[p.start.getMonth()] + ' ' + p.start.getFullYear() + ' t/m ' + MAANDEN[totDatum.getMonth()] + ' ' + totDatum.getFullYear() + ' · bijgewerkt ' + kort(vandaagIso());

  const raster = el('div', {class: 'raster'});
  for (let n = 0; n < 12; n++) { const d = new Date(p.start.getFullYear(), p.start.getMonth() + n, 1); raster.append(maandTabel(d.getFullYear(), d.getMonth(), items)); }
  const vast = vasteRepetitie(items);
  const blad1 = el('section', {class: 'blad'}, el('h1', {}, titel), el('p', {class: 'sub'}, sub), raster, legenda(), vast ? el('p', {class: 'vast'}, vast) : null);

  const lijst = items.filter(i => i.soort !== 'Repetitie');
  const tbody = el('tbody'); let maand = null;
  for (const it of lijst) {
    const d = naarDatum(it.datum), mk = d.getFullYear() * 12 + d.getMonth();
    if (mk !== maand) { maand = mk; tbody.append(el('tr', {class: 'kop'}, el('td', {colspan: 5}, MAANDEN[d.getMonth()] + ' ' + d.getFullYear()))); }
    const wanneer = kort(it.datum) + (it.tm ? ' t/m ' + kort(it.tm) : '');
    tbody.append(el('tr', {},
      el('td', {class: 'kleur ' + soortKlasse(it.soort)}),
      el('td', {class: 'nowrap'}, wanneer),
      el('td', {class: 'nowrap'}, it.tijd ? it.tijd.replace('-', '–') : ''),
      el('td', {}, el('b', {}, it.titel), it.soort === 'Onder voorbehoud' ? ' (onder voorbehoud)' : ''),
      el('td', {}, [it.waar, it.opmerking].filter(Boolean).join(' · '))));
  }
  const blad2 = el('section', {class: 'blad'}, el('h1', {}, 'Activiteiten'), el('p', {class: 'sub'}, sub + ' · wekelijkse repetities staan alleen in het jaaroverzicht'),
    lijst.length ? el('table', {class: 'lijst'}, el('thead', {}, el('tr', {}, el('th', {}), el('th', {}, 'Wanneer'), el('th', {}, 'Tijd'), el('th', {}, 'Wat'), el('th', {}, 'Waar / opmerking'))), tbody)
                 : el('p', {}, 'Geen activiteiten in deze periode.'));
  $('bladen').replaceChildren(blad1, blad2);
}

fetch(apiUrl('actie=lijst'), {cache: 'no-store'}).then(r => r.json()).then(d => {
  ALLES = d.items || []; NAAM = d.naam || '';
  document.title = 'Jaarplanning ' + NAAM + ' afdrukken';
  $('periode').replaceChildren(...periodes().map((p, i) => el('option', {value: i}, p.label)));
  teken();
}).catch(() => $('bladen').replaceChildren(el('p', {class: 'melding'}, 'De planning kon niet geladen worden.')));
$('periode').onchange = teken;
