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
  if (!knoppen.length) return;

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
  var doel = null, meer = false, gekozen = [];
  var tabs = doos.querySelector('.fk-tabs'), ncDeel = doos.querySelector('.fk-nc'), ncRaster = doos.querySelector('.fk-ncraster'), ncPad = doos.querySelector('.fk-pad');
  var ncMap = null;

  function zeg(t, fout) { status.hidden = !t; status.textContent = t || ''; status.className = 'fk-status ' + (fout ? 'fout' : 'stil'); }
  function bijwerken() {
    onder.hidden = !meer || gekozen.length > 1;
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
    b.innerHTML = '<img alt="" loading="lazy"><span class="nr"></span>';
    b.querySelector('img').src = f.src;
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
  data.fotos.forEach(function (f) { tegel(f, false); });
  if (!data.fotos.length) zeg('Er zijn nog geen foto\'s. Upload er hierboven een.');

  // ---- Nextcloud ----
  function toonTab(welke) {
    tabs.querySelectorAll('button').forEach(function (b) { b.classList.toggle('actief', b.dataset.tab === welke); });
    raster.hidden = welke !== 'site'; ncDeel.hidden = welke !== 'nc';
    zeg('');
    try { localStorage.setItem('fk-tab', welke); } catch (e) {}
    if (welke === 'nc' && ncMap === null) {
      var m = ''; try { m = localStorage.getItem('fk-ncmap') || ''; } catch (e) {}
      laadNc(m);
    }
  }
  if (data.nc) {
    tabs.hidden = false;
    tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) toonTab(b.dataset.tab); });
  }
  async function laadNc(map) {
    zeg('Nextcloud wordt geladen…');
    ncRaster.innerHTML = '';
    try {
      var r = await (await fetch(data.nc + '?ncfotos=1&map=' + encodeURIComponent(map), { credentials: 'same-origin' })).json();
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
      try { localStorage.setItem('fk-ncmap', ncMap); } catch (e) {}
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
        b.innerHTML = '<span class="mapikoon">📁</span><span class="mapnaam"></span>';
        b.querySelector('.mapnaam').textContent = m;
        b.onclick = function () { laadNc(ncMap ? ncMap + '/' + m : m); };
        ncRaster.appendChild(b);
      });
      r.fotos.forEach(function (f) {
        var pad = ncMap ? ncMap + '/' + f : f;
        var b = document.createElement('button'); b.type = 'button'; b.title = f;
        b.innerHTML = '<img alt="" loading="lazy"><span class="nr"></span><span class="fotonaam"></span>';
        b.querySelector('img').src = data.nc + '?ncvoorbeeld=' + encodeURIComponent(pad);
        b.querySelector('.fotonaam').textContent = f;
        b.onclick = function () { haalNc(b, pad); };
        ncRaster.appendChild(b);
      });
      zeg(r.mappen.length || r.fotos.length ? '' : 'Geen foto\'s in deze map.');
    } catch (e) { zeg(e.message && e.message.indexOf('JSON') < 0 ? e.message : 'Nextcloud is niet bereikbaar.', true); }
  }
  // Een foto uit Nextcloud wordt naar de website gekopieerd (verkleind) en dan gekozen
  async function haalNc(b, pad) {
    if (b.classList.contains('bezig')) return;
    b.classList.add('bezig'); b.querySelector('.nr').textContent = '…';
    zeg('Foto wordt van Nextcloud naar de website gekopieerd…');
    try {
      var fd = new FormData();
      fd.append('csrf', data.csrf); fd.append('actie', 'nc_foto'); fd.append('pad', pad);
      var r = await (await fetch(data.upload, { method: 'POST', body: fd, credentials: 'same-origin' })).json();
      if (!r.naam) throw new Error(r.fout || 'Kopiëren lukte niet.');
      tegel(r, true);
      if (meer) gekozen.push(r.naam); else gekozen = [r.naam];
      b.classList.add('gekozen'); b.querySelector('.nr').textContent = '✓';
      bijwerken();
      zeg(meer ? 'Gekopieerd. Kies er nog meer, of klik op Invoegen.' : 'Gekopieerd. Klik op Kiezen.');
    } catch (e) { b.querySelector('.nr').textContent = ''; zeg(e.message && e.message.indexOf('JSON') < 0 ? e.message : 'Kopiëren lukte niet.', true); }
    b.classList.remove('bezig');
  }

  upload.addEventListener('change', async function () {
    var lijst = Array.prototype.slice.call(upload.files);
    for (var n = 0; n < lijst.length; n++) {
      zeg('Bezig met uploaden (' + (n + 1) + ' van ' + lijst.length + ')…');
      try {
        var fd = new FormData();
        fd.append('csrf', data.csrf); fd.append('actie', 'foto');
        fd.append('foto', await verklein(lijst[n]));
        var r = await (await fetch(data.upload, { method: 'POST', body: fd, credentials: 'same-origin' })).json();
        if (!r.naam) throw new Error(r.fout || 'Uploaden lukte niet.');
        tegel(r, true);
        if (meer) gekozen.push(r.naam); else gekozen = [r.naam];
        bijwerken();
      } catch (e) { zeg(e.message && e.message.indexOf('JSON') < 0 ? e.message : 'Uploaden lukte niet. Probeer het via het tabblad Foto\'s.', true); upload.value = ''; return; }
    }
    zeg(''); upload.value = '';
  });

  doos.addEventListener('close', function () {
    if (doos.returnValue !== 'ja' || !gekozen.length || !doel) return;
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
      doel = veld; meer = veld.tagName === 'TEXTAREA';
      var w = veld.value.trim().match(/^fotos\/([\w.-]+)$/);
      gekozen = !meer && w ? [w[1]] : [];
      onderVeld.value = '';
      doos.querySelector('h2').textContent = meer ? "Kies een of meer foto's" : 'Kies een foto';
      ok.textContent = meer ? 'Invoegen' : 'Kiezen';
      zeg(data.fotos.length || raster.children.length ? '' : 'Er zijn nog geen foto\'s. Upload er hierboven een.');
      bijwerken();
      ncRaster.querySelectorAll('.gekozen').forEach(function (b) { b.classList.remove('gekozen'); b.querySelector('.nr').textContent = ''; });
      var tab = 'site'; try { tab = localStorage.getItem('fk-tab') || 'site'; } catch (e) {}
      toonTab(data.nc && tab === 'nc' ? 'nc' : 'site');
      doos.showModal();
    });
  });
})();
