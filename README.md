# Koorkalender

Een jaarplanning voor een koor: leden bekijken hem op hun telefoon (binnenkort, maand, jaar, lijst, afdrukversie, agenda-abonnement), de secretaris onderhoudt hem via een beheerpagina met wachtwoord. Schoolvakanties worden automatisch geïmporteerd en repetities in vakanties vervallen vanzelf.

| Map | Waar het staat | Inhoud |
|---|---|---|
| `docs/` | GitHub Pages van deze repository | Alles wat de app doet en hoe hij eruitziet: `laden.js`, de pagina-opbouw in `paginas/`, `gemeen.js`, `leden.js`, `beheer.js`, `afdrukken.js`, `stijl.css`, `afdrukken.css` |
| `backend/` | Je eigen webhost met PHP 7.4 of nieuwer | Drie dunne pagina's (`index.html`, `beheer.html`, `afdrukken.html`) die alleen `laden.js` van GitHub Pages inladen, `api.php`, `config.php` en de map `data/` |

De pagina's en `api.php` staan op hetzelfde domein, dus er is geen extra instelling voor het API-adres nodig.

## Eenmalig instellen

1. GitHub: Settings > Pages > Deploy from a branch > `main` en `/docs`.
2. Vervang in de drie html-bestanden in `backend/` het adres `https://JOUW-NAAM.github.io/koorkalender/` door het Pages-adres van je repository.
3. Zet in `config.php` de naam van het koor en het wachtwoord van de secretaris. Doe dat alleen op de host, nooit in git.
4. Upload de inhoud van `backend/` naar een map op je host. De map `data/` moet schrijfbaar zijn; daar komt `planning.json`.

## Bijwerken

- **De app aanpassen**: wijzig de bestanden in `docs/` en push naar `main`. GitHub Pages publiceert het binnen een paar minuten (de cache kan tot 10 minuten duren).
- **De host hoef je alleen aan te raken als `api.php` verandert.** De html op de host blijft altijd gelijk.

## Andere vereniging

Standaard gebruikt de kalender de soorten van een koor (Repetitie, Optreden, …). Een andere vereniging zet eigen soorten in `config.php` onder `'soorten'`, met per soort een naam, een kleur en eventueel een rol (`wekelijks`, `hoogtepunt`, `voorbehoud` of `vakantie`). Zie het voorbeeld in `config.php`. Met `'programma' => false` verdwijnt het programma-veld, met `'vakanties_importeren' => false` worden geen schoolvakanties opgehaald.

Meerdere verenigingen kunnen dezelfde code van GitHub Pages gebruiken: zet per vereniging de inhoud van `backend/` in een eigen map of subdomein, met een eigen `config.php` en `data/`.

## Afschermen voor leden

Vul in `config.php` een `leden_code` in. De kalender is dan alleen te zien voor wie via de geheime ledenlink komt (te vinden op de beheerpagina, onder "Ledenlink") of die code één keer intypt. De browser onthoudt dat. Het agenda-abonnement werkt met een eigen geheime link en blijft gewoon werken.

## Wat er niet in git staat

De planning (`data/planning.json`), het echte wachtwoord, de agendasleutel, de inlogsleutel en de reservekopieën staan alleen op de host.
