#!/usr/bin/env python3
"""
Phase 5B Test Runner - test execution only (NO fix logic).

[!] THIS FILE IS A META-CODER TEMPLATE - installed by resourceInstaller into
`${workspace}/.systest/phase5b_test_runner.py` when Phase 5B is prepared.

[!] DO NOT ADD FIX LOGIC TO THIS FILE.

This runner exists because executing 100+ API tests x 10 iterations via
Swagger UI interactively (airlinesys6's original approach) is O(1000) UI
operations - impractical. Batching via HTTP requests is the right call.

However, the airlinesys6 failure mode was that the AI-authored runner also
tried to FIX bugs and the fix_bugs() method was a fake (print statements).
Keeping fix logic out of this runner enforces that fixes go through the
Claude agent's Edit tool, which is the only reliable mechanism.

## Usage

    python phase5b_test_runner.py \\
        --iteration 1 \\
        --output .systest/test-logs/phase5b_iteration_1_results.json

## Inputs

- Reads: .systest/test-logs/test_data_seed.json (produced by Phase 5A)
- Writes: output JSON specified by --output

## Exit codes

- 0: ran successfully (regardless of pass rate)
- 1: fatal - seed missing or backend unreachable
- 2: configuration error (bad args)
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import requests
except ImportError:
    print("ERROR: 'requests' package not installed. Install with: pip install requests", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

WORKSPACE = os.environ.get("SYSTEST_WORKSPACE", os.getcwd())
SEED_FILE = os.environ.get(
    "SYSTEST_SEED_FILE",
    str(Path(WORKSPACE) / ".systest" / "test-logs" / "test_data_seed.json"),
)
BACKEND_URL = os.environ.get("SYSTEST_BACKEND_URL", "http://localhost:8000")
REQUEST_TIMEOUT = float(os.environ.get("SYSTEST_REQUEST_TIMEOUT", "10"))


# ---------------------------------------------------------------------------
# Seed loading
# ---------------------------------------------------------------------------

def load_seed() -> dict[str, Any]:
    path = Path(SEED_FILE)
    if not path.exists():
        print(f"ERROR: seed file not found: {path}", file=sys.stderr)
        sys.exit(1)
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Test execution (NO fix logic)
# ---------------------------------------------------------------------------

def resolve_token(seed: dict[str, Any], auth_role: str | None) -> str | None:
    if not auth_role or auth_role == "none":
        return None
    if auth_role == "admin":
        return (seed.get("auth_admin") or {}).get("token")
    if auth_role == "user":
        return (seed.get("auth") or {}).get("token")
    # Generic per-role token (seed.auth_{role})
    role_auth = seed.get(f"auth_{auth_role}") or {}
    return role_auth.get("token") or (seed.get("auth") or {}).get("token")


def resolve_path(endpoint: str, path_params: dict[str, Any] | None) -> str:
    if not path_params:
        return endpoint
    resolved = endpoint
    for k, v in path_params.items():
        resolved = resolved.replace(f"{{{k}}}", str(v))
    return resolved


# ---------------------------------------------------------------------------
# Request body resolver
#
# Phase 4 emits sentinel-bearing bodies for validation tests, e.g.
# `{"_omit": "email"}` means "send a body that omits the `email` field"
# so the server returns 422. The runner must expand these sentinels into
# real HTTP bodies before POSTing. Without expansion the server receives
# `{"_omit":"email"}` literally, which does NOT exercise the intended
# validation path and makes pass_rate signal meaningless.
# ---------------------------------------------------------------------------

_REF_PATTERN = re.compile(r"^\$\{([^}]+)\}$")


def navigate_seed(seed: dict[str, Any], path: str) -> Any:
    """Navigate seed by dotted path like 'entities.Passenger.records[0].id'."""
    parts = re.split(r"\.|\[|\]", path)
    parts = [p for p in parts if p]
    node: Any = seed
    for p in parts:
        if node is None:
            return None
        if p.isdigit():
            try:
                node = node[int(p)]
            except (IndexError, TypeError, KeyError):
                return None
        else:
            if isinstance(node, dict):
                node = node.get(p)
            else:
                return None
    return node


def resolve_refs(body: dict[str, Any], seed: dict[str, Any]) -> dict[str, Any]:
    """Resolve $-style references like '${entities.Passenger.records[0].id}'."""
    result: dict[str, Any] = {}
    for k, v in body.items():
        if isinstance(v, str):
            m = _REF_PATTERN.match(v)
            if m:
                result[k] = navigate_seed(seed, m.group(1))
            else:
                result[k] = v
        elif isinstance(v, dict):
            result[k] = resolve_refs(v, seed)
        elif isinstance(v, list):
            result[k] = [
                resolve_refs(item, seed) if isinstance(item, dict) else item
                for item in v
            ]
        else:
            result[k] = v
    return result


def get_base_body_for_entity(
    seed: dict[str, Any],
    entity_context: str | None,
) -> dict[str, Any] | None:
    """Get a valid example body for the entity type from seed.entities.

    Returns the first record in seed.entities[entity_context].records, with
    server-assigned fields (id, *_id, created_at, updated_at) stripped so
    the body is suitable for a POST create.
    """
    if not entity_context:
        return None
    entities = seed.get("entities") or {}
    entity_data = entities.get(entity_context) or {}
    records = entity_data.get("records") or []
    if not records:
        return None
    base = records[0]
    if not isinstance(base, dict):
        return None
    exclude = {"id", "created_at", "updated_at"}
    entity_id_key = f"{entity_context.lower()}_id"
    return {
        k: v
        for k, v in base.items()
        if k not in exclude and not k.endswith("_id") and k != entity_id_key
    }


def resolve_request_body(
    seed: dict[str, Any],
    test: dict[str, Any],
) -> Any:
    """Resolve test._requestBody into the actual HTTP body.

    Handles these directive shapes emitted by Phase 4:
    - `{"_omit": "field"}` or `{"_omit": ["a", "b"]}` — validation test
      that should send a body WITHOUT the named field(s). Base body comes
      from seed.entities[_entityContext].records[0].
    - `{"_override": {...}}` — start from entity base and apply overrides.
    - Plain dict — pass through, resolving any `${seed.path}` references.
    - None / missing — return None (no body sent).
    """
    rb = test.get("_requestBody")
    if rb is None:
        rb = test.get("requestBody")
    entity_context = test.get("_entityContext")

    if rb is None:
        return None

    # Case 1: _omit directive
    if isinstance(rb, dict) and "_omit" in rb:
        omit = rb["_omit"]
        omit_fields: set[str]
        if isinstance(omit, str):
            omit_fields = {omit}
        elif isinstance(omit, list):
            omit_fields = {str(x) for x in omit}
        else:
            omit_fields = set()
        base = get_base_body_for_entity(seed, entity_context)
        if base is None:
            # No entity reference — fall back to empty body; server should
            # still return 422 for missing required fields.
            return {}
        return {k: v for k, v in base.items() if k not in omit_fields}

    # Case 2: _override directive
    if isinstance(rb, dict) and "_override" in rb:
        base = get_base_body_for_entity(seed, entity_context) or {}
        override = rb["_override"]
        if not isinstance(override, dict):
            override = {}
        merged = {**base, **override}
        return resolve_refs(merged, seed)

    # Case 3: _baseOverride alias (same semantics as _override)
    if isinstance(rb, dict) and "_baseOverride" in rb:
        base = get_base_body_for_entity(seed, entity_context) or {}
        override = rb["_baseOverride"]
        if not isinstance(override, dict):
            override = {}
        merged = {**base, **override}
        return resolve_refs(merged, seed)

    # Case 4: regular dict — resolve $-references
    if isinstance(rb, dict):
        return resolve_refs(rb, seed)

    # Case 5: non-dict (list, primitive) — pass through unchanged
    return rb


def execute_test(seed: dict[str, Any], test: dict[str, Any]) -> dict[str, Any]:
    test_id = test.get("id") or test.get("Test ID") or "unknown"
    endpoint = test.get("endpoint") or test.get("Endpoint") or ""
    method = (test.get("method") or test.get("Method") or "GET").upper()
    expected_status = int(test.get("expectedStatus") or test.get("Expected") or 200)
    auth_role = test.get("_authRole") or "none"
    path_params = test.get("_pathParams")
    query_params = test.get("_queryParams")

    resolved_body = resolve_request_body(seed, test)

    url = BACKEND_URL.rstrip("/") + resolve_path(endpoint, path_params)

    headers = {"Content-Type": "application/json"}
    token = resolve_token(seed, auth_role)
    if token:
        headers["Authorization"] = f"Bearer {token}"

    started = time.time()
    status_code: int | None = None
    response_text = ""
    response_body_parsed: Any = None
    error: str | None = None

    try:
        resp = requests.request(
            method=method,
            url=url,
            headers=headers,
            json=resolved_body if resolved_body is not None else None,
            params=query_params,
            timeout=REQUEST_TIMEOUT,
        )
        status_code = resp.status_code
        response_text = resp.text[:2048]  # cap to avoid JSON bloat
        try:
            response_body_parsed = resp.json()
        except Exception:
            response_body_parsed = None
    except requests.RequestException as e:
        error = f"{type(e).__name__}: {e}"

    elapsed_ms = int((time.time() - started) * 1000)
    passed = (status_code is not None) and (status_code == expected_status)

    return {
        "id": test_id,
        "endpoint": endpoint,
        "method": method,
        "expectedStatus": expected_status,
        "actualStatus": status_code,
        "pass": passed,
        "elapsedMs": elapsed_ms,
        "authRole": auth_role,
        "error": error,
        "responseBody": response_body_parsed,
        "responseText": response_text if not response_body_parsed else None,
    }


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def run(iteration: int, output_path: str) -> dict[str, Any]:
    seed = load_seed()

    layer1 = seed.get("layer1Tests") or []
    layer2 = seed.get("layer2Tests") or []
    all_tests = list(layer1) + list(layer2)

    if not all_tests:
        print("WARNING: no tests found in seed (layer1Tests / layer2Tests both empty)", file=sys.stderr)

    results: list[dict[str, Any]] = []
    passed_count = 0
    failed_count = 0

    print(f"[phase5b_test_runner] iteration={iteration} tests={len(all_tests)}", flush=True)

    for i, t in enumerate(all_tests, start=1):
        result = execute_test(seed, t)
        results.append(result)
        if result["pass"]:
            passed_count += 1
        else:
            failed_count += 1
        if i % 25 == 0 or i == len(all_tests):
            print(f"  progress: {i}/{len(all_tests)} (passed {passed_count} / failed {failed_count})", flush=True)

    total = len(results)
    pass_rate = round((passed_count / total * 100) if total else 0.0, 2)

    failures = [r for r in results if not r["pass"]]

    summary = {
        "iteration": iteration,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "backendUrl": BACKEND_URL,
        "total": total,
        "passed": passed_count,
        "failed": failed_count,
        "pass_rate": pass_rate,
        "failures": failures,
        "results": results,
        # Intentionally no "bugs_fixed" or "files_edited" - that's the Claude agent's job.
    }

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print(
        f"[phase5b_test_runner] done: {passed_count}/{total} passed "
        f"({pass_rate}%), {failed_count} failures, output={output}",
        flush=True,
    )
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--iteration", type=int, default=1, help="Iteration number (1-based)")
    parser.add_argument("--output", type=str, required=True, help="Path to write failures JSON")
    parser.add_argument("--backend-url", type=str, help="Override SYSTEST_BACKEND_URL")
    parser.add_argument("--seed-file", type=str, help="Override SYSTEST_SEED_FILE")
    args = parser.parse_args()

    if args.backend_url:
        global BACKEND_URL
        BACKEND_URL = args.backend_url
    if args.seed_file:
        global SEED_FILE
        SEED_FILE = args.seed_file

    try:
        run(iteration=args.iteration, output_path=args.output)
    except SystemExit:
        raise
    except Exception as e:
        print(f"FATAL: {type(e).__name__}: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1
    return 0


# ---------------------------------------------------------------------------
# [!] DO NOT ADD CODE BELOW THIS LINE OTHER THAN `if __name__ == "__main__"`.
#
# In particular, DO NOT ADD:
#   - fix_bugs() / apply_fix() / repair_code() / auto_fix() / ...
#   - anything that reads source files and writes them back
#   - anything that "categorizes failures" into fixable buckets
#   - bug_fix_log lists
#   - edited_files tracking
#
# The AI running this runner must fix bugs via the Edit tool in its
# outer session, never by expanding this script. The airlinesys6 failure
# mode was "script pretends to fix" - we prevent that by keeping the
# runner test-only.
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    sys.exit(main())
