<?php
declare(strict_types=1);

// Algemene veiligheidskoppen voor elk antwoord
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");

// ---------- welke vereniging? ----------
// Eén vereniging: config.php naast api.php.
// Meerdere verenigingen met dezelfde code: een map verenigingen/ met per vereniging <naam>.php
// (bijv. verenigingen/koor.php). De naam komt uit het eerste deel van het webadres (koor.mijndomein.nl -> koor),
// of uit verenigingen/domeinen.php (['mijndomein.nl' => 'koor', ...]) voor adressen die daar niet op passen.
function kiesVereniging(): array {
    $map = __DIR__ . '/verenigingen';
    if (!is_dir($map)) {
        if (!is_file(__DIR__ . '/config.php')) { http_response_code(500); exit('config.php ontbreekt.'); }
        return ['', require __DIR__ . '/config.php'];
    }
    $host = strtolower(preg_replace('/:\d+$/', '', (string)($_SERVER['HTTP_HOST'] ?? '')));
    $domeinen = is_file($map . '/domeinen.php') ? (require $map . '/domeinen.php') : [];
    $id = is_array($domeinen) && isset($domeinen[$host]) ? (string)$domeinen[$host] : explode('.', $host)[0];
    // Alleen kleine letters, cijfers en streepjes: zo kan een webadres nooit naar een ander bestand wijzen
    if (!preg_match('/^[a-z0-9][a-z0-9-]{0,39}$/', $id) || $id === 'domeinen' || !is_file($map . '/' . $id . '.php')) {
        http_response_code(404); header('Content-Type: text/plain; charset=utf-8'); exit('Onbekende vereniging.');
    }
    return [$id, require $map . '/' . $id . '.php'];
}
[$VERENIGING, $CONFIG] = kiesVereniging();
if (!is_array($CONFIG)) { http_response_code(500); exit('Ongeldige instellingen.'); }

// Map voor de gegevens: 'data_map' in de instellingen (bij voorkeur buiten de webroot), anders data/ of data/<vereniging>/
function dataMap(array $cfg, string $id): string {
    $m = trim((string)($cfg['data_map'] ?? ''));
    if ($m === '') return __DIR__ . '/data' . ($id !== '' ? '/' . $id : '');
    return rtrim($m[0] === '/' || preg_match('/^[A-Za-z]:[\\\/]/', $m) ? $m : __DIR__ . '/' . $m, '/\\');
}
define('DATA_DIR', dataMap($CONFIG, $VERENIGING));
const DATA_FILE = DATA_DIR . '/planning.json';
const BACKUP_DIR = DATA_DIR . '/backup';
const MAX_BACKUPS = 50;
const MAX_INVOER = 256 * 1024;

// ---------- soorten activiteiten ----------
// Standaard de soorten van een koor; een andere vereniging zet eigen soorten in config.php ('soorten').
// Rollen: wekelijks (vervalt in vakanties, standaard niet in de lijst), hoogtepunt (eerstvolgende, programma),
// voorbehoud (nog niet zeker), vakantie (schoolvakanties). Andere soorten hebben geen rol.
function soortDefs(): array {
    global $CONFIG;
    static $defs = null;
    if ($defs !== null) return $defs;
    $std = [['naam' => 'Repetitie', 'kleur' => '#cfe0f3', 'rol' => 'wekelijks'], ['naam' => 'Extra repetitie', 'kleur' => '#8fd3cf', 'rol' => ''],
        ['naam' => 'Optreden', 'kleur' => '#f4a6a0', 'rol' => 'hoogtepunt'], ['naam' => 'Onder voorbehoud', 'kleur' => '#ffe45c', 'rol' => 'voorbehoud'],
        ['naam' => 'Vergadering', 'kleur' => '#c9b8e0', 'rol' => ''], ['naam' => 'Vakantie', 'kleur' => '#b7dd9a', 'rol' => 'vakantie'], ['naam' => 'Overig', 'kleur' => '#f8cbad', 'rol' => '']];
    $eigen = $CONFIG['soorten'] ?? null;
    if (!is_array($eigen) || !$eigen) return $defs = $std;
    $defs = [];
    foreach ($eigen as $s) {
        $naam = is_array($s) ? trim((string)($s['naam'] ?? '')) : '';
        if ($naam === '') continue;
        $kleur = (string)($s['kleur'] ?? '');
        $rol = (string)($s['rol'] ?? '');
        $defs[] = ['naam' => mb_substr($naam, 0, 40), 'kleur' => preg_match('/^#[0-9a-f]{6}$/i', $kleur) ? $kleur : '#dddddd',
            'rol' => in_array($rol, ['wekelijks', 'hoogtepunt', 'voorbehoud', 'vakantie'], true) ? $rol : '',
            'meervoud' => mb_substr(trim((string)($s['meervoud'] ?? '')), 0, 40)];
    }
    return $defs ?: ($defs = $std);
}
function soortNamen(): array { return array_column(soortDefs(), 'naam'); }
function soortRol(string $soort): string { foreach (soortDefs() as $d) if ($d['naam'] === $soort) return $d['rol']; return ''; }
function soortMetRol(string $rol): string { foreach (soortDefs() as $d) if ($d['rol'] === $rol) return $d['naam']; return ''; }

date_default_timezone_set($CONFIG['tijdzone'] ?? 'Europe/Amsterdam');

