# Koorkalender

Een jaarplanning voor een koor: leden bekijken hem op hun telefoon (binnenkort, maand, jaar, lijst, afdrukversie, agenda-abonnement), de secretaris onderhoudt hem via een beheerpagina met wachtwoord. Schoolvakanties worden automatisch geïmporteerd en repetities in vakanties vervallen vanzelf.

| Map | Waar het staat | Inhoud |
|---|---|---|
| `docs/` | GitHub Pages van deze repository | Alles wat de app doet en hoe hij eruitziet: `laden.js`, de pagina-opbouw in `paginas/`, `gemeen.js`, `leden.js`, `beheer.js`, `afdrukken.js`, `stijl.css`, `afdrukken.css` |
| `backend/` | Je eigen webhost met PHP 7.4 of nieuwer | Drie dunne pagina's (`index.html`, `beheer.html`, `afdrukken.html`) die alleen `laden.js` van GitHub Pages inladen, `api.php`, `config.php` en de map `data/` |

De pagina's en `api.php` staan op hetzelfde domein, dus er is geen extra instelling voor het API-adres nodig.

## Eenmalig instellen

1. GitHub: Settings > Pages > Deploy from a branch > `main` en `/docs`.
2. Vervang in de drie html-bestanden in `backend/` overal `JOUW-NAAM.github.io` (ook in de Content-Security-Policy bovenin) door het Pages-adres van je repository.
3. Zet in `config.php` de naam van het koor en het wachtwoord van de secretaris. Doe dat alleen op de host, nooit in git.
4. Upload de inhoud van `backend/` naar een map op je host. De map `data/` (of de `data_map` uit `config.php`) moet schrijfbaar zijn; daar komt `planning.json`.
5. Laat `verenigingen-voorbeeld/` staan of verwijder hem; hij doet niets zolang hij zo heet.

## Bijwerken

- **De app aanpassen**: wijzig de bestanden in `docs/` en push naar `main`. GitHub Pages publiceert het binnen een paar minuten (de cache kan tot 10 minuten duren).
- **De host hoef je alleen aan te raken als `api.php` verandert.** De html op de host blijft altijd gelijk.

## Andere vereniging

Standaard gebruikt de kalender de soorten van een koor (Repetitie, Optreden, …). Een andere vereniging zet eigen soorten in `config.php` onder `'soorten'`, met per soort een naam, een kleur en eventueel een rol (`wekelijks`, `hoogtepunt`, `voorbehoud` of `vakantie`). Zie het voorbeeld in `config.php`. Met `'programma' => false` verdwijnt het programma-veld, met `'vakanties_importeren' => false` worden geen schoolvakanties opgehaald.

## Meerdere verenigingen op één host

Eén installatie kan meerdere verenigingen bedienen, elk op een eigen subdomein (bijvoorbeeld `koor.mijndomein.nl` en `tennis.mijndomein.nl`, allebei naar dezelfde map).

1. Hernoem `backend/verenigingen-voorbeeld/` naar `backend/verenigingen/`. Zodra die map bestaat, wordt `config.php` niet meer gebruikt.
2. Maak per vereniging een bestand `verenigingen/<naam>.php` (kopie van `voorbeeld.php`). De naam is het eerste deel van het subdomein: `koor.mijndomein.nl` gebruikt `verenigingen/koor.php`. Alleen kleine letters, cijfers en streepjes.
3. Een adres dat niet zo werkt (een eigen domein, of `localhost`) koppel je in `verenigingen/domeinen.php` aan een naam.
4. Elke vereniging krijgt automatisch een eigen map `data/<naam>/`, met eigen planning, reservekopieën, sleutels en ledencode. Een onbekend subdomein krijgt "Onbekende vereniging".

De instellingen staan bewust in PHP-bestanden en niet in JSON: een PHP-bestand laat de server nooit als tekst zien, ook niet als de `.htaccess` ontbreekt.

## Datamap en rechten

Met `'data_map' => '/pad/buiten/de/webroot'` zet je de planning buiten de webmap. Dat is het veiligst. Leeg betekent `data/` naast `api.php` (afgeschermd met `.htaccess`).

Alleen de datamap hoeft schrijfbaar te zijn voor de webserver. Zet de PHP- en html-bestanden op alleen-lezen (`644`, mappen `755`) en eventueel eigenaar jijzelf in plaats van de webserver, zodat de app nooit zijn eigen code kan wijzigen.

## Beveiliging

- Alles wat gebruikers invoeren wordt in de browser als tekst getoond en nooit als html, dus ingevoerde code wordt niet uitgevoerd.
- De server controleert en beperkt alle invoer (lengte, datums, soorten, maximaal 256 kB per verzoek) en stuurt veiligheidsheaders mee.
- De pagina's hebben een Content-Security-Policy: scripts komen alleen van je eigen host, je GitHub Pages en de cdn voor Excel.
- Na 10 foute pogingen (wachtwoord of ledencode) moet een adres een kwartier wachten.
- In het agenda-abonnement worden links uit de teksten gehaald, zodat een gekaapte kalender geen phishinglinks in agenda's kan zetten.

## Afschermen voor leden

Vul in `config.php` een `leden_code` in. De kalender is dan alleen te zien voor wie via de geheime ledenlink komt (te vinden op de beheerpagina, onder "Ledenlink") of die code één keer intypt. De browser onthoudt dat. Het agenda-abonnement werkt met een eigen geheime link en blijft gewoon werken.

## Wat er niet in git staat

De planning (`data/planning.json`), het echte wachtwoord, de agendasleutel, de inlogsleutel en de reservekopieën staan alleen op de host.
