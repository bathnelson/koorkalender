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
    startSessie();
    if ($bericht !== '') $_SESSION[$isFout ? 'bericht_fout' : 'bericht'] = $bericht;
    header('Location: ' . $naar, true, 303);
    exit;
}

function fotoLijst(): array {
    $f = glob(FOTO_DIR . '/*.{jpg,png,gif,webp}', GLOB_BRACE) ?: [];
    usort($f, function ($a, $b) { return filemtime($b) <=> filemtime($a); });
    return array_map('basename', $f);
}

$paginas = laadPaginas();
$actie = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' ? (string)($_POST['actie'] ?? '') : '';
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
        } elseif ($oud !== '' && !isset($paginas[$oud])) {
            $melding = 'Deze pagina bestaat niet meer.';
        } else {
            $paginas[$slug] = ['titel' => $titel, 'menu' => $formulier['menu'], 'volgorde' => $formulier['volgorde'], 'concerten' => $formulier['concerten'], 'tekst' => $formulier['tekst']];
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

    if ($actie === 'foto') {
        $f = $_FILES['foto'] ?? null;
        $fout = null;
        if (!is_array($f) || is_array($f['error'] ?? null) || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) $fout = 'Kies eerst een foto (en controleer dat hij kleiner is dan 8 MB).';
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
                else terug($hier . '?fotos=1', 'Foto "' . $naam . '" staat erop. Zet in een pagina: ![onderschrift](fotos/' . $naam . ')');
            }
        }
        terug($hier . '?fotos=1', (string)$fout, true);
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
echo '<nav class="tabs"><a href="' . h($hier) . '"' . (!isset($_GET['fotos']) ? ' class="actief"' : '') . '>Pagina\'s</a><a href="' . h($hier . '?fotos=1') . '"' . (isset($_GET['fotos']) ? ' class="actief"' : '') . '>Foto\'s</a><a href="' . h(url()) . '" target="_blank">Website bekijken ↗</a></nav>';
if ($bericht) echo '<p class="goed">' . h($bericht) . '</p>';
if ($melding) echo '<p class="fout">' . h($melding) . '</p>';

$bewerk = $formulier['oud'] ?? (string)($_GET['bewerk'] ?? '');
$nieuw = isset($_GET['nieuw']) || ($formulier !== null && $formulier['oud'] === '');

if (isset($_GET['fotos'])) {
    echo '<form method="post" enctype="multipart/form-data" class="kaart">' . $csrf . '<h2>Foto toevoegen</h2><input type="file" name="foto" accept="image/jpeg,image/png,image/gif,image/webp" required> <button name="actie" value="foto">Uploaden</button><p class="stil">Na het uploaden zie je hieronder de regel die je in een pagina plakt. Zet je meerdere foto-regels direct onder elkaar, dan worden ze een fotogalerij.</p></form>';
    echo '<div class="fotobeheer">';
    foreach (fotoLijst() as $naam) {
        echo '<figure><img src="' . h(url('inhoud/fotos/' . $naam)) . '" alt="" loading="lazy"><figcaption><code>![](fotos/' . h($naam) . ')</code>'
            . '<form method="post" onsubmit="return confirm(\'Deze foto verwijderen?\')">' . $csrf . '<input type="hidden" name="naam" value="' . h($naam) . '"><button name="actie" value="foto_weg" class="licht klein">Verwijderen</button></form></figcaption></figure>';
    }
    echo '</div>';
} elseif ($nieuw || ($bewerk !== '' && isset($paginas[$bewerk]))) {
    $w = $formulier ?? ($nieuw ? ['oud' => '', 'adres' => '', 'titel' => '', 'menu' => true, 'volgorde' => 50, 'concerten' => false, 'tekst' => "# Titel\n\n"]
        : ['oud' => $bewerk, 'adres' => $bewerk] + $paginas[$bewerk]);
    echo '<form method="post" class="kaart bewerk">' . $csrf . '<input type="hidden" name="oud" value="' . h($w['oud']) . '">';
    echo '<h2>' . ($w['oud'] === '' ? 'Nieuwe pagina' : 'Pagina bewerken') . '</h2>';
    echo '<label>Titel (ook in het menu)<input name="titel" value="' . h($w['titel']) . '" maxlength="80" required></label>';
    if ($w['oud'] === '') echo '<label>Webadres (leeg = uit de titel)<input name="adres" value="' . h($w['adres']) . '" pattern="[a-z0-9-]*" placeholder="bijv. over-ons"></label>';
    else echo '<p class="stil">Adres: <a href="' . h(paginaUrl($w['oud'])) . '" target="_blank">' . h(paginaUrl($w['oud'])) . '</a></p>';
    echo '<div class="rij"><label class="vink"><input type="checkbox" name="menu" value="1"' . ($w['menu'] ? ' checked' : '') . '> In het menu</label>';
    echo '<label class="vink"><input type="checkbox" name="concerten" value="1"' . ($w['concerten'] ? ' checked' : '') . '> Komende concerten eronder</label>';
    echo '<label class="smal">Plek in menu<input type="number" name="volgorde" value="' . (int)$w['volgorde'] . '" min="0" max="999"></label></div>';
    echo '<label>Tekst<textarea name="tekst" rows="18">' . h($w['tekst']) . '</textarea></label>';
    echo '<details class="hulp"><summary>Hoe maak ik een kop, link, foto of video?</summary><pre>'
        . h("# Grote kop\n## Kleinere kop\n**vetgedrukt**   *schuin*\n- opsomming\n1. genummerde lijst\n[tekst van de link](https://www.voorbeeld.nl)\n[naar een andere pagina](over-ons)\n![onderschrift](fotos/naam.jpg)\nyoutube: https://www.youtube.com/watch?v=...\nknop: [Kaartjes kopen](https://...)")
        . '</pre><p>Een lege regel begint een nieuwe alinea. Foto-regels direct onder elkaar worden een fotogalerij.</p></details>';
    echo '<div class="knoppen"><button name="actie" value="opslaan">Opslaan</button><button name="actie" value="voorbeeld" class="licht">Voorbeeld bekijken</button><a href="' . h($hier) . '">Annuleren</a></div></form>';
    if ($voorbeeld !== null) {
        echo '<section class="voorbeeld"><p class="stil">Voorbeeld, nog niet opgeslagen:</p><article class="tekst">' . opmaak($voorbeeld['tekst']) . '</article>';
        if ($voorbeeld['concerten']) echo '<section class="agenda"><h2>Komende concerten</h2>' . concertenHtml($CONFIG) . '</section>';
        echo '</section>';
    }
} else {
    echo '<p><a class="knop" href="' . h($hier . '?nieuw=1') . '">+ Nieuwe pagina</a></p><ul class="paginalijst">';
    foreach ($paginas as $slug => $p) {
        echo '<li><a href="' . h($hier . '?bewerk=' . rawurlencode($slug)) . '"><strong>' . h($p['titel']) . '</strong><small>' . h(paginaUrl($slug)) . (empty($p['menu']) ? ' · niet in menu' : '') . '</small></a>';
        if ($slug !== 'home') echo '<form method="post" onsubmit="return confirm(\'Deze pagina verwijderen?\')">' . $csrf . '<input type="hidden" name="slug" value="' . h($slug) . '"><button name="actie" value="verwijder" class="licht klein">Verwijderen</button></form>';
        echo '</li>';
    }
    echo '</ul><p class="stil">Er wordt bij elke wijziging automatisch een reservekopie bewaard (map inhoud/backup, de laatste 50).</p>';
}
voet($CONFIG);