// CORS: alleen de adressen uit config.php (bijv. jullie GitHub Pages) mogen deze API vanuit de browser gebruiken
$herkomst = $_SERVER['HTTP_ORIGIN'] ?? '';
if (is_string($herkomst) && $herkomst !== '' && in_array(rtrim($herkomst, '/'), $CONFIG['toegestane_origins'] ?? [], true)) {
    header('Access-Control-Allow-Origin: ' . $herkomst);
    header('Access-Control-Allow-Headers: Content-Type, X-Token, X-Leden');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Max-Age: 600');
}
header('Vary: Origin');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

// Beperkt pogingen (inloggen, ledencode): hooguit 10 mislukte pogingen per kwartier per IP-adres
function pogingenBestand(): string { return DATA_DIR . '/.pogingen.json'; }
function teVeelPogingen(string $soort): bool {
    $p = @json_decode((string)@file_get_contents(pogingenBestand()), true) ?: [];
    $k = $soort . '|' . ($_SERVER['REMOTE_ADDR'] ?? '');
    $recent = array_filter($p[$k] ?? [], function ($t) { return $t > time() - 900; });
    return count($recent) >= 10;
}
function mislukt(string $soort): void {
    if (!is_dir(DATA_DIR)) @mkdir(DATA_DIR, 0775, true);
    $f = pogingenBestand();
    $p = @json_decode((string)@file_get_contents($f), true) ?: [];
    foreach ($p as $k => $ts) { $p[$k] = array_values(array_filter($ts, function ($t) { return $t > time() - 900; })); if (!$p[$k]) unset($p[$k]); }
    $p[$soort . '|' . ($_SERVER['REMOTE_ADDR'] ?? '')][] = time();
    @file_put_contents($f, json_encode($p), LOCK_EX);
}
function antwoord($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    // HEX-opties: ook als iemand dit antwoord als HTML zou laten tonen, staat er geen uitvoerbare opmaak in
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    exit;
}
function fout(string $melding, int $status = 400): void { antwoord(['fout' => $melding], $status); }

function laad(): array {
    if (!is_file(DATA_FILE)) return ['versie' => 1, 'items' => []];
    $fh = fopen(DATA_FILE, 'r');
    flock($fh, LOCK_SH);
    $inhoud = stream_get_contents($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    $data = json_decode((string)$inhoud, true);
    if (!is_array($data) || !isset($data['items']) || !is_array($data['items'])) return ['versie' => 1, 'items' => []];
    return $data;
}

// Leest, wijzigt en schrijft onder één exclusief slot, met een reservekopie van de vorige versie.
function wijzig(callable $fn): array {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0775, true);
    if (!is_dir(BACKUP_DIR)) mkdir(BACKUP_DIR, 0775, true);
    $lock = fopen(DATA_DIR . '/.lock', 'c');
    flock($lock, LOCK_EX);
    try {
        $data = laad();
        $data = $fn($data);
        usort($data['items'], function ($a, $b) {
            return [$a['datum'], $a['tijd']] <=> [$b['datum'], $b['tijd']];
        });
        if (is_file(DATA_FILE)) {
            copy(DATA_FILE, BACKUP_DIR . '/planning-' . date('Ymd-His') . '-' . bin2hex(random_bytes(2)) . '.json');
            $oud = glob(BACKUP_DIR . '/planning-*.json') ?: [];
            sort($oud);
            foreach (array_slice($oud, 0, max(0, count($oud) - MAX_BACKUPS)) as $f) @unlink($f);
        }
        $tmp = DATA_FILE . '.tmp';
        if (file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) === false || !rename($tmp, DATA_FILE)) {
            fout('Opslaan mislukt: map data/ is niet schrijfbaar.', 500);
        }
        return $data;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function geldigeDatum($s): bool {
    if (!is_string($s) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $s, $m)) return false;
    return checkdate((int)$m[2], (int)$m[3], (int)$m[1]);
}
function tekst($v, int $max): string {
    $v = is_string($v) ? trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $v)) : '';
    return mb_substr($v, 0, $max);
}
// Programma van een optreden: één liedje per regel, in volgorde (hooguit 40 regels van 100 tekens)
function liedjes($v): string {
    if (!is_string($v)) return '';
    $regels = array_filter(array_map(function ($r) { return tekst(preg_replace('/^\s*\d+[.)]\s*/', '', $r), 100); }, preg_split('/\R/', $v)), 'strlen');
    return implode("\n", array_slice(array_values($regels), 0, 40));
}
function schoonItem($in): array {
    if (!is_array($in)) fout('Ongeldige activiteit.');
    $item = [
        'id' => (isset($in['id']) && is_string($in['id']) && preg_match('/^[a-z0-9]{1,20}$/', $in['id'])) ? $in['id'] : 'i' . bin2hex(random_bytes(5)),
        'datum' => $in['datum'] ?? '',
        'tm' => $in['tm'] ?? '',
        'tijd' => tekst($in['tijd'] ?? '', 20),
        'titel' => tekst($in['titel'] ?? '', 120),
        'soort' => $in['soort'] ?? '',
        'waar' => tekst($in['waar'] ?? '', 120),
        'opmerking' => tekst($in['opmerking'] ?? '', 300),
        'liedjes' => liedjes($in['liedjes'] ?? ''),
    ];
    if (!geldigeDatum($item['datum'])) fout('Vul een geldige datum in.');
    if ($item['tm'] !== '' && (!geldigeDatum($item['tm']) || $item['tm'] < $item['datum'])) fout('De datum bij "t/m" moet na de begindatum liggen.');
    if ($item['tm'] === $item['datum']) $item['tm'] = '';
    if ($item['titel'] === '') fout('Vul in wat er gebeurt.');
    if (!in_array($item['soort'], soortNamen(), true)) fout('Kies een soort.');
    if ($item['tijd'] !== '' && !preg_match('/^([01]?\d|2[0-3])[:.]([0-5]\d)(\s*-\s*([01]?\d|2[0-3])[:.]([0-5]\d))?$/', $item['tijd'])) {
        fout('Schrijf de tijd als 19:30 of 19:30-21:30.');
    }
    $item['tijd'] = str_replace('.', ':', preg_replace('/\s+/', '', $item['tijd']));
    return $item;
}

