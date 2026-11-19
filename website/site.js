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
    var links = Array.prototype.slice.call(g.querySelectorAll('figure > a'));
    links.forEach(function (a, i) {
      a.addEventListener('click', function (e) { e.preventDefault(); open(links, i); });
    });
  });
})();
