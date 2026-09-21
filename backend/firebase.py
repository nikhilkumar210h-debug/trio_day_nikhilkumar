import json
import os

import firebase_admin
from firebase_admin import credentials, firestore


def _initialize():
    if firebase_admin._apps:
        return firebase_admin.get_app()

    service_account_json = os.getenv('FIREBASE_SERVICE_ACCOUNT_JSON', '').strip()
    project_id = os.getenv('FIREBASE_PROJECT_ID', '').strip() or None

    if service_account_json:
        cred = credentials.Certificate(json.loads(service_account_json))
    else:
        # Local development can use GOOGLE_APPLICATION_CREDENTIALS or
        # Google Application Default Credentials. Cloud Run uses its
        # attached service account automatically.
        cred = credentials.ApplicationDefault()

    options = {'projectId': project_id} if project_id else None
    return firebase_admin.initialize_app(cred, options=options)


_initialize()
db = firestore.client()