// Inloggen met een ondertekend token (geen cookie), zodat het ook werkt als de pagina's op een ander domein staan.
// Een token is 30 dagen geldig. Wie het wachtwoord in config.php wijzigt, maakt alle bestaande tokens ongeldig.
function tokenSleutel(array $cfg): string {
    $geheim = laad()['instellingen']['token_geheim'] ?? '';
    if ($geheim === '') {
        $geheim = bin2hex(random_bytes(32));
        wijzig(function ($d) use (&$geheim) {
            if (!empty($d['instellingen']['token_geheim'])) $geheim = $d['instellingen']['token_geheim'];
            else $d['instellingen']['token_geheim'] = $geheim;
            return $d;
        });
    }
    return hash('sha256', $geheim . '|' . (string)($cfg['wachtwoord'] ?? ''));
}
function maakToken(array $cfg): string {
    $tot = (string)(time() + 30 * 86400);
    return $tot . '.' . hash_hmac('sha256', $tot, tokenSleutel($cfg));
}
function ingelogd(): bool {
    global $CONFIG;
    $t = $_SERVER['HTTP_X_TOKEN'] ?? '';
    if (!is_string($t) || !preg_match('/^(\d{10})\.([a-f0-9]{64})$/', $t, $m) || (int)$m[1] < time()) return false;
    return hash_equals(hash_hmac('sha256', $m[1], tokenSleutel($CONFIG)), $m[2]);
}
function vereisBeheer(): void {
    if (!ingelogd()) fout('Je bent niet (meer) ingelogd.', 401);
}


// ---------- repetities vervallen in vakanties ----------
function zichtbareItems(array $items): array {
    $vak = array_values(array_filter($items, function ($i) { return soortRol($i['soort']) === 'vakantie'; }));
    return array_values(array_filter($items, function ($i) use ($vak) {
        if (soortRol($i['soort']) !== 'wekelijks') return true;
        foreach ($vak as $v) {
            $eind = $v['tm'] !== '' ? $v['tm'] : $v['datum'];
            if ($i['datum'] >= $v['datum'] && $i['datum'] <= $eind) return false;
        }
        return true;
    }));
}

// ---------- geheime agendalink ----------
function icsSleutel(bool $nieuw = false): string {
    $data = laad();
    if (!$nieuw && !empty($data['instellingen']['ics_sleutel'])) return $data['instellingen']['ics_sleutel'];
    $sleutel = bin2hex(random_bytes(12));
    wijzig(function ($d) use ($sleutel) { $d['instellingen']['ics_sleutel'] = $sleutel; return $d; });
    return $sleutel;
}

