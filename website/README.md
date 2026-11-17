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

Leden kunnen inloggen met hun eigen Nextcloud-account in plaats van met het gezamenlijke ledenwachtwoord. Dit gebruikt *Login Flow*, de manier waarop ook de Nextcloud-apps inloggen. Dat zit in elke Nextcloud, ook bij Hetzner Storage Share, en er hoeft in Nextcloud niets voor ingesteld te worden.

1. Zet in `config.php` `nextcloud_login` op `true` (en vul `nextcloud_url` in).
2. Wil je alleen een bepaalde groep toelaten, zet de groepsnaam bij `nextcloud_groep`.

Op de inlogpagina staat dan de knop *Inloggen met Nextcloud*. Er opent een venster van Nextcloud zelf; het lid logt daar in en klikt op *Toegang verlenen*. De website gaat daarna vanzelf verder. Het wachtwoord komt dus nooit langs de website, en tweestapsverificatie werkt gewoon. De website trekt het tijdelijke app-wachtwoord dat Nextcloud daarbij maakt meteen weer in.

Laat je `leden_wachtwoord` op `verander-mij` staan, dan is Nextcloud de enige manier om in te loggen. De bestanden in het ledengedeelte komen nog steeds via het website-account (zie hierboven), zodat iedereen dezelfde ledenmap ziet.

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
```

Foto-regels direct onder elkaar worden een fotogalerij. HTML in de tekst werkt bewust niet.

## Lokaal uitproberen

```
php -S localhost:8000 index.php
```
