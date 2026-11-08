# Python environment and commands

Run commands from the project root containing `pyproject.toml`. This is a non-package uv project: source files run directly, without a wheel build/editable install. Commands below are separate shell invocations; no environment activation is needed.

## First setup or fresh checkout

1. Check for an existing uv installation:

   ```sh
   uv --version
   ```

   If missing, follow the [official installation instructions](https://docs.astral.sh/uv/getting-started/installation/) for the host OS. Do not install a second copy unnecessarily.

2. Read `.python-version`, `pyproject.toml` and `uv.lock`. The version file selects the development interpreter; `requires-python` defines supported Python versions. Inspect those files rather than assuming a previously used version remains current.
3. Follow the [README quick start](../../../../README.md#run-locally) to synchronize the locked environment and start the server.

   uv creates `.venv/` and installs runtime/default development dependencies; it can obtain the selected interpreter if needed. Keep environments, caches and bytecode ignored, and retain `uv.lock` in version control. Do not substitute global pip, shell activation or `uv pip install` for project dependency management.

Sync again after pulling changed dependency inputs or recreating the environment. A manifest/lock mismatch should be investigated, not silently resolved for an unrelated task. `uv run --locked` uses/synchronizes the locked project environment, so a separate sync before every command is unnecessary.

## Run the studio

Use the launch command and browser address in the [README quick start](../../../../README.md#run-locally). This server allowlists public root-level app files and assets and provides the website import endpoint; a generic static server or `file:` URL cannot supply the endpoint. Reuse an existing project server when appropriate. Keep the process/session available during testing and stop the process you started with Ctrl+C when finished.

If the port is occupied, choose another:

```sh
uv run --locked python server.py --port 8766
```

Restart Python after backend changes; it does not auto-reload. Frontend edits need a browser reload, not a Python restart.

## Change dependencies intentionally

First check the standard library and existing packages. New runtime packages belong on the backend. Document each direct dependency's purpose and why existing tools are insufficient beside its declaration in `pyproject.toml`; avoid duplicating the rationale in other documents.

Substitute the real package name in these examples:

```sh
uv add PACKAGE
uv add --dev PACKAGE
```

Use the first command for runtime dependencies, the second for development-only tools; do not run both for the same addition. `uv add` updates the manifest, lock and environment together. Review both dependency files. Use `uv remove PACKAGE` or `uv remove --dev PACKAGE` for an intentional removal. After a deliberate manual manifest edit, run `uv lock`, review the resolution, then `uv sync --locked`. Do not upgrade unrelated packages or use `uv lock --upgrade` as routine setup.

## After Python changes

Run lint fixes/import sorting, then formatting on changed paths. These examples cover the current backend and test file; narrow/extend the list to match the change:

```sh
uv run --locked ruff check --fix server.py jw_import.py wiki_import.py content_import.py source_http.py tests/test_backend.py tests/test_sources.py
uv run --locked ruff format server.py jw_import.py wiki_import.py content_import.py source_http.py tests/test_backend.py tests/test_sources.py
```

Review automatic edits, then run clean verification:

```sh
uv lock --check
uv run --locked ruff check server.py jw_import.py wiki_import.py content_import.py source_http.py tests/test_backend.py tests/test_sources.py
uv run --locked ruff format --check server.py jw_import.py wiki_import.py content_import.py source_http.py tests/test_backend.py tests/test_sources.py
uv check --locked
uv run --locked python -m unittest discover -s tests -p "test_*.py"
```

The lock check verifies dependency consistency without intentionally updating it. Ruff checks style/imports/common errors; ty checks static types; unittest checks behavior. None replaces the others. `uv check` uses the project's enabled `check-command` preview integration; keep Ruff separate. When adding modules, extend `[tool.ty.src].include` as needed so new source is actually checked.

For a syntax/bytecode diagnostic when useful:

```sh
uv run --locked python -m py_compile server.py jw_import.py wiki_import.py content_import.py source_http.py
```

Compilation does not establish type safety or behavior. For importer/endpoint changes, exercise the affected request through the local server too. Keep fixture regression coverage distinct from live publisher verification in the handoff.

## Select checks by the change

| Change | Appropriate verification |
| --- | --- |
| Python logic/tests | Ruff fix/format, clean lint/format/type checks and affected unittest coverage; live request when integration behavior changes. |
| Dependency/interpreter inputs | Review manifest/lock diff, locked sync, lock check, Python checks and affected runtime behavior. |
| Frontend only | Follow the main skill's frontend checks; Python checks are unnecessary unless its contract changes. |
| Documentation/skills only | Verify links, commands against project configuration and skill metadata; no app/server tests without a separate reason. |

Honor tool permissions for downloads, uv cache access and server networking. An inaccessible global cache is not evidence the project is broken. Request necessary execution permission or use a permitted task-specific cache; do not disable TLS or lock enforcement to work around it.
