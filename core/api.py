from ninja import NinjaAPI
from transcription.api import api as transcription_api
from auth.api import api as auth_api
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie

api = NinjaAPI(csrf=True)

api.add_router("/transcription/", transcription_api)
api.add_router("/auth/", auth_api)


@api.post("/csrf")
@ensure_csrf_cookie
@csrf_exempt
def get_csrf_token(request):
    return HttpResponse()
