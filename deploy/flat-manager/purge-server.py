#!/usr/bin/env python3
"""Tiny HTTP server for purging OSTree refs when an app is deleted.

Listens on port 8081 alongside flat-manager (8080). Authenticated
via the same FLAT_MANAGER_SECRET used for JWT signing.

Endpoints:
  POST /purge  {"app_id": "com.example.App"}
    Deletes all OSTree refs matching app/{app_id}/* and
    regenerates the repo summary file.
"""

import http.server
import json
import os
import subprocess
import sys

DATA_DIR = os.environ.get("DATA_DIR", "/var/data/flatmanager")
REPO_PATH = os.path.join(DATA_DIR, "repo")
PURGE_SECRET = os.environ.get("PURGE_TOKEN", os.environ.get("FLAT_MANAGER_SECRET", ""))
GPG_HOMEDIR = os.path.join(DATA_DIR, "gpg")


def delete_refs(app_id: str) -> list[str]:
    """Delete all OSTree refs for the given app_id. Returns deleted ref names."""
    result = subprocess.run(
        ["ostree", "refs", "--repo", REPO_PATH],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ostree refs failed: {result.stderr}")

    deleted = []
    for ref in result.stdout.strip().split("\n"):
        ref = ref.strip()
        if not ref:
            continue
        # Match refs like app/com.example.App/x86_64/stable
        if ref.startswith(f"app/{app_id}/") or ref == f"app/{app_id}":
            dr = subprocess.run(
                ["ostree", "refs", "--repo", REPO_PATH, "--delete", ref],
                capture_output=True, text=True,
            )
            if dr.returncode == 0:
                deleted.append(ref)
            else:
                print(f"Failed to delete ref {ref}: {dr.stderr}", file=sys.stderr)

    return deleted


def update_summary():
    """Regenerate the OSTree repo summary (legacy + indexed) with GPG signing."""
    cmd = ["flatpak", "build-update-repo", "--no-update-appstream", REPO_PATH]
    if os.path.isdir(GPG_HOMEDIR):
        result = subprocess.run(
            ["gpg", "--homedir", GPG_HOMEDIR, "--list-keys", "--keyid-format", "long", "--with-colons"],
            capture_output=True, text=True,
        )
        for line in result.stdout.split("\n"):
            if line.startswith("pub"):
                key_id = line.split(":")[4]
                cmd.extend([f"--gpg-homedir={GPG_HOMEDIR}", f"--gpg-sign={key_id}"])
                break

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"flatpak build-update-repo failed: {result.stderr}")


class PurgeHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path not in ("/purge", "/update-summary"):
            self.send_error(404)
            return

        # Check auth
        auth = self.headers.get("Authorization", "")
        if not PURGE_SECRET or auth != f"Bearer {PURGE_SECRET}":
            self.send_error(403, "Forbidden")
            return

        if self.path == "/update-summary":
            try:
                update_summary()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"summary_updated": True}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return

        # Read body
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
        except (json.JSONDecodeError, ValueError):
            self.send_error(400, "Invalid JSON")
            return

        app_id = data.get("app_id", "").strip()
        if not app_id:
            self.send_error(400, "app_id required")
            return

        # Basic validation: must look like a reverse-DNS id
        if "/" in app_id or ".." in app_id:
            self.send_error(400, "Invalid app_id")
            return

        try:
            deleted = delete_refs(app_id)
            if deleted:
                update_summary()
            response = {"deleted_refs": deleted, "summary_updated": len(deleted) > 0}
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def log_message(self, fmt, *args):
        print(f"[purge-server] {fmt % args}", file=sys.stderr)


if __name__ == "__main__":
    server = http.server.HTTPServer(("0.0.0.0", 8081), PurgeHandler)
    print("[purge-server] Listening on port 8081", file=sys.stderr)
    server.serve_forever()
