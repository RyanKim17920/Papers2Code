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
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Papers2Code Dev Login</title>
    <style>
        :root {
            --primary: #2563eb;
            --primary-hover: #1d4ed8;
            --bg: #f8fafc;
            --card-bg: #ffffff;
            --text: #0f172a;
            --text-muted: #64748b;
            --border: #e2e8f0;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        
        .container {
            background: var(--card-bg);
            width: 100%;
            max-width: 480px;
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            padding: 32px;
        }
        
        h1 {
            font-size: 24px;
            font-weight: 700;
            margin: 0 0 8px 0;
            text-align: center;
        }
        
        p.subtitle {
            color: var(--text-muted);
            text-align: center;
            margin: 0 0 32px 0;
            font-size: 14px;
        }
        
        .persona-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 32px;
            max-height: 400px;
            overflow-y: auto;
        }
        
        .persona-card {
            display: flex;
            align-items: center;
            padding: 12px;
            border: 1px solid var(--border);
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            background: #fff;
        }
        
        .persona-card:hover {
            border-color: var(--primary);
            background-color: #eff6ff;
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            margin-right: 16px;
            object-fit: cover;
            border: 2px solid #fff;
            box-shadow: 0 0 0 1px var(--border);
        }
        
        .info {
            flex: 1;
            min-width: 0;
        }
        
        .name {
            font-weight: 600;
            font-size: 15px;
            margin-bottom: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .meta {
            font-size: 13px;
            color: var(--text-muted);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .provider-badge {
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 12px;
            background: #f1f5f9;
            color: var(--text-muted);
            margin-left: auto;
            font-weight: 500;
        }
        
        .divider {
            height: 1px;
            background: var(--border);
            margin: 0 0 24px 0;
            position: relative;
        }
        
        .divider span {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--card-bg);
            padding: 0 12px;
            color: var(--text-muted);
            font-size: 12px;
        }
        
        .new-persona-form {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        input, select {
            padding: 10px 12px;
            border: 1px solid var(--border);
            border-radius: 8px;
            font-size: 14px;
            transition: border-color 0.2s;
            width: 100%;
            box-sizing: border-box;
        }
        
        input:focus, select:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        
        button.create-btn {
            background: var(--primary);
            color: white;
            border: none;
            padding: 12px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
        }
        
        button.create-btn:hover {
            background: var(--primary-hover);
        }
        
        .github-icon { color: #24292f; }
        .google-icon { color: #ea4335; }
        
    </style>
</head>
<body>
    <div class="container">
        <h1>Development Login</h1>
        <p class="subtitle">Select a persona to simulate authentication</p>
        
        <div class="persona-list">
            {% for persona in personas %}
            <div class="persona-card" onclick="login('{{ persona.id }}')">
                <img src="{{ persona.avatarUrl }}" class="avatar" onerror="this.src='https://ui-avatars.com/api/?name={{ persona.displayName }}'">
                <div class="info">
                    <div class="name">{{ persona.displayName }}</div>
                    <div class="meta">{{ persona.email }}</div>
                </div>
                <span class="provider-badge">{{ persona.provider }}</span>
            </div>
            {% endfor %}
        </div>

        <div class="divider">
            <span>OR CREATE NEW</span>
        </div>

        <form class="new-persona-form" onsubmit="return createPersona(event)">
            <div style="display: flex; gap: 12px;">
                <input type="text" name="username" placeholder="Username" required style="flex: 1;">
                <select name="provider" style="width: 100px;">
                    <option value="github">GitHub</option>
                    <option value="google">Google</option>
                </select>
            </div>
            <input type="email" name="email" placeholder="Email Address" required>
            <input type="text" name="displayName" placeholder="Display Name">
            <button type="submit" class="create-btn">Create & Login</button>
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
            const btn = form.querySelector('button');
            const originalText = btn.innerText;
            btn.disabled = true;
            btn.innerText = 'Creating...';
            
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            // Add defaults
            if (!data.displayName) data.displayName = data.username;
            data.avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.displayName)}&background=random`;
            data.id = (data.provider === 'github' ? 'gh-' : 'gg-') + data.username + '-' + Math.floor(Math.random() * 1000);
            
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
                    btn.disabled = false;
                    btn.innerText = originalText;
                }
            } catch (err) {
                console.error(err);
                alert('Error creating persona');
                btn.disabled = false;
                btn.innerText = originalText;
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
