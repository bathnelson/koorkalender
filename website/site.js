// Kleine verbeteringen voor bezoekers. Zonder JavaScript werkt alles ook (dan openen video's en foto's gewoon in een nieuw venster).
(function () {
  // Video's: pas na een klik de YouTube-speler laden (sneller, en YouTube kijkt niet mee met wie alleen de pagina bekijkt)
  document.querySelectorAll('a.speel[data-yt]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('data-yt');
      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
      e.preventDefault();
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1';
      f.title = 'Video';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      a.replaceWith(f);
    });
  });

  // Galerij: van foto's van elders de verhouding pas na het laden bepalen
  document.querySelectorAll('.galerij figure:not([style]) img').forEach(function (img) {
    var zet = function () { if (img.naturalWidth && img.naturalHeight) img.closest('figure').style.setProperty('--r', (img.naturalWidth / img.naturalHeight).toFixed(3)); };
    if (img.complete) zet(); else img.addEventListener('load', zet);
  });

  // Foto's: groot bekijken in een lichtbak, met pijltjes naar de vorige en volgende foto in dezelfde galerij
  var huidige = [], plek = 0, bak = null, img = null, onder = null;
  function toon() {
    var a = huidige[plek];
    img.src = a.href;
    var cap = a.parentNode.querySelector('figcaption');
    onder.textContent = cap ? cap.textContent : '';
  }
  function sluit() { if (bak) { bak.remove(); bak = null; document.removeEventListener('keydown', toets); } }
  function stap(n) { plek = (plek + n + huidige.length) % huidige.length; toon(); }
  function toets(e) { if (e.key === 'Escape') sluit(); if (e.key === 'ArrowRight') stap(1); if (e.key === 'ArrowLeft') stap(-1); }
  function open(lijst, i) {
    huidige = lijst; plek = i;
    bak = document.createElement('div');
    bak.className = 'lichtbak';
    bak.innerHTML = '<button class="lb-sluit" aria-label="Sluiten">×</button><button class="lb-vorige" aria-label="Vorige">‹</button><figure><img alt=""><figcaption></figcaption></figure><button class="lb-volgende" aria-label="Volgende">›</button>';
    img = bak.querySelector('img'); onder = bak.querySelector('figcaption');
    bak.querySelector('.lb-sluit').onclick = sluit;
    bak.querySelector('.lb-vorige').onclick = function (e) { e.stopPropagation(); stap(-1); };
    bak.querySelector('.lb-volgende').onclick = function (e) { e.stopPropagation(); stap(1); };
    bak.onclick = function (e) { if (e.target === bak) sluit(); };
    if (lijst.length < 2) { bak.querySelector('.lb-vorige').hidden = true; bak.querySelector('.lb-volgende').hidden = true; }
    document.body.appendChild(bak);
    document.addEventListener('keydown', toets);
    toon();
  }
  document.querySelectorAll('.galerij, .foto').forEach(function (g) {
    var links = Array.prototype.slice.call(g.querySelectorAll('figure > a:not(.doorlink)'));
    links.forEach(function (a, i) {
      a.addEventListener('click', function (e) { e.preventDefault(); open(links, i); });
    });
  });

  // Luisteren: een eigen, rustige speler per nummer. Er speelt er steeds één; na afloop begint het volgende nummer.
  function tijd(s) { if (!isFinite(s)) return '–:––'; s = Math.floor(s); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  var alleSpelers = [];
  document.querySelectorAll('ol.speellijst').forEach(function (lijst) {
    lijst.classList.add('verrijkt');
    var rijen = Array.prototype.slice.call(lijst.querySelectorAll('li.nummer'));
    rijen.forEach(function (li, i) {
      var audio = li.querySelector('audio');
      if (!audio) return;
      alleSpelers.push(audio);
      audio.controls = false;
      var knop = document.createElement('button');
      knop.type = 'button'; knop.className = 'speelknop';
      var titel = li.querySelector('.nummer-titel');
      knop.setAttribute('aria-label', 'Afspelen: ' + (titel ? titel.textContent : 'nummer'));
      knop.innerHTML = '<span class="nr">' + (i + 1) + '</span>';
      li.insertBefore(knop, li.firstChild);
      var balk = document.createElement('div'); balk.className = 'nummer-balk';
      var schuif = document.createElement('input'); schuif.type = 'range'; schuif.min = 0; schuif.max = 1000; schuif.value = 0; schuif.step = 1;
      schuif.setAttribute('aria-label', 'Positie');
      var tijden = document.createElement('span'); tijden.className = 'nummer-tijd'; tijden.textContent = '0:00 / –:––';
      balk.append(schuif, tijden);
      li.querySelector('.nummer-tekst').appendChild(balk);
      function bij() {
        var d = audio.duration;
        schuif.value = isFinite(d) && d > 0 ? Math.round(audio.currentTime / d * 1000) : 0;
        schuif.style.setProperty('--p', (schuif.value / 10) + '%');
        tijden.textContent = tijd(audio.currentTime) + ' / ' + tijd(d);
      }
      audio.addEventListener('loadedmetadata', bij);
      audio.addEventListener('timeupdate', bij);
      audio.addEventListener('play', function () {
        alleSpelers.forEach(function (a) { if (a !== audio) a.pause(); });
        li.classList.add('speelt'); knop.setAttribute('aria-label', 'Pauzeren');
      });
      audio.addEventListener('pause', function () { li.classList.remove('speelt'); knop.setAttribute('aria-label', 'Afspelen'); });
      audio.addEventListener('ended', function () {
        li.classList.remove('speelt');
        var volgende = rijen[i + 1] && rijen[i + 1].querySelector('audio');
        if (volgende) volgende.play();
      });
      knop.addEventListener('click', function () { if (audio.paused) audio.play(); else audio.pause(); });
      schuif.addEventListener('input', function () {
        if (isFinite(audio.duration)) audio.currentTime = schuif.value / 1000 * audio.duration;
        schuif.style.setProperty('--p', (schuif.value / 10) + '%');
      });
      bij();
    });
  });
})();
