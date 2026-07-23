/* Compliant MCP server fixture: the scanner should report zero findings. */
import { MCPServer } from "@modelcontextprotocol/server";

const server = new MCPServer({ name: "clean-demo", version: "0.1.0" });

server.tool("add", { a: "number", b: "number" }, async ({ a, b }) => a + b);

export { server };
