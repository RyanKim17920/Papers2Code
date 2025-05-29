from flask import Blueprint

papers_bp = Blueprint('papers', __name__, url_prefix='/api/papers')

# Import routes after blueprint creation to avoid circular imports
# from . import routes  # noqa: F401, E402
from . import paper_views    # noqa: F401, E402
from . import paper_actions  # noqa: F401, E402
from . import paper_moderation  # noqa: F401, E402