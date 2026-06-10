import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';
import { getGenres, onboard } from '../lib/api';

interface Props {
  token: string;
  /** Se llama tras sembrar el gusto (para refrescar "Para ti"). */
  onDone: () => void;
}

/**
 * Onboarding de cold-start (§6.6): el usuario elige géneros y con eso sembramos
 * su `taste_vec`. Sin esto, un usuario nuevo no tendría señal para recomendar.
 */
export function Onboarding({ token, onDone }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data: genres, isLoading } = useQuery({ queryKey: ['genres'], queryFn: getGenres });

  const save = useMutation({
    mutationFn: () => onboard(token, [...selected]),
    onSuccess: onDone,
  });

  const toggle = (g: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });

  return (
    <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur">
      <div className="mb-1 flex items-center gap-2">
        <Sparkles className="size-5 text-fuchsia-400" />
        <h2 className="text-lg font-bold">Cuéntanos qué te gusta</h2>
      </div>
      <p className="mb-5 text-sm text-zinc-400">
        Elige algunos géneros y armamos tus recomendaciones. Luego aprenden de lo que escuchas.
      </p>

      {isLoading ? (
        <p className="flex items-center gap-2 py-8 text-sm text-zinc-500">
          <Loader2 className="size-4 animate-spin" /> Cargando géneros…
        </p>
      ) : !genres || genres.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          Aún no hay géneros en el catálogo. Reproduce algo de música y vuelve en un rato.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => {
              const on = selected.has(g);
              return (
                <button
                  key={g}
                  onClick={() => toggle(g)}
                  aria-pressed={on}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition ${on ? 'bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white ring-transparent' : 'bg-white/5 text-zinc-300 ring-white/10 hover:ring-white/30'}`}
                >
                  {g}
                </button>
              );
            })}
          </div>

          {save.error && (
            <p className="mt-4 text-sm text-rose-300">{(save.error as Error).message}</p>
          )}

          <button
            onClick={() => save.mutate()}
            disabled={selected.size === 0 || save.isPending}
            className="mt-6 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {selected.size === 0 ? 'Elige al menos un género' : `Empezar con ${selected.size}`}
          </button>
        </>
      )}
    </section>
  );
}