// ---------- verjaardagen ----------
// Alleen naam en dag (MM-DD), zonder geboortejaar: zo min mogelijk persoonsgegevens.
// Leden zien ze alleen als de kalender is afgeschermd met een ledencode; het eigen agenda-abonnement werkt met een eigen geheime link.
const MAX_VERJAARDAGEN = 500;
function verjaardagenAan(array $cfg): bool { return ($cfg['verjaardagen'] ?? true) !== false; }
function geldigeDag($s): bool {
    return is_string($s) && preg_match('/^(\d{2})-(\d{2})$/', $s, $m) && checkdate((int)$m[1], (int)$m[2], 2024);
}
function schoonVerjaardag($in): array {
    if (!is_array($in)) fout('Ongeldige verjaardag.');
    $v = [
        'id' => (isset($in['id']) && is_string($in['id']) && preg_match('/^[a-z0-9]{1,20}$/', $in['id'])) ? $in['id'] : 'j' . bin2hex(random_bytes(5)),
        'naam' => tekst($in['naam'] ?? '', 80),
        'dag' => $in['dag'] ?? '',
    ];
    if ($v['naam'] === '') fout('Vul een naam in.');
    if (!geldigeDag($v['dag'])) fout('Kies een geldige dag en maand.');
    return $v;
}
// Leest regels als "Anna 14-03", "Anna;14-3-1980", "14 maart Anna" of "Anna, 14/03". Een geboortejaar wordt weggelaten.
function leesVerjaardagen(string $tekst): array {
    $mnd = ['jan' => 1, 'feb' => 2, 'mrt' => 3, 'maa' => 3, 'apr' => 4, 'mei' => 5, 'jun' => 6, 'jul' => 7, 'aug' => 8, 'sep' => 9, 'okt' => 10, 'oct' => 10, 'nov' => 11, 'dec' => 12];
    $goed = []; $fout = [];
    foreach (preg_split('/\R/', $tekst) as $regel) {
        $regel = trim($regel);
        if ($regel === '') continue;
        $d = $m = 0; $naam = '';
        if (preg_match('/(\d{1,2})\s*[-\/.]\s*(\d{1,2})(?:\s*[-\/.]\s*(\d{2,4}))?/', $regel, $x)) { $d = (int)$x[1]; $m = (int)$x[2]; $naam = str_replace($x[0], ' ', $regel); }
        elseif (preg_match('/(\d{1,2})\s+([a-z]{3})[a-z]*\.?(?:\s+(\d{4}))?/iu', $regel, $x) && isset($mnd[strtolower($x[2])])) { $d = (int)$x[1]; $m = $mnd[strtolower($x[2])]; $naam = str_replace($x[0], ' ', $regel); }
        $naam = trim(preg_replace('/\s+/', ' ', trim($naam, " \t;,:|-")));
        if ($naam === '' || !checkdate($m, $d, 2024)) { $fout[] = mb_substr($regel, 0, 60); continue; }
        $goed[] = ['naam' => mb_substr($naam, 0, 80), 'dag' => sprintf('%02d-%02d', $m, $d)];
    }
    return [$goed, $fout];
}
function sorteerVerjaardagen(array &$d): void {
    $d['verjaardagen'] = array_values($d['verjaardagen'] ?? []);
    usort($d['verjaardagen'], function ($a, $b) { return [$a['dag'], $a['naam']] <=> [$b['dag'], $b['naam']]; });
}
function verjaardagSleutel(bool $nieuw = false): string {
    $data = laad();
    if (!$nieuw && !empty($data['instellingen']['verjaardag_sleutel'])) return $data['instellingen']['verjaardag_sleutel'];
    $sleutel = bin2hex(random_bytes(12));
    wijzig(function ($d) use ($sleutel) { $d['instellingen']['verjaardag_sleutel'] = $sleutel; return $d; });
    return $sleutel;
}
function verjaardagenIcs(array $lijst, array $cfg): void {
    $host = preg_replace('/[^a-z0-9.\-]/i', '', explode(':', $_SERVER['HTTP_HOST'] ?? 'jaarplanning')[0]);
    $r = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Jaarplanning//NL', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
        'X-WR-CALNAME:' . icsTekst('Verjaardagen ' . ($cfg['naam'] ?? '')), 'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H'];
    $stamp = gmdate('Ymd\THis\Z');
    $voor = trim((string)($cfg['ics_voorvoegsel'] ?? ''));
    foreach ($lijst as $v) {
        [$m, $d] = array_map('intval', explode('-', $v['dag']));
        $start = sprintf('2000%02d%02d', $m, $d);
        $r[] = 'BEGIN:VEVENT';
        $r[] = 'UID:' . $v['id'] . '-jarig@' . $host;
        $r[] = 'DTSTAMP:' . $stamp;
        $r[] = 'DTSTART;VALUE=DATE:' . $start;
        $r[] = 'DTEND;VALUE=DATE:' . date('Ymd', strtotime("2000-$m-$d +1 day"));
        // 29 februari: in andere jaren op 28 februari
        $r[] = $v['dag'] === '02-29' ? 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1' : 'RRULE:FREQ=YEARLY';
        $r[] = 'SUMMARY:' . icsTekst(zonderLinks(($voor !== '' ? "[$voor] " : '') . 'Jarig: ' . $v['naam']));
        $r[] = 'CATEGORIES:Verjaardag';
        $r[] = 'TRANSP:TRANSPARENT';
        $r[] = 'END:VEVENT';
    }
    $r[] = 'END:VCALENDAR';
    header('Content-Type: text/calendar; charset=utf-8');
    header('Content-Disposition: inline; filename="verjaardagen.ics"');
    header('Cache-Control: no-cache');
    foreach ($r as $regel) echo icsRegel($regel);
    exit;
}

// ---------- afscherming voor leden ----------
// Staat aan zodra in config.php een ledencode is ingevuld. Leden komen binnen met de geheime ledenlink (?k=...)
// of door de ledencode in te typen; daarna onthoudt hun browser de sleutel.
function ledenAfgeschermd(array $cfg): bool { return trim((string)($cfg['leden_code'] ?? '')) !== ''; }
function ledenSleutel(bool $nieuw = false): string {
    $data = laad();
    if (!$nieuw && !empty($data['instellingen']['leden_sleutel'])) return $data['instellingen']['leden_sleutel'];
    $sleutel = bin2hex(random_bytes(12));
    wijzig(function ($d) use ($sleutel) { $d['instellingen']['leden_sleutel'] = $sleutel; return $d; });
    return $sleutel;
}
function magLijstZien(array $cfg): bool {
    if (!ledenAfgeschermd($cfg) || ingelogd()) return true;
    $gegeven = $_SERVER['HTTP_X_LEDEN'] ?? '';
    $goed = laad()['instellingen']['leden_sleutel'] ?? '';
    return is_string($gegeven) && $goed !== '' && hash_equals($goed, $gegeven);
}

