// Beheer: foto's verkleinen vóór het uploaden, en de fotokiezer voor pagina's en concerten.
(function () {
  var dataEl = document.getElementById('fotodata');
  var data = dataEl ? JSON.parse(dataEl.textContent) : { fotos: [] };
  var MAX = 1600;

  // Grote foto's in de browser verkleinen, zodat de uploadlimiet van de host geen probleem is
  async function verklein(f) {
    if (!f || !/^image\/(jpeg|png|webp)$/.test(f.type) || !window.createImageBitmap || !HTMLCanvasElement.prototype.toBlob) return f;
    try {
      var img = await createImageBitmap(f, { imageOrientation: 'from-image' });
      var schaal = Math.min(1, MAX / Math.max(img.width, img.height));
      if (schaal === 1 && f.size < 1500000) return f;
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * schaal); c.height = Math.round(img.height * schaal);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      var blob = await new Promise(function (k) { c.toBlob(k, 'image/jpeg', 0.82); });
      return blob ? new File([blob], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : f;
    } catch (e) { return f; }
  }

  // Tabblad Foto's: het gewone uploadformulier
  var veld = document.getElementById('foto'), knop = document.getElementById('fotoknop');
  if (veld && knop && window.DataTransfer) {
    veld.addEventListener('change', async function () {
      if (!veld.files[0]) return;
      knop.disabled = true; knop.textContent = 'Verkleinen…';
      var klein = await verklein(veld.files[0]);
      if (klein !== veld.files[0]) { var dt = new DataTransfer(); dt.items.add(klein); veld.files = dt.files; }
      knop.disabled = false; knop.textContent = 'Uploaden';
    });
  }

  var knoppen = document.querySelectorAll('[data-fotokiezer]');
  if (!knoppen.length && !document.getElementById('blokeditor')) return;

  // De kiezer zelf
  var doos = document.createElement('dialog');
  doos.className = 'fotokiezer';
  doos.innerHTML = '<form method="dialog">'
    + '<div class="fk-kop"><h2>Kies een foto</h2><label class="knop licht klein">Nieuwe foto uploaden<input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple hidden></label></div>'
    + '<nav class="fk-tabs" hidden><button type="button" data-tab="site" class="actief">Op de website</button><button type="button" data-tab="nc">Uit Nextcloud</button></nav>'
    + '<p class="fk-status stil" hidden></p>'
    + '<div class="fk-raster"></div>'
    + '<div class="fk-nc" hidden><p class="fk-pad kruimels"></p><div class="fk-raster fk-ncraster"></div></div>'
    + '<div class="fk-voet"><label class="fk-onder">Onderschrift (mag leeg)<input type="text"></label>'
    + '<span class="fk-uitleg stil"></span><button value="nee" class="licht">Annuleren</button><button value="ja" class="fk-ok" disabled>Invoegen</button></div>'
    + '</form>';
  document.body.appendChild(doos);
  var raster = doos.querySelector('.fk-raster'), ok = doos.querySelector('.fk-ok'), status = doos.querySelector('.fk-status');
  var onder = doos.querySelector('.fk-onder'), onderVeld = onder.querySelector('input'), uitleg = doos.querySelector('.fk-uitleg');
  var upload = doos.querySelector('input[type=file]');
  var doel = null, meer = false, gekozen = [], terugroep = null, metOnder = true;
  var tabs = doos.querySelector('.fk-tabs'), ncDeel = doos.querySelector('.fk-nc'), ncRaster = doos.querySelector('.fk-ncraster'), ncPad = doos.querySelector('.fk-pad');
  var ncMap = null;
  var modus = 'foto'; // of 'audio'
  data.audio = data.audio || [];
  function lijstNu() { return modus === 'audio' ? data.audio : data.fotos; }

  // Antwoord van de server lezen; is het geen JSON (bijv. een foutpagina van de host), zeg dan wat er wel kwam
  async function leesJson(antw) {
    var t = await antw.text();
    try { return JSON.parse(t); } catch (e) {
      var kaal = t.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
      throw new Error('De server gaf een onverwacht antwoord (HTTP ' + antw.status + ')' + (kaal ? ': ' + kaal : ', leeg.'));
    }
  }
  function zeg(t, fout) { status.hidden = !t; status.textContent = t || ''; status.className = 'fk-status ' + (fout ? 'fout' : 'stil'); }
  function bijwerken() {
    onder.hidden = !metOnder || !meer || gekozen.length > 1;
    raster.querySelectorAll('button').forEach(function (b) {
      var i = gekozen.indexOf(b.dataset.naam);
      b.classList.toggle('gekozen', i >= 0);
      b.querySelector('.nr').textContent = meer && i >= 0 ? String(i + 1) : (i >= 0 ? '✓' : '');
    });
    ok.disabled = !gekozen.length;
    uitleg.textContent = meer ? (gekozen.length > 1 ? gekozen.length + " foto's worden een fotogalerij" : "Kies er meer voor een fotogalerij") : '';
  }
  function tegel(f, vooraan) {
    var b = document.createElement('button');
    b.type = 'button'; b.dataset.naam = f.naam; b.title = f.naam;
    if (modus === 'audio') {
      b.innerHTML = '<span class="mapinhoud"><span class="mapikoon">🎵</span><span class="mapnaam"></span></span><span class="nr"></span>';
      b.querySelector('.mapnaam').textContent = f.naam;
    } else {
      b.innerHTML = '<img alt="" loading="lazy"><span class="nr"></span>';
      b.querySelector('img').src = f.src;
    }
    b.addEventListener('click', function () {
      var i = gekozen.indexOf(f.naam);
      if (i >= 0) gekozen.splice(i, 1);
      else if (meer) gekozen.push(f.naam);
      else gekozen = [f.naam];
      bijwerken();
    });
    b.addEventListener('dblclick', function () { if (!meer) { gekozen = [f.naam]; doos.close('ja'); } });
    if (vooraan) raster.prepend(b); else raster.appendChild(b);
  }
  function vulRaster() { raster.innerHTML = ''; lijstNu().forEach(function (f) { tegel(f, false); }); }
  vulRaster();

  // ---- Nextcloud ----
  function toonTab(welke) {
    tabs.querySelectorAll('button').forEach(function (b) { b.classList.toggle('actief', b.dataset.tab === welke); });
    raster.hidden = welke !== 'site'; ncDeel.hidden = welke !== 'nc';
    zeg('');
    try { localStorage.setItem('fk-tab', welke); } catch (e) {}
    if (welke === 'nc' && ncMap === null) {
      var m = ''; try { m = localStorage.getItem('fk-ncmap' + (modus === 'audio' ? '-audio' : '')) || ''; } catch (e) {}
      laadNc(m);
    }
  }
  if (data.nc) {
    tabs.hidden = false;
    tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) toonTab(b.dataset.tab); });
  }
  async function laadNc(map) {
    zeg('Nextcloud wordt geladen…');
    ncRaster.innerHTML = ''; kapotGemeld = false;
    var mijn = laadNc.teller = (laadNc.teller || 0) + 1;
    try {
      var r = await leesJson(await fetch(data.nc + '?ncfotos=1&soort=' + modus + '&map=' + encodeURIComponent(map), { credentials: 'same-origin' }));
      if (mijn !== laadNc.teller) return; // intussen al een andere map gekozen
      if (r.fout && map && !r.inlog) return laadNc('');
      if (r.fout) {
        zeg(r.fout, true);
        if (r.inlog) {
          var l = document.createElement('a'); l.href = r.inlog; l.target = '_blank'; l.className = 'knop klein'; l.textContent = 'Naar de ledenpagina';
          var opnieuw = document.createElement('button'); opnieuw.type = 'button'; opnieuw.className = 'licht klein'; opnieuw.textContent = 'Opnieuw proberen';
          opnieuw.onclick = function () { laadNc(map); };
          status.append(' ', l, ' ', opnieuw);
        }
        return;
      }
      ncMap = r.map;
      try { localStorage.setItem('fk-ncmap' + (modus === 'audio' ? '-audio' : ''), ncMap); } catch (e) {}
      // kruimelpad
      ncPad.innerHTML = '';
      var delen = ncMap ? ncMap.split('/') : [];
      var a = document.createElement('a'); a.href = '#'; a.textContent = 'Nextcloud'; a.onclick = function (e) { e.preventDefault(); laadNc(''); };
      ncPad.appendChild(a);
      delen.forEach(function (d, i) {
        ncPad.appendChild(document.createTextNode(' / '));
        var l = document.createElement('a'); l.href = '#'; l.textContent = d;
        l.onclick = function (e) { e.preventDefault(); laadNc(delen.slice(0, i + 1).join('/')); };
        ncPad.appendChild(l);
      });
      r.mappen.forEach(function (m) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'map';
        b.innerHTML = '<span class="mapinhoud"><span class="mapikoon">📁</span><span class="mapnaam"></span></span>';
        b.querySelector('.mapnaam').textContent = m;
        b.onclick = function () { laadNc(ncMap ? ncMap + '/' + m : m); };
        ncRaster.appendChild(b);
      });
      r.fotos.forEach(function (f) {
        var pad = ncMap ? ncMap + '/' + f : f;
        var b = document.createElement('button'); b.type = 'button'; b.title = f;
        if (modus === 'audio') {
          b.innerHTML = '<span class="mapinhoud"><span class="mapikoon">🎵</span><span class="mapnaam"></span></span><span class="nr"></span>';
          b.querySelector('.mapnaam').textContent = f;
        } else {
          b.innerHTML = '<img alt="" loading="lazy"><span class="nr"></span><span class="fotonaam"></span>';
          var vb = b.querySelector('img');
          vb.onerror = function () { b.classList.add('kapot'); meldKapot(pad); };
          vb.src = data.nc + '?ncvoorbeeld=' + encodeURIComponent(pad);
          b.querySelector('.fotonaam').textContent = f;
        }
        b.onclick = function () { haalNc(b, pad); };
        ncRaster.appendChild(b);
      });
      zeg(r.mappen.length || r.fotos.length ? '' : (modus === 'audio' ? 'Geen audiobestanden in deze map.' : 'Geen foto\'s in deze map.'));
    } catch (e) { zeg(e.message ? e.message : 'Nextcloud is niet bereikbaar.', true); }
  }
  // Laden de voorbeeldjes niet, dan één keer een melding met een link die laat zien waarom
  var kapotGemeld = false;
  function meldKapot(pad) {
    if (kapotGemeld) return;
    kapotGemeld = true;
    zeg('Sommige voorbeeldjes laden niet. Je kunt ze wel kiezen. ', true);
    var l = document.createElement('a'); l.href = data.nc + '?ncvoorbeeld=' + encodeURIComponent(pad) + '&waarom=1'; l.target = '_blank'; l.textContent = 'Waarom?';
    status.appendChild(l);
  }
  // Een foto uit Nextcloud wordt naar de website gekopieerd (verkleind) en dan gekozen
  async function haalNc(b, pad) {
    if (b.classList.contains('bezig')) return;
    b.classList.add('bezig'); b.querySelector('.nr').textContent = '…';
    zeg('Foto wordt van Nextcloud naar de website gekopieerd…');
    try {
      var fd = new FormData();
      fd.append('csrf', data.csrf); fd.append('actie', 'nc_foto'); fd.append('pad', pad);
      var r = await leesJson(await fetch(data.upload, { method: 'POST', body: fd, credentials: 'same-origin' }));
      if (!r.naam) throw new Error(r.fout || 'Kopiëren lukte niet.');
      lijstNu().unshift(r);
      tegel(r, true);
      if (meer) gekozen.push(r.naam); else gekozen = [r.naam];
      b.classList.add('gekozen'); b.querySelector('.nr').textContent = '✓';
      bijwerken();
      zeg(meer ? 'Gekopieerd. Kies er nog meer, of klik op Invoegen.' : 'Gekopieerd. Klik op Kiezen.');
    } catch (e) { b.querySelector('.nr').textContent = ''; zeg(e.message ? e.message : 'Kopiëren lukte niet.', true); }
    b.classList.remove('bezig');
  }

  upload.addEventListener('change', async function () {
    var lijst = Array.prototype.slice.call(upload.files);
    for (var n = 0; n < lijst.length; n++) {
      zeg('Bezig met uploaden (' + (n + 1) + ' van ' + lijst.length + ')…');
      try {
        var fd = new FormData();
        fd.append('csrf', data.csrf); fd.append('actie', modus);
        fd.append(modus, modus === 'audio' ? lijst[n] : await verklein(lijst[n]));
        var r = await leesJson(await fetch(data.upload, { method: 'POST', body: fd, credentials: 'same-origin' }));
        if (!r.naam) throw new Error(r.fout || 'Uploaden lukte niet.');
        lijstNu().unshift(r);
        tegel(r, true);
        if (meer) gekozen.push(r.naam); else gekozen = [r.naam];
        bijwerken();
      } catch (e) { zeg(e.message ? e.message : 'Uploaden lukte niet. Probeer het via het tabblad Foto\'s.', true); upload.value = ''; return; }
    }
    zeg(''); upload.value = '';
  });

  doos.addEventListener('close', function () {
    var cb = terugroep; terugroep = null;
    if (doos.returnValue !== 'ja' || !gekozen.length) return;
    if (cb) { cb(gekozen.slice(), onderVeld.value.replace(/[\[\]\n]/g, ' ').trim()); return; }
    if (!doel) return;
    if (doel.tagName === 'TEXTAREA') {
      var tekst = onderVeld.value.replace(/[\[\]\n]/g, ' ').trim();
      var regels = gekozen.map(function (n) { return '![' + (gekozen.length === 1 ? tekst : '') + '](fotos/' + n + ')'; });
      // Nog niet in de tekst geklikt? Dan komen de foto's onderaan
      var v = doel.value, a = doel.dataset.aangeraakt ? doel.selectionStart : v.length, z = doel.dataset.aangeraakt ? doel.selectionEnd : v.length;
      var voor = v.slice(0, a), na = v.slice(z);
      var blok = (voor && !/\n\n$/.test(voor) ? (/\n$/.test(voor) ? '\n' : '\n\n') : '') + regels.join('\n') + (na && !/^\n\n/.test(na) ? (/^\n/.test(na) ? '\n' : '\n\n') : '');
      doel.value = voor + blok + na;
      doel.focus();
      doel.selectionStart = doel.selectionEnd = (voor + blok).length;
    } else {
      doel.value = 'fotos/' + gekozen[0];
      doel.dispatchEvent(new Event('input'));
    }
  });

  function openKiezer(veld, veelKeuze, huidig, soort) {
    soort = soort || 'foto';
    if (soort !== modus) {
      modus = soort; ncMap = null; vulRaster();
      upload.accept = modus === 'audio' ? 'audio/*,.mp3,.m4a,.ogg,.wav' : 'image/jpeg,image/png,image/gif,image/webp';
      upload.parentNode.firstChild.textContent = modus === 'audio' ? 'Nieuw bestand uploaden' : 'Nieuwe foto uploaden';
    }
    doel = veld; meer = veelKeuze;
    gekozen = huidig ? [huidig] : [];
    onderVeld.value = '';
    doos.querySelector('h2').textContent = modus === 'audio' ? 'Kies een audiobestand' : meer ? "Kies een of meer foto's" : 'Kies een foto';
    ok.textContent = meer ? 'Invoegen' : 'Kiezen';
    zeg(raster.children.length ? '' : (modus === 'audio' ? 'Er staan nog geen audiobestanden op de website. Upload er een, of kies er een uit Nextcloud.' : 'Er zijn nog geen foto\'s. Upload er hierboven een.'));
    bijwerken();
    ncRaster.querySelectorAll('.gekozen').forEach(function (b) { b.classList.remove('gekozen'); b.querySelector('.nr').textContent = ''; });
    var tab = 'site'; try { tab = localStorage.getItem('fk-tab') || 'site'; } catch (e) {}
    toonTab(data.nc && tab === 'nc' ? 'nc' : 'site');
    doos.showModal();
  }
  // Voor de pagina-editor: kiesFotos({ meer: true }, function (namen, onderschrift) { ... })
  window.kiesFotos = function (opties, klaar) {
    metOnder = !!opties.onderschrift;
    openKiezer(null, !!opties.meer, opties.huidig || null, opties.soort);
    terugroep = klaar;
  };

  knoppen.forEach(function (k) {
    var veld = document.getElementById(k.dataset.fotokiezer);
    if (!veld) return;
    // Bij een los fotoveld een voorbeeldje laten zien
    if (veld.tagName === 'TEXTAREA') ['focus', 'click', 'keyup'].forEach(function (s) { veld.addEventListener(s, function () { veld.dataset.aangeraakt = '1'; }); });
    if (veld.tagName === 'INPUT') {
      var vb = document.createElement('img');
      vb.className = 'fotovoorbeeld'; vb.alt = '';
      k.parentNode.appendChild(vb);
      var toon = function () {
        var w = veld.value.trim();
        var src = /^fotos\/[\w.-]+$/.test(w) ? (data.fotos.concat(data.extra || []).filter(function (f) { return 'fotos/' + f.naam === w; })[0] || {}).src : (/^https:\/\//.test(w) ? w : '');
        vb.hidden = !src; if (src) vb.src = src;
      };
      veld.addEventListener('input', toon);
      toon();
    }
    k.addEventListener('click', function () {
      var w = veld.value.trim().match(/^fotos\/([\w.-]+)$/);
      metOnder = true;
      openKiezer(veld, veld.tagName === 'TEXTAREA', veld.tagName !== 'TEXTAREA' && w ? w[1] : null, 'foto');
    });
  });
})();

