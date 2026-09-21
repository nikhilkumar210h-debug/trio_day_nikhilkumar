from flask import Flask, request
from flask_cors import CORS

from backend.config import Config
from backend.routes.health import health_bp
from backend.routes.notifications import notifications_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(
        app,
        origins=Config.ALLOWED_ORIGINS,
        methods=['GET', 'POST', 'OPTIONS'],
        allow_headers=['Authorization', 'Content-Type'],
        supports_credentials=False,
        max_age=86400,
    )

    @app.get('/')
    def root():
        return {'service': 'trio-day-api', 'status': 'running'}

    app.register_blueprint(health_bp)
    app.register_blueprint(notifications_bp)

    @app.errorhandler(404)
    def not_found(_error):
        return {'error': 'Route not found'}, 404

    @app.errorhandler(405)
    def method_not_allowed(_error):
        return {'error': 'Method not allowed'}, 405

    return app


app = create_app()

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
