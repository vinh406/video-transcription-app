from ninja import NinjaAPI
from transcription.api import api as transcription_api
from auth.api import api as auth_api

api = NinjaAPI()

api.add_router("/transcription/", transcription_api)
api.add_router("/auth/", auth_api)
