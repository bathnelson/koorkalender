let ITEMS = [], JAAR = new Date().getFullYear();
let TOKEN = ''; try { TOKEN = localStorage.getItem('kk-token') || ''; } catch (e) {}
function zetToken(t) { TOKEN = t || ''; try { t ? localStorage.setItem('kk-token', t) : localStorage.removeItem('kk-token'); } catch (e) {} }
const $ = id => document.getElementById(id);

async function api(actie, body) {
  const headers = TOKEN ? {'X-Token': TOKEN} : {};
  const opties = body === undefined ? {cache: 'no-store', headers} :
    {method: 'POST', headers: {...headers, 'Content-Type': 'application/json'}, body: JSON.stringify(body)};
  let r;
  try { r = await fetch(apiUrl('actie=' + actie), opties); } catch (e) { throw new Error('Geen verbinding met de server (' + API + ').'); }
  let d = {};
  try { d = await r.json(); } catch (e) { throw new Error('Onverwacht antwoord van de server.'); }
  if (r.status === 401 && actie !== 'login') { zetToken(''); toon(false); throw new Error(d.fout || 'Niet ingelogd.'); }
  if (!r.ok) throw new Error(d.fout || 'Er ging iets mis.');
  return d;
}
function zeg(t) { const m = $('melding'); m.textContent = t; m.classList.remove('verborgen'); clearTimeout(zeg.t); zeg.t = setTimeout(() => m.classList.add('verborgen'), 4000); }
function fout(id, t) { const m = $(id); m.textContent = t || ''; m.classList.toggle('verborgen', !t); }

function toon(ingelogd) { $('login').classList.toggle('verborgen', ingelogd); $('beheer').classList.toggle('verborgen', !ingelogd); if (!ingelogd) $('ww').focus(); }

function tekenLijst() {
  const sel = $('jaarkeuze');
  sel.replaceChildren(...jarenVan(ITEMS).map(j => el('option', {value: j, selected: j === JAAR}, String(j))));
  const inJaar = ITEMS.filter(i => i.datum.startsWith(JAAR) || eind(i).startsWith(JAAR));
  const delen = maandLijst(inJaar, it => {
    const rij = itemRij(it, el('div', {class: 'acties'},
      el('button', {onclick: () => bewerk(it), 'aria-label': 'Wijzig ' + it.titel + ' ' + kort(it.datum)}, 'Wijzig'),
      el('button', {class: 'gevaar', onclick: () => weg(it), 'aria-label': 'Verwijder ' + it.titel + ' ' + kort(it.datum)}, 'Verwijder')));
    if (vervalt(it, ITEMS)) { rij.classList.add('voorbij'); rij.querySelector('.titel').append(' (vervalt: vakantie)'); }
    return rij;
  }, JAAR);
  if (!inJaar.length) delen.push(el('p', {class: 'leeg'}, 'Nog niets gepland in ' + JAAR + '.' + (metRol('wekelijks') ? ' Begin met "Wekelijkse ' + meervoud(WEKELIJKS()) + '".' : '')));
  $('lijst').replaceChildren(...delen);
}

function bewerk(it) {
  it = it || {id: '', titel: '', soort: metRol('hoogtepunt') || SOORTEN[0], datum: '', tm: '', tijd: '', waar: '', opmerking: ''};
  $('dlgtitel').textContent = it.id ? 'Activiteit wijzigen' : 'Nieuwe activiteit';
  $('f-id').value = it.id; $('f-titel').value = it.titel; $('f-soort').value = it.soort; $('f-datum').value = it.datum;
  $('f-tm').value = it.tm; $('f-tijd').value = it.tijd; $('f-waar').value = it.waar; $('f-opm').value = it.opmerking || ''; $('f-liedjes').value = it.liedjes || ''; toonLiedjesVeld();
  $('f-weg').classList.toggle('verborgen', !it.id); fout('dlgfout');
  $('f-weg').onclick = () => { $('dlg').close(); weg(it); };
  $('dlg').showModal();
}
async function weg(it) {
  if (!confirm('"' + it.titel + '" op ' + kort(it.datum) + ' verwijderen?')) return;
  try { ITEMS = (await api('verwijder', {ids: [it.id]})).items; tekenLijst(); zeg('Verwijderd: ' + it.titel + ' (' + kort(it.datum) + ').'); }
  catch (e) { alert(e.message); }
}

