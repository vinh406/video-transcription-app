from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from ninja import Router, Schema
from ninja.security import django_auth
from typing import Optional

api = Router()


# Authentication schemas
class SignupSchema(Schema):
    username: str
    email: str
    password: str


class LoginSchema(Schema):
    username: str
    password: str


class UserSchema(Schema):
    id: int
    username: str
    email: str


class AuthResponse(Schema):
    message: str
    user: Optional[UserSchema] = None


# Media history schema
class MediaFileSchema(Schema):
    id: str
    file_name: str
    mime_type: str
    created_at: str
    has_transcript: bool
    has_summary: bool
    service: Optional[str] = None


# Authentication endpoints
@api.post("/signup", response={200: AuthResponse, 400: AuthResponse})
def signup(request, data: SignupSchema):
    if User.objects.filter(username=data.username).exists():
        return 400, {"message": "Username already exists"}

    user = User.objects.create_user(
        username=data.username, email=data.email, password=data.password
    )
    login(request, user)

    return 200, {
        "message": "User created successfully",
        "user": {"id": user.id, "username": user.username, "email": user.email},
    }


@api.post("/login", response={200: AuthResponse, 400: AuthResponse})
def login_user(request, data: LoginSchema):
    user = authenticate(request, username=data.username, password=data.password)
    if user is not None:
        login(request, user)
        print(f"User authenticated: {user.username}")
        print(f"Session ID: {request.session.session_key}")
        return 200, {
            "message": "Login successful",
            "user": {"id": user.id, "username": user.username, "email": user.email},
        }
    else:
        return 400, {"message": "Invalid credentials"}


@api.post("/logout", response=AuthResponse)
def logout_user(request):
    logout(request)
    return 200, {"message": "Logged out successfully"}


@api.get("/me", response=AuthResponse, auth=django_auth)
def get_current_user(request):
    user = request.user
    return 200, {
        "message": "User information retrieved",
        "user": {"id": user.id, "username": user.username, "email": user.email},
    }
