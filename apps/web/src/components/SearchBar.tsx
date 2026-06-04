import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react'; // Lucide: iconos open source (ISC)

interface Props {
  onSearch: (query: string) => void;
  loading: boolean;
}

export function SearchBar({ onSearch, loading }: Props) {
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const query = value.trim();
    if (query) onSearch(query);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Busca artistas, canciones, géneros…"
          maxLength={120}
          className="w-full rounded-full bg-zinc-900 py-2.5 pl-10 pr-4 text-sm outline-none ring-1 ring-zinc-800 placeholder:text-zinc-600 focus:ring-emerald-500"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-emerald-600 px-5 text-sm font-medium transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {loading ? 'Buscando…' : 'Buscar'}
      </button>
    </form>
  );
}
