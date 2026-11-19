<?php
declare(strict_types=1);

// Beheerpagina: pagina's en foto's van de website aanpassen. Wordt geladen via index.php.
if (!isset($CONFIG)) { http_response_code(404); exit; }

const MAX_FOTO = 8 * 1024 * 1024;
const FOTO_SOORTEN = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_GIF => 'gif', IMAGETYPE_WEBP => 'webp'];

$melding = probeerLogin('beheer', $CONFIG);
$hier = url('beheer');

if (!ingelogd('beheer')) {
    kop($CONFIG, 'Beheer', '', false);
    echo '<section class="inlog"><h1>Beheer van de website</h1>';
    if ($melding) echo '<p class="fout">' . h($melding) . '</p>';
    echo '<form method="post"><label>Wachtwoord<input type="password" name="wachtwoord" autocomplete="current-password" required autofocus></label><button>Inloggen</button></form></section>';
    voet($CONFIG);
    exit;
}

function terug(string $naar, string $bericht = '', bool $isFout = false): void {
    if (isset($_GET['ajax'])) antwoordJson([$isFout ? 'fout' : 'bericht' => $bericht]);
    startSessie();
    if ($bericht !== '') $_SESSION[$isFout ? 'bericht_fout' : 'bericht'] = $bericht;
    header('Location: ' . $naar, true, 303);
    exit;
}

// Antwoord voor de fotokiezer (uploaden zonder de pagina te verlaten)
function antwoordJson(array $data): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data);
    exit;
}

function fotoLijst(): array {
    $f = glob(FOTO_DIR . '/*.{jpg,png,gif,webp}', GLOB_BRACE) ?: [];
    usort($f, function ($a, $b) { return filemtime($b) <=> filemtime($a); });
    return array_map('basename', $f);
}

// ---- Foto's uit Nextcloud (voor de fotokiezer) ----
// Map in Nextcloud waar de kiezer begint, bijv. '7. media/Foto\'s'. Leeg = de hoofdmap.
function ncFotoPad(array $cfg, string $sub): ?string {
    $sub = ncSchoonPad($sub);
    $basis = ncSchoonPad((string)($cfg['nextcloud_fotomap'] ?? ''));
    if ($sub === null || $basis === null) return null;
    return trim($basis . '/' . $sub, '/');
}
const FOTO_EXT = '/\.(jpe?g|png|gif|webp)$/i';

if (isset($_GET['ncfotos'])) {
    if (!ncAan($CONFIG)) antwoordJson(['fout' => 'Log eerst in op de ledenpagina met je Nextcloud-account (in een nieuw tabblad van deze browser), en kom dan hier terug.', 'inlog' => url('leden')]);
    $sub = ncSchoonPad((string)($_GET['map'] ?? '')) ?? '';
    $pad = ncFotoPad($CONFIG, $sub);
    session_write_close();
    $lijst = $pad === null ? 'Ongeldige map.' : ncLijst($CONFIG, $pad);
    if (is_string($lijst)) antwoordJson(['fout' => $lijst]);
    antwoordJson([
        'map' => $sub,
        'mappen' => array_map(function ($m) { return $m['naam']; }, $lijst['mappen']),
        'fotos' => array_values(array_map(function ($b) { return $b['naam']; }, array_filter($lijst['bestanden'], function ($b) { return preg_match(FOTO_EXT, $b['naam']); }))),
    ]);
}
if (isset($_GET['ncvoorbeeld'])) {
    $pad = ncAan($CONFIG) ? ncFotoPad($CONFIG, (string)$_GET['ncvoorbeeld']) : null;
    session_write_close();
    $data = $pad !== null && preg_match(FOTO_EXT, $pad) ? (ncOphalen($CONFIG, $pad, true) ?? ncOphalen($CONFIG, $pad, false, 8 * 1024 * 1024)) : null;
    $soort = $data !== null ? (new finfo(FILEINFO_MIME_TYPE))->buffer($data) : '';
    if (!in_array($soort, ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], true)) { http_response_code(404); exit; }
    header('Content-Type: ' . $soort);
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, max-age=86400');
    echo $data;
    exit;
}

$paginas = laadPaginas();
$actie = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' ? (string)($_POST['actie'] ?? '') : '';

