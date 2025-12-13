from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as redis

from app.config import settings
from app.database import init_db
from app.routers import auth, files, websocket, users, conversations
from app.routers.public import router as public_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    app.state.redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
    yield
    # Shutdown
    await app.state.redis.close()


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix=f"{settings.API_V1_PREFIX}/auth", tags=["Auth"])
app.include_router(files.router, prefix=f"{settings.API_V1_PREFIX}/files", tags=["Files"])
app.include_router(users.router, prefix=f"{settings.API_V1_PREFIX}/users", tags=["Users"])
app.include_router(conversations.router, tags=["Conversations"])
app.include_router(websocket.router, prefix="/ws", tags=["WebSocket"])
app.include_router(public_router, tags=["Public"])


@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.APP_NAME} API", "version": "0.1.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
