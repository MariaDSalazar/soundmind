import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, LogIn, LogOut, UserPlus } from 'lucide-react'; // Lucide (ISC)
import { useAuthStore } from '../store/auth';

/** Login/registro + menú de usuario con el toggle de consentimiento (§9). */
export function AuthPanel() {
  const { profile, login, register, logout, setConsent } = useAuthStore();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, displayName);
      setOpen(false);
      setPassword('');
      // refresca queries dependientes de la sesión (likes, historial)
      await queryClient.invalidateQueries();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    await queryClient.invalidateQueries();
  }

  if (profile) {
    return (
      <div className="relative ml-auto">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1.5 text-xs font-medium ring-1 ring-white/10 backdrop-blur transition hover:bg-white/10"
        >
          <span className="grid size-6 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-[11px] font-bold text-white">
            {profile.displayName.charAt(0).toUpperCase()}
          </span>
          {profile.displayName}
          <ChevronDown className="size-3.5 text-zinc-400" />
        </button>

        {menuOpen && (
          <div className="animate-pop absolute right-0 top-11 z-10 w-72 rounded-2xl border border-white/10 bg-zinc-950/90 p-3 shadow-2xl backdrop-blur-xl">
            {/* Consentimiento de tracking — privacidad por diseño (§9, GDPR/LOPD) */}
            <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="text-xs font-semibold">Guardar mi historial de escucha</span>
                <input
                  type="checkbox"
                  checked={profile.consentTracking}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="size-4 accent-fuchsia-500"
                />
              </label>
              <p className="mt-1.5 text-[11px] leading-snug text-zinc-400">
                Si lo activas, registramos qué reproduces para mejorar tus recomendaciones. Puedes
                desactivarlo cuando quieras (lo exige el RGPD).
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              <LogOut className="size-4" /> Cerrar sesión
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative ml-auto">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition hover:brightness-110"
      >
        <LogIn className="size-3.5" /> Entrar
      </button>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="animate-pop absolute right-0 top-11 z-10 w-72 space-y-2 rounded-2xl border border-white/10 bg-zinc-950/90 p-4 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex gap-1 rounded-xl bg-white/5 p-1 text-xs ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 rounded-lg py-1.5 font-medium transition ${mode === 'login' ? 'bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 rounded-lg py-1.5 font-medium transition ${mode === 'register' ? 'bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              Crear cuenta
            </button>
          </div>

          {mode === 'register' && (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Tu nombre"
              required
              className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10 transition focus:ring-2 focus:ring-fuchsia-500/70"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@ejemplo.com"
            required
            className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10 transition focus:ring-2 focus:ring-fuchsia-500/70"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña (mín. 8)"
            minLength={8}
            required
            className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10 transition focus:ring-2 focus:ring-fuchsia-500/70"
          />

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition hover:brightness-110 disabled:opacity-50"
          >
            {mode === 'login' ? <LogIn className="size-4" /> : <UserPlus className="size-4" />}
            {busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>
      )}
    </div>
  );
}