// Te groot voor de server (post_max_size): PHP gooit dan het hele formulier weg
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && !$_POST && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    terug($hier . '?fotos=1', 'Deze foto is te groot voor de server (maximaal ' . ini_get('post_max_size') . '). Verklein hem eerst, of verhoog de limiet (zie README).', true);
}
$voorbeeld = null;
$formulier = null; // ingevulde waarden die terug moeten in het formulier (bij voorbeeld of fout)

if ($actie !== '') {
    controleerCsrf();

    if ($actie === 'uitloggen') { uitloggen(); terug(url()); }

    if ($actie === 'opslaan' || $actie === 'voorbeeld') {
        $oud = (string)($_POST['oud'] ?? '');
        $titel = trim(mb_substr((string)($_POST['titel'] ?? ''), 0, 80));
        $slug = $oud !== '' ? $oud : maakSlug((string)($_POST['adres'] ?? '') !== '' ? (string)$_POST['adres'] : $titel);
        $formulier = [
            'oud' => $oud,
            'adres' => $slug,
            'titel' => $titel,
            'menu' => !empty($_POST['menu']),
            'volgorde' => (int)($_POST['volgorde'] ?? 50),
            'onder' => (string)($_POST['onder'] ?? ''),
            'link' => trim(mb_substr((string)($_POST['link'] ?? ''), 0, 500)),
            'concerten' => !empty($_POST['concerten']),
            'tekst' => mb_substr(str_replace("\r\n", "\n", (string)($_POST['tekst'] ?? '')), 0, 100000),
        ];
        if ($actie === 'voorbeeld') {
            $voorbeeld = $formulier;
        } elseif ($titel === '') {
            $melding = 'Geef de pagina een titel.';
        } elseif ($oud === '' && (!geldigeSlug($slug) || in_array($slug, VASTE_ADRESSEN, true))) {
            $melding = 'Dit webadres kan niet. Gebruik alleen kleine letters, cijfers en streepjes.';
        } elseif ($oud === '' && isset($paginas[$slug])) {
            $melding = 'Er is al een pagina met het adres "' . $slug . '".';
        } elseif ($formulier['link'] !== '' && !preg_match('~^https?://~i', $formulier['link'])) {
            $melding = 'Het webadres voor het menu moet beginnen met https://';
        } elseif ($oud !== '' && !isset($paginas[$oud])) {
            $melding = 'Deze pagina bestaat niet meer.';
        } else {
            // Submenu: alleen onder een bestaande pagina die zelf geen submenu-item is
            $onder = $formulier['onder'];
            if ($onder === $slug || !isset($paginas[$onder]) || !empty($paginas[$onder]['onder'])) $onder = '';
            $paginas[$slug] = ['titel' => $titel, 'menu' => $formulier['menu'], 'volgorde' => $formulier['volgorde'], 'onder' => $onder, 'link' => $formulier['link'], 'concerten' => $formulier['concerten'], 'tekst' => $formulier['tekst']];
            // Wordt deze pagina zelf een submenu-item, dan schuiven zijn eigen submenu-items een niveau op
            if ($onder !== '') foreach ($paginas as $k => $p) if (($p['onder'] ?? '') === $slug) $paginas[$k]['onder'] = '';
            bewaarPaginas($paginas);
            terug($hier, 'Pagina "' . $titel . '" is opgeslagen.');
        }
    }

    if ($actie === 'verwijder') {
        $slug = (string)($_POST['slug'] ?? '');
        if ($slug === 'home') terug($hier, 'De homepagina kan niet weg.', true);
        if (isset($paginas[$slug])) {
            $t = $paginas[$slug]['titel'];
            unset($paginas[$slug]);
            bewaarPaginas($paginas);
            terug($hier, 'Pagina "' . $t . '" is verwijderd.');
        }
        terug($hier);
    }

    // Een foto uit Nextcloud naar de website kopiëren (verkleind), zodat de site niet van Nextcloud afhangt
    if ($actie === 'nc_foto') {
        $pad = ncAan($CONFIG) ? ncFotoPad($CONFIG, (string)($_POST['pad'] ?? '')) : null;
        if ($pad === null || !preg_match(FOTO_EXT, $pad)) antwoordJson(['fout' => 'Ongeldige foto.']);
        session_write_close();
        $data = ncOphalen($CONFIG, $pad);
        if ($data === null) antwoordJson(['fout' => 'De foto kon niet uit Nextcloud gehaald worden (of is groter dan 40 MB).']);
        $tmp = tempnam(sys_get_temp_dir(), 'wkh');
        file_put_contents($tmp, $data);
        $info = @getimagesize($tmp);
        $ext = $info ? (FOTO_SOORTEN[$info[2]] ?? null) : null;
        if (!$ext) { @unlink($tmp); antwoordJson(['fout' => 'Dit is geen foto (alleen jpg, png, gif of webp).']); }
        verkleinFoto($tmp);
        if (!is_dir(FOTO_DIR)) mkdir(FOTO_DIR, 0775, true);
        $basis = maakSlug(pathinfo($pad, PATHINFO_FILENAME)) ?: 'foto';
        $naam = $basis . '.' . $ext;
        for ($i = 2; is_file(FOTO_DIR . '/' . $naam); $i++) $naam = $basis . '-' . $i . '.' . $ext;
        if (!@rename($tmp, FOTO_DIR . '/' . $naam) && !@copy($tmp, FOTO_DIR . '/' . $naam)) { @unlink($tmp); antwoordJson(['fout' => 'Opslaan mislukt: de map inhoud/fotos is niet schrijfbaar.']); }
        @unlink($tmp);
        @chmod(FOTO_DIR . '/' . $naam, 0644);
        antwoordJson(['naam' => $naam, 'src' => url('inhoud/fotos/' . $naam)]);
    }

    if ($actie === 'foto') {
        $f = $_FILES['foto'] ?? null;
        $fout = null;
        $code = is_array($f) && !is_array($f['error'] ?? null) ? (int)($f['error'] ?? UPLOAD_ERR_NO_FILE) : UPLOAD_ERR_NO_FILE;
        if ($code === UPLOAD_ERR_INI_SIZE || $code === UPLOAD_ERR_FORM_SIZE) $fout = 'Deze foto is te groot voor de server (maximaal ' . ini_get('upload_max_filesize') . '). Verklein hem eerst, of verhoog de limiet (zie README).';
        elseif ($code !== UPLOAD_ERR_OK) $fout = 'Kies eerst een foto.';
        elseif ($f['size'] > MAX_FOTO) $fout = 'Deze foto is te groot (meer dan 8 MB).';
        else {
            $info = @getimagesize($f['tmp_name']);
            $ext = $info ? (FOTO_SOORTEN[$info[2]] ?? null) : null;
            if (!$ext) $fout = 'Dit is geen foto (alleen jpg, png, gif of webp).';
            else {
                if (!is_dir(FOTO_DIR)) mkdir(FOTO_DIR, 0775, true);
                $basis = maakSlug(pathinfo((string)$f['name'], PATHINFO_FILENAME));
                $naam = $basis . '.' . $ext;
                for ($i = 2; is_file(FOTO_DIR . '/' . $naam); $i++) $naam = $basis . '-' . $i . '.' . $ext;
                if (!move_uploaded_file($f['tmp_name'], FOTO_DIR . '/' . $naam)) $fout = 'Opslaan mislukt: de map inhoud/fotos is niet schrijfbaar.';
                elseif (isset($_GET['ajax'])) antwoordJson(['naam' => $naam, 'src' => url('inhoud/fotos/' . $naam)]);
                else terug($hier . '?fotos=1', 'Foto "' . $naam . '" staat erop. Zet in een pagina: ![onderschrift](fotos/' . $naam . ')');
            }
        }
        terug($hier . '?fotos=1', (string)$fout, true);
    }

    if ($actie === 'concert_opslaan' || $actie === 'concert_weg') {
        $info = laadConcertInfo();
        $bron = (string)($_POST['bron'] ?? '');
        $sleutel = (string)($_POST['sleutel'] ?? '');
        $w = [];
        foreach (CONCERT_VELDEN as $v) $w[$v] = trim(mb_substr(str_replace("\r\n", "\n", (string)($_POST[$v] ?? '')), 0, $v === 'beschrijving' ? 5000 : 300));
        $terugNaar = $hier . '?concerten=1';
        if ($bron === 'kalender' && isset(kalenderOptredens($CONFIG)[$sleutel])) {
            if ($actie === 'concert_weg') { unset($info['extra'][$sleutel]); bewaarConcertInfo($info); terug($terugNaar, 'De aanvullingen zijn weggehaald.'); }
            $w['datum'] = ''; // datum komt altijd uit de kalender
            $w['verborgen'] = !empty($_POST['verborgen']);
            $info['extra'][$sleutel] = array_filter($w, function ($x) { return $x !== '' && $x !== false; });
            bewaarConcertInfo($info);
            terug($terugNaar, 'Concert opgeslagen.');
        }
        if ($bron === 'eigen') {
            if ($actie === 'concert_weg') { unset($info['eigen'][$sleutel]); bewaarConcertInfo($info); terug($terugNaar, 'Concert verwijderd.'); }
            if ($w['titel'] === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $w['datum'])) terug($hier . '?concert=' . rawurlencode($sleutel ?: 'nieuw') . '&bron=eigen', 'Vul minstens een titel en datum in.', true);
            if ($sleutel === '' || !isset($info['eigen'][$sleutel])) $sleutel = 'e' . date('ymdHis') . bin2hex(random_bytes(2));
            $info['eigen'][$sleutel] = $w;
            bewaarConcertInfo($info);
            terug($terugNaar, 'Concert "' . $w['titel'] . '" opgeslagen.');
        }
        terug($terugNaar);
    }

    if ($actie === 'foto_weg') {
        $naam = basename((string)($_POST['naam'] ?? ''));
        if (in_array($naam, fotoLijst(), true)) { @unlink(FOTO_DIR . '/' . $naam); terug($hier . '?fotos=1', 'Foto "' . $naam . '" is verwijderd.'); }
        terug($hier . '?fotos=1');
    }
}

