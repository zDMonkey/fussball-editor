const EXERCISE_SEARCH_API = 'https://b5zb58pdy4.execute-api.eu-north-1.amazonaws.com/prod/search';

export function normalizeExerciseSearchResults(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export async function searchExercises(query = '') {
  const response = await fetch(`${EXERCISE_SEARCH_API}?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error(`Search API-Fehler (${response.status})`);
  }

  return normalizeExerciseSearchResults(await response.json());
}
