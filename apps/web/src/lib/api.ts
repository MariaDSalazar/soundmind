import type { SearchResponse } from '@soundmind/shared';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

export async function searchTracks(query: string): Promise<SearchResponse> {
  const url = new URL(`${API_URL}/tracks/search`);
  url.searchParams.set('q', query);

  const res = await fetch(url);
  if (!res.ok) {
    const problem = await res.json().catch(() => null);
    throw new Error(problem?.title ?? `Error ${res.status}`);
  }
  return res.json();
}
