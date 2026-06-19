function normalizeDurationMinutes(value) {
  if (value === '' || value === null || value === undefined) return null;

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

export function buildExercisePayload({
  title,
  description,
  ageGroup,
  durationMinutes,
  focus,
  fieldTemplate,
  objects,
  keyframes,
  thumbnailUrl,
}) {
  // Das Backend speichert kein ExerciseTemplate, sondern ein klassisches
  // Exercise-Entity plus choreography als JSONB. Dieser Mapper bildet den
  // Editor-State auf genau dieses bestehende Modell ab.
  return {
    title: title.trim(),
    description: description.trim() || null,
    age_group: ageGroup.trim() || null,
    duration_minutes: normalizeDurationMinutes(durationMinutes),
    field_template: fieldTemplate,
    thumbnail_url: thumbnailUrl || null,
    choreography: {
      objects,
      keyframes,
      meta: {
        focus,
      },
    },
  };
}
