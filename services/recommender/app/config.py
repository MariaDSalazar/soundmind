"""Configuración validada (§9: 'nada entra sin esquema'). Falla rápido al
arrancar si falta algo crítico, en vez de morir en runtime."""
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_pem(value: str) -> str:
    """Admite PEM multilínea, en una línea con '\\n', o en base64 — igual que el
    users service, a prueba de paneles (Render) que rompen los saltos reales."""
    import base64

    v = value.strip()
    if "BEGIN" in v:
        return v.replace("\\n", "\n") if "\\n" in v else v
    return base64.b64decode(v).decode("utf-8")  # forma base64


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    # Solo la clave PÚBLICA: el recommender verifica JWT, nunca los firma.
    JWT_PUBLIC_KEY: str | None = None
    JWT_PUBLIC_KEY_PATH: str | None = None
    # Render inyecta PORT; en local usamos RECOMMENDER_PORT.
    PORT: int | None = None
    RECOMMENDER_PORT: int = 4004

    @property
    def port(self) -> int:
        return self.PORT or self.RECOMMENDER_PORT

    @property
    def public_key(self) -> str:
        raw = self.JWT_PUBLIC_KEY
        if not raw and self.JWT_PUBLIC_KEY_PATH:
            with open(self.JWT_PUBLIC_KEY_PATH, encoding="utf-8") as f:
                raw = f.read()
        return normalize_pem(raw) if raw else ""

    @model_validator(mode="after")
    def _warn_missing_key(self):
        if not (self.JWT_PUBLIC_KEY or self.JWT_PUBLIC_KEY_PATH):
            import sys

            print(
                "WARN: sin JWT_PUBLIC_KEY — los endpoints por-usuario fallarán.",
                file=sys.stderr,
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