$('form').addEventListener('submit', async e => {
  e.preventDefault();
  const item = {id: $('f-id').value || undefined, titel: $('f-titel').value, soort: $('f-soort').value, datum: $('f-datum').value,
    tm: $('f-tm').value, tijd: $('f-tijd').value, waar: $('f-waar').value, opmerking: $('f-opm').value, liedjes: $('f-liedjes').value};
  try { const d = await api('opslaan', {item}); ITEMS = d.items; JAAR = Number(d.item.datum.slice(0, 4)); tekenLijst(); $('dlg').close(); zeg('Opgeslagen: ' + d.item.titel + ' (' + kort(d.item.datum) + ').'); }
  catch (err) { fout('dlgfout', err.message); }
});
// Het programma-veld alleen bij optredens tonen (of als er al liedjes in staan)
function toonLiedjesVeld() { $('v-liedjes').classList.toggle('verborgen', !(PROGRAMMA && (isRol($('f-soort').value, 'hoogtepunt') || isRol($('f-soort').value, 'voorbehoud'))) && !$('f-liedjes').value.trim()); }
$('f-soort').addEventListener('change', toonLiedjesVeld);
$('f-annuleer').onclick = () => $('dlg').close();
$('nieuw').onclick = () => bewerk(null);

// Reeks wekelijkse repetities
function reeksDatums() {
  const van = $('r-van').value, tot = $('r-tot').value, dag = Number($('r-dag').value), slaOver = $('r-vak').checked;
  if (!van || !tot || tot < van) return [];
  const uit = [];
  for (let d = naarDatum(van); naarIso(d) <= tot; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== dag) continue;
    const iso = naarIso(d);
    if (slaOver && opDag(ITEMS, iso).some(i => isRol(i.soort, 'wekelijks') && i.datum === iso)) continue;
    uit.push(iso);
  }
  return uit;
}
function preview() { const n = reeksDatums().length; $('r-preview').textContent = n ? n + ' ' + meervoud(WEKELIJKS()) + ' worden toegevoegd.' : 'Kies een periode.'; $('r-ok').disabled = !n || n > 200; }
['r-dag', 'r-van', 'r-tot', 'r-vak'].forEach(id => $(id).addEventListener('input', preview));
$('reeks').onclick = () => { $('r-van').value = JAAR + '-01-01'; $('r-tot').value = JAAR + '-12-31'; fout('dlg2fout'); preview(); $('dlg2').showModal(); };
$('r-annuleer').onclick = () => $('dlg2').close();
$('form2').addEventListener('submit', async e => {
  e.preventDefault();
  const items = reeksDatums().map(datum => ({datum, tm: '', tijd: $('r-tijd').value, titel: $('r-titel').value || metRol('wekelijks'), soort: metRol('wekelijks'), waar: $('r-waar').value, opmerking: ''}));
  try { const d = await api('meerdere', {items}); ITEMS = d.items; tekenLijst(); $('dlg2').close(); zeg(d.aantal + ' ' + meervoud(WEKELIJKS()) + ' toegevoegd.'); }
  catch (err) { fout('dlg2fout', err.message); }
});

$('jaarkeuze').onchange = e => { JAAR = Number(e.target.value); tekenLijst(); };
$('loginform').addEventListener('submit', async e => {
  e.preventDefault(); fout('loginfout');
  try { const d = await api('login', {wachtwoord: $('ww').value}); zetToken(d.token); $('ww').value = ''; await laad(); toon(true); }
  catch (err) { fout('loginfout', err.message); }
});
$('uit').onclick = () => { zetToken(''); toon(false); };
function zetSoortKeuzes() {
  $('f-soort').replaceChildren(...SOORTEN.map(s => el('option', {value: s}, s)));
  const w = metRol('wekelijks'), mv = meervoud(WEKELIJKS());
  $('reeks').classList.toggle('verborgen', !w);
  $('reeks').textContent = '+ Wekelijkse ' + mv;
  $('reekskop').textContent = 'Wekelijkse ' + mv + ' toevoegen';
  $('r-titel').value = w;
  $('r-vaktekst').textContent = ' Sla dagen met al een ' + WEKELIJKS() + ' over (in vakanties vervalt de ' + WEKELIJKS() + ' sowieso)';
  $('vakknop').classList.toggle('verborgen', !metRol('vakantie'));
}
zetSoortKeuzes();

