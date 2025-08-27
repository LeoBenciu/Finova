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


def get_backend_tools() -> List[BaseTool]:
    """Return available backend tools based on env. Empty if missing config."""
    base = _pick_backend_base()
    headers = _auth_headers()
    if not base or "Authorization" not in headers:
        return []
    return [CompanyFinancialInfoTool()]
