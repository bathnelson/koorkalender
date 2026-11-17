<?php
declare(strict_types=1);

// Ledengedeelte: jaarkalender en bestanden uit Nextcloud. Wordt geladen via index.php.
if (!isset($CONFIG)) { http_response_code(404); exit; }

if (($_POST['actie'] ?? '') === 'uitloggen') {
    controleerCsrf();
    uitloggen();
    header('Location: ' . url(), true, 303);
    exit;
}

$melding = probeerLogin('leden', $CONFIG);

// Inloggen met Nextcloud
if (ssoAan($CONFIG) && isset($_GET['sso'])) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    if ($_GET['sso'] === 'start') {
        $login = ssoStart($CONFIG);
        echo json_encode($login ? ['login' => $login] : ['fout' => 'Nextcloud is niet bereikbaar. Probeer het later opnieuw.']);
    } else {
        echo json_encode(ssoCheck($CONFIG));
    }
    exit;
}

if (ssoAan($CONFIG) && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && isset($_POST['nc_naam'])) {
    $melding = ssoFormulier($CONFIG, (string)$_POST['nc_naam'], (string)($_POST['nc_wachtwoord'] ?? ''));
    if ($melding === null) { header('Location: ' . url('leden'), true, 303); exit; }
    sleep(1);
}

if (!ingelogd('leden')) {
    $metWachtwoord = !in_array((string)($CONFIG['leden_wachtwoord'] ?? ''), ['', 'verander-mij'], true);
    kop($CONFIG, 'Leden', 'leden');
    echo '<section class="inlog"><h1>Voor leden</h1>';
    if ($melding) echo '<p class="fout">' . h($melding) . '</p>';
    if (ssoAan($CONFIG)) {
        echo '<p>Log in met je Nextcloud-account van het koor.</p>'
            . '<form method="post"><label>Gebruikersnaam of e-mailadres<input name="nc_naam" autocomplete="username" required autofocus value="' . h($_POST['nc_naam'] ?? '') . '"></label>'
            . '<label>Wachtwoord<input type="password" name="nc_wachtwoord" autocomplete="current-password" required></label><button>Inloggen</button></form>'
            . '<p class="stil">Je wachtwoord gaat alleen naar Nextcloud en wordt niet bewaard.</p>'
            . '<p class="stil">Heb je tweestapsverificatie aan? <button type="button" id="ncknop" class="licht klein">Inloggen via Nextcloud</button></p><p id="ncstatus" class="stil" hidden></p>';
        echo <<<'JS'
<script>
(function () {
  const knop = document.getElementById('ncknop'), status = document.getElementById('ncstatus');
  const zeg = (t, fout) => { status.hidden = false; status.textContent = t; status.className = fout ? 'fout' : 'stil'; };
  const wacht = async venster => {
    zeg('Log in in het Nextcloud-venster en klik daar op "Toegang verlenen". Deze pagina gaat daarna vanzelf verder.');
    const tot = Date.now() + 20 * 60000;
    while (Date.now() < tot) {
      await new Promise(k => setTimeout(k, 2000));
      const c = await (await fetch('?sso=check', { credentials: 'same-origin' })).json();
      if (c.status === 'ok') { try { venster && venster.close(); } catch (e) {} location.reload(); return; }
      if (c.status === 'fout') throw new Error(c.melding);
    }
    throw new Error('Het inloggen duurde te lang. Probeer het opnieuw.');
  };
  const mis = (e, venster) => { try { venster && venster.close(); } catch (x) {} zeg(e.message, true); knop.disabled = false; };
  knop.addEventListener('click', async () => {
    const venster = window.open('', 'nextcloud');
    knop.disabled = true; zeg('Nextcloud wordt geopend…');
    try {
      const r = await (await fetch('?sso=start', { credentials: 'same-origin' })).json();
      if (!r.login) throw new Error(r.fout || 'Nextcloud is niet bereikbaar.');
      if (!venster) { try { sessionStorage.setItem('ncbezig', '1'); } catch (e) {} location.href = r.login; return; }
      venster.location = r.login;
      await wacht(venster);
    } catch (e) { mis(e, venster); }
  });
  // Kon er geen nieuw venster open (bijv. op sommige telefoons), dan ging het in dit venster: na terugkomen verder wachten
  let bezig = false;
  try { bezig = sessionStorage.getItem('ncbezig') === '1'; sessionStorage.removeItem('ncbezig'); } catch (e) {}
  if (bezig) { knop.disabled = true; wacht(null).catch(e => mis(e, null)); }
})();
</script>
JS;
        if ($metWachtwoord) echo '<p class="stil">Of met het gezamenlijke ledenwachtwoord:</p>';
    } else {
        echo '<p>Log in met het ledenwachtwoord. Dat krijg je van het bestuur.</p>';
    }
    if ($metWachtwoord || !ssoAan($CONFIG)) {
        echo '<form method="post"><label>Wachtwoord<input type="password" name="wachtwoord" autocomplete="current-password" required' . (ssoAan($CONFIG) ? '' : ' autofocus') . '></label><button>Inloggen</button></form>';
    }
    echo '</section>';
    voet($CONFIG);
    exit;
}

