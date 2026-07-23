"""Compliant MCP server fixture: the scanner should report zero findings."""

from mcp.server import MCPServer

mcp = MCPServer("clean-demo")


@mcp.tool()
def add(a: int, b: int) -> int:
    return a + b


@mcp.tool()
def read_notes(directory: str) -> str:
    # Scope arrives as an explicit tool parameter, not via Roots.
    return f"reading notes from {directory}"
