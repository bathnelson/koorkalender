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

function gekozen() {
  const p = periodes()[Number($('periode').value) || 0];
  const van = naarIso(p.start), totDatum = new Date(p.start.getFullYear(), p.start.getMonth() + 12, 0), tot = naarIso(totDatum);
  const items = zichtbaar(ALLES).filter(i => eind(i) >= van && i.datum <= tot);
  const sub = MAANDEN[p.start.getMonth()] + ' ' + p.start.getFullYear() + ' t/m ' + MAANDEN[totDatum.getMonth()] + ' ' + totDatum.getFullYear() + ' · bijgewerkt ' + kort(vandaagIso());
  const maanden = Array.from({length: 12}, (_, n) => new Date(p.start.getFullYear(), p.start.getMonth() + n, 1));
  return {p, items, sub, maanden, titel: 'Jaarplanning ' + NAAM};
}

// Klassiek raster: dagen 1-31 onder elkaar, maanden naast elkaar, zoals de oude Excel
function rasterCel(items, d) {
  const iso = naarIso(d), lijst = opDag(items, iso);
  const tekst = lijst.filter(i => i.soort !== 'Vakantie' || i.datum === iso)
    .map(i => (i.soort === 'Vakantie' && i.tm ? i.titel + ' (t/m ' + kort(i.tm) + ')' : i.titel) + (i.tijd && i.soort !== 'Repetitie' ? ' ' + i.tijd : '')).join(' / ');
  return {soort: hoofdSoort(lijst), tekst, dag: DAGEN[d.getDay()]};
}
function aantalRepetities(items, d) {
  const m = d.getMonth(), j = d.getFullYear();
  return items.filter(i => i.soort === 'Repetitie' || i.soort === 'Extra repetitie').filter(i => { const x = naarDatum(i.datum); return x.getMonth() === m && x.getFullYear() === j; }).length;
}
function tekenKlassiek() {
  const {items, sub, maanden, titel} = gekozen();
  const kop = el('tr', {}, el('th', {}), maanden.map(d => el('th', {}, MND[d.getMonth()] + (d.getMonth() === 0 || d === maanden[0] ? ' ' + String(d.getFullYear()).slice(2) : ''))));
  const tbody = el('tbody');
  for (let dag = 1; dag <= 31; dag++) {
    tbody.append(el('tr', {}, el('th', {}, String(dag)), maanden.map(m => {
      const d = new Date(m.getFullYear(), m.getMonth(), dag);
      if (d.getMonth() !== m.getMonth()) return el('td', {class: 'geen'});
      const c = rasterCel(items, d), weekend = d.getDay() === 0 || d.getDay() === 6;
      return el('td', {class: (c.soort ? soortKlasse(c.soort) : '') + (weekend ? ' weekend' : '')}, el('div', {}, el('span', {class: 'wd'}, c.dag), ' ', c.tekst));
    })));
  }
  tbody.append(el('tr', {class: 'telling'}, el('th', {title: 'Aantal repetities'}, '#'), maanden.map(m => el('td', {}, String(aantalRepetities(items, m))))));
  const blad = el('section', {class: 'blad klassiek-blad'}, el('h1', {}, titel), el('p', {class: 'sub'}, sub + ' · onderste regel: aantal repetities per maand'),
    el('table', {class: 'klassiek'}, el('thead', {}, kop), tbody), legenda(), vasteRepetitie(items) ? el('p', {class: 'vast'}, vasteRepetitie(items)) : null);
  $('bladen').replaceChildren(blad);
}

