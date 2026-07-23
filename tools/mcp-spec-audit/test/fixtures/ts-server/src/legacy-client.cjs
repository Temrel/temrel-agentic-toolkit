/* CommonJS client fixture: SDK v2 is ESM-only, so this require must be flagged. */
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");

async function listAvailableTools(client) {
  return client.listTools({});
}

module.exports = { Client, listAvailableTools };