// ---------- schoolvakanties (open data Rijksoverheid) ----------
$GLOBALS['haal_fout'] = '';
function haalUrl(string $url): ?string {
    if (function_exists('curl_init')) {
        $c = curl_init($url);
        curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_USERAGENT => 'Jaarplanning koor', CURLOPT_HTTPHEADER => ['Accept: application/json']]);
        $r = curl_exec($c);
        $code = curl_getinfo($c, CURLINFO_HTTP_CODE);
        if ($r === false) $GLOBALS['haal_fout'] = 'verbinding mislukt: ' . curl_error($c);
        elseif ($code < 200 || $code >= 300) $GLOBALS['haal_fout'] = 'server gaf HTTP ' . $code;
        curl_close($c);
        return ($r !== false && $code >= 200 && $code < 300) ? $r : null;
    }
    $ctx = stream_context_create(['http' => ['timeout' => 15, 'header' => "Accept: application/json\r\nUser-Agent: Jaarplanning koor\r\n"]]);
    if (!ini_get('allow_url_fopen')) { $GLOBALS['haal_fout'] = 'PHP mag geen externe adressen openen (geen curl en allow_url_fopen staat uit)'; return null; }
    $r = @file_get_contents($url, false, $ctx);
    if ($r === false) $GLOBALS['haal_fout'] = 'verbinding mislukt';
    return $r === false ? null : $r;
}
function huidigeSchooljaren(): array {
    $j = (int)date('Y');
    $start = (int)date('n') >= 8 ? $j : $j - 1;
    return [$start . '-' . ($start + 1), ($start + 1) . '-' . ($start + 2)];
}
// Geeft [['titel'=>..., 'datum'=>..., 'tm'=>...], ...] voor de gekozen regio, of null als het ophalen mislukt.
function haalVakanties(string $schooljaar, string $regio, string $tz): ?array {
    $ruw = haalUrl('https://opendata.rijksoverheid.nl/v1/infotypes/schoolholidays/schoolyear/' . $schooljaar . '?output=json');
    if ($ruw === null) return null;
    $knopen = [];
    // Rijksoverheid zet regeleinden midden in tekstwaarden; dat is geen geldige JSON, dus eerst opschonen
    $data = json_decode(preg_replace('/[\x00-\x1F]+/', ' ', $ruw), true);
    if (is_array($data)) {
        $zoek = function ($n) use (&$zoek, &$knopen) {
            if (!is_array($n)) return;
            if (isset($n['type'], $n['regions']) && is_array($n['regions'])) {
                $regios = isset($n['regions']['region']) ? [$n['regions']] : $n['regions'];
                $knopen[] = ['type' => $n['type'], 'regions' => $regios];
                return;
            }
            foreach ($n as $kind) $zoek($kind);
        };
        $zoek($data);
    } elseif (function_exists('simplexml_load_string') && ($xml = @simplexml_load_string($ruw))) {
        foreach ($xml->xpath('//vacation') ?: [] as $v) {
            $regios = [];
            foreach ($v->regions as $r) $regios[] = ['region' => (string)$r->region, 'startdate' => (string)$r->startdate, 'enddate' => (string)$r->enddate];
            $knopen[] = ['type' => (string)$v->type, 'regions' => $regios];
        }
    }
    $zone = new DateTimeZone($tz);
    $uit = [];
    foreach ($knopen as $k) {
        foreach ($k['regions'] as $r) {
            $naam = strtolower(trim((string)($r['region'] ?? '')));
            if ($naam !== strtolower($regio) && $naam !== 'heel nederland') continue;
            try {
                $van = (new DateTime((string)$r['startdate']))->setTimezone($zone)->format('Y-m-d');
                $tot = (new DateTime((string)$r['enddate']))->setTimezone($zone)->format('Y-m-d');
            } catch (Exception $e) { continue; }
            $uit[] = ['titel' => trim((string)$k['type']), 'datum' => $van, 'tm' => $tot];
        }
    }
    return $uit;
}
function importeerVakanties(array $schooljaren, array $cfg): array {
    $regio = $cfg['regio'] ?? 'noord';
    $tz = $cfg['tijdzone'] ?? 'Europe/Amsterdam';
    $toegevoegd = []; $overgeslagen = []; $mislukt = []; $gelukt = [];
    $nieuw = [];
    foreach ($schooljaren as $sj) {
        $lijst = haalVakanties($sj, $regio, $tz);
        if ($lijst === null || !$lijst) {
            $mislukt[] = $sj . ' (' . ($lijst === null ? ($GLOBALS['haal_fout'] ?: 'onbekende fout') : 'geen vakanties gevonden voor regio ' . $regio) . ')';
            continue;
        }
        $gelukt[] = $sj;
        foreach ($lijst as $v) $nieuw[] = $v;
    }
    $vakSoort = soortMetRol('vakantie');
    $wekelijks = soortMetRol('wekelijks');
    $vakOpm = 'schoolvakantie' . ($wekelijks !== '' ? ', geen ' . mb_strtolower($wekelijks) : '');
    $data = wijzig(function ($d) use ($nieuw, $gelukt, $vakSoort, $vakOpm, &$toegevoegd, &$overgeslagen) {
        foreach ($nieuw as $v) {
            $botst = false;
            foreach ($d['items'] as $i) {
                if (soortRol($i['soort']) !== 'vakantie') continue;
                $e = $i['tm'] !== '' ? $i['tm'] : $i['datum'];
                if ($v['datum'] <= $e && $v['tm'] >= $i['datum']) { $botst = true; break; }
            }
            if ($botst) { $overgeslagen[] = $v['titel'] . ' ' . $v['datum']; continue; }
            $d['items'][] = ['id' => 'v' . bin2hex(random_bytes(5)), 'datum' => $v['datum'], 'tm' => $v['tm'] === $v['datum'] ? '' : $v['tm'],
                'tijd' => '', 'titel' => $v['titel'], 'soort' => $vakSoort, 'waar' => '', 'opmerking' => $vakOpm];
            $toegevoegd[] = $v['titel'] . ' ' . $v['datum'];
        }
        $klaar = $d['instellingen']['vakanties_geimporteerd'] ?? [];
        $d['instellingen']['vakanties_geimporteerd'] = array_values(array_unique(array_merge($klaar, $gelukt)));
        return $d;
    });
    return ['toegevoegd' => $toegevoegd, 'overgeslagen' => $overgeslagen, 'mislukt' => $mislukt, 'items' => $data['items']];
}

