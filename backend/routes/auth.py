import json
import os
import re
import urllib.error
import urllib.request

from flask import Blueprint, jsonify, request

from backend.firebase import db
from firebase_admin import auth as firebase_auth

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

TRIO_UID_RE = re.compile(r'^TRIO-[A-Z0-9]{8}$')
FIREBASE_WEB_API_KEY = os.getenv(
    'FIREBASE_WEB_API_KEY',
    'AIzaSyDyuycRTSAaGSEiCPEXXf36sxhyDVPQLTA',
).strip()


def _clean(value, max_len=256):
    return str(value or '').strip()[:max_len]


@auth_bp.post('/trio-uid')
def sign_in_with_trio_uid():
    payload = request.get_json(silent=True) or {}
    trio_uid = _clean(payload.get('trioUid'), 13).upper()
    password = str(payload.get('password') or '')

    if not TRIO_UID_RE.fullmatch(trio_uid) or not password:
        return jsonify({'error': 'Invalid Trio UID or password.'}), 401

    try:
        matches = list(
            db.collection('users')
            .where('userId', '==', trio_uid)
            .limit(2)
            .stream()
        )

        # A public Trio UID must map to exactly one Firebase account.
        if len(matches) != 1:
            return jsonify({'error': 'Invalid Trio UID or password.'}), 401

        uid = matches[0].id
        user = firebase_auth.get_user(uid)
        email = (user.email or '').strip()

        if not email:
            return jsonify({
                'error': 'This account uses Google sign-in. Use Continue with Google.'
            }), 401

        url = (
            'https://identitytoolkit.googleapis.com/v1/'
            f'accounts:signInWithPassword?key={FIREBASE_WEB_API_KEY}'
        )
        body = json.dumps({
            'email': email,
            'password': password,
            'returnSecureToken': True,
        }).encode('utf-8')

        req = urllib.request.Request(
            url,
            data=body,
            headers={'Content-Type': 'application/json'},
            method='POST',
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                response.read()
        except urllib.error.HTTPError:
            return jsonify({'error': 'Invalid Trio UID or password.'}), 401

        custom_token = firebase_auth.create_custom_token(uid, {
            'trioLogin': True,
            'trioUid': trio_uid,
        })

        if isinstance(custom_token, bytes):
            custom_token = custom_token.decode('utf-8')

        return jsonify({'customToken': custom_token}), 200

    except Exception as exc:
        # Do not expose Firebase/Admin/Identity Toolkit internals to the client.
        print(f'[trio-uid-login] {type(exc).__name__}: {exc}')
        return jsonify({
            'error': 'Unable to sign in with Trio UID right now.'
        }), 500
