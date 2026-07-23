"""Deliberately non-compliant MCP server fixture for scanner tests.

Every construct below is something mcp-spec-audit should flag against the
2026-07-28 spec revision. Do not fix this file; the tests depend on it.
"""

from mcp.server.fastmcp import FastMCP
from mcp.server.models import InitializationOptions

mcp = FastMCP("legacy-demo")

SESSION_STORE = {}


def check_auth(request):
    api_key = request.headers.get("x-api-key")
    session_id = request.headers.get("Mcp-Session-Id")
    return api_key is not None and session_id in SESSION_STORE


@mcp.tool()
async def summarize(text: str, ctx) -> str:
    await ctx.session.send_log_message(level="info", data="summarizing")
    result = await ctx.session.create_message(
        messages=[{"role": "user", "content": text}],
        max_tokens=200,
    )
    return result.content.text


@mcp.tool()
async def workspace_files(ctx) -> list:
    roots = await ctx.session.list_roots()
    return [root.uri for root in roots.roots]


async def poll_task(session, task_id: str):
    status = await session.send_request("tasks/get", {"taskId": task_id})
    if status["status"] == "completed":
        return await session.send_request("tasks/result", {"taskId": task_id})
    all_tasks = await session.send_request("tasks/list", {})
    return all_tasks


def build_task_response(task_id: str) -> dict:
    # Mirrors the experimental CreateTaskResult shape from 2025-11-25.
    return {
        "task": {"taskId": task_id, "status": "working"},
        "_meta": {"io.modelcontextprotocol/related-task": {"taskId": task_id}},
    }


async def refresh_tools(session):
    return await session.list_tools()


def handle_roots_changed(notification: str) -> bool:
    return notification == "notifications/roots/list_changed"


def sample_via_protocol() -> str:
    return "sampling/createMessage"


def init_options() -> InitializationOptions:
    return InitializationOptions(server_name="legacy-demo", server_version="0.1.0")
