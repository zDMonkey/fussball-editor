# Trainer-Tool

Internes Tool für das Trainerteam: Übungen/Taktiken auf einem Spielfeld
zeichnen, animieren, in einer Bibliothek verwalten, als Video/GIF exportieren
und per Link mit Trainerkollegen teilen.

Komplett selbst entwickelt und self-hosted.

## Aktueller Stand (Grundgerüst)

Dieses Gerüst ist ein **Proof-of-Concept**, kein fertiges Produkt. Es zeigt
die grundlegende Architektur und funktioniert bereits so weit:

- ✅ Datenbankschema (Users, Exercises, Categories, Tags, Sharing)
- ✅ Backend-API (Auth/JWT, CRUD für Übungen, Kategorien, Export-Anstoß-Stub)
- ✅ Frontend-Editor: Spielfeld (SVG, Vollfeld Hochformat), Toolbar,
  Spieler/Material-Auswahl-Popup (analog zu den ft-graphics-Screenshots),
  Drag & Drop auf der Canvas (Konva.js), einfache Keyframe-Timeline mit
  linearer Bewegungsinterpolation
- 🚧 Noch NICHT umgesetzt: Login-UI, Bibliotheksansicht, Pfeil-Werkzeuge
  (gerade/gebogen), Export-Worker (Puppeteer + FFmpeg), Share-Seite,
  echte SVG-Icons für Spielerposen/Equipment (derzeit nur Platzhalter-Formen),
  weitere Spielfeldvorlagen (Halbfeld, Strafraum — Datenstruktur existiert
  bereits in `elementLibrary.js`, Komponenten fehlen noch)

## Projektstruktur

```
sve-trainer-tool/
├── backend/
│   ├── migrations/001_init.sql      # Datenbankschema
│   ├── src/
│   │   ├── controllers/             # Auth, Exercises, Export
│   │   ├── routes/                  # Express-Routen
│   │   ├── middleware/auth.js       # JWT-Prüfung
│   │   ├── db/                      # Pool + Migrations-Runner
│   │   ├── workers/exportQueue.js   # Platzhalter für BullMQ
│   │   └── server.js                # Einstiegspunkt
│   ├── .env.example
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/editor/       # Editor, Toolbar, Picker, Timeline, Spielfeld
│   │   ├── lib/elementLibrary.js    # Zentrale Datendefinition aller Objekttypen
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── Dockerfile
│   └── nginx.conf
└── docker-compose.yml
```

## Lokal starten (Entwicklung, ohne Docker)

**Backend:**
```bash
cd backend
cp .env.example .env
npm install
# Postgres muss erreichbar sein (lokal oder via docker compose up db)
npm run migrate
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
Frontend läuft dann auf `http://localhost:5173`, Backend auf `:4000`.

Ersten Admin-Account anlegen (z. B. via curl, solange es keine Registrierungs-UI gibt):
```bash
# Erfordert vorübergehend einen bestehenden Admin-Token ODER:
# Direkt per SQL in der DB anlegen, siehe Hinweis unten.
```
**Hinweis:** Da `createUser` aktuell `requireAdmin` voraussetzt, aber noch kein
Admin existiert, muss der allererste Account direkt per SQL angelegt werden
(Passwort-Hash z. B. mit `node -e "console.log(require('bcryptjs').hashSync('dein-passwort', 12))"`
erzeugen und per `INSERT INTO users (...)` einfügen). Das ist ein bewusster
Henne-Ei-Schritt für ein kleines, geschlossenes Trainerteam — keine offene
Selbstregistrierung gewollt.

## Mit Docker starten

```bash
cp backend/.env.example backend/.env   # Werte anpassen, v.a. JWT_SECRET
docker compose up -d --build
docker compose exec backend npm run migrate
```

Die Traefik-Labels in `docker-compose.yml` sind als Beispiel hinterlegt und
müssen an die tatsächliche Traefik-Konfiguration auf dem Server angepasst
werden (Hostnamen über `.env`-Variablen `APP_HOSTNAME` / `API_HOSTNAME`,
ggf. externes Traefik-Netzwerk statt eigenem `bridge`-Netz).

## Empfohlene nächste Schritte (für die Arbeit in Claude Code)

Sinnvolle Reihenfolge, um iterativ weiterzubauen:

1. **Login-Seite** im Frontend (einfaches Formular gegen `/api/auth/login`,
   Token in `localStorage` oder besser `httpOnly`-Cookie ablegen)
2. **Bibliotheksansicht** (Liste/Grid aller Übungen, Filter nach Kategorie,
   Suche) — Backend-Route `GET /api/exercises` existiert bereits
3. **Speichern-Funktion im Editor**: aktuellen `objects`- und
   `keyframes`-State als `choreography`-JSON an `POST /api/exercises` senden
4. **Pfeil-Werkzeuge** (gerade/gebogen) — bisher nur als Toolbar-Eintrag ohne
   Zeichenlogik vorhanden
5. **Echte SVG-Icons** für Spielerposen und Equipment, um die
   Platzhalter-Kreise/Dreiecke in `PlacedObject.jsx` zu ersetzen
6. **Export-Worker** als eigener Service: Puppeteer rendert die Animation
   headless, FFmpeg setzt die Frames zu MP4/GIF zusammen, Ergebnis landet in
   `export_url`. Queue-Anbindung in `exportQueue.js` von Stub auf echtes
   BullMQ umstellen
7. **Share-Seite** (öffentliche Route `/teilen/:token` im Frontend, nutzt
   die bereits vorhandene Backend-Route `GET /api/exercises/shared/:token`)
8. **Weitere Spielfeldvorlagen** (Halbfeld, Strafraum, Querformat) als
   zusätzliche Komponenten analog zu `FieldVollfeldHoch.jsx`

## Wichtige Architekturentscheidungen (Begründung)

- **Choreografie als JSONB statt eigener Tabellen pro Objekt/Keyframe:**
  Die Struktur (Objekte + Keyframe-Positionen) ändert sich pro Übung kaum in
  ihrer Form, ist aber in der Tiefe variabel. JSONB erlaubt schnelles
  Lesen/Schreiben des gesamten Übungszustands in einer Anfrage, ohne
  komplexe Joins. Für reine Metadaten (Titel, Kategorie, Tags) bleiben es
  normale relationale Spalten/Tabellen, damit Filterung/Suche effizient
  bleibt.
- **Share-Token als eigenständiges UUID-Feld statt der internen `id`:**
  Verhindert, dass interne IDs erraten/sequenziell durchprobiert werden
  können, und erlaubt, Freigaben unabhängig von der Übung selbst zu
  widerrufen (`share_enabled` umschalten, Token bleibt bestehen oder wird
  bei Bedarf neu generiert).
- **Export asynchron über Queue statt synchron in der API-Anfrage:**
  Rendering mit Puppeteer/FFmpeg dauert mehrere Sekunden bis Minuten —
  das würde die API-Anfrage blockieren. Stattdessen: Anfrage setzt Status
  auf `pending` und kehrt sofort zurück, Worker erledigt die Arbeit im
  Hintergrund, Frontend pollt `GET /api/exercises/:id/export` bis `done`.