startSessie();
$bericht = $_SESSION['bericht'] ?? '';
if (!empty($_SESSION['bericht_fout'])) $melding = $_SESSION['bericht_fout'];
unset($_SESSION['bericht'], $_SESSION['bericht_fout']);
$csrf = '<input type="hidden" name="csrf" value="' . h(csrfToken()) . '">';

kop($CONFIG, 'Beheer', '', false);
echo '<div class="ledenkop"><h1>Beheer</h1><form method="post">' . $csrf . '<button name="actie" value="uitloggen" class="licht">Uitloggen</button></form></div>';
$tabConcert = isset($_GET['concerten']) || isset($_GET['concert']);
echo '<nav class="tabs"><a href="' . h($hier) . '"' . (!isset($_GET['fotos']) && !$tabConcert ? ' class="actief"' : '') . '>Pagina\'s</a><a href="' . h($hier . '?concerten=1') . '"' . ($tabConcert ? ' class="actief"' : '') . '>Concerten</a><a href="' . h($hier . '?fotos=1') . '"' . (isset($_GET['fotos']) ? ' class="actief"' : '') . '>Foto\'s</a><a href="' . h(url()) . '" target="_blank">Website bekijken ↗</a></nav>';
if ($bericht) echo '<p class="goed">' . h($bericht) . '</p>';
if ($melding) echo '<p class="fout">' . h($melding) . '</p>';

