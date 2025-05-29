from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_wtf.csrf import CSRFProtect
from flask_talisman import Talisman
from flask_pymongo import PyMongo
from .config import Config
# Initialize extensions without app context
cors = CORS()
limiter = Limiter(key_func=get_remote_address, storage_uri="memory://", strategy="fixed-window")
csrf = CSRFProtect()
talisman = Talisman()
mongo = PyMongo()
