from functools import wraps

from firebase_admin import auth
from flask import g, jsonify, request


def require_auth(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        header = request.headers.get('Authorization', '')
        if not header.startswith('Bearer '):
            return jsonify({'error': 'Authentication required'}), 401

        token = header[7:].strip()
        if not token:
            return jsonify({'error': 'Authentication required'}), 401

        try:
            decoded = auth.verify_id_token(token)
        except Exception:
            return jsonify({'error': 'Invalid authentication token'}), 401

        g.firebase_user = decoded
        return view(*args, **kwargs)

    return wrapped
