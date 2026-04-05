# tmesh — task runner
# Usage: just <recipe>

# Default: show available recipes
default:
    @just --list

# Run unit tests
test:
    bun test src/

# Run acceptance/QA tests (real tmux sessions)
qa:
    bun test test/qa/acceptance.test.ts

# Run all tests (unit + acceptance)
test-all: test qa

# Build JS bundle
build:
    bun build src/cli/index.ts --outdir dist --target bun

# Build standalone binary
binary:
    bun build src/cli/index.ts --compile --outfile dist/tmesh

# Run the CLI
run *ARGS:
    bun run src/cli/index.ts {{ARGS}}

# Show mesh status
status:
    @echo "=== Who's on the mesh ==="
    @bun run src/cli/index.ts who 2>/dev/null || echo "(no identified nodes)"
    @echo ""
    @echo "=== Topology ==="
    @bun run src/cli/index.ts topology 2>/dev/null || echo "(run: tmesh identify <name>)"

# Visual dashboard
viz:
    bun run src/cli/index.ts viz

# Install tmux auto-registration hooks
hooks-install:
    bun run src/cli/index.ts hooks install

# Uninstall tmux hooks
hooks-uninstall:
    bun run src/cli/index.ts hooks uninstall

# Clean build artifacts and test state
clean:
    rm -rf dist/
    rm -rf /tmp/tmesh-qa-*