// Een bestand ophalen uit Nextcloud
if (isset($_GET['bestand']) && ncAan($CONFIG)) {
    $pad = ncSchoonPad((string)$_GET['bestand']);
    if ($pad === null || $pad === '') { http_response_code(400); exit('Ongeldig pad.'); }
    session_write_close(); // een lange download houdt andere pagina's niet op
    ncDownload($CONFIG, $pad);
    exit;
}

$tab = ($_GET['tab'] ?? '') === 'bestanden' || isset($_GET['map']) ? 'bestanden' : 'kalender';
$ledenUrl = url('leden');

kop($CONFIG, 'Leden', 'leden');
$naam = (string)($_SESSION['naam'] ?? '');
echo '<div class="ledenkop"><h1>' . ($naam !== '' ? 'Welkom, ' . h($naam) : 'Ledengedeelte') . '</h1><form method="post"><input type="hidden" name="csrf" value="' . h(csrfToken()) . '"><button name="actie" value="uitloggen" class="licht">Uitloggen</button></form></div>';
echo '<nav class="tabs"><a href="' . h($ledenUrl) . '"' . ($tab === 'kalender' ? ' class="actief"' : '') . '>Jaarkalender</a>';
if (ncAan($CONFIG)) echo '<a href="' . h($ledenUrl . '?tab=bestanden') . '"' . ($tab === 'bestanden' ? ' class="actief"' : '') . '>Bestanden</a>';
echo '</nav>';

if ($tab === 'kalender') {
    $k = (string)($CONFIG['kalender_url'] ?? '');
    if ($k === '') {
        echo '<p class="stil">De jaarkalender is nog niet ingesteld (kalender_url in config.php).</p>';
    } else {
        echo '<div class="kalender"><iframe src="' . h($k) . '" title="Jaarkalender"></iframe></div>';
        echo '<p class="stil"><a href="' . h($k) . '" target="_blank" rel="noopener">Kalender openen in een eigen venster</a> (handig op de telefoon, en daar vind je ook de knop om hem in je eigen agenda te zetten).</p>';
    }
} else {
    $pad = ncSchoonPad((string)($_GET['map'] ?? ''));
    if ($pad === null) $pad = '';
    // kruimelpad
    echo '<p class="kruimels"><a href="' . h($ledenUrl . '?tab=bestanden') . '">Alle bestanden</a>';
    $tot = '';
    foreach ($pad === '' ? [] : explode('/', $pad) as $d) {
        $tot = ltrim($tot . '/' . $d, '/');
        echo ' / <a href="' . h($ledenUrl . '?map=' . rawurlencode($tot)) . '">' . h($d) . '</a>';
    }
    echo '</p>';

    $lijst = ncLijst($CONFIG, $pad);
    if (is_string($lijst)) {
        echo '<p class="fout">' . h($lijst) . '</p>';
    } elseif (!$lijst['mappen'] && !$lijst['bestanden']) {
        echo '<p class="stil">Deze map is leeg.</p>';
    } else {
        echo '<ul class="bestanden">';
        foreach ($lijst['mappen'] as $m) {
            $sub = ltrim($pad . '/' . $m['naam'], '/');
            echo '<li class="map"><a href="' . h($ledenUrl . '?map=' . rawurlencode($sub)) . '"><span class="ikoon">📁</span>' . h($m['naam']) . '</a></li>';
        }
        foreach ($lijst['bestanden'] as $b) {
            $sub = ltrim($pad . '/' . $b['naam'], '/');
            $ikoon = preg_match('/\.(mp3|m4a|wav|ogg)$/i', $b['naam']) ? '🎵' : (preg_match('/\.(jpe?g|png|gif|webp)$/i', $b['naam']) ? '🖼️' : (preg_match('/\.(mp4|mov)$/i', $b['naam']) ? '🎬' : '📄'));
            echo '<li><a href="' . h($ledenUrl . '?bestand=' . rawurlencode($sub)) . '" target="_blank"><span class="ikoon">' . $ikoon . '</span>' . h($b['naam'])
                . '<small>' . h(grootte($b['grootte'])) . ($b['gewijzigd'] ? ' · ' . h(date('j-n-Y', $b['gewijzigd'])) : '') . '</small></a></li>';
        }
        echo '</ul>';
    }
}
voet($CONFIG);