// ---------- agenda-abonnement ----------
// Links (en alles wat een agenda-app als link herkent) gaan niet mee in het abonnement,
// zodat een valse afspraak geen aanklikbare phishinglink kan bevatten.
function zonderLinks(string $s): string {
    $s = preg_replace('~\b(?:https?|ftp|mailto|tel|webcal)://?\S+~i', '[link verwijderd]', $s);
    $s = preg_replace('~\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}(?:/\S*)?\b~i', '[link verwijderd]', $s);
    return preg_replace('~\S+@\[link verwijderd\]~', '[link verwijderd]', $s);
}
function icsTekst(string $s): string { return str_replace(["\\", ';', ',', "\n"], ["\\\\", '\;', '\,', '\n'], $s); }
function icsRegel(string $r): string {
    $uit = '';
    while (strlen($r) > 74) {
        $knip = 74;
        while ($knip > 0 && (ord($r[$knip]) & 0xC0) === 0x80) $knip--; // niet midden in een UTF-8-teken knippen
        $uit .= substr($r, 0, $knip) . "\r\n ";
        $r = substr($r, $knip);
    }
    return $uit . $r . "\r\n";
}
function ics(array $items, array $cfg): void {
    $tz = $cfg['tijdzone'] ?? 'Europe/Amsterdam';
    $host = preg_replace('/[^a-z0-9.\-]/i', '', explode(':', $_SERVER['HTTP_HOST'] ?? 'jaarplanning')[0]);
    $r = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Jaarplanning//NL', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
        'X-WR-CALNAME:' . icsTekst(($cfg['naam'] ?? 'Koor') . ' jaarplanning'), 'X-WR-TIMEZONE:' . $tz,
        'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H'];
    if ($tz === 'Europe/Amsterdam') {
        array_push($r, 'BEGIN:VTIMEZONE', 'TZID:Europe/Amsterdam', 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST',
            'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT', 'BEGIN:STANDARD', 'TZOFFSETFROM:+0200',
            'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD', 'END:VTIMEZONE');
    }
    $stamp = gmdate('Ymd\THis\Z');
    foreach ($items as $it) {
        $d = str_replace('-', '', $it['datum']);
        $r[] = 'BEGIN:VEVENT';
        $r[] = 'UID:' . $it['id'] . '@' . $host;
        $r[] = 'DTSTAMP:' . $stamp;
        if ($it['tijd'] !== '' && preg_match('/^(\d{1,2}):(\d{2})(?:-(\d{1,2}):(\d{2}))?$/', $it['tijd'], $m)) {
            $start = sprintf('%02d%02d00', $m[1], $m[2]);
            if (isset($m[3]) && $m[3] !== '') { $eind = sprintf('%02d%02d00', $m[3], $m[4]); }
            else { $eind = sprintf('%02d%02d00', min(23, (int)$m[1] + 1), $m[2]); }
            $r[] = "DTSTART;TZID=$tz:{$d}T$start";
            $r[] = "DTEND;TZID=$tz:{$d}T$eind";
        } else {
            $tot = $it['tm'] !== '' ? $it['tm'] : $it['datum'];
            $r[] = "DTSTART;VALUE=DATE:$d";
            $r[] = 'DTEND;VALUE=DATE:' . date('Ymd', strtotime($tot . ' +1 day'));
            $r[] = 'TRANSP:TRANSPARENT';
        }
        $titel = (soortRol($it['soort']) === 'voorbehoud' ? $it['soort'] . ': ' : '') . $it['titel'];
        $voor = trim((string)($cfg['ics_voorvoegsel'] ?? ''));
        if ($voor !== '') $titel = "[$voor] " . $titel;
        $r[] = 'SUMMARY:' . icsTekst(zonderLinks($titel));
        $r[] = 'CATEGORIES:' . icsTekst($it['soort']);
        $kleur = ['Repetitie' => 'lightsteelblue', 'Extra repetitie' => 'mediumturquoise', 'Optreden' => 'salmon', 'Onder voorbehoud' => 'gold', 'Vergadering' => 'mediumpurple', 'Vakantie' => 'yellowgreen', 'Overig' => 'sandybrown'][$it['soort']] ?? '';
        if ($kleur !== '') $r[] = 'COLOR:' . $kleur; // RFC 7986: CSS-kleurnaam
        $r[] = 'STATUS:' . (soortRol($it['soort']) === 'voorbehoud' ? 'TENTATIVE' : 'CONFIRMED');
        if ($it['waar'] !== '') $r[] = 'LOCATION:' . icsTekst(zonderLinks($it['waar']));
        $omschr = $it['opmerking'];
        if (($it['liedjes'] ?? '') !== '') {
            $n = 0;
            $omschr .= ($omschr !== '' ? "\n\n" : '') . "Programma:\n" . implode("\n", array_map(function ($l) use (&$n) { return (++$n) . '. ' . $l; }, explode("\n", $it['liedjes'])));
        }
        if ($omschr !== '') $r[] = 'DESCRIPTION:' . icsTekst(zonderLinks($omschr));
        $r[] = 'END:VEVENT';
    }
    $r[] = 'END:VCALENDAR';
    header('Content-Type: text/calendar; charset=utf-8');
    header('Content-Disposition: inline; filename="jaarplanning.ics"');
    header('Cache-Control: no-cache');
    foreach ($r as $regel) echo icsRegel($regel);
    exit;
}

