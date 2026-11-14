# Handleiding voor de beheerder van de host

Deze handleiding is voor wie de server beheert waar `api.php` en de planning staan. De secretaris van een vereniging heeft hem niet nodig; die werkt alleen in de beheerpagina.

## Hoe het in elkaar zit

- **GitHub Pages** (map `docs/` van deze repository) levert alle code en opmaak. Wijzigingen daar komen vanzelf bij iedereen aan.
- **De host** levert drie dunne pagina's (`index.html`, `beheer.html`, `afdrukken.html`), `api.php`, de instellingen en de data.
- De host hoef je alleen aan te raken bij een nieuwe `api.php`, een nieuwe vereniging of een andere instelling.

Eisen: PHP 7.4 of nieuwer, https, en de server moet naar `https://opendata.rijksoverheid.nl` kunnen voor de schoolvakanties. Apache is het makkelijkst, omdat de meegeleverde `.htaccess`-bestanden dan de gevoelige mappen afschermen. Bij nginx moet je dat zelf regelen (zie [Afschermen](#afschermen)).

## Bestanden op de host

| Bestand of map | Wat | Schrijfbaar? |
|---|---|---|
| `index.html`, `beheer.html`, `afdrukken.html` | Laden de app van GitHub Pages | Nee |
| `api.php` | De server: opslaan, inloggen, agenda-abonnement | Nee |
| `config.php` | Instellingen bij één vereniging | Nee |
| `verenigingen/` | Instellingen bij meerdere verenigingen (zie hieronder) | Nee |
| `data/` of de `data_map` | Planning, reservekopieën, sleutels | **Ja**, als enige |

Zet alle code op alleen-lezen: bestanden `644`, mappen `755`, liefst met jezelf als eigenaar en niet de webserver. Alleen de datamap moet schrijfbaar zijn voor de webserver (`775`, of `700` als de webserver de eigenaar is). Dan kan de app nooit zijn eigen code veranderen, ook niet als er ooit een fout in zit.

## Eén vereniging installeren

1. Vervang in de drie html-bestanden overal `JOUW-NAAM.github.io` door het adres van je GitHub Pages. Dat staat er drie keer in: in de Content-Security-Policy bovenin, in de opmerking en in de `<script>`-regel.
2. Vul `config.php` in. Kies minstens een sterk `wachtwoord`. Zolang daar `verander-mij` staat, kan niemand inloggen. Het wachtwoord mag ook een hash zijn die begint met `$2y$` (maak die met `php -r 'echo password_hash("geheim", PASSWORD_DEFAULT);'`).
3. Upload alles naar een map op de host en maak de datamap schrijfbaar.
4. Open `beheer.html`, log in en controleer of opslaan werkt. Bij de eerste keer inloggen worden de schoolvakanties opgehaald.
5. Geef de secretaris het adres van `beheer.html` en het wachtwoord. Geef de leden het adres van `index.html`, of de ledenlink als de kalender is afgeschermd.

## Meerdere verenigingen op één host

Een vereniging per subdomein, allemaal met dezelfde bestanden. Bijvoorbeeld `koor.mijndomein.nl` en `tennis.mijndomein.nl`.

1. Laat alle subdomeinen naar dezelfde map wijzen. Een wildcard (`*.mijndomein.nl`) in de DNS en bij de hoster is het makkelijkst, met een wildcard-certificaat (Let's Encrypt kan dat).
2. Hernoem `verenigingen-voorbeeld/` naar `verenigingen/`. Vanaf dat moment wordt `config.php` niet meer gebruikt. Laat de `.htaccess` in die map staan.
3. Maak per vereniging een kopie van `voorbeeld.php`, met als naam het eerste deel van het subdomein: `koor.mijndomein.nl` krijgt `verenigingen/koor.php`. Alleen kleine letters, cijfers en streepjes, hooguit 40 tekens.
4. Een adres dat niet op die manier werkt (het hoofddomein, een eigen domein van een vereniging, of `localhost` om te testen) koppel je in `verenigingen/domeinen.php` aan een naam: `'kalender.voorbeeldclub.nl' => 'voorbeeld'`.
5. Elke vereniging krijgt een eigen map `data/<naam>/`, die vanzelf wordt aangemaakt. Zet je in het bestand van een vereniging een `data_map`, gebruik dan per vereniging een andere map.

Een subdomein zonder eigen bestand krijgt "Onbekende vereniging". Het adres in de browser bepaalt dus welke vereniging iemand ziet, en de verenigingen kunnen niet bij elkaars data. Ook inloggen, ledenlink en agenda-abonnement zijn per vereniging gescheiden.

### Een nieuwe vereniging erbij

1. Kopieer `verenigingen/voorbeeld.php` naar `verenigingen/<naam>.php`.
2. Vul de naam, een eigen wachtwoord en de soorten activiteiten in. Een vereniging die geen koor is, wil meestal eigen soorten. Elke soort heeft een `naam`, een `kleur` (`#rrggbb`) en eventueel een `rol`:
   - `wekelijks`: een vaste activiteit (training, repetitie) die in schoolvakanties vervalt en die je met de knop "+ Wekelijkse ..." in één keer invoert;
   - `hoogtepunt`: de belangrijke dingen (wedstrijd, optreden), bovenaan bij "Binnenkort", met programma;
   - `voorbehoud`: nog niet zeker;
   - `vakantie`: hier komen de schoolvakanties in.
3. Zet `'programma' => false` als de vereniging geen programma (liedjes, onderdelen) per hoogtepunt gebruikt, en `'vakanties_importeren' => false` als schoolvakanties niet uitmaken.
4. Open `https://<naam>.mijndomein.nl/beheer.html` en log in om te controleren.

### Van één naar meerdere verenigingen

Draait er al een vereniging met `config.php` en `data/planning.json`, dan verhuis je die zo:

1. Kopieer `config.php` naar `verenigingen/<naam>.php`.
2. Verplaats de inhoud van `data/` (`planning.json`, `backup/`, `.pogingen.json`) naar `data/<naam>/`. De sleutels staan in `planning.json`, dus inloggen, ledenlink en agenda-abonnement blijven dezelfde.
3. Moet het oude adres blijven werken, koppel het dan in `domeinen.php` aan dezelfde naam. Anders moeten leden de ledenlink en het agenda-abonnement opnieuw instellen met het nieuwe adres.
4. Hernoem pas daarna `verenigingen-voorbeeld/` naar `verenigingen/`.

## Een nieuwe versie van api.php

1. Bewaar de oude `api.php` even apart.
2. Upload de nieuwe `api.php`. Overschrijf nooit `config.php`, de bestanden in `verenigingen/` of de datamap.
3. Open de kalender en de beheerpagina en controleer of alles werkt. Lukt dat niet, zet dan de oude terug.

De html-bestanden op de host hoeven alleen opnieuw als in deze repository de bestanden in `backend/` veranderen. Neem dan wel weer je eigen Pages-adres over.

## Reservekopieën en herstel

Bij elke wijziging bewaart `api.php` een kopie in `<datamap>/backup/`. De laatste 50 blijven bewaard.

Om een oude versie terug te zetten: kopieer de gewenste `backup/planning-JJJJMMDD-UUMMSS-....json` over `planning.json`. Zet daarnaast zelf af en toe een kopie van de hele datamap buiten de server, want een kapotte server neemt de reservekopieën mee.

## Sleutels en wachtwoorden

| Wat | Waar | Opnieuw maken |
|---|---|---|
| Wachtwoord secretaris | `config.php` of `verenigingen/<naam>.php` | Pas het aan. Alle ingelogde apparaten zijn dan meteen uitgelogd. |
| Ledencode | idem, `leden_code` | Pas hem aan. Wie de oude code intypte, blijft binnen tot je ook een nieuwe ledenlink maakt. |
| Ledenlink | in `planning.json` | Beheerpagina, onder "Ledenlink (afgeschermde kalender)": "Nieuwe link". De oude werkt dan niet meer. |
| Agenda-abonnement | in `planning.json` | Beheerpagina, onder "Agendalink voor leden (abonnement)": "Nieuwe link". Iedereen moet zich daarna opnieuw abonneren. |
| Agenda verjaardagen | in `planning.json` | Beheerpagina, onder "Verjaardagen": "Nieuwe link". Iedereen moet zich daarna opnieuw abonneren. |
| Inlogsleutel | in `planning.json` (`token_geheim`) | Wordt vanzelf gemaakt. Verander je het wachtwoord, dan vervallen alle inlogtokens toch al. |

Een inlogtoken op een apparaat is 30 dagen geldig.

## Beveiliging

Wat de app zelf doet:

- Alles wat gebruikers invoeren wordt in de browser als tekst getoond en nooit als html. Ingevoerde code wordt dus niet uitgevoerd.
- De server controleert alle invoer (lengte, datums, tijden, soorten) en weigert verzoeken groter dan 256 kB.
- De server stuurt veiligheidsheaders mee (`nosniff`, geen referrer, niet in een frame te zetten, een strenge Content-Security-Policy op de API).
- De pagina's hebben een Content-Security-Policy: scripts komen alleen van de eigen host, de eigen GitHub Pages en `cdn.jsdelivr.net` (voor de Excel-download).
- Na 10 foute wachtwoorden of ledencodes binnen een kwartier moet dat IP-adres een kwartier wachten. Dat staat bijgehouden in `<datamap>/.pogingen.json`. Zit iemand onterecht vast, dan kun je dat bestand weggooien.
- Wachtwoord, ledencode en sleutels worden met een tijdsveilige vergelijking gecontroleerd.
- In het agenda-abonnement worden links uit de teksten gehaald, zodat een gekaapte kalender geen phishinglinks in de agenda's van leden kan zetten.

- Verjaardagen zijn persoonsgegevens. De app bewaart alleen naam en dag, zonder geboortejaar, en laat ze alleen zien als de kalender met een ledencode is afgeschermd. Vraag leden of ze erin willen staan.

Wat jij als beheerder doet:

- Gebruik altijd https.
- Houd de code alleen-lezen en alleen de datamap schrijfbaar (zie boven).
- Zet de datamap liefst buiten de webroot met `data_map`.
- Zet nooit een echt wachtwoord, een `planning.json` of een bestand uit `verenigingen/` in git. De repository is openbaar.
- Houd PHP bij met de updates van de hoster.

### Afschermen

Bij Apache zorgen `data/.htaccess` en `verenigingen/.htaccess` dat niemand die mappen via het web kan openen. Bij nginx zet je in de serverconfiguratie:

```nginx
location ~ /(data|verenigingen)/ { deny all; }
location ~ /\. { deny all; }
```

Test het: `https://<adres>/data/planning.json` moet "403" of "404" geven.

## Problemen oplossen

| Melding of verschijnsel | Oorzaak en oplossing |
|---|---|
| "Opslaan mislukt: map data/ is niet schrijfbaar." | De webserver mag niet in de datamap schrijven. Pas de rechten aan. |
| "Onbekende vereniging." | Er is geen `verenigingen/<naam>.php` voor dit adres, of het adres staat niet in `domeinen.php`. |
| "config.php ontbreekt." | Er is geen map `verenigingen/` en ook geen `config.php`. |
| "Te veel mislukte pogingen." | Wacht een kwartier, of gooi `<datamap>/.pogingen.json` weg. |
| De pagina blijft op "Laden…" staan | Het Pages-adres in de html klopt niet, of de Content-Security-Policy bovenin noemt een ander adres dan de `<script>`-regel. De browserconsole (F12) laat zien wat er geblokkeerd wordt. |
| Een wijziging in de app is nog niet te zien | GitHub Pages kan tot 10 minuten cachen. Herlaad daarna de pagina. |
| Geen schoolvakanties | De server kan `opendata.rijksoverheid.nl` niet bereiken, of het schooljaar staat nog niet online. Bij een volgende keer inloggen probeert de app het opnieuw. |
| Agenda-abonnement werkt niet meer | Er is een nieuwe link gemaakt, of het adres van de host is veranderd. Leden moeten zich opnieuw abonneren. |
