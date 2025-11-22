"""
Mock IDP Router
Endpoints for the Mock OIDC Provider.
"""

from fastapi import APIRouter, Request, Form, HTTPException, Depends
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from typing import Optional

from ..services.mock_idp_service import mock_idp_service
from ..shared import config_settings

router = APIRouter(prefix="/mock-idp", tags=["mock-idp"])

# Simple HTML template for the login page
LOGIN_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>Choose Persona - Mock IDP</title>
    <style>
        body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .persona-card { 
            border: 1px solid #ddd; 
            padding: 15px; 
            margin: 10px 0; 
            border-radius: 8px;
            display: flex;
            align-items: center;
            cursor: pointer;
            transition: background 0.2s;
        }
        .persona-card:hover { background: #f5f5f5; }
        .avatar { width: 50px; height: 50px; border-radius: 50%; margin-right: 15px; }
        .info { flex-grow: 1; }
        .name { font-weight: bold; }
        .meta { color: #666; font-size: 0.9em; }
        .new-persona { margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
        input { padding: 8px; margin: 5px; width: 200px; }
        button { padding: 8px 15px; cursor: pointer; }
    </style>
</head>
<body>
    <h1>Choose a Persona</h1>
    <p>Select a user to simulate login:</p>
    
    <div id="persona-list">
        {% for persona in personas %}
        <div class="persona-card" onclick="login('{{ persona.id }}')">
            <img src="{{ persona.avatarUrl }}" class="avatar" onerror="this.src='https://via.placeholder.com/50'">
            <div class="info">
                <div class="name">{{ persona.displayName }}</div>
                <div class="meta">{{ persona.username }} | {{ persona.email }}</div>
                <div class="meta" style="font-size: 0.8em; color: #888;">Provider: {{ persona.provider }}</div>
            </div>
        </div>
        {% endfor %}
    </div>

    <div class="new-persona">
        <h3>Create New Persona</h3>
        <form action="/mock-idp/personas" method="post" onsubmit="return createPersona(event)">
            <input type="text" name="username" placeholder="Username" required>
            <input type="email" name="email" placeholder="Email" required>
            <input type="text" name="displayName" placeholder="Display Name">
            <select name="provider">
                <option value="github">GitHub</option>
                <option value="google">Google</option>
            </select>
            <button type="submit">Create & Login</button>
        </form>
    </div>

    <form id="login-form" action="/mock-idp/authorize/submit" method="post" style="display:none;">
        <input type="hidden" name="client_id" value="{{ client_id }}">
        <input type="hidden" name="redirect_uri" value="{{ redirect_uri }}">
        <input type="hidden" name="state" value="{{ state }}">
        <input type="hidden" name="nonce" value="{{ nonce }}">
        <input type="hidden" name="user_id" id="selected-user-id">
    </form>

    <script>
        function login(userId) {
            document.getElementById('selected-user-id').value = userId;
            document.getElementById('login-form').submit();
        }
        
        async function createPersona(e) {
            e.preventDefault();
            const form = e.target;
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            // Add some defaults
            data.avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.displayName || data.username)}`;
            data.id = (data.provider === 'github' ? 'gh-' : 'gg-') + data.username;
            
            try {
                const res = await fetch('/mock-idp/api/personas', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data)
                });
                
                if (res.ok) {
                    const newPersona = await res.json();
                    login(newPersona.id);
                } else {
                    alert('Failed to create persona');
                }
            } catch (err) {
                console.error(err);
                alert('Error creating persona');
            }
            return false;
        }
    </script>
</body>
</html>
"""

@router.get("/.well-known/openid-configuration")
async def discovery():
    return mock_idp_service.get_discovery_doc()

@router.get("/jwks")
async def jwks():
    return mock_idp_service.get_jwks()

@router.get("/authorize")
async def authorize_page(
    client_id: str,
    redirect_uri: str,
    state: str,
    nonce: Optional[str] = None,
    response_type: str = "code",
    scope: str = "openid"
):
    # Render the login page with personas
    # We use a simple string template for now to avoid dependency on template files
    from jinja2 import Template
    t = Template(LOGIN_TEMPLATE)
    return HTMLResponse(t.render(
        personas=mock_idp_service.personas,
        client_id=client_id,
        redirect_uri=redirect_uri,
        state=state,
        nonce=nonce or ""
    ))

@router.post("/authorize/submit")
async def authorize_submit(
    client_id: str = Form(...),
    redirect_uri: str = Form(...),
    state: str = Form(...),
    user_id: str = Form(...),
    nonce: Optional[str] = Form(None)
):
    # Generate auth code
    code = mock_idp_service.create_auth_code(client_id, redirect_uri, nonce, user_id)
    
    # Redirect back to Dex
    # Dex expects: redirect_uri?code=...&state=...
    separator = "&" if "?" in redirect_uri else "?"
    return RedirectResponse(
        f"{redirect_uri}{separator}code={code}&state={state}",
        status_code=302
    )

@router.post("/token")
async def token(
    grant_type: str = Form(...),
    code: str = Form(...),
    redirect_uri: str = Form(...),
    client_id: str = Form(...),
    client_secret: Optional[str] = Form(None)
):
    if grant_type != "authorization_code":
        raise HTTPException(status_code=400, detail="Unsupported grant type")
        
    try:
        return mock_idp_service.exchange_code(code)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/userinfo")
async def userinfo(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
        
    token = auth_header.split(" ")[1]
    try:
        return mock_idp_service.get_user_info(token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/api/personas")
async def add_persona(persona: dict):
    return mock_idp_service.add_persona(persona)
