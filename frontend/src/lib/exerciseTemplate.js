function makeKeyframeId() {
  return `kf_${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyChoreography() {
  return {
    objects: [],
    keyframes: [
      {
        id: makeKeyframeId(),
        positions: {},
      },
    ],
  };
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function inferFieldTemplate(_searchResult) {
  // Die externe Suche liefert aktuell nur freie Feldgroessen-Texte.
  // Bis eine belastbare Zuordnung existiert, starten importierte Templates
  // immer mit dem internen Standardfeld.
  return 'vollfeld_hoch';
}

/**
 * Creates the internal exercise template shape used as the handoff format
 * between external sources, the editor, and later persistence layers.
 */
export function createExerciseTemplate(overrides = {}) {
  // Dieses Template ist das gemeinsame Austauschformat zwischen:
  // Bibliothek / Such-API, lokalem Backend und Editor-Hydration.
  const baseTemplate = {
    source: {
      type: 'manual',
      externalId: null,
      sourceKey: null,
      importedAt: null,
    },
    meta: {
      title: '',
      description: '',
      summary: '',
      ageGroups: [],
      playersMin: null,
      playersMax: null,
      durationMinutes: null,
      focus: [],
      fieldSizeLabel: '',
      thumbnailKey: '',
      thumbnailUrl: '',
    },
    editor: {
      fieldTemplate: 'vollfeld_hoch',
    },
    choreography: createEmptyChoreography(),
  };

  return {
    ...baseTemplate,
    ...overrides,
    source: {
      ...baseTemplate.source,
      ...overrides.source,
    },
    meta: {
      ...baseTemplate.meta,
      ...overrides.meta,
    },
    editor: {
      ...baseTemplate.editor,
      ...overrides.editor,
    },
    choreography: overrides.choreography
      ? {
          objects: Array.isArray(overrides.choreography.objects) ? overrides.choreography.objects : [],
          keyframes:
            Array.isArray(overrides.choreography.keyframes) && overrides.choreography.keyframes.length > 0
              ? overrides.choreography.keyframes
              : createEmptyChoreography().keyframes,
        }
      : baseTemplate.choreography,
  };
}

/**
 * Maps one external search result into the internal template model.
 * This intentionally imports metadata only; editable drawing data stays empty
 * until a dedicated PDF/diagram import exists.
 */
export function mapSearchResultToExerciseTemplate(searchResult = {}) {
  return createExerciseTemplate({
    source: {
      type: 'external-search',
      externalId: searchResult.exercise_id ?? null,
      sourceKey: searchResult.source_key ?? searchResult.exercise_id ?? null,
      importedAt: new Date().toISOString(),
    },
    meta: {
      title: searchResult.title ?? '',
      description: searchResult.description ?? searchResult.summary ?? '',
      summary: searchResult.summary ?? '',
      ageGroups: normalizeArray(searchResult.age_groups),
      playersMin: Number.isFinite(searchResult.players_min) ? searchResult.players_min : null,
      playersMax: Number.isFinite(searchResult.players_max) ? searchResult.players_max : null,
      durationMinutes: Number.isFinite(searchResult.duration_minutes) ? searchResult.duration_minutes : null,
      focus: normalizeArray(searchResult.focus),
      fieldSizeLabel: searchResult.field_size ?? '',
      thumbnailKey: searchResult.thumbnail_key ?? '',
      thumbnailUrl: searchResult.thumbnail_url ?? '',
    },
    editor: {
      fieldTemplate: inferFieldTemplate(searchResult),
    },
    choreography: createEmptyChoreography(),
  });
}

export function mapStoredExerciseToExerciseTemplate(exercise = {}) {
  // Backend-Exercises werden fuer den Editor wieder in das interne
  // Template-Modell zurueckgefuehrt. Entscheidend ist hier, dass die
  // gespeicherte choreography unveraendert uebernommen wird.
  return createExerciseTemplate({
    id: exercise.id ?? null,
    source: {
      type: 'local-backend',
      externalId: exercise.id ?? null,
      sourceKey: exercise.id ?? null,
      importedAt: exercise.updated_at ?? exercise.created_at ?? null,
    },
    meta: {
      title: exercise.title ?? '',
      description: exercise.description ?? '',
      summary: exercise.description ?? '',
      ageGroups: exercise.age_group ? [exercise.age_group] : [],
      durationMinutes: Number.isFinite(exercise.duration_minutes) ? exercise.duration_minutes : null,
      thumbnailKey: exercise.thumbnail_key ?? '',
      thumbnailUrl: exercise.thumbnail_url ?? '',
    },
    editor: {
      fieldTemplate: exercise.field_template ?? 'vollfeld_hoch',
    },
    choreography: exercise.choreography ?? createEmptyChoreography(),
  });
}
