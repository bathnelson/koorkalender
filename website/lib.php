<?php
declare(strict_types=1);

// Gedeelde code voor de website: instellingen, opslag, inloggen, tekstopmaak, concerten en Nextcloud.

$CONFIG = require __DIR__ . '/config.php';
date_default_timezone_set('Europe/Amsterdam');

const INHOUD_DIR = __DIR__ . '/inhoud';
const PAGINAS_FILE = INHOUD_DIR . '/paginas.json';
const FOTO_DIR = INHOUD_DIR . '/fotos';
const BACKUP_DIR = INHOUD_DIR . '/backup';
const MAX_BACKUPS = 50;

function h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

function basisUrl(): string {
    $s = str_replace('\\', '/', (string)($_SERVER['SCRIPT_NAME'] ?? '/index.php'));
    if (basename($s) !== 'index.php') return '/';
    return rtrim(dirname($s), '/') . '/';
}
function url(string $pad = ''): string { return basisUrl() . ltrim($pad, '/'); }
function paginaUrl(string $slug): string { return $slug === 'home' ? url() : url($slug); }

// ---------- sessie en inloggen ----------

function startSessie(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $veilig = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_name('wkh');
    session_set_cookie_params(['lifetime' => 0, 'path' => basisUrl(), 'secure' => $veilig, 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}

function wachtwoordKlopt(string $ingevoerd, string $goed): bool {
    if ($goed === '' || $goed === 'verander-mij') return false;
    if (strpos($goed, '$2y$') === 0) return password_verify($ingevoerd, $goed);
    return hash_equals($goed, $ingevoerd);
}

// $rol is 'beheer' of 'leden'. Beheer mag ook in het ledengedeelte.
function ingelogd(string $rol): bool {
    startSessie();
    if (!empty($_SESSION['beheer'])) return true;
    return $rol === 'leden' && !empty($_SESSION['leden']);
}

function probeerLogin(string $rol, array $cfg): ?string {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || !isset($_POST['wachtwoord'])) return null;
    startSessie();
    $goed = (string)($cfg[$rol === 'beheer' ? 'beheer_wachtwoord' : 'leden_wachtwoord'] ?? '');
    if (wachtwoordKlopt((string)$_POST['wachtwoord'], $goed)) {
        session_regenerate_id(true);
        $_SESSION[$rol] = true;
        header('Location: ' . strtok($_SERVER['REQUEST_URI'] ?? url(), '?'), true, 303);
        exit;
    }
    sleep(1); // remt raden af
    return $goed === 'verander-mij' || $goed === '' ? 'Er is nog geen wachtwoord ingesteld in config.php.' : 'Dat wachtwoord klopt niet.';
}

function uitloggen(): void {
    global $CONFIG;
    startSessie();
    // Het app-wachtwoord dat bij het inloggen met Nextcloud is gemaakt weer intrekken
    if (!empty($_SESSION['nc_login']) && !empty($_SESSION['nc_app']) && empty($_SESSION['nc_eigen_app']) && ($CONFIG['nextcloud_url'] ?? '') !== '') {
        ncHttp('DELETE', rtrim($CONFIG['nextcloud_url'], '/') . '/ocs/v2.php/core/apppassword', ['OCS-APIRequest: true'], null, $_SESSION['nc_login'] . ':' . $_SESSION['nc_app']);
    }
    $_SESSION = [];
    session_destroy();
}

function csrfToken(): string {
    startSessie();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
    return $_SESSION['csrf'];
}
function controleerCsrf(): void {
    startSessie();
    $t = $_POST['csrf'] ?? '';
    if (!is_string($t) || empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $t)) {
        http_response_code(400);
        exit('Het formulier is verlopen. Ga terug en probeer het opnieuw.');
    }
}

// ---------- pagina's ----------

function laadPaginas(): array {
    if (!is_file(PAGINAS_FILE)) return standaardPaginas();
    $data = json_decode((string)file_get_contents(PAGINAS_FILE), true);
    return is_array($data) && isset($data['paginas']) && is_array($data['paginas']) ? $data['paginas'] : standaardPaginas();
}

