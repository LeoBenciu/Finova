from typing import Optional, Dict, Any, List
import urllib.parse
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


class UsersSearchInput(BaseModel):
    """Inputs for searching company users to resolve assignees."""
    query: Optional[str] = Field(default=None, description="Partial name or email to search for")
    limit: Optional[int] = Field(default=10, description="Max number of results to return")


class UsersSearchTool(BaseTool):
    name: str = "search_users"
    description: str = (
        "Search company users by name/email to resolve assignees. Returns closest matches."
    )
    args_schema: type[UsersSearchInput] = UsersSearchInput

    def _run(self, query: Optional[str] = None, limit: Optional[int] = 10) -> str:
        base = _pick_backend_base()
        headers = _auth_headers()
        if not base:
            return "Backend base URL not configured. Set BACKEND_API_URL or BANK_BACKEND_URL."
        if "Authorization" not in headers:
            return "No backend JWT available. Set BACKEND_JWT in environment."

        try:
            url = f"{base}/users/company"
            r = requests.get(url, headers=headers, timeout=15)
            r.raise_for_status()
            data = r.json()
            if not isinstance(data, list):
                return "Unexpected users payload from backend."

            users: List[Dict[str, Any]] = [
                {"id": u.get("id"), "name": u.get("name"), "email": u.get("email")}
                for u in data
            ]

            if not query:
                return json.dumps({"items": users[: (limit or 10)]}, ensure_ascii=False)

            # Fuzzy match locally (name/email)
            def norm(s: Optional[str]) -> str:
                return (s or "").strip().lower()

            q = norm(query)

            def levenshtein(a: str, b: str) -> int:
                m, n = len(a), len(b)
                if m == 0:
                    return n
                if n == 0:
                    return m
                dp = [[0] * (n + 1) for _ in range(m + 1)]
                for i in range(m + 1):
                    dp[i][0] = i
                for j in range(n + 1):
                    dp[0][j] = j
                for i in range(1, m + 1):
                    ca = a[i - 1]
                    for j in range(1, n + 1):
                        cost = 0 if ca == b[j - 1] else 1
                        dp[i][j] = min(
                            dp[i - 1][j] + 1,
                            dp[i][j - 1] + 1,
                            dp[i - 1][j - 1] + cost,
                        )
                return dp[m][n]

            scored: List[Dict[str, Any]] = []
            for u in users:
                n = norm(u.get("name"))
                e = norm(u.get("email"))
                # scores for name
                ns = (0 if n.startswith(q) else 1) * 100 + (0 if q in n else 1) * 10 + levenshtein(n, q)
                # scores for email
                es = (0 if e.startswith(q) else 1) * 100 + (0 if q in e else 1) * 10 + levenshtein(e, q)
                score = min(ns, es)
                scored.append({**u, "score": score})

            scored.sort(key=lambda x: x["score"])  # lower is better
            top = scored[: (limit or 10)]
            return json.dumps({"items": top}, ensure_ascii=False)
        except requests.exceptions.RequestException:
            return "Backend temporarily unavailable or network error."
        except Exception as e:
            return f"Error searching users: {str(e)}"


