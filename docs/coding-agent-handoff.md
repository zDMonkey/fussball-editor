# Coding Agent Handoff

## Zielbild

Dieses Projekt hat aktuell vier relevante Frontend-Flows:

1. `Übungsbibliothek` lädt externe Suchtreffer aus der AWS-Such-API.
2. `Übungsbibliothek` mischt bei vorhandenem Token zusaetzlich lokale Übungen aus dem Express-/Postgres-Backend dazu.
3. `Meine Übungen` lädt nur lokal gespeicherte Übungen.
4. `Editor` kann externe Vorlagen, lokale Übungen und leere Dokumente öffnen und lokal speichern.

## Zentrales Modell

Die wichtigste Datei ist:

- [frontend/src/lib/exerciseTemplate.js](../frontend/src/lib/exerciseTemplate.js)

Sie definiert das interne Austauschformat `ExerciseTemplate`.

Das Modell trennt bewusst:

- `source`
- `meta`
- `editor`
- `choreography`

`ExerciseTemplate` ist kein 1:1-Backend-Modell. Es ist das gemeinsame Handoff-Format zwischen:

- externer Suche
- lokalem Backend
- Editor-Hydration

## ExerciseTemplate-Regeln

Wichtige Punkte:

- `source.type = external-search`
  - fuer Treffer aus der AWS-Suche
- `source.type = local-backend`
  - fuer lokal gespeicherte Übungen aus `GET /api/exercises`
- `source.type = manual`
  - fuer initial leere Dokumente / interne Defaults

- `choreography` muss immer editor-kompatibel sein:
  - `objects: []`
  - `keyframes: [{ id, positions }]`

- `normalizeChoreography(...)` in `exerciseTemplate.js` erzwingt genau diesen Minimalvertrag.

## Editor-Hydration

Die Editor-Initialisierung sitzt in:

- [frontend/src/components/editor/Editor.jsx](../frontend/src/components/editor/Editor.jsx)

Wichtige Punkte:

- `Editor` akzeptiert optional `initialTemplate`
- `getInitialEditorState(initialTemplate)` liest nur:
  - `choreography.objects`
  - `choreography.keyframes`
- die Hydration passiert absichtlich nur beim ersten Render
- spaetere Prop-Aenderungen synchronisieren den Editor nicht automatisch nach

Zusatz fuer Persistenz:

- `getInitialExerciseId(initialTemplate)` zieht die lokale Backend-ID aus:
  - `initialTemplate.id`
  - oder bei lokalen Übungen aus `source.externalId` / `source.sourceKey`
- damit speichert eine geoeffnete lokale Übung spaeter per `PUT` statt erneut per `POST`

## Öffnen aus der Bibliothek

Datei:

- [frontend/src/pages/ExerciseLibraryPage.jsx](../frontend/src/pages/ExerciseLibraryPage.jsx)

Flow:

1. externe Treffer aus AWS-Such-API laden
2. falls Token vorhanden:
   - lokale Übungen via `GET /api/exercises?search=...` laden
3. beide Quellen in eine gemeinsame Kartenliste mappen
4. je nach Quelle:
   - extern: `mapSearchResultToExerciseTemplate()`
   - lokal: `mapStoredExerciseToExerciseTemplate()`
5. Template in `App`-State legen
6. nach `/editor` navigieren

Wichtig:

- lokale Karten sind `resultType = local`
- externe Karten sind `resultType = external`
- lokale Karten koennen geloescht werden
- externe Karten sind in V1 nicht loeschbar

## Öffnen aus "Meine Übungen"

Datei:

- [frontend/src/pages/MyExercisesPage.jsx](../frontend/src/pages/MyExercisesPage.jsx)

Flow:

1. `GET /api/exercises`
2. `mapStoredExerciseToExerciseTemplate()`
3. `App` setzt das Template
4. `/editor` hydratisiert daraus die persistierte `choreography`

Wichtig:

- `GET /api/exercises` muss `id` und `choreography` enthalten
- ohne `id` waere spaeter kein verlässliches `PUT` moeglich
- ohne `choreography` startet der Editor beim Reopen leer

## Speichern im Editor

Relevante Dateien:

- [frontend/src/lib/exerciseApi.js](../frontend/src/lib/exerciseApi.js)
- [frontend/src/lib/exercisePersistence.js](../frontend/src/lib/exercisePersistence.js)
- [frontend/src/components/editor/Editor.jsx](../frontend/src/components/editor/Editor.jsx)

Flow:

1. Editor-State wird auf das bestehende Backend-Modell gemappt
2. Payload enthaelt:
   - `title`
   - `description`
   - `age_group`
   - `duration_minutes`
   - `field_template`
   - `thumbnail_url`
   - `choreography`
3. `choreography` enthaelt:
   - `objects`
   - `keyframes`
   - `meta.focus`
4. Save-Regel:
   - mit lokaler ID: `PUT /api/exercises/:id`
   - ohne lokale ID: `POST /api/exercises`
5. nach erfolgreichem `POST` merkt sich der Editor die neue ID im State

Wichtig:

- externe/AWS-Übungen ohne lokale ID erzeugen beim ersten Speichern bewusst eine neue lokale Übung
- lokal geoeffnete Übungen sollen nie eine zweite Kopie erzeugen

## Focus / Schwerpunkte

Es gibt aktuell keine separate `focus`-Spalte im lokalen Backend.

