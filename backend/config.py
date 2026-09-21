import os

from dotenv import load_dotenv

load_dotenv()


def _csv(value: str) -> list[str]:
    return [item.strip() for item in (value or '').split(',') if item.strip()]


class Config:
    PROJECT_ID = os.getenv('FIREBASE_PROJECT_ID', '').strip()
    ALLOWED_ORIGINS = _csv(os.getenv(
        'ALLOWED_ORIGINS',
        'http://127.0.0.1:5500,http://localhost:5500',
    ))
    MAX_NOTIFICATION_TEXT = int(os.getenv('MAX_NOTIFICATION_TEXT', '500'))
