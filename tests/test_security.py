import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


TEST_DB_PATH = Path("test_security.db")


def setup_module(module):
    # Ensure we don't touch the real database
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()
    os.environ["SECRET_KEY"] = "test-secret-key"
    os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
    os.environ["ENABLE_AI_ANALYSIS"] = "false"


def teardown_module(module):
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()


@pytest.fixture(scope="module")
def client():
    import main  # Import after env vars are set

    return TestClient(main.app)


def auth_header(token: str):
    return {"Authorization": f"Bearer {token}"}


def login(client: TestClient, email: str, password: str):
    resp = client.post("/auth/login", json={"username": email, "password": password})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    return data["access_token"]


def test_registration_password_policy(client: TestClient):
    resp = client.post(
        "/auth/register",
        json={
            "name": "Weak User",
            "email": "weak@example.com",
            "password": "weak",
            "companyTitle": "Tester",
        },
    )
    assert resp.status_code == 400


def test_employee_cannot_update_foreign_request(client: TestClient):
    # Submit registration with strong password
    resp = client.post(
        "/auth/register",
        json={
            "name": "Alice Employee",
            "email": "alice@example.com",
            "password": "StrongPass1",
            "companyTitle": "Engineer",
        },
    )
    assert resp.status_code == 201
    reg_id = resp.json()["id"]

    # Login as demo developer and approve
    demo_token = login(client, "demo@automationhub.local", "demo1234")
    approve = client.post(
        f"/registration-requests/{reg_id}/approve",
        headers=auth_header(demo_token),
    )
    assert approve.status_code == 200
    employee = approve.json()

    # Login as employee
    employee_token = login(client, employee["email"], "StrongPass1")

    # Developer creates a request
    me_resp = client.get("/users/me", headers=auth_header(demo_token))
    demo_user = me_resp.json()
    request_payload = {
        "title": "Dev Task",
        "description": "Secure task",
        "priority": "HIGH",
        "projectName": "Security",
        "revitVersion": "2025",
        "requesterId": demo_user["id"],
        "requesterName": demo_user["name"],
        "attachments": [],
    }
    req_resp = client.post("/requests", json=request_payload, headers=auth_header(demo_token))
    assert req_resp.status_code == 201, req_resp.text
    request_id = req_resp.json()["id"]

    # Employee cannot update someone else's request
    update_resp = client.put(
        f"/requests/{request_id}",
        json={"description": "Attempted change"},
        headers=auth_header(employee_token),
    )
    assert update_resp.status_code == 403
