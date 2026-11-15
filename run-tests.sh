#!/usr/bin/env bash
# Runs every automated check with one command:  ./run-tests.sh
#
# 1. Backend: compiles (type checks) and runs all unit, API, database
#    integration and performance tests. The database integration tests
#    start a throwaway PostgreSQL, so Docker must be running. They are
#    skipped, not failed, if Docker is not available.
# 2. Frontend: lints (static analysis) and runs all unit tests.
#
# Needs Java 21, Maven and Node 22. Stops at the first failure.
set -euo pipefail
cd "$(dirname "$0")"

echo "== Backend: mvn verify =="
(cd backend && mvn -B verify)

echo "== Frontend: lint =="
(cd frontend && npm ci && npm run lint)

echo "== Frontend: tests =="
(cd frontend && npm test)

echo "All checks passed."
