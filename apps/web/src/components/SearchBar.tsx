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
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-fuchsia-400" />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Busca artistas, canciones, géneros…"
          maxLength={120}
          className="w-full rounded-full bg-white/5 py-3 pl-11 pr-4 text-sm outline-none ring-1 ring-white/10 backdrop-blur transition placeholder:text-zinc-500 focus:ring-2 focus:ring-fuchsia-500/70"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-6 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition hover:brightness-110 disabled:opacity-50"
      >
        {loading ? 'Buscando…' : 'Buscar'}
      </button>
    </form>
  );
}
