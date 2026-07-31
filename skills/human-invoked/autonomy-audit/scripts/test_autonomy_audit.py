"""Unit tests for autonomy_audit.py against the fixture configs.

Run from this directory:  python3 -m unittest test_autonomy_audit -v
"""

import io
import json
import os
import tempfile
import unittest
from contextlib import redirect_stderr

import autonomy_audit as aa

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURE_PROJECT = os.path.join(HERE, "fixtures", "project")


def load_fixture_settings():
    with open(os.path.join(FIXTURE_PROJECT, ".claude", "settings.json"),
              encoding="utf-8") as f:
        return json.load(f)


class TestHookDiscovery(unittest.TestCase):
    def test_hook_is_auto_expensive_and_gets_matcher_suggestion(self):
        hooks = aa.discover_hooks(load_fixture_settings(), "settings.json")
        self.assertEqual(len(hooks), 2)
        npm = next(h for h in hooks if "npm test" in h["name"])
        self.assertEqual(npm["kind"], "hook")
        self.assertEqual(npm["trigger"], "auto")
        self.assertEqual(npm["spend"], "high")
        self.assertEqual(npm["recommendation"], "manual")
        self.assertIsNotNone(npm["suggestion"])
        self.assertEqual(npm["suggestion"]["type"], "narrow-hook-matcher")
        self.assertIn('"matcher": "*"', npm["suggestion"]["diff"])

    def test_cheap_local_hook_may_stay_auto(self):
        hooks = aa.discover_hooks(load_fixture_settings(), "settings.json")
        echo = next(h for h in hooks if "echo" in h["name"])
        self.assertEqual(echo["spend"], "low")
        self.assertEqual(echo["blast_radius"], "low")
        self.assertEqual(echo["recommendation"], "auto ok")


class TestSkillClassification(unittest.TestCase):
    def setUp(self):
        skills_dir = os.path.join(FIXTURE_PROJECT, ".claude", "skills")
        self.skills = {s["name"]: s
                       for s in aa.discover_skills(skills_dir, "project")}

    def test_auto_trigger_description_is_flagged_auto(self):
        leak = self.skills["skill: auto-leak"]
        self.assertEqual(leak["trigger"], "auto")
        # "applies fixes" + repo-wide linter run: not cheap, not reversible
        self.assertNotEqual(leak["recommendation"], "auto ok")
        self.assertIsNotNone(leak["suggestion"])
        self.assertIn("disable-model-invocation: true",
                      leak["suggestion"]["diff"])

    def test_gated_skill_is_manual_with_no_suggestion(self):
        gated = self.skills["skill: gated"]
        self.assertEqual(gated["trigger"], "manual")
        self.assertIsNone(gated["suggestion"])

    def test_mixed_description_is_ambiguous(self):
        trigger = aa.classify_description(
            "Use when the user asks to audit a server, or mentions "
            "migrating off Roots.", disable_model_invocation=False)
        self.assertEqual(trigger, "ambiguous")


class TestMcpDiscovery(unittest.TestCase):
    def test_remote_server_is_high_blast_and_manual(self):
        with open(os.path.join(FIXTURE_PROJECT, ".mcp.json"),
                  encoding="utf-8") as f:
            cfg = json.load(f)["mcpServers"]
        servers = {s["name"]: s for s in aa.discover_mcp(cfg, ".mcp.json")}
        remote = servers["MCP server: prod-db"]
        self.assertEqual(remote["trigger"], "auto")
        self.assertEqual(remote["blast_radius"], "high")
        self.assertEqual(remote["recommendation"], "manual")
        local = servers["MCP server: local-notes"]
        self.assertEqual(local["blast_radius"], "med")


class TestEndToEnd(unittest.TestCase):
    def test_audit_of_fixture_project_without_user_scope(self):
        result = aa.audit(FIXTURE_PROJECT, user_scope=None, claude_json=None)
        kinds = {b["kind"] for b in result["behaviours"]}
        self.assertLessEqual(
            {"hook", "skill", "mcp-server", "permission-allow",
             "permission-deny", "instruction", "guardrail"}, kinds)
        # "Always run npm run lint" is auto + high spend -> manual
        instr = next(b for b in result["behaviours"]
                     if b["kind"] == "instruction")
        self.assertEqual(instr["trigger"], "auto")
        self.assertEqual(instr["recommendation"], "manual")
        # "Never commit directly to main" is a guardrail -> keep
        guard = next(b for b in result["behaviours"]
                     if b["kind"] == "guardrail")
        self.assertEqual(guard["recommendation"], "keep")
        report = aa.render_markdown(result)
        self.assertIn("## Inventory", report)
        self.assertIn("## Suggested changes", report)
        self.assertIn("```diff", report)

    def test_nonexistent_project_path_fails_without_writing_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, "autonomy-audit.md")
            with redirect_stderr(io.StringIO()) as stderr:
                code = aa.main(["/nonexistent/path/to/repo", "--out", out])
            self.assertEqual(code, 2)
            self.assertIn("not a directory", stderr.getvalue())
            self.assertFalse(os.path.exists(out))


if __name__ == "__main__":
    unittest.main()