Die pragmatische V1 ist:

- Fokus im Editor als kommagetrennte Eingabe
- Persistenz in `choreography.meta.focus`
- Re-Hydration aus `exercise.choreography.meta.focus`
- lokale Suche beruecksichtigt:
  - `title`
  - `description`
  - `choreography.meta.focus`

Das ist bewusst eine KISS-Loesung ohne Migration.

## Thumbnails

Es gibt aktuell zwei Thumbnail-Pfade:

### Externe/importierte Übungen

- kommen aus der AWS-Suche
- nutzen `thumbnail_key` oder `thumbnail_url`
- `thumbnail_key` wird im Frontend ueber `VITE_THUMBNAIL_BASE_URL` aufgeloest

### Lokale/editorbasierte Übungen

- beim Speichern wird ein Thumbnail direkt im Browser erzeugt
- Quelle:
  - Feld-SVG
  - plus Konva-Zeichnung darueber
- Ergebnis:
  - Data-URL in `thumbnail_url`

Wichtig:

- alte lokal gespeicherte Übungen koennen noch alte/gruene Thumbnails haben
- nach erneutem Speichern bekommen sie das neue kombinierte Thumbnail

## choreography_draft

Die externe Such-API kann optional spaeter ein Feld `choreography_draft` liefern.

Frontend-Status heute:

- `mapSearchResultToExerciseTemplate()` uebernimmt `choreography_draft`, falls vorhanden
- wenn vorhanden, startet der Editor mit diesem KI-Vorschlag
- wenn nicht vorhanden, bleibt der Editor leer

Wichtig:

- `choreography_draft` ist nur ein grober Startvorschlag
- es gibt aktuell noch keine UI-Kennzeichnung wie `KI-Vorschlag`
- es gibt aktuell noch keine Lambda-Implementierung in diesem Repo

## Navigation / App-Flow

Datei:

- [frontend/src/App.jsx](../frontend/src/App.jsx)

Wichtige Punkte:

- `App` haelt `currentEditorTemplate` zentral
- `Leere Übung` setzt `currentEditorTemplate = null`
- `editorResetVersion` erzwingt einen frischen Editor-Mount
- `editorInstanceKey` unterscheidet:
  - lokales Dokument
  - externe Vorlage
  - bewusst neu gestarteten leeren Editor

Warum das wichtig ist:

- sonst bleiben bei "Leere Übung" lokale `useState`-Werte im Editor haengen

## Mobile UI

Desktop soll bewusst unveraendert bleiben. Mobile Anpassungen leben hauptsaechlich in:

- [frontend/src/index.css](../frontend/src/index.css)
- [frontend/src/App.jsx](../frontend/src/App.jsx)
- [frontend/src/components/editor/Toolbar.jsx](../frontend/src/components/editor/Toolbar.jsx)

### Mobile Hauptnavigation

- unter `768px` wird die Desktop-Navigation ausgeblendet
- stattdessen gibt es ein `☰ Menü`
- das Dropdown enthaelt:
  - `Editor`
  - `Leere Übung`
  - `Übungsbibliothek`
  - `Meine Übungen`
  - `Import`
  - `Login` / `Logout`

### Mobile Toolbar

Die Desktop-Toolbar bleibt unveraendert.

Unter `768px`:

- keine lange horizontale Komplettleiste mehr
- stattdessen kompaktes Raster mit Hauptaktionen:
  - `Auswählen`
  - `Spieler`
  - `Material`
- Rest liegt unter `Mehr Werkzeuge`
- das Zusatzmenue rendert als Block unterhalb der Toolbar, nicht als abgeschnittenes Overlay

## Auth / Login

Es gibt inzwischen eine minimale Login-UI:

- [frontend/src/pages/LoginPage.jsx](../frontend/src/pages/LoginPage.jsx)

Wichtige Regeln:

- Token liegt in `localStorage.token`
- geschuetzt sind:
  - `/editor`
  - `/meine-uebungen`
  - `/pdf-upload`
- oeffentlich bleibt:
  - `/uebungsbibliothek`

## Lokale URLs und Env

- Frontend lokal:
  - `http://localhost:5173`
  - alternativ `http://127.0.0.1:5173`
- Docker-Frontend lokal:
  - `http://localhost:8080`
  - alternativ `http://127.0.0.1:8080`
- Backend lokal:
  - `http://localhost:4000`
- Externe Such-API:
  - `https://b5zb58pdy4.execute-api.eu-north-1.amazonaws.com/prod/search`

Wichtige Frontend-Variablen:

- `VITE_API_BASE_URL`
  - optional
  - Fallback aktuell: `http://localhost:4000`
- `VITE_THUMBNAIL_BASE_URL`
  - optional
  - wichtig fuer echte Thumbnail-Keys aus der AWS-Suche

Wichtige Backend-Annahme:

- CORS ist lokal explizit offen fuer:
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
  - `http://localhost:8080`
  - `http://127.0.0.1:8080`

## Gute nächste Schritte

- `KI-Vorschlag` fuer `choreography_draft` sichtbar kennzeichnen
- lokale `focus` spaeter ggf. in eigene Spalte migrieren, falls Filter/Reporting wachsen
- Bundle groesser 500 kB spaeter per Code-Splitting aufraeumen
- Editor-Thumbnail-Generierung weiter haerten, falls weitere Feldtemplates dazukommen
