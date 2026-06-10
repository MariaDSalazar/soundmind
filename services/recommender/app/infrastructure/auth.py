"""Defensa en profundidad (§9 / ADR-008): el recommender verifica el MISMO access
token RS256 que emite el gateway, con solo la clave pública. El user_id sale del
`sub` verificado — nunca de un header manipulable."""
import jwt
from fastapi import HTTPException, Request, status

from ..config import get_settings

AUDIENCE = "soundmind-api"


def current_user_id(request: Request) -> int:
    """Dependencia FastAPI: devuelve el user_id (BIGINT) del token verificado."""
    header = request.headers.get("authorization")
    token = header[7:] if header and header.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")
    try:
        payload = jwt.decode(
            token,
            get_settings().public_key,
            algorithms=["RS256"],
            audience=AUDIENCE,
        )
        return int(payload["sub"])
    except Exception as exc:  # token inválido, expirado, clave mal, sub no numérico
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido"
        ) from exc
