<?php
// Instellingen voor de jaarplanning. Pas alleen de waarden tussen de aanhalingstekens aan.
return [
    // Naam boven de pagina
    'naam' => 'Mijn koor',

    // Wachtwoord van de secretaris voor de beheerpagina.
    // Zolang hier 'verander-mij' staat, kan niemand inloggen.
    // Mag ook een hash zijn die begint met $2y$ (gemaakt met password_hash).
    'wachtwoord' => 'verander-mij',

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