// Menu-indeling met slepen: omhoog/omlaag voor de volgorde, naar rechts voor een submenu
(function () {
  var menu = document.getElementById('menulijst'), los = document.getElementById('losselijst');
  var dataEl = document.getElementById('fotodata');
  if (!menu || !los || !dataEl) return;
  var data = JSON.parse(dataEl.textContent);
  var status = document.getElementById('menustatus');
  var STAP = 36; // pixels naar rechts voor een submenu

  function rijen(lijst) { return Array.prototype.slice.call(lijst.children); }
  function diepte(li) { return li.dataset.diepte === '1' ? 1 : 0; }
  function zetDiepte(li, d) { li.dataset.diepte = String(d); }
  // Regels: het eerste menu-item is een hoofditem, home is altijd een hoofditem, buiten het menu geen submenu's
  function netjes() {
    rijen(menu).forEach(function (li, i) { if (i === 0 || li.dataset.slug === 'home') zetDiepte(li, 0); });
    rijen(los).forEach(function (li) { zetDiepte(li, 0); });
  }
  async function bewaar() {
    netjes();
    var lijst = rijen(menu).map(function (li) { return { s: li.dataset.slug, m: 1, d: diepte(li) }; })
      .concat(rijen(los).map(function (li) { return { s: li.dataset.slug, m: 0, d: 0 }; }));
    status.textContent = 'Bezig met opslaan…'; status.className = 'stil';
    try {
      var fd = new FormData();
      fd.append('csrf', data.csrf); fd.append('actie', 'menu_opslaan'); fd.append('menu', JSON.stringify(lijst));
      var r = await (await fetch(data.upload, { method: 'POST', body: fd, credentials: 'same-origin' })).json();
      if (!r.bericht) throw new Error(r.fout || 'Opslaan lukte niet.');
      status.textContent = 'Opgeslagen ✓'; status.className = 'goedtekst';
    } catch (e) { status.textContent = 'Opslaan lukte niet. Ververs de pagina en probeer het opnieuw.'; status.className = 'fout'; }
  }

  var sleep = null; // { li, mee: [submenu-items die meeverhuizen], startX, startDiepte }
  var wacht = null; // muis ingedrukt op een regel: pas na een paar pixels bewegen gaat het slepen in (anders is het een klik)
  var netGesleept = false;
  function begin(e) {
    // met de muis pak je de hele regel, op een touchscherm alleen het handvat ⠿
    var li = e.target.closest('.menulijst li');
    if (!li || e.button > 0) return;
    var greep = e.target.closest('.greep');
    if (greep) { start(li, greep, e); return; }
    if (e.pointerType === 'mouse' && !e.target.closest('button, input, select')) wacht = { li: li, x: e.clientX, y: e.clientY };
  }
  function start(li, greep, e) {
    e.preventDefault();
    wacht = null;
    var mee = [];
    if (li.parentNode === menu && diepte(li) === 0) {
      for (var n = li.nextElementSibling; n && diepte(n) === 1; n = n.nextElementSibling) mee.push(n);
    }
    mee.forEach(function (m) { m.classList.add('meeverhuis'); });
    sleep = { li: li, mee: mee, startX: e.clientX, startDiepte: li.parentNode === menu ? diepte(li) : 0 };
    li.classList.add('sleept');
    document.body.classList.add('bezig-slepen');
    greep.setPointerCapture && greep.setPointerCapture(e.pointerId);
  }
  function beweeg(e) {
    if (wacht && Math.abs(e.clientX - wacht.x) + Math.abs(e.clientY - wacht.y) > 6) {
      var w = wacht;
      start(w.li, w.li, e);
      sleep.startX = w.x;
      netGesleept = true;
    }
    if (!sleep) return;
    var li = sleep.li;
    // bij de rand van het venster meeschuiven, voor lange lijsten
    if (e.clientY < 60) window.scrollBy(0, -12); else if (e.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
    // welke lijst en welke plek: de lijst die het dichtst bij de muis is (ook als je tussen de twee lijsten loslaat)
    var doel = null, voor = true;
    var afstand = function (lijst) { var v = lijst.getBoundingClientRect(); return e.clientY < v.top ? v.top - e.clientY : e.clientY > v.bottom ? e.clientY - v.bottom : 0; };
    var lijst = afstand(menu) <= afstand(los) ? menu : los;
    var kandidaten = rijen(lijst).filter(function (r) { return r !== li && sleep.mee.indexOf(r) < 0; });
    // Op het midden van een hoofditem loslaten = in zijn submenu zetten
    var erin = null;
    if (lijst === menu && li.dataset.slug !== 'home' && !sleep.mee.length) {
      kandidaten.forEach(function (k) {
        if (diepte(k) !== 0) return;
        var b = k.getBoundingClientRect();
        if (e.clientY > b.top + b.height * 0.25 && e.clientY < b.bottom - b.height * 0.25) erin = k;
      });
    }
    if (sleep.erin && sleep.erin !== erin) sleep.erin.classList.remove('doel-erin');
    sleep.erin = erin;
    if (erin) { erin.classList.add('doel-erin'); return; }
    if (!kandidaten.length) doel = { lijst: lijst, rij: null };
    else {
      for (var i = 0; i < kandidaten.length && !doel; i++) {
        var b = kandidaten[i].getBoundingClientRect();
        if (e.clientY < b.top + b.height / 2) doel = { lijst: lijst, rij: kandidaten[i] };
      }
      if (!doel) { doel = { lijst: lijst, rij: kandidaten[kandidaten.length - 1] }; voor = false; }
    }
    if (doel) {
      if (!doel.rij) doel.lijst.appendChild(li);
      else if (voor) doel.lijst.insertBefore(li, doel.rij);
      else {
        // na een hoofditem met submenu: na zijn laatste submenu-item, behalve als we zelf een submenu-item worden
        var na = doel.rij;
        doel.lijst.insertBefore(li, na.nextSibling);
      }
    }
    // diepte uit de horizontale beweging
    if (li.parentNode === menu) {
      var dx = e.clientX - sleep.startX;
      var d = sleep.startDiepte + (dx > STAP / 2 ? 1 : dx < -STAP / 2 ? -1 : 0);
      d = Math.max(0, Math.min(1, d));
      if (!li.previousElementSibling || li.dataset.slug === 'home' || sleep.mee.length) d = 0; // een hoofditem met submenu blijft hoofditem
      // tussen twee submenu-items in moet je zelf ook een submenu-item zijn
      var volgende = li.nextElementSibling;
      while (volgende && sleep.mee.indexOf(volgende) >= 0) volgende = volgende.nextElementSibling;
      if (d === 0 && volgende && diepte(volgende) === 1 && !sleep.mee.length) d = 1;
      zetDiepte(li, d);
      // een hoofditem dat hoofditem blijft, mag een ander zijn submenu-items niet afpakken: schuif door tot na dat submenu
      if (d === 0) {
        var laatste = null;
        for (var v = li.nextElementSibling; v && (sleep.mee.indexOf(v) >= 0 || diepte(v) === 1); v = v.nextElementSibling) if (sleep.mee.indexOf(v) < 0) laatste = v;
        if (laatste) menu.insertBefore(li, laatste.nextSibling);
      }
    } else zetDiepte(li, 0);
    // submenu-items verhuizen mee, direct achter hun hoofditem
    var plek = li;
    sleep.mee.forEach(function (m) { if (li.parentNode === menu) { menu.insertBefore(m, plek.nextSibling); zetDiepte(m, 1); } else { los.insertBefore(m, plek.nextSibling); zetDiepte(m, 0); } plek = m; });
  }
  function einde() {
    wacht = null;
    if (netGesleept) setTimeout(function () { netGesleept = false; }, 0);
    if (!sleep) return;
    if (sleep.erin) {
      // achteraan in het submenu van het gekozen hoofditem
      var na = sleep.erin;
      while (na.nextElementSibling && diepte(na.nextElementSibling) === 1 && na.nextElementSibling !== sleep.li) na = na.nextElementSibling;
      menu.insertBefore(sleep.li, na.nextSibling);
      zetDiepte(sleep.li, 1);
      sleep.erin.classList.remove('doel-erin');
    }
    sleep.li.classList.remove('sleept');
    sleep.mee.forEach(function (m) { m.classList.remove('meeverhuis'); });
    document.body.classList.remove('bezig-slepen');
    sleep = null;
    bewaar();
  }
  document.addEventListener('pointerdown', begin);
  // na het slepen geen klik op de link, en de browser moet links in de lijst niet zelf gaan slepen
  document.addEventListener('click', function (e) { if (netGesleept) { netGesleept = false; e.preventDefault(); e.stopPropagation(); } }, true);
  document.addEventListener('dragstart', function (e) { if (e.target.closest && e.target.closest('.menulijst')) e.preventDefault(); });
  document.addEventListener('pointermove', beweeg);
  document.addEventListener('pointerup', einde);
  document.addEventListener('pointercancel', einde);
})();