class CreateTodoInput(BaseModel):
    """Inputs for creating a new Todo task for the current client."""
    title: str = Field(..., description="Short title for the task")
    description: Optional[str] = Field(default=None, description="Detailed description")
    status: Optional[str] = Field(default=None, description="pending|in_progress|completed (optional)")
    priority: Optional[str] = Field(default=None, description="low|medium|high (optional)")
    dueDate: Optional[str] = Field(default=None, description="ISO date string YYYY-MM-DD (optional)")
    tags: Optional[List[str]] = Field(default=None, description="List of tags (optional)")
    assigneeIds: Optional[List[int]] = Field(default=None, description="List of user IDs to assign (optional)")
    assigneeNames: Optional[List[str]] = Field(default=None, description="List of user names to assign (optional)")
    assigneeEmails: Optional[List[str]] = Field(default=None, description="List of user emails to assign (optional)")
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
        assigneeNames: Optional[List[str]] = None,
        assigneeEmails: Optional[List[str]] = None,
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
        # Propagate language preference explicitly if available
        lang = os.getenv("AGENT_LANG") or os.getenv("LANGUAGE") or os.getenv("APP_LANG") or os.getenv("BACKEND_LANGUAGE")
        if lang:
            payload["language"] = lang
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
        if assigneeNames is not None:
            payload["assigneeNames"] = assigneeNames
        if assigneeEmails is not None:
            payload["assigneeEmails"] = assigneeEmails
        if relatedDocumentId is not None:
            payload["relatedDocumentId"] = relatedDocumentId
        if relatedTransactionId is not None:
            payload["relatedTransactionId"] = relatedTransactionId

        try:
            url = f"{base}/todos/{ein}"
            r = requests.post(url, headers=headers, json=payload, timeout=20)
            # If backend returns non-2xx, raise and surface details
            try:
                r.raise_for_status()
            except requests.exceptions.HTTPError as he:
                # Include backend response text for easier debugging
                detail = r.text
                return f"Failed to create todo (HTTP {r.status_code}): {detail or str(he)}"

            # Parse response and ensure it contains an ID
            try:
                data = r.json()
            except Exception:
                data = None

            if isinstance(data, dict) and data.get("id"):
                return json.dumps({"success": True, "item": data}, ensure_ascii=False)

            # Fallback verification: search recent todos by title to confirm creation
            try:
                q = urllib.parse.quote(title)
                list_url = f"{base}/todos/{ein}?q={q}&size=5"
                lr = requests.get(list_url, headers=headers, timeout=15)
                if lr.ok:
                    listing = lr.json() if lr.content else {}
                    items = (listing or {}).get("items") or []
                    # Try to find an exact title match (optionally description if provided)
                    match = None
                    for it in items:
                        if it.get("title") == title:
                            if description is None or it.get("description") == description:
                                match = it
                                break
                    if match and match.get("id"):
                        return json.dumps({"success": True, "item": match, "note": "verified via list fallback"}, ensure_ascii=False)
            except Exception:
                # Ignore fallback errors, proceed to final failure
                pass

            return json.dumps({
                "success": False,
                "error": "Create may have failed: backend did not return an ID and verification couldn't confirm the item.",
                "request": payload,
            }, ensure_ascii=False)
        except requests.exceptions.RequestException as e:
            return f"Failed to create todo: {str(e)}"
        except Exception as e:
            return f"Error creating todo: {str(e)}"


class SearchDocumentsInput(BaseModel):
    """Inputs for searching documents via the Finova backend /files/search endpoint."""
    company: str = Field(..., description="Company EIN or name to search in")
    q: Optional[str] = Field(default=None, description="Free text query (e.g., invoice number)")
    type: Optional[str] = Field(default=None, description="Document type filter (e.g., Invoice, Receipt)")
    paymentStatus: Optional[str] = Field(default=None, description="Payment status filter")
    dateFrom: Optional[str] = Field(default=None, description="Start date YYYY-MM-DD")
    dateTo: Optional[str] = Field(default=None, description="End date YYYY-MM-DD")
    page: Optional[int] = Field(default=1, description="Page number (1-based)")
    limit: Optional[int] = Field(default=25, description="Page size")
    sort: Optional[str] = Field(default="createdAt_desc", description="Sort key, e.g., createdAt_desc")


class SendEmailInput(BaseModel):
    """Inputs for sending emails via the Finova backend /mailer/send endpoint."""
    to: str = Field(..., description="Recipient email address(es) - comma separated for multiple")
    subject: str = Field(..., description="Email subject line")
    text: Optional[str] = Field(default=None, description="Plain text email content")
    html: Optional[str] = Field(default=None, description="HTML email content")
    cc: Optional[str] = Field(default=None, description="CC recipient(s) - comma separated for multiple")
    bcc: Optional[str] = Field(default=None, description="BCC recipient(s) - comma separated for multiple")
    client_ein: Optional[str] = Field(default=None, description="Client EIN; if not provided, reads CLIENT_EIN from env")


