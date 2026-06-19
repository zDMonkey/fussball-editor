# Coding Agent Handoff

## Zielbild

Dieses Projekt hat aktuell drei relevante Frontend-Flows:

1. `Übungsbibliothek` lädt externe Suchtreffer aus der AWS-Such-API.
2. `Meine Übungen` lädt lokal gespeicherte Übungen aus dem Express-/Postgres-Backend.
3. `Editor` kann beide Quellen als `initialTemplate` öffnen und lokal gespeicherte Dokumente wieder speichern.

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

## Editor-Hydration

Die Editor-Initialisierung sitzt in:

- [frontend/src/components/editor/Editor.jsx](../frontend/src/components/editor/Editor.jsx)

Wichtige Punkte:

- `Editor` akzeptiert optional `initialTemplate`
- `getInitialEditorState(initialTemplate)` liest daraus nur:
  - `choreography.objects`
  - `choreography.keyframes`
- Die Hydration passiert absichtlich nur beim ersten Render
- Spaetere Prop-Aenderungen synchronisieren den Editor nicht automatisch nach

## Öffnen aus der Bibliothek

Externe Treffer:

- [frontend/src/pages/ExerciseLibraryPage.jsx](../frontend/src/pages/ExerciseLibraryPage.jsx)

Flow:

1. Treffer aus AWS-Such-API laden
2. `mapSearchResultToExerciseTemplate()` aufrufen
3. Template in `App`-State legen
4. nach `/editor` navigieren

Wichtig:

- Externe Treffer enthalten aktuell keine editierbare Diagrammstruktur
- Deshalb startet `choreography` dort leer
- Optional vorhandene `thumbnailKey` / `thumbnailUrl` werden fuer das Referenzpanel genutzt

## Öffnen aus "Meine Übungen"

Lokale Übungen:

- [frontend/src/pages/MyExercisesPage.jsx](../frontend/src/pages/MyExercisesPage.jsx)

Flow:

1. `GET /api/exercises`
2. `mapStoredExerciseToExerciseTemplate()`
3. `App` setzt das Template
4. `/editor` hydratisiert daraus die persistierte `choreography`

Wichtig:

- `GET /api/exercises` muss `choreography` im Response enthalten
- Ohne diese Spalte startet der Editor beim Reopen leer

## Speichern im Editor

Speichern ist absichtlich minimal gehalten.

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
   - `choreography`
3. Erstes Speichern:
   - `POST /api/exercises`
4. Weitere Saves:
   - `PUT /api/exercises/:id`

## Thumbnail-Handling

Thumbnails werden aktuell nur angezeigt, nicht weiterverarbeitet.

Bibliothek:

- `thumbnail_key` aus Suchergebnissen
- URL-Aufloesung ueber `VITE_THUMBNAIL_BASE_URL`

Editor:

- Referenzpanel liest `initialTemplate.meta.thumbnailKey` oder `thumbnailUrl`

## Wichtige Annahmen

- Login-UI existiert nicht
- `localStorage.token` muss fuer authentifizierte API-Calls vorhanden sein
- Das lokale Backend speichert `choreography` in Postgres als `jsonb`
- Externe Suchtreffer und lokale Übungen nutzen unterschiedliche Ursprungsmodelle, werden aber vor dem Editor beide auf `ExerciseTemplate` vereinheitlicht

## Gute nächste Schritte

- Login-Seite bauen
- `ExerciseTemplate` um Referenz-Metadaten systematischer erweitern
- Feldtemplate dynamisch im Editor rendern
- Speichern/Laden robuster machen, z. B. Dirty-State und explizites Rehydrate-Verhalten