$bewerk = $formulier['oud'] ?? (string)($_GET['bewerk'] ?? '');
$nieuw = isset($_GET['nieuw']) || ($formulier !== null && $formulier['oud'] === '');

if ($tabConcert && isset($_GET['concert'])) {
    $bron = ($_GET['bron'] ?? '') === 'kalender' ? 'kalender' : 'eigen';
    $sleutel = (string)$_GET['concert'];
    $info = laadConcertInfo();
    $kal = $bron === 'kalender' ? (kalenderOptredens($CONFIG)[$sleutel] ?? null) : null;
    if ($bron === 'kalender' && !$kal) { echo '<p class="fout">Dit optreden staat niet (meer) in de jaarkalender.</p>'; voet($CONFIG); exit; }
    $w = $bron === 'kalender' ? ($info['extra'][$sleutel] ?? []) : ($info['eigen'][$sleutel] ?? []);
    $v = function ($k) use ($w) { return h((string)($w[$k] ?? '')); };
    $ph = function ($k) use ($kal) { return $kal && ($kal[$k] ?? '') !== '' ? ' placeholder="' . h($kal[$k]) . '"' : ''; };
    echo '<form method="post" class="kaart bewerk">' . $csrf . '<input type="hidden" name="bron" value="' . h($bron) . '"><input type="hidden" name="sleutel" value="' . h($sleutel === 'nieuw' ? '' : $sleutel) . '">';
    if ($kal) {
        echo '<h2>' . h($kal['titel'] ?? '') . '</h2><p class="stil">Uit de jaarkalender: ' . h(datumNL($kal['datum'])) . (($kal['tijd'] ?? '') !== '' ? ', ' . h($kal['tijd']) : '') . (($kal['waar'] ?? '') !== '' ? ', ' . h($kal['waar']) : '')
            . '. De datum pas je aan in de jaarkalender. Laat een veld hieronder leeg om de tekst uit de kalender te gebruiken.</p>';
    } else {
        echo '<h2>' . ($w ? 'Concert bewerken' : 'Nieuw concert') . '</h2><p class="stil">Voor een concert dat niet in de jaarkalender staat.</p>';
        echo '<div class="rij"><label class="smal">Datum<input type="date" name="datum" value="' . $v('datum') . '" required></label></div>';
    }
    echo '<label>Titel<input name="titel" value="' . $v('titel') . '"' . $ph('titel') . ($kal ? '' : ' required') . '></label>';
    echo '<div class="rij"><label class="smal">Hoe laat<input name="tijd" value="' . $v('tijd') . '"' . $ph('tijd') . ' placeholder="bijv. 15:00-16:30"></label>';
    echo '<label style="flex:1">Waar<input name="waar" value="' . $v('waar') . '"' . $ph('waar') . '></label></div>';
    echo '<label>Beschrijving<textarea name="beschrijving" rows="6">' . $v('beschrijving') . '</textarea></label>';
    echo '<label>Foto<span class="fotoveld"><input name="foto" id="concertfoto" value="' . $v('foto') . '" placeholder="fotos/naam.jpg of een webadres"><button type="button" class="licht" data-fotokiezer="concertfoto">Kies foto</button></span></label>';
    echo '<label>Link naar de locatie (bijv. Google Maps of de website van de zaal)<input type="url" name="locatie_url" value="' . $v('locatie_url') . '" placeholder="https://"></label>';
    echo '<label>Link naar de kaartverkoop<input type="url" name="kaarten_url" value="' . $v('kaarten_url') . '" placeholder="https://"></label>';
    if ($kal) echo '<label class="vink"><input type="checkbox" name="verborgen" value="1"' . (!empty($w['verborgen']) ? ' checked' : '') . '> Niet op de website tonen</label>';
    echo '<div class="knoppen"><button name="actie" value="concert_opslaan">Opslaan</button><a href="' . h($hier . '?concerten=1') . '">Annuleren</a>';
    if ($w) echo '<button name="actie" value="concert_weg" class="licht" onclick="return confirm(\'' . ($kal ? 'Aanvullingen weghalen?' : 'Dit concert verwijderen?') . '\')">' . ($kal ? 'Aanvullingen weghalen' : 'Verwijderen') . '</button>';
    echo '</div></form>';
} elseif ($tabConcert) {
    echo '<p><a class="knop" href="' . h($hier . '?concert=nieuw&bron=eigen') . '">+ Concert dat niet in de kalender staat</a></p>';
    echo '<p class="stil">Optredens uit de jaarkalender staan hier vanzelf. Klik erop om een beschrijving, foto of links toe te voegen.</p>';
    $vandaag = date('Y-m-d');
    $lijst = array_filter(alleConcerten($CONFIG, true), function ($c) use ($vandaag) { return ($c['tm'] !== '' ? $c['tm'] : $c['datum']) >= $vandaag; });
    if (!$lijst) echo '<p class="stil">Er zijn geen komende concerten.</p>';
    else {
        echo '<ul class="paginalijst">';
        foreach ($lijst as $c) {
            $extra = [];
            if ($c['bron'] === 'eigen') $extra[] = 'niet in kalender';
            if ($c['foto'] !== '') $extra[] = 'foto';
            if ($c['beschrijving'] !== '') $extra[] = 'beschrijving';
            if ($c['kaarten_url'] !== '') $extra[] = 'kaarten';
            if ($c['verborgen']) $extra[] = 'verborgen';
            echo '<li><a href="' . h($hier . '?concert=' . rawurlencode($c['sleutel']) . '&bron=' . $c['bron']) . '"><strong>' . h($c['titel']) . '</strong><small>' . h(datumNL($c['datum'])) . ($c['tijd'] !== '' ? ' · ' . h($c['tijd']) : '') . ($extra ? ' · ' . h(implode(', ', $extra)) : '') . '</small></a></li>';
        }
        echo '</ul>';
    }
} elseif (isset($_GET['fotos'])) {
    echo '<form method="post" enctype="multipart/form-data" class="kaart">' . $csrf . '<h2>Foto toevoegen</h2><input type="file" name="foto" id="foto" accept="image/jpeg,image/png,image/gif,image/webp" required> <button name="actie" value="foto" id="fotoknop">Uploaden</button><p class="stil">Grote foto\'s worden vóór het uploaden automatisch verkleind tot maximaal 1600 pixels breed. Na het uploaden zie je hieronder de regel die je in een pagina plakt. Zet je meerdere foto-regels direct onder elkaar, dan worden ze een fotogalerij.</p></form>';
    echo '<div class="fotobeheer">';
    foreach (fotoLijst() as $naam) {
        echo '<figure><img src="' . h(url('inhoud/fotos/' . $naam)) . '" alt="" loading="lazy"><figcaption><code>![](fotos/' . h($naam) . ')</code>'
            . '<form method="post" onsubmit="return confirm(\'Deze foto verwijderen?\')">' . $csrf . '<input type="hidden" name="naam" value="' . h($naam) . '"><button name="actie" value="foto_weg" class="licht klein">Verwijderen</button></form></figcaption></figure>';
    }
    echo '</div>';
} elseif ($nieuw || ($bewerk !== '' && isset($paginas[$bewerk]))) {
    $w = $formulier ?? ($nieuw ? ['oud' => '', 'adres' => '', 'titel' => '', 'menu' => true, 'volgorde' => 50, 'onder' => '', 'link' => '', 'concerten' => false, 'tekst' => "# Titel\n\n"]
        : ['oud' => $bewerk, 'adres' => $bewerk] + $paginas[$bewerk]);
    $w['onder'] = (string)($w['onder'] ?? '');
    $w['link'] = (string)($w['link'] ?? '');
    echo '<form method="post" class="kaart bewerk">' . $csrf . '<input type="hidden" name="oud" value="' . h($w['oud']) . '">';
    echo '<h2>' . ($w['oud'] === '' ? 'Nieuwe pagina' : 'Pagina bewerken') . '</h2>';
    echo '<label>Titel (ook in het menu)<input name="titel" value="' . h($w['titel']) . '" maxlength="80" required></label>';
    if ($w['oud'] === '') echo '<label>Webadres (leeg = uit de titel)<input name="adres" value="' . h($w['adres']) . '" pattern="[a-z0-9-]*" placeholder="bijv. over-ons"></label>';
    else echo '<p class="stil">Adres: <a href="' . h(paginaUrl($w['oud'])) . '" target="_blank">' . h(paginaUrl($w['oud'])) . '</a></p>';
    echo '<div class="rij"><label class="vink"><input type="checkbox" name="menu" value="1"' . ($w['menu'] ? ' checked' : '') . '> In het menu</label>';
    echo '<label class="vink"><input type="checkbox" name="concerten" value="1"' . ($w['concerten'] ? ' checked' : '') . '> Komende concerten eronder</label>';
    echo '<label class="smal">Plek in menu<input type="number" name="volgorde" value="' . (int)$w['volgorde'] . '" min="0" max="999"></label>';
    echo '<label class="smal">Submenu van<select name="onder"><option value="">(hoofdmenu)</option>';
    foreach ($paginas as $k => $p) {
        if ($k === $w['oud'] || !empty($p['onder']) || empty($p['menu'])) continue;
        echo '<option value="' . h($k) . '"' . ($w['onder'] === $k ? ' selected' : '') . '>' . h($p['titel']) . '</option>';
    }
    echo '</select></label></div>';
    echo '<label>Menu-item verwijst naar een andere website (leeg = deze pagina)<input type="url" name="link" value="' . h($w['link']) . '" placeholder="https://"></label>';
    echo '<div class="tekstkop"><label for="paginatekst">Tekst</label><button type="button" class="licht klein" data-fotokiezer="paginatekst">📷 Foto invoegen</button></div>';
    echo '<textarea name="tekst" id="paginatekst" rows="18">' . h($w['tekst']) . '</textarea>';
    echo '<details class="hulp"><summary>Hoe maak ik een kop, link, foto of video?</summary><pre>'
        . h("# Grote kop\n## Kleinere kop\n**vetgedrukt**   *schuin*\n- opsomming\n1. genummerde lijst\n[tekst van de link](https://www.voorbeeld.nl)\n[naar een andere pagina](over-ons)\n![onderschrift](fotos/naam.jpg)\nyoutube: https://www.youtube.com/watch?v=...\ntegel: [Titel](andere-pagina) https://www.youtube.com/watch?v=...\nknop: [Kaartjes kopen](https://...)")
        . '</pre><p>Een lege regel begint een nieuwe alinea. Foto-regels direct onder elkaar worden een fotogalerij. Tegel-regels onder elkaar worden een raster met plaatjes; bij een YouTube-adres komt het plaatje van de video erin, je kunt ook fotos/naam.jpg gebruiken.</p></details>';
    echo '<div class="knoppen"><button name="actie" value="opslaan">Opslaan</button><button name="actie" value="voorbeeld" class="licht">Voorbeeld bekijken</button><a href="' . h($hier) . '">Annuleren</a></div></form>';
    if ($voorbeeld !== null) {
        echo '<section class="voorbeeld"><p class="stil">Voorbeeld, nog niet opgeslagen:</p><article class="tekst">' . opmaak($voorbeeld['tekst']) . '</article>';
        if ($voorbeeld['concerten']) echo '<section class="agenda"><h2>Komende concerten</h2>' . concertenHtml($CONFIG) . '</section>';
        echo '</section>';
    }
} else {
    echo '<p><a class="knop" href="' . h($hier . '?nieuw=1') . '">+ Nieuwe pagina</a></p><ul class="paginalijst">';
    foreach ($paginas as $slug => $p) {
        echo '<li><a href="' . h($hier . '?bewerk=' . rawurlencode($slug)) . '"><strong>' . h($p['titel']) . '</strong><small>' . h(paginaUrl($slug)) . (empty($p['menu']) ? ' · niet in menu' : '') . (!empty($p['onder']) && isset($paginas[$p['onder']]) ? ' · onder ' . h($paginas[$p['onder']]['titel']) : '') . '</small></a>';
        if ($slug !== 'home') echo '<form method="post" onsubmit="return confirm(\'Deze pagina verwijderen?\')">' . $csrf . '<input type="hidden" name="slug" value="' . h($slug) . '"><button name="actie" value="verwijder" class="licht klein">Verwijderen</button></form>';
        echo '</li>';
    }
    echo '</ul><p class="stil">Er wordt bij elke wijziging automatisch een reservekopie bewaard (map inhoud/backup, de laatste 50).</p>';
}
// Gegevens voor de fotokiezer en het verkleinen van foto's (beheer.js)
$fotoData = ['upload' => $hier . '?ajax=1', 'nc' => ncAan($CONFIG) || ssoAan($CONFIG) ? $hier : null, 'csrf' => csrfToken(), 'fotos' => array_map(function ($n) { return ['naam' => $n, 'src' => url('inhoud/fotos/' . $n)]; }, fotoLijst())];
echo '<script type="application/json" id="fotodata">' . json_encode($fotoData, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES) . '</script>';
echo '<script src="' . h(url('beheer.js')) . '?v=' . @filemtime(__DIR__ . '/beheer.js') . '" defer></script>';
voet($CONFIG);