class SearchDocumentsTool(BaseTool):
    name: str = "search_documents"
    description: str = (
        "Search company documents by company name/EIN, text, type, dates, and payment status. "
        "Returns items with signedUrl for direct PDF rendering."
    )
    args_schema: type[SearchDocumentsInput] = SearchDocumentsInput

    def _run(
        self,
        company: str,
        q: Optional[str] = None,
        type: Optional[str] = None,
        paymentStatus: Optional[str] = None,
        dateFrom: Optional[str] = None,
        dateTo: Optional[str] = None,
        page: Optional[int] = 1,
        limit: Optional[int] = 25,
        sort: Optional[str] = "createdAt_desc",
    ) -> str:
        base = _pick_backend_base()
        headers = _auth_headers()
        if not base:
            return "Backend base URL not configured. Set BACKEND_API_URL or BANK_BACKEND_URL."
        if "Authorization" not in headers:
            return "No backend JWT available. Set BACKEND_JWT in environment."

        try:
            params = {
                "company": company,
                "page": str(page or 1),
                "limit": str(limit or 25),
                "sort": sort or "createdAt_desc",
            }
            if q:
                params["q"] = q
            if type:
                params["type"] = type
            if paymentStatus:
                params["paymentStatus"] = paymentStatus
            if dateFrom:
                params["dateFrom"] = dateFrom
            if dateTo:
                params["dateTo"] = dateTo

            url = f"{base}/files/search?" + urllib.parse.urlencode(params)
            r = requests.get(url, headers=headers, timeout=20)
            r.raise_for_status()
            data = r.json()
            # Normalize minimal structure for the agent
            items = (data or {}).get("items") or (data or {}).get("documents") or []
            total = (data or {}).get("totalCount") or (data or {}).get("total") or len(items)
            return json.dumps({
                "items": items,
                "total": total,
                "accountingCompany": (data or {}).get("accountingCompany"),
                "clientCompany": (data or {}).get("clientCompany"),
            }, ensure_ascii=False)
        except requests.exceptions.RequestException:
            return "Backend temporarily unavailable or network error."
        except Exception as e:
            return f"Error searching documents: {str(e)}"


class SendEmailTool(BaseTool):
    name: str = "send_email"
    description: str = (
        "Send emails via the Finova backend mailer service. "
        "Provide recipient(s), subject, and either text or HTML content. "
        "Supports CC and BCC recipients."
    )
    args_schema: type[SendEmailInput] = SendEmailInput

    def _run(
        self,
        to: str,
        subject: str,
        text: Optional[str] = None,
        html: Optional[str] = None,
        cc: Optional[str] = None,
        bcc: Optional[str] = None,
        client_ein: Optional[str] = None,
    ) -> str:
        base = _pick_backend_base()
        headers = _auth_headers()
        ein = client_ein or os.getenv("CLIENT_EIN")

        if not base:
            return "Backend base URL not configured. Set BACKEND_API_URL or BANK_BACKEND_URL."
        if "Authorization" not in headers:
            return "No backend JWT available. Set BACKEND_JWT in environment."

        # Validate required fields
        if not to or not subject:
            return "Error: 'to' and 'subject' are required fields."
        
        if not text and not html:
            return "Error: Either 'text' or 'html' content must be provided. Please provide the email content."

        try:
            # Prepare email payload
            payload = {
                "to": to,
                "subject": subject,
            }
            
            if text:
                payload["text"] = text
            if html:
                payload["html"] = html
            if cc:
                payload["cc"] = cc
            if bcc:
                payload["bcc"] = bcc

            print(f"DEBUG: Sending email payload: {payload}", file=sys.stderr)
            url = f"{base}/mailer/send"
            r = requests.post(url, headers=headers, json=payload, timeout=30)
            r.raise_for_status()
            
            response_data = r.json()
            print(f"DEBUG: Backend response: {response_data}", file=sys.stderr)
            
            if response_data.get("success"):
                return json.dumps({
                    "success": True,
                    "message": "Email sent successfully",
                    "timestamp": response_data.get("timestamp"),
                    "recipients": to,
                    "subject": subject
                }, ensure_ascii=False)
            else:
                error_msg = response_data.get("error", "Unknown error occurred")
                print(f"DEBUG: Backend returned error: {error_msg}", file=sys.stderr)
                return json.dumps({
                    "success": False,
                    "error": error_msg,
                    "timestamp": response_data.get("timestamp")
                }, ensure_ascii=False)

        except requests.exceptions.RequestException as e:
            return f"Failed to send email: {str(e)}"
        except Exception as e:
            return f"Error sending email: {str(e)}"


def get_backend_tools() -> List[BaseTool]:
    """Return available backend tools based on env. Empty if missing config."""
    base = _pick_backend_base()
    headers = _auth_headers()
    if not base or "Authorization" not in headers:
        return []
    return [CompanyFinancialInfoTool(), UsersSearchTool(), CreateTodoTool(), SearchDocumentsTool(), SendEmailTool()]
