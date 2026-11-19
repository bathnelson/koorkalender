# Website Wereldkoor Haarlem

Een kleine website in PHP, zonder database. Draait op gewone webhosting (bijvoorbeeld Vimexx) met PHP 7.4 of nieuwer.

- **Openbare pagina's**: Home, Over ons, Concerten, Contact en wat je zelf toevoegt. Tekst met koppen, foto's, fotogalerijen, YouTube-video's en knoppen.
- **Concertagenda**: komt automatisch uit de koorkalender (alle afspraken van de soort "Optreden" die nog moeten komen). Niets dubbel bijhouden.
- **Ledengedeelte** (`/leden`): met één gezamenlijk ledenwachtwoord. Toont de jaarkalender en de bestanden uit een map in Nextcloud (bladmuziek, opnames, notulen). Leden hebben zelf geen Nextcloud-account nodig; de website kijkt mee met één account en laat alleen die ene map zien, alleen lezen.
- **Beheer** (`/beheer`): pagina's maken, aanpassen en verwijderen, foto's uploaden, met een voorbeeld vóór het opslaan. Bij elke wijziging wordt een reservekopie bewaard.

## Installeren

1. Upload de inhoud van deze map naar de webroot van het domein (bij Vimexx meestal `public_html`). Zet de koorkalender (de inhoud van `backend/`) in de submap `kalender/` daarbinnen, dus `public_html/kalender/`.
2. Zorg dat de map `inhoud/` (en `inhoud/fotos/`) schrijfbaar is voor PHP. Bij Vimexx is dat normaal al zo.
3. Vul `config.php` in, op de host en niet in git:
   - `beheer_wachtwoord` en `leden_wachtwoord`
   - `kalender_data`: pad naar `planning.json` van de koorkalender (standaard `kalender/data/planning.json`)
   - `kalender_url`: adres van de kalender voor leden (de geheime ledenlink als de kalender is afgeschermd)
   - Nextcloud: adres, gebruiker, app-wachtwoord en de map die leden mogen zien
4. Ga naar `/beheer`, log in en pas de standaardpagina's aan.

## Uploadlimiet voor foto's

Grote foto's worden in de browser al verkleind tot maximaal 1600 pixels voordat ze worden geüpload. Geeft de host toch een melding dat een foto te groot is, dan staat de limiet van PHP te laag. Het bestand `.user.ini` in deze map zet hem op 10 MB. Werkt dat niet, zet dan in DirectAdmin bij *PHP-instellingen* (of *Select PHP version > Options*) `upload_max_filesize` op `10M` en `post_max_size` op `12M`.

## Nextcloud koppelen

1. Maak in Nextcloud bij voorkeur een apart account, bijvoorbeeld `website`.
2. Deel vanuit het koor-account de map met ledenbestanden met dat account (alleen lezen is genoeg).
3. Log in als `website`, ga naar Instellingen > Beveiliging en maak een app-wachtwoord.
4. Zet adres, gebruikersnaam, app-wachtwoord en de mapnaam in `config.php`.

Wat in die map komt, staat meteen in het ledengedeelte. Bestanden toevoegen doe je gewoon in Nextcloud.

## Inloggen met Nextcloud

Leden loggen in met hun eigen Nextcloud-account, gewoon op de ledenpagina. Zet daarvoor in `config.php` `nextcloud_login` op `true` en vul `nextcloud_url` in. Wil je alleen een bepaalde groep toelaten, zet de groeps-ID bij `nextcloud_groep` (hoofdlettergevoelig).

- **Gebruikersnaam en wachtwoord**: de website vraagt daarmee bij Nextcloud een app-wachtwoord aan voor deze sessie. Het wachtwoord zelf wordt niet bewaard; het app-wachtwoord blijft alleen op de server en wordt bij uitloggen ingetrokken.
- **Tweestapsverificatie**: wie dat aan heeft, klikt op *Inloggen via Nextcloud*. Er opent dan een venster van Nextcloud zelf (Login Flow); daarna gaat de website vanzelf verder. Een eigen app-wachtwoord intypen werkt ook.

**Bestanden**: wie met Nextcloud is ingelogd, ziet de map `nextcloud_map` (bijvoorbeeld `Leden`) uit zijn of haar eigen Nextcloud, met precies de rechten die hij of zij daar heeft. Deel de ledenmap daarom met de groep, of gebruik een teamfolder, zodat hij bij iedereen onder dezelfde naam staat.

Gebruiken jullie teammappen, zet `nextcloud_map` dan op `''` en `nextcloud_alleen_teammappen` op `true`. Een lid ziet dan bovenaan precies de teammappen waar hij of zij in Nextcloud recht op heeft, en niet de eigen mappen zoals Documents of Photos. Het website-account (`nextcloud_gebruiker`) is dan alleen nog nodig voor wie met het gezamenlijke ledenwachtwoord inlogt.

Let op: sluit een lid de browser zonder uit te loggen, dan blijft het app-wachtwoord in Nextcloud staan (Instellingen > Beveiliging > Apparaten & sessies, naam "Website Wereldkoor Haarlem"). Dat kan geen kwaad en het lid kan het daar weghalen. Logt een lid vaak met een verkeerd wachtwoord in, dan kan de beveiliging van Nextcloud het inloggen via de website tijdelijk vertragen.

## Tekst opmaken

```
# Grote kop
## Kleinere kop
**vetgedrukt**   *schuin*
- opsomming
1. genummerde lijst
[tekst van de link](https://www.voorbeeld.nl)
[naar een andere pagina](over-ons)
![onderschrift](fotos/naam.jpg)
youtube: https://www.youtube.com/watch?v=...
knop: [Kaartjes kopen](https://...)
tegel: [Titel](https://www.youtube.com/watch?v=...)
tegel: [Titel](pagina) fotos/naam.jpg
```

Foto-regels direct onder elkaar worden een fotogalerij in rijen van gelijke hoogte (masonry); een klik opent de foto groot, met pijltjes naar de volgende. Een video laat eerst alleen de miniatuur zien en laadt de speler pas na een klik. Tegel-regels onder elkaar worden een raster van tegels met plaatje en titel. HTML in de tekst werkt bewust niet.

## Foto's kiezen

In het beheer staat bij een pagina de knop **Foto invoegen** en bij een concert **Kies foto**. Je kiest dan uit de foto's op de website, uploadt een nieuwe, of bladert onder **Uit Nextcloud** door de foto's in Nextcloud. Een foto uit Nextcloud wordt verkleind (maximaal 1600 pixels) naar de website gekopieerd, zodat de site niet afhangt van Nextcloud. Met `nextcloud_fotomap` in `config.php` stel je de map in waar de kiezer begint. De kiezer gebruikt het website-account (`nextcloud_gebruiker`), of anders het Nextcloud-account waarmee je in hetzelfde browservenster op de ledenpagina bent ingelogd.

## Subsidiegevers in de voettekst

Onderaan elke pagina staat "Mede mogelijk gemaakt door" met de logo's van subsidiegevers en sponsors. Die stel je in onder Beheer > Algemeen, met de fotokiezer voor het logo. Daar pas je ook de naam, de ondertitel en de kopfoto aan.

## Concertagenda

Optredens komen uit de jaarkalender (soort 'Optreden'). Onder Beheer > Concerten vul je per optreden aan: hoe laat, waar, beschrijving, foto, link naar de locatie en link naar de kaartverkoop. Een optreden kun je daar ook verbergen. Concerten die niet in de kalender staan voeg je daar zelf toe. Alles wordt bewaard in `inhoud/concerten.json`.

## Lokaal uitproberen

```
php -S localhost:8000 index.php
```
