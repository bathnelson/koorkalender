// Beheer: pagina's bewerken met blokken (kopje, tekst, foto's, video, tegels, knop) in plaats van losse tekstregels.
// De pagina wordt nog steeds als tekst bewaard (zie opmaak() in lib.php); deze editor leest en schrijft die tekst.
(function () {
  var houder = document.getElementById('blokeditor');
  var bron = document.getElementById('paginatekst');
  var dataEl = document.getElementById('fotodata');
  if (!houder || !bron || !dataEl) return;
  var data = JSON.parse(dataEl.textContent);
  var soortVeld = document.getElementById('paginasoort');
  var titelVeld = document.querySelector('input[name=titel]');

  // ---------- hulpjes ----------
  function el(tag, cls, tekst) { var e = document.createElement(tag); if (cls) e.className = cls; if (tekst != null) e.textContent = tekst; return e; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ytId(u) { var m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(u || ''); return m ? m[1] : null; }
  function fotoSrc(a) {
    a = (a || '').trim();
    if (/^fotos\/[\w.-]+$/.test(a)) return data.fotobasis + a.slice(6);
    if (/^https?:\/\//i.test(a)) return a;
    return '';
  }
  function audioSrc(a) {
    a = (a || '').trim();
    if (/^audio\/[\w.-]+$/.test(a)) return data.audiobasis + a.slice(6);
    if (/^https?:\/\//i.test(a)) return a;
    return '';
  }
  function schoon(t) { return String(t || '').replace(/[\[\]\n\r]/g, ' ').replace(/\s+/g, ' ').trim(); } // voor titels en onderschriften
  function adres(t) { return String(t || '').trim().replace(/\s/g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29'); }

  // ---------- tekst <-> blokken ----------
  var RE = {
    tegel: /^tegel:\s*\[([^\]]+)\]\(([^)\s]+)\)\s*(\S+)?$/i,
    foto: /^!\[([^\]]*)\]\(([^)\s]+)\)$/,
    fotolink: /^\[!\[([^\]]*)\]\(([^)\s]+)\)\]\(([^)\s]+)\)$/,
    video: /^youtube:\s*(\S+)$/i,
    knop: /^knop:\s*\[([^\]]+)\]\(([^)\s]+)\)$/i,
    audio: /^audio:\s*\[([^\]]*)\]\(([^)\s]+)\)\s*(.*)$/i,
    kop: /^(#{1,3})\s+(.*)$/
  };
  function leesTekst(tekst) {
    var blokken = [], leeg = true;
    tekst.split(/\r\n|\r|\n/).forEach(function (r) {
      var t = r.trim(), m, laatste = blokken[blokken.length - 1];
      if (!t) { leeg = true; return; }
      if ((m = RE.tegel.exec(t))) {
        var tg = { titel: m[1], doel: m[2], beeld: m[3] || '' };
        if (laatste && laatste.soort === 'tegels' && !leeg) laatste.items.push(tg); else blokken.push({ soort: 'tegels', items: [tg] });
      } else if ((m = RE.fotolink.exec(t)) || (m = RE.foto.exec(t))) {
        var f = { onder: m[1], src: m[2], link: m[3] || '' };
        if (laatste && laatste.soort === 'fotos' && !leeg) laatste.items.push(f); else blokken.push({ soort: 'fotos', items: [f] });
      } else if ((m = RE.video.exec(t))) blokken.push({ soort: 'video', url: m[1] });
      else if ((m = RE.knop.exec(t))) blokken.push({ soort: 'knop', tekst: m[1], url: m[2] });
      else if ((m = RE.audio.exec(t))) {
        var nr = { titel: m[1], src: m[2], info: m[3] || '' };
        if (laatste && laatste.soort === 'audio' && !leeg) laatste.items.push(nr); else blokken.push({ soort: 'audio', items: [nr] });
      }
      else if ((m = RE.kop.exec(t))) blokken.push({ soort: 'kop', niveau: m[1].length, tekst: m[2] });
      else if (laatste && laatste.soort === 'tekst') laatste.md += (leeg ? '\n\n' : '\n') + t;
      else blokken.push({ soort: 'tekst', md: t });
      leeg = false;
    });
    return blokken;
  }
  function schrijfTekst(blokken) {
    return blokken.map(function (b) {
      if (b.soort === 'kop') return b.tekst.trim() ? '#'.repeat(b.niveau) + ' ' + b.tekst.replace(/\n/g, ' ').trim() : '';
      if (b.soort === 'tekst') return b.md.trim();
      if (b.soort === 'fotos') return b.items.filter(function (f) { return f.src; }).map(function (f) {
        var r = '![' + schoon(f.onder) + '](' + adres(f.src) + ')';
        return f.link.trim() ? '[' + r + '](' + adres(f.link) + ')' : r;
      }).join('\n');
      if (b.soort === 'video') return b.url.trim() ? 'youtube: ' + adres(b.url) : '';
      if (b.soort === 'audio') return b.items.filter(function (a) { return a.src.trim(); }).map(function (a) {
        return 'audio: [' + schoon(a.titel) + '](' + adres(a.src) + ')' + (a.info.trim() ? ' ' + a.info.replace(/\s+/g, ' ').trim() : '');
      }).join('\n');
      if (b.soort === 'knop') return b.tekst.trim() && b.url.trim() ? 'knop: [' + schoon(b.tekst) + '](' + adres(b.url) + ')' : '';
      if (b.soort === 'tegels') return b.items.filter(function (t) { return t.titel.trim() && t.doel.trim(); }).map(function (t) {
        return 'tegel: [' + schoon(t.titel) + '](' + adres(t.doel) + ')' + (t.beeld.trim() ? ' ' + adres(t.beeld) : '');
      }).join('\n');
      return '';
    }).filter(function (s) { return s; }).join('\n\n') + '\n';
  }

  // ---------- opgemaakte tekst: markdown <-> html (alleen vet, schuin, links en lijstjes) ----------
  function inlineHtml(t) {
    t = esc(t);
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, tk, a) { return '<a href="' + a + '">' + tk + '</a>'; });
    t = t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    t = t.replace(/(^|[^*\w])\*(?!\s)(.+?)(?<!\s)\*(?!\w)/g, '$1<i>$2</i>');
    return t;
  }
  function mdNaarHtml(md) {
    if (!md.trim()) return '<p><br></p>';
    return md.split(/\n{2,}/).map(function (alinea) {
      var uit = '', regels = alinea.split('\n'), lijst = null, losse = [];
      function sluitLos() { if (losse.length) { uit += '<p>' + losse.map(inlineHtml).join('<br>') + '</p>'; losse = []; } }
      function sluitLijst() { if (lijst) { uit += '</' + lijst + '>'; lijst = null; } }
      regels.forEach(function (r) {
        var m = /^(-|\*|\d+\.)\s+(.*)$/.exec(r);
        if (m) {
          sluitLos();
          var s = m[1] === '-' || m[1] === '*' ? 'ul' : 'ol';
          if (lijst !== s) { sluitLijst(); uit += '<' + s + '>'; lijst = s; }
          uit += '<li>' + inlineHtml(m[2]) + '</li>';
        } else { sluitLijst(); losse.push(r); }
      });
      sluitLijst(); sluitLos();
      return uit;
    }).join('');
  }
  function htmlNaarMd(wortel) {
    function inl(nodes) {
      var s = '';
      Array.prototype.forEach.call(nodes, function (n) {
        if (n.nodeType === 3) { s += n.nodeValue.replace(/\s+/g, ' '); return; }
        if (n.nodeType !== 1) return;
        var t = n.tagName, x;
        if (t === 'BR') s += '\n';
        else if (t === 'B' || t === 'STRONG' || (n.style && /bold|[6-9]00/.test(n.style.fontWeight))) s += omhul(inl(n.childNodes), '**');
        else if (t === 'I' || t === 'EM' || (n.style && n.style.fontStyle === 'italic')) s += omhul(inl(n.childNodes), '*');
        else if (t === 'A') { x = inl(n.childNodes).replace(/[\[\]]/g, ''); var h = n.getAttribute('href') || ''; s += h && x.trim() ? '[' + x + '](' + adres(h) + ')' : x; }
        else if (/^(P|DIV|LI|H\d|BLOCKQUOTE)$/.test(t)) s += '\n' + inl(n.childNodes) + '\n';
        else s += inl(n.childNodes);
      });
      return s;
    }
    function omhul(x, teken) {
      var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(x);
      return m[2] ? m[1] + teken + m[2] + teken + m[3] : x;
    }
    function regels(x) { return x.split('\n').map(function (r) { return r.trim(); }).filter(function (r) { return r; }).join('\n'); }
    var delen = [], los = [];
    function sluit() { if (los.length) { var r = regels(inl(los)); if (r) delen.push(r); los = []; } }
    Array.prototype.forEach.call(wortel.childNodes, function (n) {
      if (n.nodeType === 1 && (n.tagName === 'UL' || n.tagName === 'OL')) {
        sluit();
        var i = 0, lijst = [];
        Array.prototype.forEach.call(n.children, function (li) { var r = inl(li.childNodes).replace(/\s*\n\s*/g, ' ').trim(); if (r) lijst.push((n.tagName === 'UL' ? '- ' : (++i) + '. ') + r); });
        if (lijst.length) delen.push(lijst.join('\n'));
      } else if (n.nodeType === 1 && /^(P|DIV|H\d|BLOCKQUOTE)$/.test(n.tagName)) {
        sluit();
        var r = regels(inl(n.childNodes)); if (r) delen.push(r);
      } else los.push(n);
    });
    sluit();
    return delen.join('\n\n');
  }

  // ---------- slepen om te ordenen (blokken onder elkaar, foto's en tegels in een raster) ----------
  function sorteerbaar(lijst, greepSel, raster, klaar) {
    var s = null;
    lijst.addEventListener('pointerdown', function (e) {
      var g = e.target.closest(greepSel);
      if (!g || e.button > 0) return;
      var item = g.closest('[data-i]');
      if (!item || item.parentNode !== lijst) return;
      s = { item: item, x: e.clientX, y: e.clientY, bezig: false };
    });
    document.addEventListener('pointermove', function (e) {
      if (!s) return;
      if (!s.bezig) {
        if (Math.abs(e.clientX - s.x) + Math.abs(e.clientY - s.y) < 6) return;
        s.bezig = true; s.item.classList.add('sleept'); document.body.classList.add('bezig-slepen');
      }
      e.preventDefault();
      if (e.clientY < 60) window.scrollBy(0, -12); else if (e.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
      var anderen = Array.prototype.filter.call(lijst.children, function (c) { return c !== s.item && c.hasAttribute('data-i'); });
      if (!raster) {
        var voor = null;
        for (var i = 0; i < anderen.length && !voor; i++) { var b = anderen[i].getBoundingClientRect(); if (e.clientY < b.top + b.height / 2) voor = anderen[i]; }
        if (voor) lijst.insertBefore(s.item, voor); else if (anderen.length) lijst.insertBefore(s.item, anderen[anderen.length - 1].nextSibling);
        return;
      }
      var best = null, afst = Infinity;
      anderen.forEach(function (c) {
        var b = c.getBoundingClientRect();
        var d = Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2));
        if (d < afst) { afst = d; best = c; }
      });
      if (!best) return;
      var bb = best.getBoundingClientRect();
      var na = e.clientY > bb.bottom ? true : e.clientY < bb.top ? false : e.clientX > bb.left + bb.width / 2;
      lijst.insertBefore(s.item, na ? best.nextSibling : best);
    });
    function einde() {
      if (!s) return;
      var was = s; s = null;
      if (!was.bezig) return;
      was.item.classList.remove('sleept'); document.body.classList.remove('bezig-slepen');
      var volgorde = Array.prototype.filter.call(lijst.children, function (c) { return c.hasAttribute('data-i'); }).map(function (c) { return +c.dataset.i; });
      // de klik die na het loslaten komt niet laten doorgaan
      var stop = function (ev) { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener('click', stop, true);
      setTimeout(function () { window.removeEventListener('click', stop, true); }, 0);
      klaar(volgorde);
    }
    document.addEventListener('pointerup', einde);
    document.addEventListener('pointercancel', einde);
  }
  function herorden(lijst, volgorde) { return volgorde.map(function (i) { return lijst[i]; }); }
  houder.addEventListener('dragstart', function (e) { e.preventDefault(); });

  // ---------- de blokken ----------
  var NAMEN = { kop: 'Kopje', tekst: 'Tekst', fotos: "Foto's", video: 'Video', audio: 'Audio', tegels: 'Tegels', knop: 'Knop' };
  var UITLEG = {
    fotos: "Eén foto staat groot op de pagina, meer foto's worden een fotogalerij. Sleep om de volgorde te veranderen. Zonder link wordt de foto groter bij klikken.",
    video: 'Plak de link uit YouTube (Delen → Kopiëren).',
    tegels: 'Een raster met plaatjes die naar een andere pagina gaan. Gebruik een YouTube-link of een foto voor het plaatje.',
    knop: 'Een opvallende knop, bijvoorbeeld voor kaartverkoop.',
    audio: 'Eén nummer of een speellijst. Kies mp3- of m4a-bestanden uit Nextcloud, of upload ze. Sleep aan ⠿ om de volgorde te veranderen.'
  };
  var blokken = leesTekst(bron.value);
  var lijstEl = el('div', 'blokken');
  var balk = el('div', 'blok-toevoegen');
  var ruwKnop = el('button', 'licht klein', 'Als tekst bewerken');
  ruwKnop.type = 'button';
  var kopBalk = el('div', 'editor-kop');
  kopBalk.append(el('span', 'stil', 'Sleep een blok aan ⠿ om de volgorde te veranderen.'), ruwKnop);
  houder.append(kopBalk, lijstEl, balk);
  bron.hidden = true;
  var hulp = document.getElementById('tekshulp'); if (hulp) hulp.hidden = true;
  var ruw = false;

  function bewaar() { bron.value = schrijfTekst(blokken); }

  function nieuw(soort) {
    if (soort === 'kop') return { soort: 'kop', niveau: 2, tekst: '' };
    if (soort === 'tekst') return { soort: 'tekst', md: '' };
    if (soort === 'fotos') return { soort: 'fotos', items: [] };
    if (soort === 'video') return { soort: 'video', url: '' };
    if (soort === 'tegels') return { soort: 'tegels', items: [] };
    if (soort === 'audio') return { soort: 'audio', items: [] };
    return { soort: 'knop', tekst: '', url: '' };
  }

  function invoer(label, waarde, bij, extra) {
    var l = el('label', 'blok-veld');
    l.append(document.createTextNode(label));
    var i = el('input'); i.value = waarde || ''; if (extra) for (var k in extra) i.setAttribute(k, extra[k]);
    i.addEventListener('input', function () { bij(i.value); bewaar(); });
    l.appendChild(i);
    return l;
  }

  function tekenKop(b, lichaam) {
    var rij = el('div', 'kop-rij');
    var niv = el('select');
    [[1, 'Grote kop'], [2, 'Kop'], [3, 'Kleine kop']].forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; if (b.niveau === o[0]) op.selected = true; niv.appendChild(op); });
    var i = el('input', 'kopinvoer kop' + b.niveau); i.value = b.tekst; i.placeholder = 'Tekst van het kopje';
    niv.onchange = function () { b.niveau = +niv.value; i.className = 'kopinvoer kop' + b.niveau; bewaar(); };
    i.oninput = function () { b.tekst = i.value; bewaar(); };
    rij.append(i, niv);
    lichaam.appendChild(rij);
  }

  function tekenTekst(b, lichaam) {
    var werk = el('div', 'tekstwerk');
    var knoppen = [['B', 'bold', 'Vet'], ['I', 'italic', 'Schuin'], ['🔗', 'link', 'Link'], ['• Lijst', 'insertUnorderedList', 'Opsomming'], ['1. Lijst', 'insertOrderedList', 'Genummerde lijst']];
    var vak = el('div', 'tekstvak tekst');
    vak.contentEditable = 'true';
    vak.innerHTML = mdNaarHtml(b.md);
    knoppen.forEach(function (k) {
      var kn = el('button', 'licht klein', k[0]); kn.type = 'button'; kn.title = k[2];
      kn.addEventListener('mousedown', function (e) { e.preventDefault(); }); // selectie in de tekst houden
      kn.onclick = function () {
        vak.focus();
        if (k[1] === 'link') {
          var a = prompt('Link naar een webadres (https://…) of naar een pagina van de site (bijv. over-ons). Leeg = link weghalen.', '');
          if (a === null) return;
          a = a.trim();
          if (!a) document.execCommand('unlink');
          else {
            if (/^www\./i.test(a)) a = 'https://' + a;
            if (window.getSelection().isCollapsed) document.execCommand('insertHTML', false, '<a href="' + esc(a) + '">' + esc(a) + '</a>');
            else document.execCommand('createLink', false, a);
          }
        } else document.execCommand(k[1]);
        b.md = htmlNaarMd(vak); bewaar();
      };
      werk.appendChild(kn);
    });
    vak.addEventListener('input', function () { b.md = htmlNaarMd(vak); bewaar(); });
    vak.addEventListener('paste', function (e) {
      // alleen platte tekst plakken, geen opmaak van andere websites of Word
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, t);
    });
    vak.addEventListener('focus', function () { try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (er) {} });
    lichaam.append(werk, vak);
  }

  function tekenFotos(b, lichaam) {
    var raster = el('div', 'blok-raster');
    b.items.forEach(function (f, i) {
      var k = el('div', 'fotokaart'); k.dataset.i = i;
      var beeld = el('div', 'kaartbeeld greep-beeld'); beeld.title = 'Slepen om te verplaatsen';
      var img = el('img'); img.alt = ''; img.src = fotoSrc(f.src); beeld.appendChild(img);
      var weg = el('button', 'kaartweg', '×'); weg.type = 'button'; weg.title = 'Foto weghalen';
      weg.onclick = function () { b.items.splice(i, 1); bewaar(); teken(); };
      beeld.appendChild(weg);
      k.append(beeld,
        invoer('Onderschrift', f.onder, function (v) { f.onder = v; }, { placeholder: 'mag leeg' }),
        invoer('Link', f.link, function (v) { f.link = v; }, { placeholder: 'leeg = groot bekijken', list: 'ed-paginas' }));
      raster.appendChild(k);
    });
    var plus = el('button', 'fotoplus', "+ Foto's kiezen"); plus.type = 'button';
    plus.onclick = function () {
      window.kiesFotos({ meer: true }, function (namen) {
        namen.forEach(function (n) { b.items.push({ src: 'fotos/' + n, onder: '', link: '' }); });
        bewaar(); teken();
      });
    };
    raster.appendChild(plus);
    sorteerbaar(raster, '.greep-beeld', true, function (v) { b.items = herorden(b.items, v); bewaar(); teken(); });
    lichaam.appendChild(raster);
  }

  function tekenVideo(b, lichaam) {
    var rij = el('div', 'videorij');
    var vb = el('div', 'videovb');
    function toon() {
      var id = ytId(b.url);
      vb.innerHTML = id ? '<img alt="" src="https://i.ytimg.com/vi/' + id + '/hqdefault.jpg"><span class="knopje">▶</span>' : '<span class="stil">' + (b.url.trim() ? 'Dit is geen YouTube-link' : 'Nog geen video') + '</span>';
    }
    rij.append(invoer('YouTube-link', b.url, function (v) { b.url = v.trim(); toon(); }, { placeholder: 'https://youtu.be/…', type: 'url' }), vb);
    toon();
    lichaam.appendChild(rij);
  }

  function tekenTegels(b, lichaam) {
    var raster = el('div', 'blok-raster');
    b.items.forEach(function (t, i) {
      var k = el('div', 'fotokaart'); k.dataset.i = i;
      var beeld = el('div', 'kaartbeeld greep-beeld'); beeld.title = 'Slepen om te verplaatsen';
      var img = el('img'); img.alt = '';
      function toon() { var id = ytId(t.beeld); var src = id ? 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' : fotoSrc(t.beeld); img.hidden = !src; if (src) img.src = src; }
      beeld.appendChild(img);
      var weg = el('button', 'kaartweg', '×'); weg.type = 'button'; weg.title = 'Tegel weghalen';
      weg.onclick = function () { b.items.splice(i, 1); bewaar(); teken(); };
      beeld.appendChild(weg);
      var beeldVeld = invoer('Plaatje: YouTube-link of foto', t.beeld, function (v) { t.beeld = v; toon(); }, { placeholder: 'https://youtu.be/… of fotos/…' });
      var kies = el('button', 'licht klein', '📷'); kies.type = 'button'; kies.title = 'Foto kiezen';
      kies.onclick = function () {
        var nu = /^fotos\/([\w.-]+)$/.exec(t.beeld || '');
        window.kiesFotos({ meer: false, huidig: nu ? nu[1] : null }, function (namen) { t.beeld = 'fotos/' + namen[0]; bewaar(); teken(); });
      };
      beeldVeld.appendChild(kies);
      k.append(beeld,
        invoer('Titel', t.titel, function (v) { t.titel = v; }),
        invoer('Gaat naar (pagina of webadres)', t.doel, function (v) { t.doel = v; }, { list: 'ed-paginas', placeholder: 'bijv. over-ons' }),
        beeldVeld);
      toon();
      raster.appendChild(k);
    });
    var plus = el('button', 'fotoplus', '+ Tegel'); plus.type = 'button';
    plus.onclick = function () { b.items.push({ titel: '', doel: '', beeld: '' }); bewaar(); teken(); };
    raster.appendChild(plus);
    sorteerbaar(raster, '.greep-beeld', true, function (v) { b.items = herorden(b.items, v); bewaar(); teken(); });
    lichaam.appendChild(raster);
  }

  function tekenAudio(b, lichaam) {
    var lijst = el('div', 'nummerlijst');
    var naarTitel = function (n) { return n.replace(/\.\w+$/, '').replace(/[-_]+/g, ' ').replace(/^\w/, function (c) { return c.toUpperCase(); }); };
    b.items.forEach(function (a, i) {
      var rij = el('div', 'ed-nummer'); rij.dataset.i = i;
      var greep = el('span', 'nummer-greep', '⠿'); greep.title = 'Slepen om te verplaatsen';
      var velden = el('div', 'nummer-velden');
      var speler = el('audio'); speler.controls = true; speler.preload = 'none';
      var s = audioSrc(a.src); if (s) speler.src = s; else speler.hidden = true;
      var bestand = invoer('Bestand', a.src, function (v) { a.src = v.trim(); var z = audioSrc(a.src); speler.hidden = !z; if (z) speler.src = z; }, { placeholder: 'audio/naam.mp3 of https://…' });
      var kies = el('button', 'licht klein', '🎵 Ander bestand'); kies.type = 'button';
      kies.onclick = function () {
        var nu = /^audio\/([\w.-]+)$/.exec(a.src || '');
        window.kiesFotos({ soort: 'audio', meer: false, huidig: nu ? nu[1] : null }, function (namen) { a.src = 'audio/' + namen[0]; if (!a.titel.trim()) a.titel = naarTitel(namen[0]); bewaar(); teken(); });
      };
      bestand.appendChild(kies);
      var rij2 = el('div', 'blok-rij');
      rij2.append(invoer('Titel', a.titel, function (v) { a.titel = v; }), invoer('Toelichting (mag leeg)', a.info, function (v) { a.info = v; }, { placeholder: 'bijv. Georgië · opname 2024' }));
      velden.append(rij2, bestand, speler);
      var weg = el('button', 'kaartweg', '×'); weg.type = 'button'; weg.title = 'Nummer weghalen';
      weg.onclick = function () { b.items.splice(i, 1); bewaar(); teken(); };
      rij.append(greep, velden, weg);
      lijst.appendChild(rij);
    });
    var plus = el('button', 'fotoplus nummerplus', '+ Nummers kiezen'); plus.type = 'button';
    plus.onclick = function () {
      window.kiesFotos({ soort: 'audio', meer: true }, function (namen) {
        namen.forEach(function (n) { b.items.push({ titel: naarTitel(n), src: 'audio/' + n, info: '' }); });
        bewaar(); teken();
      });
    };
    lijst.appendChild(plus);
    sorteerbaar(lijst, '.nummer-greep', false, function (v) { b.items = herorden(b.items, v); bewaar(); teken(); });
    lichaam.appendChild(lijst);
  }

  function tekenKnop(b, lichaam) {
    var rij = el('div', 'blok-rij');
    rij.append(invoer('Tekst op de knop', b.tekst, function (v) { b.tekst = v; }),
      invoer('Gaat naar', b.url, function (v) { b.url = v; }, { list: 'ed-paginas', placeholder: 'https://… of een pagina' }));
    lichaam.appendChild(rij);
  }

  var TEKEN = { kop: tekenKop, tekst: tekenTekst, fotos: tekenFotos, video: tekenVideo, tegels: tekenTegels, knop: tekenKnop, audio: tekenAudio };

  function teken(focusOp) {
    var y = window.scrollY;
    lijstEl.innerHTML = '';
    blokken.forEach(function (b, i) {
      var blok = el('section', 'blok blok-' + b.soort); blok.dataset.i = i;
      var kop = el('div', 'blok-balk');
      var greep = el('span', 'blok-greep', '⠿'); greep.title = 'Slepen om te verplaatsen';
      kop.append(greep, el('span', 'blok-naam', NAMEN[b.soort]));
      if (UITLEG[b.soort]) kop.appendChild(el('span', 'blok-uitleg stil', UITLEG[b.soort]));
      [['↑', -1, 'Omhoog'], ['↓', 1, 'Omlaag']].forEach(function (p) {
        var k = el('button', 'licht klein', p[0]); k.type = 'button'; k.title = p[2];
        k.disabled = i + p[1] < 0 || i + p[1] >= blokken.length;
        k.onclick = function () { var x = blokken.splice(i, 1)[0]; blokken.splice(i + p[1], 0, x); bewaar(); teken(); };
        kop.appendChild(k);
      });
      var weg = el('button', 'licht klein', 'Weghalen'); weg.type = 'button';
      weg.onclick = function () {
        if (schrijfTekst([b]).trim() && !confirm('Dit blok weghalen?')) return;
        blokken.splice(i, 1); bewaar(); teken();
      };
      kop.appendChild(weg);
      var lichaam = el('div', 'blok-lichaam');
      TEKEN[b.soort](b, lichaam);
      blok.append(kop, lichaam);
      lijstEl.appendChild(blok);
    });
    if (!blokken.length) lijstEl.appendChild(el('p', 'stil leeg', 'Nog leeg. Voeg hieronder een blok toe.'));
    window.scrollTo(0, y);
    if (focusOp != null) {
      var doel = lijstEl.children[focusOp] && lijstEl.children[focusOp].querySelector('input, [contenteditable]');
      if (doel) doel.focus();
    }
  }
  sorteerbaar(lijstEl, '.blok-greep', false, function (v) { blokken = herorden(blokken, v); bewaar(); teken(); });

  // Knoppen om een blok toe te voegen; het soort pagina bepaalt welke vooraan staan
  var VOORKEUR = { tekst: ['tekst', 'kop', 'fotos', 'video', 'audio', 'knop', 'tegels'], fotos: ['fotos', 'tekst', 'kop', 'video', 'audio', 'knop', 'tegels'], video: ['video', 'tekst', 'kop', 'audio', 'tegels', 'fotos', 'knop'], overzicht: ['tegels', 'tekst', 'kop', 'fotos', 'video', 'audio', 'knop'], luisteren: ['audio', 'tekst', 'kop', 'fotos', 'video', 'knop', 'tegels'] };
  function tekenBalk() {
    balk.innerHTML = '';
    balk.appendChild(el('span', 'stil', 'Toevoegen:'));
    (VOORKEUR[soortVeld && soortVeld.value] || VOORKEUR.tekst).forEach(function (s, n) {
      var k = el('button', n === 0 ? 'klein' : 'licht klein', '+ ' + NAMEN[s]); k.type = 'button';
      k.onclick = function () {
        blokken.push(nieuw(s)); bewaar(); teken(blokken.length - 1);
        if (s === 'fotos' || s === 'audio') lijstEl.lastChild.querySelector('.fotoplus').click();
      };
      balk.appendChild(k);
    });
  }

  // Nieuwe, nog lege pagina: met het soort pagina ook de beginblokken kiezen
  function beginBlokken() {
    var s = soortVeld ? soortVeld.value : 'tekst';
    var titel = titelVeld ? titelVeld.value.trim() : '';
    var b = [{ soort: 'kop', niveau: 1, tekst: titel }];
    if (s === 'fotos') b.push(nieuw('tekst'), nieuw('fotos'));
    else if (s === 'video') b.push(nieuw('video'), nieuw('tekst'));
    else if (s === 'overzicht') b.push(nieuw('tekst'), nieuw('tegels'));
    else if (s === 'luisteren') b.push(nieuw('tekst'), nieuw('audio'));
    else b.push(nieuw('tekst'));
    return b;
  }
  function isLeeg() { return !blokken.some(function (b) { return b.soort !== 'kop' && schrijfTekst([b]).trim(); }); }
  var nieuwePagina = houder.dataset.nieuw === '1';
  if (nieuwePagina && isLeeg()) { blokken = beginBlokken(); bewaar(); }
  if (soortVeld) soortVeld.addEventListener('change', function () {
    tekenBalk();
    if (nieuwePagina && isLeeg()) { blokken = beginBlokken(); bewaar(); teken(); }
  });
  // De titel van een nieuwe pagina gaat ook in de grote kop, zolang je die niet zelf veranderd hebt
  if (nieuwePagina && titelVeld) titelVeld.addEventListener('input', function () {
    var k = blokken[0];
    if (k && k.soort === 'kop' && k.niveau === 1 && (k.tekst === '' || k.tekst === titelVeld.dataset.vorige)) { k.tekst = titelVeld.value; bewaar(); var i = lijstEl.querySelector('.kopinvoer'); if (i) i.value = k.tekst; }
    titelVeld.dataset.vorige = titelVeld.value;
  });

  // Als tekst bewerken (voor wie dat liever doet), en weer terug
  ruwKnop.onclick = function () {
    ruw = !ruw;
    if (ruw) { bewaar(); bron.hidden = false; if (hulp) hulp.hidden = false; lijstEl.hidden = true; balk.hidden = true; ruwKnop.textContent = 'Terug naar de blokken'; bron.focus(); }
    else { blokken = leesTekst(bron.value); bron.hidden = true; if (hulp) hulp.hidden = true; lijstEl.hidden = false; balk.hidden = false; ruwKnop.textContent = 'Als tekst bewerken'; teken(); }
  };
  bron.form.addEventListener('submit', function () { if (!ruw) bewaar(); });

  // Paginanamen als suggestie bij links
  var dl = el('datalist'); dl.id = 'ed-paginas';
  (data.paginas || []).forEach(function (p) { var o = el('option'); o.value = p.slug; o.label = p.titel; dl.appendChild(o); });
  houder.appendChild(dl);

  tekenBalk();
  teken();
})();
