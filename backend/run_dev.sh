#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ -x ".venv/bin/python" ]]; then
  PY=".venv/bin/python"
elif [[ -x "venv/bin/python" ]]; then
  PY="venv/bin/python"
else
  PY="${PYTHON:-python3}"
fi

exec "$PY" -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload \
  --reload-exclude "venv/*" \
  --reload-exclude ".venv/*" \
  --reload-exclude "*/site-packages/*" \
  --reload-exclude "data/results/*"
