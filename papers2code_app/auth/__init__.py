from flask import Blueprint

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

# Import routes after blueprint creation
from . import routes # noqa: F401, E402
