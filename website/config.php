<?php
// Instellingen voor de website. Pas alleen de waarden tussen de aanhalingstekens aan.
// Zet de echte wachtwoorden alleen op de host, nooit in git.
return [
    // Naam van het koor, bovenaan elke pagina
    'naam' => 'Wereldkoor Haarlem',

    // Korte zin onder de naam
    'ondertitel' => 'Liederen uit de hele wereld',

    // Wachtwoord voor de beheerpagina (/beheer). Zolang hier 'verander-mij' staat, kan niemand inloggen.
    // Mag ook een hash zijn die begint met $2y$ (gemaakt met password_hash).
    'beheer_wachtwoord' => 'verander-mij',

    // Wachtwoord voor het ledengedeelte (/leden). Eén gezamenlijk wachtwoord voor alle leden.
    // Zolang hier 'verander-mij' staat, kan niemand hiermee inloggen.
    // Gebruik je "Inloggen met Nextcloud" (zie hieronder), dan kun je dit op 'verander-mij' laten staan.
    'leden_wachtwoord' => 'verander-mij',

    // ---- Jaarkalender (de koorkalender op dezelfde host) ----

    // Pad naar planning.json van de koorkalender. Standaard staat de kalender in de submap kalender/ van de website.
    // Hieruit komt de openbare concertagenda (alleen afspraken van de soort 'Optreden').
    // Leeg laten = geen concertagenda.
    'kalender_data' => __DIR__ . '/kalender/data/planning.json',

    // Adres van de jaarkalender voor leden. Gebruik de geheime ledenlink van de beheerpagina van de kalender
    // als die is afgeschermd. Wordt in het ledengedeelte getoond.
    'kalender_url' => '/kalender/',

    // ---- Nextcloud (bestanden voor leden, alleen lezen) ----

    // Adres van jullie Nextcloud, zonder / aan het eind. Leeg laten = geen bestanden in het ledengedeelte.
    'nextcloud_url' => '',
    // Gebruikersnaam van het account waarmee de website meekijkt (liefst een apart account, bijv. 'website')
    'nextcloud_gebruiker' => '',
    // App-wachtwoord van dat account (Nextcloud > Instellingen > Beveiliging > Nieuw app-wachtwoord)
    'nextcloud_app_wachtwoord' => '',
    // ---- Inloggen met Nextcloud (leden loggen in met hun eigen Nextcloud-account) ----
    // true = op de ledenpagina staat de knop "Inloggen met Nextcloud". Er hoeft in Nextcloud niets ingesteld te worden.
    'nextcloud_login' => false,
    // Alleen leden van deze Nextcloud-groep mogen erin (bijv. 'Wereldkoor'). Leeg = iedereen met een account.
    'nextcloud_groep' => '',

    // Map in dat account die leden mogen zien, bijvoorbeeld 'Koor/Leden'. Alles daarbuiten blijft onzichtbaar.
    'nextcloud_map' => 'Leden',
    // Staat nextcloud_map leeg (''), dan zie je de hoofdmap van Nextcloud. Met true staan daar alleen de teammappen,
    // dus niet de eigen mappen van het lid zoals Documents en Photos.
    'nextcloud_alleen_teammappen' => true,
];