async function laad() {
  const lijstData = await api('lijst'); zetSoorten(lijstData.soorten, lijstData.programma); zetSoortKeuzes(); ITEMS = lijstData.items || []; tekenLijst();
  api('leden_link', {}).then(toonLeden).catch(e => zeg('Ledenlink ophalen lukte niet: ' + e.message));
  api('ics_link', {}).then(d => toonIcs(d.sleutel)).catch(e => fout('icsfout', 'Agendalink maken lukte niet: ' + e.message));
  // Schoolvakanties van dit en volgend schooljaar automatisch ophalen (eenmalig per schooljaar)
  api('vakanties', {automatisch: true}).then(d => meldVakanties(d, true)).catch(e => zeg('Schoolvakanties ophalen lukte niet: ' + e.message));
}
function toonLeden(d) {
  $('ledenlink').value = new URL('./?k=' + d.sleutel, location.href).href;
  $('ledenuit').classList.toggle('verborgen', d.afgeschermd);
}
$('ledenkopie').onclick = async () => { try { await navigator.clipboard.writeText($('ledenlink').value); zeg('Ledenlink gekopieerd.'); } catch (e) { $('ledenlink').select(); } };
$('ledennieuw').onclick = async () => {
  if (!confirm('Nieuwe ledenlink maken? De oude link werkt dan niet meer; vervang hem ook op de ledensite.')) return;
  try { toonLeden(await api('leden_link', {nieuw: true})); zeg('Nieuwe ledenlink gemaakt.'); } catch (e) { alert(e.message); }
};
function toonIcs(sleutel) {
  const https = new URL(apiUrl('actie=ics&sleutel=' + sleutel), location.href).href;
  $('icslink').value = https;
  $('icstest').href = https;
  $('icsoutlook').href = 'https://outlook.live.com/calendar/0/addfromweb?url=' + encodeURIComponent(https) + '&name=' + encodeURIComponent('Jaarplanning');
}
function meldVakanties(d, automatisch) {
  // Een schooljaar dat Rijksoverheid nog niet heeft gepubliceerd (404) is bij automatisch ophalen geen melding waard
  if (automatisch) d.mislukt = d.mislukt.filter(m => !m.includes('HTTP 404'));
  if (d.items) { ITEMS = d.items; tekenLijst(); }
  const delen = [];
  if (d.toegevoegd.length) delen.push(d.toegevoegd.length + ' schoolvakanties toegevoegd');
  if (d.overgeslagen.length) delen.push(d.overgeslagen.length + ' stonden er al in');
  if (d.mislukt.length) delen.push('schoolvakanties ophalen lukte niet voor ' + d.mislukt.join(', ') + '; bij de volgende keer inloggen probeert de app het opnieuw');
  if (delen.length) zeg(delen.join(', ') + '.');
  return delen;
}
$('vakknop').onclick = async () => {
  const sj = prompt('Welk schooljaar? Laat leeg voor dit en volgend schooljaar.', '');
  if (sj === null) return;
  try { const d = await api('vakanties', {schooljaar: sj.trim()}); if (!meldVakanties(d).length) zeg('Geen nieuwe vakanties gevonden.'); }
  catch (e) { alert(e.message); }
};
$('icskopie').onclick = async () => { try { await navigator.clipboard.writeText($('icslink').value); zeg('Link gekopieerd.'); } catch (e) { $('icslink').select(); } };
$('icsnieuw').onclick = async () => {
  if (!confirm('Nieuwe link maken? De oude link werkt dan niet meer; leden moeten zich opnieuw abonneren.')) return;
  try { toonIcs((await api('ics_link', {nieuw: true})).sleutel); zeg('Nieuwe agendalink gemaakt.'); } catch (e) { alert(e.message); }
};
(async () => {
  try { const s = TOKEN ? await api('sessie') : {ingelogd: false}; if (s.ingelogd) { await laad(); toon(true); } else toon(false); }
  catch (e) { toon(false); fout('loginfout', e.message); }
})();
