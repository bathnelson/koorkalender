<?php
// Instellingen voor één vereniging. De bestandsnaam (zonder .php) is het eerste deel van het webadres:
// voorbeeld.php hoort bij voorbeeld.mijndomein.nl. Alleen kleine letters, cijfers en streepjes.
// Instellingen voor de jaarplanning. Pas alleen de waarden tussen de aanhalingstekens aan.
return [
    // Naam boven de pagina
    'naam' => 'Voorbeeldvereniging',

    // Wachtwoord van de secretaris voor de beheerpagina.
    // Zolang hier 'verander-mij' staat, kan niemand inloggen.
    // Mag ook een hash zijn die begint met $2y$ (gemaakt met password_hash).
    'wachtwoord' => 'verander-mij',

    // Ledencode: vul hier een code in om de kalender af te schermen voor niet-leden.
    // Leden komen dan binnen via de geheime ledenlink (zie de beheerpagina) of door deze code één keer in te typen.
    // Leeg laten = de kalender is voor iedereen met het adres te zien.
    'leden_code' => '',

    // Soorten activiteiten. Laat dit weg voor de standaardsoorten van een koor
    // (Repetitie, Extra repetitie, Optreden, Onder voorbehoud, Vergadering, Vakantie, Overig).
    // Rollen: 'wekelijks' (vervalt in schoolvakanties, standaard niet in de lijst), 'hoogtepunt' (eerstvolgende, programma),
    // 'voorbehoud' (nog niet zeker), 'vakantie' (hier komen de schoolvakanties in). Kleur als #rrggbb.
    // 'soorten' => [
    //     ['naam' => 'Training',         'kleur' => '#cfe0f3', 'rol' => 'wekelijks', 'meervoud' => 'trainingen'],
    //     ['naam' => 'Wedstrijd',        'kleur' => '#f4a6a0', 'rol' => 'hoogtepunt'],
    //     ['naam' => 'Onder voorbehoud', 'kleur' => '#ffe45c', 'rol' => 'voorbehoud'],
    //     ['naam' => 'Vergadering',      'kleur' => '#c9b8e0'],
    //     ['naam' => 'Vakantie',         'kleur' => '#b7dd9a', 'rol' => 'vakantie'],
    // ],

    // Programma (liedjes/onderdelen in volgorde) bij hoogtepunten tonen: true of false
    'programma' => true,

    // Schoolvakanties automatisch ophalen: true of false
    'vakanties_importeren' => true,

    // Regio voor de schoolvakanties: noord, midden of zuid
    'regio' => 'noord',

    // Webadressen die deze API vanuit de browser mogen gebruiken (zonder / aan het eind).
    // Zet hier het adres van jullie GitHub Pages. Staan de pagina's op dezelfde server als api.php, dan hoeft hier niets.
    'toegestane_origins' => [],

    // Korte naam die in het agenda-abonnement voor elke afspraak komt, bijvoorbeeld 'KOOR' geeft "[KOOR] Repetitie".
    // Leeg laten voor geen voorvoegsel.
    'ics_voorvoegsel' => '',

    // Map voor de planning en reservekopieën. Leeg = de map data/ naast api.php.
    // Veiliger: een map buiten de webroot, bijv. '/home/gebruiker/kalender-data'. De webserver moet erin kunnen schrijven.
    'data_map' => '',

    // Tijdzone voor het agenda-abonnement
    'tijdzone' => 'Europe/Amsterdam',
];