function bewaarPaginas(array $paginas): void {
    if (!is_dir(INHOUD_DIR)) mkdir(INHOUD_DIR, 0775, true);
    if (!is_dir(BACKUP_DIR)) mkdir(BACKUP_DIR, 0775, true);
    $lock = fopen(INHOUD_DIR . '/.lock', 'c');
    flock($lock, LOCK_EX);
    try {
        if (is_file(PAGINAS_FILE)) {
            copy(PAGINAS_FILE, BACKUP_DIR . '/paginas-' . date('Ymd-His') . '-' . bin2hex(random_bytes(2)) . '.json');
            $oud = glob(BACKUP_DIR . '/paginas-*.json') ?: [];
            sort($oud);
            foreach (array_slice($oud, 0, max(0, count($oud) - MAX_BACKUPS)) as $f) @unlink($f);
        }
        uasort($paginas, function ($a, $b) { return [$a['volgorde'], $a['titel']] <=> [$b['volgorde'], $b['titel']]; });
        $tmp = PAGINAS_FILE . '.tmp';
        if (file_put_contents($tmp, json_encode(['versie' => 1, 'paginas' => $paginas], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) === false || !rename($tmp, PAGINAS_FILE)) {
            http_response_code(500);
            exit('Opslaan mislukt: de map inhoud/ is niet schrijfbaar.');
        }
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function geldigeSlug(string $s): bool { return (bool)preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $s) && strlen($s) <= 60; }

function maakSlug(string $titel): string {
    $s = strtolower(trim($titel));
    $s = strtr($s, ['ë' => 'e', 'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ï' => 'i', 'í' => 'i', 'ö' => 'o', 'ó' => 'o', 'ü' => 'u', 'ú' => 'u', 'á' => 'a', 'à' => 'a', 'ä' => 'a', 'ç' => 'c', 'ñ' => 'n']);
    $s = trim((string)preg_replace('/[^a-z0-9]+/', '-', $s), '-');
    return substr($s, 0, 60) ?: 'pagina';
}

// Gereserveerd voor de vaste onderdelen van de site
const VASTE_ADRESSEN = ['beheer', 'leden', 'inhoud', 'index', 'stijl'];

function standaardPaginas(): array {
    return [
        'home' => ['titel' => 'Home', 'menu' => true, 'volgorde' => 0, 'concerten' => true,
            'tekst' => "# Welkom bij Wereldkoor Haarlem\n\nWe zingen liederen uit de hele wereld. Kom eens luisteren, of zing mee!\n\nDeze tekst pas je aan op de beheerpagina."],
        'over-ons' => ['titel' => 'Over ons', 'menu' => true, 'volgorde' => 10, 'concerten' => false,
            'tekst' => "# Over ons\n\nVertel hier wie jullie zijn, waar en wanneer jullie repeteren, en wie de dirigent is."],
        'concerten' => ['titel' => 'Concerten', 'menu' => true, 'volgorde' => 20, 'concerten' => true,
            'tekst' => "# Concerten\n\nDe concerten hieronder komen automatisch uit de jaarkalender."],
        'contact' => ['titel' => 'Contact', 'menu' => true, 'volgorde' => 90, 'concerten' => false,
            'tekst' => "# Contact\n\nMail ons op [ons e-mailadres](mailto:info@example.org)."],
    ];
}

// ---------- tekstopmaak (een eenvoudige, veilige vorm van Markdown) ----------
//
//   # Kop, ## Kleinere kop     **vet**   *schuin*   [tekst](https://link)
//   - opsomming                1. genummerd
//   ![onderschrift](fotos/naam.jpg)   losse foto's onder elkaar worden een fotogalerij
//   youtube: https://www.youtube.com/watch?v=...   wordt een video (speler laadt pas na een klik)
//   tegel: [Titel](pagina) https://youtube.../fotos/x.jpg   tegels onder elkaar worden een raster met plaatjes
//   knop: [Kaartjes](https://...)                  wordt een knop
//
// Alle tekst wordt eerst ontsmet, dus HTML in de tekst doet niets.

function veiligAdres(string $u): ?string {
    $u = trim($u);
    if (preg_match('~^(https?://|mailto:|tel:)~i', $u)) return $u;
    if (preg_match('~^(/|#)~', $u) && strpos($u, '//') !== 0) return $u;
    if (preg_match('~^fotos/[A-Za-z0-9._-]+$~', $u)) return url('inhoud/' . $u);
    if (preg_match('~^[a-z0-9-]+$~', $u)) return paginaUrl($u);
    return null;
}

function inline(string $t): string {
    $t = h($t);
    // links [tekst](adres)
    $t = preg_replace_callback('~\[([^\]]+)\]\(([^)\s]+)\)~', function ($m) {
        $adres = veiligAdres(html_entity_decode($m[2], ENT_QUOTES, 'UTF-8'));
        if ($adres === null) return $m[1];
        $extern = preg_match('~^https?://~i', $adres) ? ' target="_blank" rel="noopener"' : '';
        return '<a href="' . h($adres) . '"' . $extern . '>' . $m[1] . '</a>';
    }, $t);
    $t = preg_replace('~\*\*(.+?)\*\*~s', '<strong>$1</strong>', $t);
    $t = preg_replace('~(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?!\w)~s', '<em>$1</em>', $t);
    return $t;
}

function youtubeId(string $u): ?string {
    if (preg_match('~(?:youtube\.com/(?:watch\?(?:.*&)?v=|embed/|live/|shorts/)|youtu\.be/)([A-Za-z0-9_-]{11})~', $u, $m)) return $m[1];
    return null;
}

function opmaak(string $tekst): string {
    $uit = [];
    $alinea = [];
    $lijst = null; // 'ul' of 'ol'
    $galerij = [];
    $tegels = [];

    $sluitTekst = function () use (&$uit, &$alinea, &$lijst) {
        if ($alinea) { $uit[] = '<p>' . implode('<br>', array_map('inline', $alinea)) . '</p>'; $alinea = []; }
        if ($lijst) { $uit[] = '</' . $lijst . '>'; $lijst = null; }
    };
    $sluitGalerij = function () use (&$uit, &$galerij) {
        if (!$galerij) return;
        $uit[] = '<div class="' . (count($galerij) > 1 ? 'galerij' : 'foto') . '">' . implode('', $galerij) . '</div>';
        $galerij = [];
    };

    $sluitTegels = function () use (&$uit, &$tegels) {
        if (!$tegels) return;
        $uit[] = '<div class="tegels">' . implode('', $tegels) . '</div>';
        $tegels = [];
    };

    foreach (preg_split('/\r\n|\r|\n/', $tekst) as $r) {
        $t = trim($r);
        if ($t === '') { $sluitTekst(); $sluitGalerij(); $sluitTegels(); continue; }

        // tegel: [Titel](pagina) plaatje-of-youtube-adres
        if (preg_match('/^tegel:\s*\[([^\]]+)\]\(([^)\s]+)\)\s*(\S+)?$/i', $t, $m)) {
            $sluitTekst(); $sluitGalerij();
            $doel = veiligAdres($m[2]);
            $bron = $m[3] ?? '';
            $id = $bron !== '' ? youtubeId($bron) : null;
            $plaatje = $id ? 'https://i.ytimg.com/vi/' . $id . '/hqdefault.jpg' : ($bron !== '' ? veiligAdres($bron) : null);
            if ($doel !== null && $id) {
                // video: de speler staat in de tegel zelf, de titel gaat naar de pagina
                $tegels[] = '<div class="tegel isvideo"><div class="video"><a class="speel" href="https://www.youtube.com/watch?v=' . h($id) . '" data-yt="' . h($id) . '" target="_blank" rel="noopener">'
                    . '<img src="' . h($plaatje) . '" alt="" loading="lazy"><span class="knopje">▶</span></a></div>'
                    . '<a class="naam" href="' . h($doel) . '">' . h($m[1]) . '</a></div>';
            } elseif ($doel !== null) {
                $tegels[] = '<a class="tegel' . ($id ? ' isvideo' : '') . '" href="' . h($doel) . '">'
                    . ($plaatje ? '<span class="beeld"><img src="' . h($plaatje) . '" alt="" loading="lazy"></span>' : '')
                    . '<span class="naam">' . h($m[1]) . '</span></a>';
            }
            continue;
        }
        $sluitTegels();

        // foto: ![onderschrift](fotos/naam.jpg)
        if (preg_match('/^!\[([^\]]*)\]\(([^)\s]+)\)$/', $t, $m)) {
            $sluitTekst();
            $adres = veiligAdres($m[2]);
            if ($adres !== null) {
                $onder = $m[1] !== '' ? '<figcaption>' . h($m[1]) . '</figcaption>' : '';
                $galerij[] = '<figure><a href="' . h($adres) . '"><img src="' . h($adres) . '" alt="' . h($m[1]) . '" loading="lazy"></a>' . $onder . '</figure>';
            }
            continue;
        }
        $sluitGalerij();

        if (preg_match('/^youtube:\s*(\S+)$/i', $t, $m)) {
            $sluitTekst();
            $id = youtubeId($m[1]);
            if ($id) $uit[] = '<div class="video"><a class="speel" href="https://www.youtube.com/watch?v=' . h($id) . '" data-yt="' . h($id) . '" target="_blank" rel="noopener" aria-label="Video afspelen"><img src="https://i.ytimg.com/vi/' . h($id) . '/hqdefault.jpg" alt="" loading="lazy"><span class="knopje">▶</span></a></div>';
            continue;
        }
        if (preg_match('/^knop:\s*\[([^\]]+)\]\(([^)\s]+)\)$/i', $t, $m)) {
            $sluitTekst();
            $adres = veiligAdres($m[2]);
            if ($adres !== null) $uit[] = '<p><a class="knop" href="' . h($adres) . '"' . (preg_match('~^https?://~i', $adres) ? ' target="_blank" rel="noopener"' : '') . '>' . h($m[1]) . '</a></p>';
            continue;
        }
        if (preg_match('/^(#{1,3})\s+(.*)$/', $t, $m)) {
            $sluitTekst();
            $n = strlen($m[1]);
            $uit[] = '<h' . $n . '>' . inline($m[2]) . '</h' . $n . '>';
            continue;
        }
        if (preg_match('/^(-|\*|\d+\.)\s+(.*)$/', $t, $m)) {
            $soort = $m[1] === '-' || $m[1] === '*' ? 'ul' : 'ol';
            if ($alinea) { $uit[] = '<p>' . implode('<br>', array_map('inline', $alinea)) . '</p>'; $alinea = []; }
            if ($lijst !== $soort) { if ($lijst) $uit[] = '</' . $lijst . '>'; $uit[] = '<' . $soort . '>'; $lijst = $soort; }
            $uit[] = '<li>' . inline($m[2]) . '</li>';
            continue;
        }
        if ($lijst) { $uit[] = '</' . $lijst . '>'; $lijst = null; }
        $alinea[] = $t;
    }
    $sluitTekst();
    $sluitGalerij();
    $sluitTegels();
    return implode("\n", $uit);
}

// ---------- concerten ----------
//
// Optredens uit de jaarkalender verschijnen vanzelf. Op de beheerpagina kun je ze aanvullen met een beschrijving,
// foto en links (inhoud/concerten.json, onder 'extra' met het id uit de kalender), en eigen concerten toevoegen
// die niet in de kalender staan (onder 'eigen').

const CONCERTEN_FILE = INHOUD_DIR . '/concerten.json';
const CONCERT_VELDEN = ['titel', 'datum', 'tijd', 'waar', 'beschrijving', 'foto', 'locatie_url', 'kaarten_url'];

function laadConcertInfo(): array {
    $d = is_file(CONCERTEN_FILE) ? json_decode((string)file_get_contents(CONCERTEN_FILE), true) : null;
    return ['extra' => is_array($d['extra'] ?? null) ? $d['extra'] : [], 'eigen' => is_array($d['eigen'] ?? null) ? $d['eigen'] : []];
}

function bewaarConcertInfo(array $info): void {
    if (!is_dir(INHOUD_DIR)) mkdir(INHOUD_DIR, 0775, true);
    $tmp = CONCERTEN_FILE . '.tmp';
    if (file_put_contents($tmp, json_encode(['versie' => 1] + $info, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) === false || !rename($tmp, CONCERTEN_FILE)) {
        http_response_code(500);
        exit('Opslaan mislukt: de map inhoud/ is niet schrijfbaar.');
    }
}

// Optredens uit de jaarkalender, per id
function kalenderOptredens(array $cfg): array {
    $bestand = (string)($cfg['kalender_data'] ?? '');
    if ($bestand === '' || !is_file($bestand)) return [];
    $data = json_decode((string)file_get_contents($bestand), true);
    $uit = [];
    foreach ((is_array($data['items'] ?? null) ? $data['items'] : []) as $i) {
        if (($i['soort'] ?? '') === 'Optreden' && !empty($i['id'])) $uit[(string)$i['id']] = $i;
    }
    return $uit;
}

// Alle concerten (kalender + eigen), met aanvullingen. Elk concert krijgt 'bron' (kalender/eigen) en 'sleutel'.
function alleConcerten(array $cfg, bool $metVerborgen = false): array {
    $info = laadConcertInfo();
    $uit = [];
    foreach (kalenderOptredens($cfg) as $id => $k) {
        $x = $info['extra'][$id] ?? [];
        if (!$metVerborgen && !empty($x['verborgen'])) continue;
        $c = ['bron' => 'kalender', 'sleutel' => $id, 'tm' => (string)($k['tm'] ?? ''), 'verborgen' => !empty($x['verborgen']), 'kalender' => $k];
        foreach (CONCERT_VELDEN as $v) {
            $c[$v] = (string)(($x[$v] ?? '') !== '' ? $x[$v] : ($k[$v] ?? ''));
        }
        $uit[] = $c;
    }
    foreach ($info['eigen'] as $id => $e) {
        $c = ['bron' => 'eigen', 'sleutel' => (string)$id, 'tm' => '', 'verborgen' => false];
        foreach (CONCERT_VELDEN as $v) $c[$v] = (string)($e[$v] ?? '');
        $uit[] = $c;
    }
    usort($uit, function ($a, $b) { return [$a['datum'], $a['tijd']] <=> [$b['datum'], $b['tijd']]; });
    return $uit;
}

function komendeConcerten(array $cfg, int $max = 20): array {
    $vandaag = date('Y-m-d');
    $uit = array_values(array_filter(alleConcerten($cfg), function ($c) use ($vandaag) {
        return ($c['tm'] !== '' ? $c['tm'] : $c['datum']) >= $vandaag;
    }));
    return array_slice($uit, 0, $max);
}

function datumNL(string $iso): string {
    $d = DateTime::createFromFormat('Y-m-d', $iso);
    if (!$d) return $iso;
    $dagen = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
    $maanden = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
    return $dagen[(int)$d->format('w')] . ' ' . (int)$d->format('j') . ' ' . $maanden[(int)$d->format('n') - 1] . ' ' . $d->format('Y');
}

function concertenHtml(array $cfg): string {
    $lijst = komendeConcerten($cfg);
    if (!$lijst) return '<p class="stil">Er staan op dit moment geen concerten gepland. Kijk binnenkort nog eens!</p>';
    $uit = '<div class="concerten">';
    foreach ($lijst as $c) {
        $wanneer = datumNL($c['datum']) . ($c['tm'] !== '' ? ' t/m ' . datumNL($c['tm']) : '');
        $foto = $c['foto'] !== '' ? veiligAdres($c['foto']) : null;
        $locatie = $c['locatie_url'] !== '' ? veiligAdres($c['locatie_url']) : null;
        $kaarten = $c['kaarten_url'] !== '' ? veiligAdres($c['kaarten_url']) : null;
        $uit .= '<article class="concert">'
            . ($foto ? '<div class="concertfoto"><img src="' . h($foto) . '" alt="" loading="lazy"></div>' : '')
            . '<div class="concerttekst"><div class="wanneer">' . h($wanneer) . ($c['tijd'] !== '' ? ' · ' . h(str_replace('-', '–', $c['tijd'])) : '') . '</div>'
            . '<h3 class="wat">' . h($c['titel']) . '</h3>'
            . ($c['waar'] !== '' ? '<div class="waar">📍 ' . ($locatie ? '<a href="' . h($locatie) . '" target="_blank" rel="noopener">' . h($c['waar']) . '</a>' : h($c['waar'])) . '</div>' : '')
            . ($c['beschrijving'] !== '' ? '<div class="beschrijving">' . opmaak($c['beschrijving']) . '</div>' : '')
            . ($kaarten ? '<p><a class="knop" href="' . h($kaarten) . '" target="_blank" rel="noopener">Kaarten</a></p>' : '')
            . '</div></article>';
    }
    return $uit . '</div>';
}

// ---------- Nextcloud (alleen lezen, via WebDAV) ----------

// Met welk account worden de bestanden opgehaald? Is het lid met Nextcloud ingelogd, dan met zijn of haar eigen account
// (het lid ziet dan precies wat het in Nextcloud ook mag zien). Anders met het website-account uit config.php.
// Geeft [gebruikers-id voor het pad, inlognaam, app-wachtwoord] of null.
function ncAccount(array $cfg): ?array {
    if (($cfg['nextcloud_url'] ?? '') === '') return null;
    if (!empty($_SESSION['nc_id']) && !empty($_SESSION['nc_app'])) {
        return [(string)$_SESSION['nc_id'], (string)$_SESSION['nc_login'], (string)$_SESSION['nc_app']];
    }
    if (($cfg['nextcloud_gebruiker'] ?? '') !== '' && ($cfg['nextcloud_app_wachtwoord'] ?? '') !== '') {
        return [(string)$cfg['nextcloud_gebruiker'], (string)$cfg['nextcloud_gebruiker'], (string)$cfg['nextcloud_app_wachtwoord']];
    }
    return null;
}

function ncAan(array $cfg): bool { return ncAccount($cfg) !== null; }

// Maakt van een pad uit de adresbalk een veilig pad binnen de ledenmap. Geeft null bij iets vreemds.
function ncSchoonPad(string $pad): ?string {
    $delen = [];
    foreach (explode('/', str_replace('\\', '/', $pad)) as $d) {
        if ($d === '' || $d === '.') continue;
        if ($d === '..' || preg_match('/[\x00-\x1F\x7F]/', $d)) return null;
        $delen[] = $d;
    }
    return implode('/', $delen);
}

function ncAdres(array $cfg, string $pad): string {
    $basis = rtrim($cfg['nextcloud_url'], '/') . '/remote.php/dav/files/' . rawurlencode(ncAccount($cfg)[0]) . '/';
    $volledig = trim(trim((string)$cfg['nextcloud_map'], '/') . '/' . $pad, '/');
    return $basis . implode('/', array_map('rawurlencode', $volledig === '' ? [] : explode('/', $volledig)));
}

function ncCurl(array $cfg, string $adres) {
    $c = curl_init($adres);
    curl_setopt_array($c, [
        CURLOPT_USERPWD => ncAccount($cfg)[1] . ':' . ncAccount($cfg)[2],
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS | CURLPROTO_HTTP,
    ]);
    return $c;
}

// Geeft ['mappen' => [...], 'bestanden' => [...]] of een string met een foutmelding.
function ncLijst(array $cfg, string $pad) {
    $adres = ncAdres($cfg, $pad);
    $c = ncCurl($cfg, $adres . '/');
    $body = '<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:nc="http://nextcloud.org/ns"><d:prop><d:resourcetype/><d:getcontentlength/><d:getlastmodified/><d:getcontenttype/><nc:mount-type/></d:prop></d:propfind>';
    curl_setopt_array($c, [
        CURLOPT_CUSTOMREQUEST => 'PROPFIND',
        CURLOPT_HTTPHEADER => ['Depth: 1', 'Content-Type: application/xml'],
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
    ]);
    $antw = curl_exec($c);
    $code = (int)curl_getinfo($c, CURLINFO_HTTP_CODE);
    curl_close($c);
    if ($antw === false || $code === 0) return 'Nextcloud is niet bereikbaar.';
    if ($code === 401) return 'De website kan niet inloggen bij Nextcloud. Controleer gebruiker en app-wachtwoord in config.php.';
    if ($code === 404) return $pad === '' ? 'De map "' . $cfg['nextcloud_map'] . '" staat niet in jouw Nextcloud. Vraag het bestuur om hem met je te delen.' : 'Deze map bestaat niet (meer).';
    if ($code !== 207) return 'Nextcloud gaf een onverwacht antwoord (' . $code . ').';

    $prev = libxml_use_internal_errors(true);
    $xml = simplexml_load_string((string)$antw, 'SimpleXMLElement', LIBXML_NONET);
    libxml_use_internal_errors($prev);
    if ($xml === false) return 'Het antwoord van Nextcloud kon niet gelezen worden.';
    $xml->registerXPathNamespace('d', 'DAV:');

    $eigen = rtrim((string)parse_url($adres, PHP_URL_PATH), '/');
    $mappen = [];
    $bestanden = [];
    foreach ($xml->xpath('//d:response') as $r) {
        $r->registerXPathNamespace('d', 'DAV:');
        $href = rtrim(rawurldecode((string)($r->xpath('d:href')[0] ?? '')), '/');
        if ($href === rawurldecode($eigen)) continue;
        $naam = basename($href);
        if ($naam === '' || $naam[0] === '.') continue;
        $r->registerXPathNamespace('nc', 'http://nextcloud.org/ns');
        $isMap = (bool)$r->xpath('.//d:resourcetype/d:collection');
        $team = (string)($r->xpath('.//nc:mount-type')[0] ?? '') === 'group';
        $rij = [
            'naam' => $naam,
            'grootte' => (int)($r->xpath('.//d:getcontentlength')[0] ?? 0),
            'gewijzigd' => strtotime((string)($r->xpath('.//d:getlastmodified')[0] ?? '')) ?: 0,
            'team' => $team,
        ];
        if ($isMap) $mappen[] = $rij; else $bestanden[] = $rij;
    }
    // Bovenaan alleen de teammappen tonen (welke dat zijn hangt af van de rechten van het lid in Nextcloud)
    if ($pad === '' && trim((string)$cfg['nextcloud_map'], '/') === '' && !empty($cfg['nextcloud_alleen_teammappen'])) {
        $mappen = array_values(array_filter($mappen, function ($m) { return $m['team']; }));
        $bestanden = [];
    }
    $opNaam = function ($a, $b) { return strnatcasecmp($a['naam'], $b['naam']); };
    usort($mappen, $opNaam);
    usort($bestanden, $opNaam);
    return ['mappen' => $mappen, 'bestanden' => $bestanden];
}

// Stuurt een bestand van Nextcloud rechtstreeks door naar de browser.
function ncDownload(array $cfg, string $pad): void {
    $naam = basename($pad);
    $c = ncCurl($cfg, ncAdres($cfg, $pad));
    $begonnen = false;
    $status = 0;
    curl_setopt_array($c, [
        CURLOPT_TIMEOUT => 0,
        CURLOPT_HEADERFUNCTION => function ($c, $regel) use (&$status, &$begonnen, $naam) {
            if (preg_match('~^HTTP/\S+\s+(\d+)~', $regel, $m)) $status = (int)$m[1];
            if (!$begonnen && $status === 200 && preg_match('/^(Content-Length|Last-Modified):/i', $regel)) header(trim($regel));
            return strlen($regel);
        },
        CURLOPT_WRITEFUNCTION => function ($c, $data) use (&$status, &$begonnen, $naam) {
            if ($status !== 200) return strlen($data);
            if (!$begonnen) {
                $begonnen = true;
                // Alleen bekende, veilige soorten mogen in de browser openen; de rest wordt gedownload
                $soorten = ['pdf' => 'application/pdf', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'gif' => 'image/gif', 'webp' => 'image/webp',
                    'mp3' => 'audio/mpeg', 'm4a' => 'audio/mp4', 'wav' => 'audio/wav', 'mp4' => 'video/mp4', 'txt' => 'text/plain; charset=utf-8'];
                $ext = strtolower(pathinfo($naam, PATHINFO_EXTENSION));
                header('Content-Type: ' . ($soorten[$ext] ?? 'application/octet-stream'));
                header('Content-Disposition: ' . (isset($soorten[$ext]) ? 'inline' : 'attachment') . "; filename*=UTF-8''" . rawurlencode($naam));
                header('X-Content-Type-Options: nosniff');
                header('Cache-Control: private, max-age=300');
            }
            echo $data;
            return strlen($data);
        },
    ]);
    curl_exec($c);
    curl_close($c);
    if (!$begonnen) {
        http_response_code($status === 404 ? 404 : 502);
        header('Content-Type: text/plain; charset=utf-8');
        echo $status === 404 ? 'Bestand niet gevonden.' : 'Het bestand kon niet worden opgehaald bij Nextcloud.';
    }
}

// ---------- Inloggen met Nextcloud (Login Flow v2, zit in elke Nextcloud) ----------
//
// 1. De website vraagt Nextcloud om een inlogpagina (login/v2) en opent die in een nieuw venster.
// 2. Het lid logt daar in bij Nextcloud zelf (met tweestapsverificatie als die aan staat) en geeft toestemming.
// 3. De website vraagt intussen steeds na of het gelukt is, controleert wie het is en in welke groepen,
//    en trekt het tijdelijke app-wachtwoord daarna meteen weer in. Het wachtwoord van het lid komt nooit langs de website.

const SSO_AGENT = 'Website Wereldkoor Haarlem';

function ssoAan(array $cfg): bool {
    return ($cfg['nextcloud_url'] ?? '') !== '' && !empty($cfg['nextcloud_login']);
}

function ncHttp(string $methode, string $adres, array $koppen = [], ?string $body = null, ?string $basic = null): array {
    $c = curl_init($adres);
    curl_setopt_array($c, [
        CURLOPT_CUSTOMREQUEST => $methode,
        CURLOPT_HTTPHEADER => $koppen,
        CURLOPT_USERAGENT => SSO_AGENT,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS | CURLPROTO_HTTP,
    ]);
    if ($basic !== null) { curl_setopt($c, CURLOPT_USERPWD, $basic); curl_setopt($c, CURLOPT_HTTPAUTH, CURLAUTH_BASIC); }
    if ($body !== null) curl_setopt($c, CURLOPT_POSTFIELDS, $body);
    $antw = curl_exec($c);
    $code = (int)curl_getinfo($c, CURLINFO_HTTP_CODE);
    curl_close($c);
    return [$code, $antw === false ? '' : (string)$antw];
}

// Stap 1: geeft het adres van de inlogpagina van Nextcloud, of null als Nextcloud niet reageert.
function ssoStart(array $cfg): ?string {
    startSessie();
    [$code, $antw] = ncHttp('POST', rtrim($cfg['nextcloud_url'], '/') . '/index.php/login/v2', ['Accept: application/json']);
    $d = json_decode($antw, true);
    if ($code !== 200 || empty($d['login']) || empty($d['poll']['token'])) return null;
    $_SESSION['sso_poll'] = (string)$d['poll']['token'];
    $_SESSION['sso_tijd'] = time();
    return (string)$d['login'];
}

// Rondt het inloggen af met een inlognaam en app-wachtwoord van Nextcloud. Geeft null als het gelukt is, anders een foutmelding.
// Het app-wachtwoord blijft in de sessie op de server (niet in de browser) en wordt bij uitloggen ingetrokken.
// $eigen = true: het lid logde in met een eigen app-wachtwoord; dat wordt nooit door de website ingetrokken.
function ssoVoltooi(array $cfg, string $loginNaam, string $appWachtwoord, bool $eigen = false): ?string {
    $basis = rtrim($cfg['nextcloud_url'], '/');
    $basic = $loginNaam . ':' . $appWachtwoord;
    [$code, $antw] = ncHttp('GET', $basis . '/ocs/v2.php/cloud/user?format=json', ['OCS-APIRequest: true', 'Accept: application/json'], null, $basic);
    $gebruiker = json_decode($antw, true)['ocs']['data'] ?? null;
    $weg = function () use ($basis, $basic, $eigen) { if (!$eigen) ncHttp('DELETE', $basis . '/ocs/v2.php/core/apppassword', ['OCS-APIRequest: true'], null, $basic); };
    if ($code !== 200 || !is_array($gebruiker) || empty($gebruiker['id'])) { $weg(); return $eigen ? 'Gebruikersnaam of wachtwoord klopt niet.' : 'Je gegevens konden niet worden opgehaald bij Nextcloud.'; }
    $groep = (string)($cfg['nextcloud_groep'] ?? '');
    if ($groep !== '' && !in_array($groep, (array)($gebruiker['groups'] ?? []), true)) {
        $weg();
        return 'Je bent ingelogd bij Nextcloud, maar je account hoort niet bij de groep "' . $groep . '". Vraag het bestuur om je toe te voegen.';
    }
    startSessie();
    session_regenerate_id(true);
    $_SESSION['leden'] = true;
    $_SESSION['naam'] = (string)($gebruiker['displayname'] ?? $gebruiker['display-name'] ?? $gebruiker['id']);
    $_SESSION['nc_id'] = (string)$gebruiker['id'];
    $_SESSION['nc_login'] = $loginNaam;
    $_SESSION['nc_app'] = $appWachtwoord;
    if ($eigen) $_SESSION['nc_eigen_app'] = true;
    return null;
}

// Inloggen met gebruikersnaam en wachtwoord op de website zelf. Het wachtwoord wordt alleen gebruikt om bij Nextcloud
// een app-wachtwoord voor deze sessie aan te vragen en wordt nergens bewaard.
function ssoFormulier(array $cfg, string $naam, string $wachtwoord): ?string {
    $naam = trim($naam);
    if ($naam === '' || $wachtwoord === '') return 'Vul je gebruikersnaam en wachtwoord in.';
    $basis = rtrim($cfg['nextcloud_url'], '/');
    [$code, $antw] = ncHttp('GET', $basis . '/ocs/v2.php/core/getapppassword?format=json', ['OCS-APIRequest: true', 'Accept: application/json'], null, $naam . ':' . $wachtwoord);
    if ($code === 200) {
        $app = (string)(json_decode($antw, true)['ocs']['data']['apppassword'] ?? '');
        if ($app === '') return 'Nextcloud gaf een onverwacht antwoord.';
        return ssoVoltooi($cfg, $naam, $app);
    }
    // 403: er werd al met een app-wachtwoord ingelogd; dat dan zelf gebruiken (wordt bij uitloggen niet ingetrokken)
    if ($code === 403) {
        return ssoVoltooi($cfg, $naam, $wachtwoord, true);
    }
    if ($code === 401) return 'Inloggen lukte niet. Controleer je gebruikersnaam (niet je e-mailadres) en wachtwoord, of gebruik de knop "Inloggen via Nextcloud" hieronder.';
    if ($code === 0) return 'Nextcloud is niet bereikbaar. Probeer het later opnieuw.';
    return 'Inloggen lukte niet (' . $code . ').';
}

// Login Flow (venster van Nextcloud, voor wie tweestapsverificatie aan heeft). Geeft ['status' => 'wacht' | 'ok' | 'fout', 'melding' => ...]
function ssoCheck(array $cfg): array {
    startSessie();
    $token = (string)($_SESSION['sso_poll'] ?? '');
    if ($token === '' || time() - (int)($_SESSION['sso_tijd'] ?? 0) > 1200) {
        unset($_SESSION['sso_poll'], $_SESSION['sso_tijd']);
        return ['status' => 'fout', 'melding' => 'Het inloggen is verlopen. Probeer het opnieuw.'];
    }
    $basis = rtrim($cfg['nextcloud_url'], '/');
    [$code, $antw] = ncHttp('POST', $basis . '/index.php/login/v2/poll', ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'], http_build_query(['token' => $token]));
    if ($code === 404) return ['status' => 'wacht'];
    unset($_SESSION['sso_poll'], $_SESSION['sso_tijd']);
    $d = json_decode($antw, true);
    if ($code !== 200 || empty($d['loginName']) || empty($d['appPassword'])) return ['status' => 'fout', 'melding' => 'Nextcloud gaf een onverwacht antwoord (' . $code . ').'];
    $fout = ssoVoltooi($cfg, (string)$d['loginName'], (string)$d['appPassword']);
    return $fout === null ? ['status' => 'ok'] : ['status' => 'fout', 'melding' => $fout];
}

function grootte(int $b): string {
    if ($b < 1024) return $b . ' B';
    if ($b < 1048576) return round($b / 1024) . ' kB';
    return number_format($b / 1048576, 1, ',', '') . ' MB';
}

// ---------- opbouw van een pagina ----------

function kop(array $cfg, string $titel, string $actief = '', bool $menuTonen = true): void {
    $paginas = laadPaginas();
    header('Content-Type: text/html; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    echo '<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">';
    echo '<title>' . h($titel === '' || $titel === 'Home' ? $cfg['naam'] : $titel . ' | ' . $cfg['naam']) . '</title>';
    echo '<link rel="stylesheet" href="' . h(url('stijl.css')) . '?v=' . @filemtime(__DIR__ . '/stijl.css') . '"></head><body>';
    $banner = (string)($cfg['kop_afbeelding'] ?? '');
    $banner = $banner !== '' ? veiligAdres($banner) : null;
    // Met een kopfoto staat de naam van het koor over de foto heen; anders links in de menubalk
    $logo = '<a class="logo" href="' . h(url()) . '">' . h($cfg['naam']) . '<span>' . h($cfg['ondertitel'] ?? '') . '</span></a>';
    if ($banner) echo '<div class="banner"><img src="' . h($banner) . '" alt="">' . $logo . '</div>';
    echo '<header class="kop' . ($banner ? ' metbanner' : '') . '"><div class="binnen">' . ($banner ? '' : $logo);
    if ($menuTonen) {
        echo '<input type="checkbox" id="menuknop" hidden><label for="menuknop" class="menuknop" aria-label="Menu">☰</label><nav>';
        foreach ($paginas as $slug => $p) {
            if (empty($p['menu'])) continue;
            echo '<a href="' . h(paginaUrl($slug)) . '"' . ($slug === $actief ? ' class="actief"' : '') . '>' . h($p['titel']) . '</a>';
        }
        echo '<a href="' . h(url('leden')) . '" class="ledenknop' . ($actief === 'leden' ? ' actief' : '') . '">Leden</a></nav>';
    }
    echo '</div></header><main class="binnen">';
}

function voet(array $cfg): void {
    echo '</main><footer class="voet"><div class="binnen">© ' . date('Y') . ' ' . h($cfg['naam']) . '</div></footer>';
    echo '<script src="' . h(url('site.js')) . '?v=' . @filemtime(__DIR__ . '/site.js') . '" defer></script></body></html>';
}
