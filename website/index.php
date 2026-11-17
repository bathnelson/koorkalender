<?php
declare(strict_types=1);

// Toegang tot alle pagina's van de site. .htaccess stuurt elk adres hierheen.

// Bij testen met "php -S localhost:8000 index.php": bestaande bestanden (css, foto's) gewoon laten serveren
if (PHP_SAPI === 'cli-server') {
    $echt = __DIR__ . parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    if (is_file($echt) && !preg_match('~/(inhoud/[^/]+\.json|config\.php|lib\.php)$~', $echt) && substr($echt, -4) !== '.php') return false;
}

require __DIR__ . '/lib.php';

$pad = (string)parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$basis = basisUrl();
$slug = strpos($pad, $basis) === 0 ? substr($pad, strlen($basis)) : ltrim($pad, '/');
$slug = trim(rawurldecode($slug), '/');
if ($slug === '' || $slug === 'index.php') $slug = (string)($_GET['p'] ?? 'home');

if ($slug === 'leden' || strpos($slug, 'leden/') === 0) { require __DIR__ . '/leden.php'; exit; }
if ($slug === 'beheer') { require __DIR__ . '/beheer.php'; exit; }

$paginas = laadPaginas();
if (!geldigeSlug($slug) || !isset($paginas[$slug])) {
    http_response_code(404);
    kop($CONFIG, 'Niet gevonden');
    echo '<h1>Deze pagina bestaat niet</h1><p><a href="' . h(url()) . '">Naar de homepagina</a></p>';
    voet($CONFIG);
    exit;
}

$p = $paginas[$slug];
kop($CONFIG, $p['titel'], $slug);
echo '<article class="tekst">' . opmaak((string)$p['tekst']) . '</article>';
if (!empty($p['concerten'])) {
    echo '<section class="agenda"><h2>Komende concerten</h2>' . concertenHtml($CONFIG) . '</section>';
}
voet($CONFIG);