// ---------- routes ----------
$actie = $_GET['actie'] ?? '';
$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($methode === 'GET' && $actie === 'lijst') {
    if (!magLijstZien($CONFIG)) antwoord(['fout' => 'Deze kalender is alleen voor leden.', 'afgeschermd' => true], 401);
    $uit = ['naam' => $CONFIG['naam'] ?? '', 'soorten' => soortDefs(), 'programma' => ($CONFIG['programma'] ?? true) !== false, 'items' => laad()['items'], 'ics' => icsSleutel()];
    // Verjaardagen alleen voor leden van een afgeschermde kalender (en voor de secretaris)
    if (verjaardagenAan($CONFIG) && (ledenAfgeschermd($CONFIG) || ingelogd())) {
        $uit['verjaardagen'] = laad()['verjaardagen'] ?? [];
        if ($uit['verjaardagen']) $uit['jarig'] = verjaardagSleutel();
    }
    antwoord($uit);
}
if ($methode === 'GET' && $actie === 'jarig') {
    $sleutel = $_GET['sleutel'] ?? '';
    $goed = laad()['instellingen']['verjaardag_sleutel'] ?? '';
    if (!verjaardagenAan($CONFIG) || !is_string($sleutel) || $goed === '' || !hash_equals($goed, $sleutel)) { http_response_code(404); exit('Niet gevonden.'); }
    verjaardagenIcs(laad()['verjaardagen'] ?? [], $CONFIG);
}
if ($methode === 'GET' && $actie === 'ics') {
    $sleutel = $_GET['sleutel'] ?? '';
    $goed = laad()['instellingen']['ics_sleutel'] ?? '';
    if (!is_string($sleutel) || $goed === '' || !hash_equals($goed, $sleutel)) { http_response_code(404); exit('Niet gevonden.'); }
    ics(zichtbareItems(laad()['items']), $CONFIG);
}

if ($methode === 'GET' && $actie === 'sessie') {
    antwoord(['ingelogd' => ingelogd()]);
}
if ($methode !== 'POST') fout('Onbekende actie.', 404);

if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > MAX_INVOER) fout('Te veel gegevens in één keer.', 413);
$ruw = (string)file_get_contents('php://input', false, null, 0, MAX_INVOER + 1);
if (strlen($ruw) > MAX_INVOER) fout('Te veel gegevens in één keer.', 413);
$invoer = json_decode($ruw, true);
if (!is_array($invoer)) $invoer = [];

