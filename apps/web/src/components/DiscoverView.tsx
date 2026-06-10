import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { RecommendationReason, RecommendedTrack, Track } from '@soundmind/shared';
import { getForMe, getSimilar } from '../lib/api';
import { useDiscoverStore } from '../store/discover';
import { Onboarding } from './Onboarding';
import { TrackList } from './TrackList';

/** Traduce el `reason` (§6.5) a un texto humano por pista. */
function reasonText(r: RecommendationReason): string {
  const base =
    r.type === 'collaborative'
      ? 'Oyentes como tú lo escuchan'
      : r.type === 'similar_track'
        ? 'Similar a la que elegiste'
        : 'Por tu gusto';
  return r.context ? `${base} · ${r.context}` : base;
}

function reasonLabels(tracks: RecommendedTrack[]): Record<string, string> {
  return Object.fromEntries(tracks.map((t) => [t.id, reasonText(t.reason)]));
}

interface Props {
  /** null si no hay sesión: el modo "similar" es público, el personal pide login. */
  token: string | null;
  likedIds?: Set<string>;
  onToggleLike?: (track: Track) => void;
}

/**
 * Vista "Para ti" (F3). Dos modos:
 *  - ANCLA presente (similarTo) → "Más como esta": similares por contenido.
 *  - Sin ancla → recos personales por gusto; si el usuario no se ha onboardeado,
 *    muestra el onboarding (cold start).
 */
export function DiscoverView({ token, likedIds, onToggleLike }: Props) {
  const similarTo = useDiscoverStore((s) => s.similarTo);
  const setSimilarTo = useDiscoverStore((s) => s.setSimilarTo);
  // Permite re-elegir géneros aunque ya estés onboardeado ("Ajustar mis gustos").
  const [editing, setEditing] = useState(false);

  // Modo "Más como esta".
  const similar = useQuery({
    queryKey: ['similar', similarTo?.id],
    queryFn: () => getSimilar(similarTo!.id),
    enabled: !!similarTo,
  });

  // Modo personal (requiere sesión). Pasa la hora local del cliente para el
  // re-ranking contextual (§6.3).
  const forMe = useQuery({
    queryKey: ['forme'],
    queryFn: () => getForMe(token!, new Date().getHours()),
    enabled: !similarTo && !!token,
  });

  if (similarTo) {
    return (
      <section>
        <button
          onClick={() => setSimilarTo(null)}
          className="mb-4 flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft className="size-4" /> Volver a tus recomendaciones
        </button>
        <Banner text={`Porque te gustó “${similarTo.title}”`} />
        {similar.isFetching ? (
          <Spinner />
        ) : (
          <TrackList
            tracks={similar.data ?? []}
            likedIds={likedIds}
            onToggleLike={onToggleLike}
            onSimilar={(t) => setSimilarTo(t)}
            reasonLabels={reasonLabels(similar.data ?? [])}
          />
        )}
      </section>
    );
  }

  if (!token) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500">
        Inicia sesión para ver recomendaciones hechas para ti.
      </p>
    );
  }
  if (forMe.isFetching) return <Spinner />;
  if (forMe.error) {
    return <p className="py-8 text-center text-sm text-rose-300">{(forMe.error as Error).message}</p>;
  }

  // Cold start (sin onboarding) o el usuario pidió re-elegir géneros.
  if (editing || (forMe.data && !forMe.data.onboarded)) {
    return (
      <Onboarding
        token={token}
        onDone={() => {
          setEditing(false);
          void forMe.refetch();
        }}
      />
    );
  }

  const tracks = forMe.data?.tracks ?? [];
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Banner text="Según lo que escuchas y te gusta" className="mb-0 flex-1" />
        <button
          onClick={() => setEditing(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 ring-1 ring-white/10 transition hover:text-white hover:ring-white/30"
        >
          <SlidersHorizontal className="size-3.5" /> Ajustar mis gustos
        </button>
      </div>
      {tracks.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-500">
          Todavía no tenemos suficientes pistas para recomendarte. Escucha algo y vuelve —
          tus recomendaciones se actualizan cada noche.
        </p>
      ) : (
        <TrackList
          tracks={tracks}
          likedIds={likedIds}
          onToggleLike={onToggleLike}
          onSimilar={(t) => setSimilarTo(t)}
          reasonLabels={reasonLabels(tracks)}
        />
      )}
    </section>
  );
}

function Banner({ text, className = 'mb-4' }: { text: string; className?: string }) {
  return (
    <p className={`${className} flex items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500/10 to-violet-500/10 px-4 py-2.5 text-sm text-fuchsia-200 ring-1 ring-fuchsia-500/20`}>
      <Sparkles className="size-4 shrink-0" /> {text}
    </p>
  );
}

function Spinner() {
  return (
    <p className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
      <Loader2 className="size-4 animate-spin" /> Cargando…
    </p>
  );
}
