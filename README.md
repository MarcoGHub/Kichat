# Kichat — Nikita, dein digitaler Begleiter

Eine lokale Web-App mit **Nikita**: einer sichtbaren, reagierenden Begleiterin, mit
der du im Chat sprichst und die **echte Aktionen ausführt**, die du ihr schreibst.

- 🖤 **Sichtbarer Avatar** — ausdrucksstarke Figur, deren Mimik/Pose zu ihrer Stimmung passt (blinzelt, „spricht", winkt, zwinkert).
- 💬 **Chat** — natürliche Unterhaltung, Verlauf wird lokal gespeichert.
- ⚡ **Aktions-System** — sie merkt sich Dinge, macht Notizen, legt Erinnerungen an, ändert ihre Stimmung/Pose u. v. m. Leicht um eigene Aktionen erweiterbar.
- 🔌 **Anbieter-agnostisch** — nutzt Anthropic Claude **oder** jede OpenAI-kompatible API (auch lokale Modelle über Ollama / LM Studio).

Keine externen npm-Pakete nötig — läuft mit reinem Node.js (≥ 20).

## Schnellstart

```bash
# 1. Konfiguration anlegen
cp .env.example .env
#    ... .env öffnen und deinen API-Key eintragen (siehe unten)

# 2. Starten
npm start          # oder: node server.js

# 3. Öffnen
#    http://localhost:8787
```

## Konfiguration (`.env`)

**Variante A — Anthropic Claude (Standard):**
```
PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-5
```

**Variante B — lokales / eigenes Modell (OpenAI-kompatibel):**
```
PROVIDER=openai
OPENAI_BASE_URL=http://localhost:11434/v1   # z. B. Ollama
OPENAI_API_KEY=local
OPENAI_MODEL=llama3.1
```
> Für ein lokales, ungefiltertes Modell einfach `OPENAI_BASE_URL` auf deinen
> lokalen Server richten. Die App entfernt keine modellseitigen
> Schutzmechanismen — was generiert wird, bestimmt das gewählte Modell.

## Was Nikita tun kann (Aktionen)

| Aktion            | Beispiel im Chat                              |
|-------------------|-----------------------------------------------|
| Stimmung ändern   | „sei verspielt" / „zeig dich kühl"            |
| Pose ändern       | „winke mir" / „verschränk die Arme"           |
| Sich etwas merken | „merk dir, dass ich Tee mag"                  |
| Erinnern abrufen  | „was weißt du über mich?"                     |
| Notiz speichern   | „notier: Milch kaufen"                        |
| Erinnerung        | „erinnere mich morgen um 9 an den Anruf"      |
| Uhrzeit           | „wie spät ist es?"                            |

Gespeicherte Daten liegen lokal in `data/store.json`.

## Eigene Aktionen hinzufügen

In `src/tools.js` ein Objekt an das `TOOLS`-Array anhängen:

```js
{
  name: 'play_music',
  description: 'Spielt Musik ab.',
  parameters: { genre: { type: 'string', description: 'Musikrichtung' } },
  required: ['genre'],
  side: 'server',                 // "server" oder "client"
  async run(args) { /* ... */ return { ok: true }; },
}
```
Server-Aktionen laufen in Node, Client-Aktionen im Browser (siehe `applyClientActions` in `public/app.js`).

## Charakter anpassen

Nikitas Persönlichkeit steht in `src/persona.js` — frei editierbar.
Ihr Aussehen (Avatar) steckt in `public/avatar.js`; eigene Bilder lassen sich
statt der SVG-Grafik einbinden (siehe Kommentar oben in der Datei).

## Architektur

```
server.js        Zero-Dep HTTP-Server (statische Dateien + /api/chat)
src/persona.js   Nikitas System-Prompt
src/tools.js     Aktions-/Tool-Definitionen + persistenter Speicher
src/providers.js LLM-Anbindung (Anthropic / OpenAI) mit Tool-Loop
public/          Frontend: Avatar, Chat-UI, Aktions-Feed
```

## Hinweis

Dies ist eine private, lokale Companion-App. Der Chat ist so unzensiert, wie es
das von dir gewählte Modell zulässt. Der API-Key bleibt serverseitig und wird
nie an den Browser gesendet.
