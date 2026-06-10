import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import type { Track } from '@soundmind/shared';
import { getForMe, getSimilar } from '../lib/api';
import { useDiscoverStore } from '../store/discover';
import { Onboarding } from './Onboarding';
import { TrackList } from './TrackList';

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

  // Modo "Más como esta".
  const similar = useQuery({
    queryKey: ['similar', similarTo?.id],
    queryFn: () => getSimilar(similarTo!.id),
    enabled: !!similarTo,
  });

  // Modo personal (requiere sesión).
  const forMe = useQuery({
    queryKey: ['forme'],
    queryFn: () => getForMe(token!),
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

  // Cold start: aún no ha elegido gustos.
  if (forMe.data && !forMe.data.onboarded) {
    return <Onboarding token={token} onDone={() => forMe.refetch()} />;
  }

  const tracks = forMe.data?.tracks ?? [];
  return (
    <section>
      <Banner text="Según lo que escuchas y te gusta" />
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
        />
      )}
    </section>
  );
}

function Banner({ text }: { text: string }) {
  return (
    <p className="mb-4 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500/10 to-violet-500/10 px-4 py-2.5 text-sm text-fuchsia-200 ring-1 ring-fuchsia-500/20">
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