const ARGB = {'Repetitie':'FFCFE0F3','Extra repetitie':'FF8FD3CF','Optreden':'FFF4A6A0','Onder voorbehoud':'FFFFE45C','Vergadering':'FFC9B8E0','Vakantie':'FFB7DD9A','Overig':'FFF8CBAD'};
function laadScript(src) { return new Promise((ok, fout) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => fout(new Error('kon ' + src + ' niet laden')); document.head.append(s); }); }
async function downloadExcel() {
  const knop = $('excel'); knop.disabled = true; knop.textContent = 'Bezig…';
  try {
    if (!window.ExcelJS) await laadScript('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js');
    const {items, sub, maanden, titel} = gekozen();
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Jaaroverzicht', {pageSetup: {orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 1}, views: [{state: 'frozen', xSplit: 1, ySplit: 3}]});
    const rand = {style: 'thin', color: {argb: 'FFBBBBBB'}}, randen = {top: rand, left: rand, bottom: rand, right: rand};
    ws.getColumn(1).width = 4;
    maanden.forEach((_, n) => ws.getColumn(n + 2).width = 17);
    ws.mergeCells(1, 1, 1, 13); ws.getCell(1, 1).value = titel; ws.getCell(1, 1).font = {bold: true, size: 14, color: {argb: 'FF1F4E78'}};
    ws.mergeCells(2, 1, 2, 13); ws.getCell(2, 1).value = sub; ws.getCell(2, 1).font = {size: 9, color: {argb: 'FF555555'}};
    maanden.forEach((d, n) => { const c = ws.getCell(3, n + 2); c.value = MAANDEN[d.getMonth()] + ' ' + d.getFullYear(); c.font = {bold: true}; c.alignment = {horizontal: 'center'}; c.border = randen; });
    for (let dag = 1; dag <= 31; dag++) {
      const r = 3 + dag, kop = ws.getCell(r, 1); kop.value = dag; kop.font = {bold: true}; kop.alignment = {horizontal: 'center', vertical: 'top'};
      maanden.forEach((m, n) => {
        const c = ws.getCell(r, n + 2), d = new Date(m.getFullYear(), m.getMonth(), dag);
        c.border = randen; c.alignment = {wrapText: true, vertical: 'top'}; c.font = {size: 9};
        if (d.getMonth() !== m.getMonth()) { c.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFE5E5E5'}}; return; }
        const x = rasterCel(items, d);
        c.value = x.dag + (x.tekst ? ' ' + x.tekst : '');
        if (x.soort) c.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: ARGB[x.soort]}};
      });
    }
    const rt = 35; ws.getCell(rt, 1).value = '#'; ws.getCell(rt, 1).font = {bold: true};
    maanden.forEach((m, n) => { const c = ws.getCell(rt, n + 2); c.value = aantalRepetities(items, m); c.alignment = {horizontal: 'center'}; c.font = {bold: true}; });
    ws.getCell(rt, 14).value = 'aantal repetities';
    SOORTEN.forEach((s, k) => { const c = ws.getCell(37 + k, 2); c.value = LABEL[s] || s; c.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: ARGB[s]}}; c.border = randen; ws.mergeCells(37 + k, 2, 37 + k, 3); });

    const wl = wb.addWorksheet('Lijst', {views: [{state: 'frozen', ySplit: 1}]});
    wl.columns = [{header: 'Datum', key: 'd', width: 14}, {header: 't/m', key: 'tm', width: 14}, {header: 'Tijd', key: 't', width: 13}, {header: 'Activiteit', key: 'a', width: 36}, {header: 'Soort', key: 's', width: 18}, {header: 'Waar', key: 'w', width: 30}, {header: 'Opmerking', key: 'o', width: 30}];
    wl.getRow(1).font = {bold: true};
    for (const i of items) {
      const rij = wl.addRow({d: naarDatum(i.datum), tm: i.tm ? naarDatum(i.tm) : null, t: i.tijd, a: i.titel, s: i.soort, w: i.waar, o: i.opmerking});
      rij.getCell('s').fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: ARGB[i.soort] || 'FFFFFFFF'}};
    }
    wl.getColumn('d').numFmt = 'ddd d mmm yyyy'; wl.getColumn('tm').numFmt = 'ddd d mmm yyyy';
    wl.autoFilter = {from: 'A1', to: 'G1'};

    const blob = new Blob([await wb.xlsx.writeBuffer()], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const a = el('a', {href: URL.createObjectURL(blob), download: titel + ' ' + maanden[0].getFullYear() + '.xlsx'});
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (e) { alert('Het Excel-bestand kon niet gemaakt worden: ' + e.message); }
  finally { knop.disabled = false; knop.textContent = 'Download Excel'; }
}

function teken() {
  const liggend = $('richting').value === 'liggend';
  document.body.classList.toggle('liggend', liggend);
  let ps = document.getElementById('paginastijl');
  if (!ps) { ps = el('style', {id: 'paginastijl'}); document.head.append(ps); }
  ps.textContent = '@page { size: A4 ' + (liggend ? 'landscape' : 'portrait') + '; margin: 0; }';
  if ($('weergave').value === 'klassiek') return tekenKlassiek();
  const {p, items, sub, titel} = gekozen();

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
$('weergave').onchange = teken;
$('richting').onchange = teken;
$('excel').onclick = downloadExcel;
