from typing import Optional, Dict, Any, List
import os
import requests
import json
from crewai.tools import BaseTool
from pydantic import BaseModel, Field


DEFAULT_BACKEND_URLS = [
    os.getenv("BACKEND_API_URL"),
    os.getenv("BANK_BACKEND_URL"),
    "http://localhost:3001",
    "http://localhost:3000",
]


def _pick_backend_base() -> Optional[str]:
    for u in DEFAULT_BACKEND_URLS:
        if u:
            return u.rstrip("/")
    return None


def _auth_headers() -> Dict[str, str]:
    token = os.getenv("BACKEND_JWT") or os.getenv("BANK_API_TOKEN")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


class FinancialInfoInput(BaseModel):
    """Inputs for fetching company financial information."""
    topic: str = Field(
        ..., description="Topic to fetch, e.g., 'summary', 'accounts', 'outstanding', 'balance', 'audit'"
    )
    client_ein: Optional[str] = Field(
        default=None, description="Client EIN; if not provided, reads CLIENT_EIN from env"
    )


class CompanyFinancialInfoTool(BaseTool):
    name: str = "company_financial_info"
    description: str = (
        "Fetch company financial info for the current client (EIN) from the Finova backend. "
        "Supports topics: summary, accounts, outstanding, balance, audit."
    )
    # Pydantic v2 requires annotated override for class attributes inherited from BaseModel-based parents
    args_schema: type[FinancialInfoInput] = FinancialInfoInput

    def _run(self, topic: str, client_ein: Optional[str] = None) -> str:
        base = _pick_backend_base()
        headers = _auth_headers()
        ein = client_ein or os.getenv("CLIENT_EIN")

        if not ein:
            return "No client EIN available. Provide client_ein or set CLIENT_EIN in environment."
        if not base:
            return "Backend base URL not configured. Set BACKEND_API_URL or BANK_BACKEND_URL."
        if "Authorization" not in headers:
            return "No backend JWT available. Set BACKEND_JWT in environment."

        try:
            if topic.lower() == "accounts":
                url = f"{base}/bank/{ein}/accounts"
                r = requests.get(url, headers=headers, timeout=15)
                r.raise_for_status()
                data = r.json()
                return json.dumps({"accounts": data}, ensure_ascii=False)

            if topic.lower() == "summary":
                url = f"{base}/bank/{ein}/reports/summary"
                r = requests.get(url, headers=headers, timeout=20)
                r.raise_for_status()
                return json.dumps(r.json(), ensure_ascii=False)

            if topic.lower() == "outstanding":
                url = f"{base}/bank/{ein}/reports/outstanding-items"
                r = requests.get(url, headers=headers, timeout=20)
                r.raise_for_status()
                return json.dumps(r.json(), ensure_ascii=False)

            if topic.lower() == "balance":
                # Example: current month by default; backend may infer defaults if not provided
                url = f"{base}/bank/{ein}/balance-reconciliation"
                r = requests.get(url, headers=headers, timeout=20)
                r.raise_for_status()
                return json.dumps(r.json(), ensure_ascii=False)

            if topic.lower() == "audit":
                url = f"{base}/bank/{ein}/reports/audit-trail?page=1&size=20"
                r = requests.get(url, headers=headers, timeout=20)
                r.raise_for_status()
                return json.dumps(r.json(), ensure_ascii=False)

            return (
                "Unknown topic. Use one of: summary, accounts, outstanding, balance, audit."
            )
        except requests.exceptions.RequestException:
            return "Backend temporarily unavailable or network error."
        except Exception as e:
            return f"Error fetching financial info: {str(e)}"


class CreateTodoInput(BaseModel):
    """Inputs for creating a new Todo task for the current client."""
    title: str = Field(..., description="Short title for the task")
    description: Optional[str] = Field(default=None, description="Detailed description")
    status: Optional[str] = Field(default=None, description="pending|in_progress|completed (optional)")
    priority: Optional[str] = Field(default=None, description="low|medium|high (optional)")
    dueDate: Optional[str] = Field(default=None, description="ISO date string YYYY-MM-DD (optional)")
    tags: Optional[List[str]] = Field(default=None, description="List of tags (optional)")
    assigneeIds: Optional[List[int]] = Field(default=None, description="List of user IDs to assign (optional)")
    relatedDocumentId: Optional[int] = Field(default=None, description="Related document ID (optional)")
    relatedTransactionId: Optional[str] = Field(default=None, description="Related bank transaction ID (optional)")
    client_ein: Optional[str] = Field(default=None, description="Client EIN; if not provided, reads CLIENT_EIN from env")


class CreateTodoTool(BaseTool):
    name: str = "create_todo"
    description: str = (
        "Create a new Todo task for the current client (EIN). Provide at minimum a title. "
        "Optional: description, dueDate (YYYY-MM-DD), priority (low|medium|high), status, tags, assigneeIds."
    )
    args_schema: type[CreateTodoInput] = CreateTodoInput

    def _run(
        self,
        title: str,
        description: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        dueDate: Optional[str] = None,
        tags: Optional[List[str]] = None,
        assigneeIds: Optional[List[int]] = None,
        relatedDocumentId: Optional[int] = None,
        relatedTransactionId: Optional[str] = None,
        client_ein: Optional[str] = None,
    ) -> str:
        base = _pick_backend_base()
        headers = _auth_headers()
        ein = client_ein or os.getenv("CLIENT_EIN")

        if not ein:
            return "No client EIN available. Provide client_ein or set CLIENT_EIN in environment."
        if not base:
            return "Backend base URL not configured. Set BACKEND_API_URL or BANK_BACKEND_URL."
        if "Authorization" not in headers:
            return "No backend JWT available. Set BACKEND_JWT in environment."

        payload: Dict[str, Any] = {"title": title}
        if description is not None:
            payload["description"] = description
        if status is not None:
            payload["status"] = status
        if priority is not None:
            payload["priority"] = priority
        if dueDate is not None:
            payload["dueDate"] = dueDate
        if tags is not None:
            payload["tags"] = tags
        if assigneeIds is not None:
            payload["assigneeIds"] = assigneeIds
        if relatedDocumentId is not None:
            payload["relatedDocumentId"] = relatedDocumentId
        if relatedTransactionId is not None:
            payload["relatedTransactionId"] = relatedTransactionId

        try:
            url = f"{base}/todos/{ein}"
            r = requests.post(url, headers=headers, json=payload, timeout=20)
            r.raise_for_status()
            return json.dumps(r.json(), ensure_ascii=False)
        except requests.exceptions.RequestException as e:
            return f"Failed to create todo: {str(e)}"
        except Exception as e:
            return f"Error creating todo: {str(e)}"


def get_backend_tools() -> List[BaseTool]:
    """Return available backend tools based on env. Empty if missing config."""
    base = _pick_backend_base()
    headers = _auth_headers()
    if not base or "Authorization" not in headers:
        return []
    return [CompanyFinancialInfoTool(), CreateTodoTool()]