switch ($actie) {
    case 'login':
        if (teVeelPogingen('login')) fout('Te veel mislukte pogingen. Probeer het over een kwartier opnieuw.', 429);
        $ww = (string)($CONFIG['wachtwoord'] ?? '');
        if ($ww === '' || $ww === 'verander-mij') fout('Er is nog geen wachtwoord ingesteld in config.php.', 403);
        $gegeven = is_string($invoer['wachtwoord'] ?? null) ? $invoer['wachtwoord'] : '';
        $ok = strpos($ww, '$2y$') === 0 ? password_verify($gegeven, $ww) : hash_equals($ww, $gegeven);
        if (!$ok) { mislukt('login'); sleep(2); fout('Wachtwoord klopt niet.', 401); }
        antwoord(['ingelogd' => true, 'token' => maakToken($CONFIG)]);
    case 'opslaan':
        vereisBeheer();
        $item = schoonItem($invoer['item'] ?? null);
        $data = wijzig(function ($d) use ($item) {
            $gevonden = false;
            foreach ($d['items'] as $i => $bestaand) {
                if ($bestaand['id'] === $item['id']) { $d['items'][$i] = $item; $gevonden = true; }
            }
            if (!$gevonden) $d['items'][] = $item;
            return $d;
        });
        antwoord(['ok' => true, 'item' => $item, 'items' => $data['items']]);
    case 'meerdere':
        vereisBeheer();
        $lijst = $invoer['items'] ?? null;
        if (!is_array($lijst) || count($lijst) === 0 || count($lijst) > 200) fout('Geen of te veel activiteiten.');
        $nieuw = array_map(function ($i) { unset($i['id']); return schoonItem($i); }, $lijst);
        $data = wijzig(function ($d) use ($nieuw) { $d['items'] = array_merge($d['items'], $nieuw); return $d; });
        antwoord(['ok' => true, 'aantal' => count($nieuw), 'items' => $data['items']]);
    case 'verwijder':
        vereisBeheer();
        $ids = $invoer['ids'] ?? [];
        if (!is_array($ids) || !$ids) fout('Niets gekozen om te verwijderen.');
        $data = wijzig(function ($d) use ($ids) {
            $d['items'] = array_values(array_filter($d['items'], function ($i) use ($ids) { return !in_array($i['id'], $ids, true); }));
            return $d;
        });
        antwoord(['ok' => true, 'items' => $data['items']]);
    case 'ledencode':
        if (!ledenAfgeschermd($CONFIG)) antwoord(['sleutel' => '']);
        if (teVeelPogingen('code')) fout('Te veel mislukte pogingen. Probeer het over een kwartier opnieuw.', 429);
        $code = is_string($invoer['code'] ?? null) ? trim($invoer['code']) : '';
        if (!hash_equals(strtolower(trim((string)$CONFIG['leden_code'])), strtolower($code))) { mislukt('code'); sleep(2); fout('Die code klopt niet.', 401); }
        antwoord(['sleutel' => ledenSleutel()]);
    case 'leden_link':
        vereisBeheer();
        antwoord(['sleutel' => ledenSleutel(!empty($invoer['nieuw'])), 'afgeschermd' => ledenAfgeschermd($CONFIG)]);
    case 'ics_link':
        vereisBeheer();
        antwoord(['sleutel' => icsSleutel(!empty($invoer['nieuw']))]);
    case 'verjaardag_opslaan':
    case 'verjaardagen_plakken':
    case 'verjaardag_verwijder':
        vereisBeheer();
        if (!verjaardagenAan($CONFIG)) fout('Verjaardagen staan uit in de instellingen.', 403);
        $nieuw = []; $mislukt = [];
        if ($actie === 'verjaardag_opslaan') $nieuw = [schoonVerjaardag($invoer['verjaardag'] ?? null)];
        if ($actie === 'verjaardagen_plakken') {
            [$gelezen, $mislukt] = leesVerjaardagen(is_string($invoer['tekst'] ?? null) ? $invoer['tekst'] : '');
            $nieuw = array_map('schoonVerjaardag', $gelezen);
            if (!$nieuw) fout('Geen verjaardagen herkend. Zet op elke regel een naam en een datum, bijvoorbeeld: Anna 14-03');
        }
        $ids = $actie === 'verjaardag_verwijder' && is_array($invoer['ids'] ?? null) ? $invoer['ids'] : [];
        $data = wijzig(function ($d) use ($nieuw, $ids) {
            $lijst = $d['verjaardagen'] ?? [];
            if ($ids) $lijst = array_filter($lijst, function ($v) use ($ids) { return !in_array($v['id'], $ids, true); });
            foreach ($nieuw as $v) {
                $gevonden = false;
                foreach ($lijst as $i => $b) {
                    // Zelfde id: wijzigen. Zelfde naam en dag: niet dubbel toevoegen.
                    if ($b['id'] === $v['id'] || ($b['naam'] === $v['naam'] && $b['dag'] === $v['dag'])) { $lijst[$i] = $v; $gevonden = true; break; }
                }
                if (!$gevonden) $lijst[] = $v;
            }
            if (count($lijst) > MAX_VERJAARDAGEN) fout('Hooguit ' . MAX_VERJAARDAGEN . ' verjaardagen.');
            $d['verjaardagen'] = $lijst;
            sorteerVerjaardagen($d);
            return $d;
        });
        antwoord(['ok' => true, 'aantal' => count($nieuw), 'niet_herkend' => $mislukt, 'verjaardagen' => $data['verjaardagen']]);
    case 'verjaardag_link':
        vereisBeheer();
        antwoord(['sleutel' => verjaardagSleutel(!empty($invoer['nieuw'])), 'afgeschermd' => ledenAfgeschermd($CONFIG), 'aan' => verjaardagenAan($CONFIG)]);
    case 'vakanties':
        vereisBeheer();
        if (soortMetRol('vakantie') === '' || ($CONFIG['vakanties_importeren'] ?? true) === false) antwoord(['toegevoegd' => [], 'overgeslagen' => [], 'mislukt' => [], 'items' => null]);
        if (!empty($invoer['automatisch'])) {
            $klaar = laad()['instellingen']['vakanties_geimporteerd'] ?? [];
            $jaren = array_values(array_diff(huidigeSchooljaren(), $klaar));
            if (!$jaren) antwoord(['toegevoegd' => [], 'overgeslagen' => [], 'mislukt' => [], 'items' => null]);
        } else {
            $sj = $invoer['schooljaar'] ?? '';
            $jaren = (is_string($sj) && preg_match('/^(\d{4})-(\d{4})$/', $sj, $m) && (int)$m[2] === (int)$m[1] + 1) ? [$sj] : huidigeSchooljaren();
        }
        antwoord(importeerVakanties($jaren, $CONFIG));
    default:
        fout('Onbekende actie.', 404);
}
