<?php
// Instellingen voor de jaarplanning. Pas alleen de waarden tussen de aanhalingstekens aan.
return [
    // Naam boven de pagina
    'naam' => 'Mijn koor',

    // Wachtwoord van de secretaris voor de beheerpagina.
    // Zolang hier 'verander-mij' staat, kan niemand inloggen.
    // Mag ook een hash zijn die begint met $2y$ (gemaakt met password_hash).
    'wachtwoord' => 'verander-mij',

    // Ledencode: vul hier een code in om de kalender af te schermen voor niet-leden.
    // Leden komen dan binnen via de geheime ledenlink (zie de beheerpagina) of door deze code één keer in te typen.
    // Leeg laten = de kalender is voor iedereen met het adres te zien.
    'leden_code' => '',

    // Regio voor de schoolvakanties: noord, midden of zuid
    'regio' => 'noord',

    // Webadressen die deze API vanuit de browser mogen gebruiken (zonder / aan het eind).
    // Zet hier het adres van jullie GitHub Pages. Staan de pagina's op dezelfde server als api.php, dan hoeft hier niets.
    'toegestane_origins' => [],

    // Korte naam die in het agenda-abonnement voor elke afspraak komt, bijvoorbeeld 'KOOR' geeft "[KOOR] Repetitie".
    // Leeg laten voor geen voorvoegsel.
    'ics_voorvoegsel' => '',

    // Tijdzone voor het agenda-abonnement
    'tijdzone' => 'Europe/Amsterdam',
];
