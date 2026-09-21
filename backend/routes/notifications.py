from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request

from backend.firebase import db
from backend.middleware.auth import require_auth

notifications_bp = Blueprint('notifications', __name__, url_prefix='/api/notifications')


def _clean_string(value, max_len=500):
    if value is None:
        return ''
    return str(value).strip()[:max_len]


@notifications_bp.post('/create')
@require_auth
def create_notification():
    payload = request.get_json(silent=True) or {}
    target_uid = _clean_string(payload.get('targetUid'), 128)
    if not target_uid:
        return jsonify({'error': 'targetUid is required'}), 400

    actor_uid = g.firebase_user.get('uid')
    if not actor_uid:
        return jsonify({'error': 'Invalid authenticated user'}), 401
    if target_uid == actor_uid:
        return jsonify({'error': 'Cannot notify yourself'}), 400

    notification_type = _clean_string(payload.get('type'), 60) or 'update'
    actor_name = _clean_string(payload.get('actorName'), 80) or 'Someone'
    actor_photo = _clean_string(payload.get('actorPhotoURL'), 1000)
    text = _clean_string(payload.get('text'), 500)
    title = _clean_string(payload.get('title'), 160)
    url_path = _clean_string(payload.get('urlPath'), 300)
    post_id = _clean_string(payload.get('postId'), 200)

    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    data = {
        'type': notification_type,
        'actorUid': actor_uid,
        'actorName': actor_name,
        'createdAtMs': now_ms,
        'read': False,
    }
    if actor_photo:
        data['actorPhotoURL'] = actor_photo
    if text:
        data['text'] = text
    if title:
        data['title'] = title
    if url_path:
        data['urlPath'] = url_path
    if post_id:
        data['postId'] = post_id

    ref = db.collection('users').document(target_uid).collection('notifications').document()
    ref.set(data)
    return jsonify({'ok': True, 'notificationId': ref.id}), 201
