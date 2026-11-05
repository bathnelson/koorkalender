// Laadt een pagina van de koorkalender: opbouw (paginas/*.html), opmaak (*.css) en code (*.js), allemaal van GitHub Pages.
// De pagina's op de host bevatten alleen <script src=".../laden.js" data-pagina="leden|beheer|afdrukken">.
(function () {
  const ik = document.currentScript;
  const BASIS = new URL('.', ik.src).href;
  const pagina = ik.dataset.pagina || 'leden';
  const css = { leden: ['stijl.css'], beheer: ['stijl.css'], afdrukken: ['stijl.css', 'afdrukken.css'] }[pagina] || ['stijl.css'];
  const js = ['gemeen.js', pagina + '.js'];

  const laadCss = href => new Promise(klaar => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = BASIS + href; l.onload = l.onerror = klaar;
    document.head.append(l);
  });
  const laadJs = src => new Promise((klaar, mis) => {
    const s = document.createElement('script');
    s.src = BASIS + src; s.async = false; s.onload = klaar; s.onerror = () => mis(new Error(src));
    document.body.append(s);
  });

  Promise.all([
    Promise.all(css.map(laadCss)),
    fetch(BASIS + 'paginas/' + pagina + '.html', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('pagina ' + r.status); return r.text(); })
  ]).then(([, html]) => {
    document.body.innerHTML = html;
    return js.reduce((p, s) => p.then(() => laadJs(s)), Promise.resolve());
  }).catch(e => {
    document.body.innerHTML = '';
    const p = document.createElement('p');
    p.style.cssText = 'font-family:system-ui,sans-serif;padding:16px';
    p.textContent = 'De jaarplanning kon niet geladen worden (' + e.message + '). Probeer het later opnieuw.';
    document.body.append(p);
  });
})();
