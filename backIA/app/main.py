
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.agent import ask_agent


# ==================================================
# 1. INITIALISATION DE L'APPLICATION
# ==================================================

app = FastAPI(
    title="Fabio IA API",
    description="API backend de l'assistant intelligent Fabio IA.",
    version="1.0.0"
)


# ==================================================
# 2. CONFIGURATION CORS
# ==================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://fabio-p288r3h9g-fabiodel.vercel.app",
        "https://fabio-5o6vwy40g-fabiodel.vercel.app/"
        
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


# ==================================================
# 3. MODELES DE DONNEES
# ==================================================

class ChatRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="Message envoyé par l'utilisateur."
    )

    user_id: str = Field(
        default="default",
        min_length=1,
        max_length=100,
        description="Identifiant temporaire de l'utilisateur."
    )


class ChatResponse(BaseModel):
    success: bool
    user_id: str
    message: str
    response: str


class HealthResponse(BaseModel):
    status: str
    application: str
    version: str


# ==================================================
# 4. ROUTE PRINCIPALE
# ==================================================

@app.get("/", response_model=HealthResponse)
def home():
    return HealthResponse(
        status="online",
        application="Fabio IA",
        version="1.0.0"
    )


# ==================================================
# 5. VERIFICATION DE L'API
# ==================================================

@app.get("/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(
        status="healthy",
        application="Fabio IA API",
        version="1.0.0"
    )


# ==================================================
# 6. ROUTE DE CONVERSATION
# ==================================================

@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):

    message = request.message.strip()
    user_id = request.user_id.strip()

    if not message:
        raise HTTPException(
            status_code=400,
            detail="Le message ne peut pas être vide."
        )

    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="L'identifiant utilisateur est obligatoire."
        )

    try:

        response = ask_agent(
            message=message,
            user_id=user_id
        )

        return ChatResponse(
            success=True,
            user_id=user_id,
            message=message,
            response=response
        )

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception:
        # Ne pas exposer les détails internes ou les secrets
        # du backend dans la réponse HTTP.
        import logging

        logging.exception("Erreur pendant le traitement du chat.")

        raise HTTPException(
            status_code=500,
            detail="Une erreur interne est survenue. Réessaie plus tard."
        )
