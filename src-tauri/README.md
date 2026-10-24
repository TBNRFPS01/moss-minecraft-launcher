# MOSS Rust backend

This folder contains the Tauri 2 desktop shell and Rust command layer for MOSS.

## Commands currently available

- `get_backend_status`: returns the app name, operating system, and architecture.
- `detect_java`: checks whether `java` is available on PATH and returns its version output.
- `get_versions`: retrieves official Minecraft version metadata from Mojang's manifest.
- `list_instances`, `create_instance`, `rename_instance`, `delete_instance`: manage isolated instances in the operating-system application-data directory.
- `install_version`: downloads official client, applicable library/native artifacts, and assets; verifies SHA-1 values where provided; retries failures and replaces corrupt partial files.

The current milestone does not implement Microsoft/Xbox/Minecraft authentication, runtime downloads, Java compatibility selection, launch argument construction, or game launching. The UI explicitly reports that launch is unavailable until legitimate Microsoft sign-in is configured. Java detection currently checks PATH only. Mod loaders and mod platform integrations are not implemented.

Installation is vanilla-only. Version metadata with `inheritsFrom` is rejected rather than incorrectly treating a loader profile as a vanilla install. Installation progress currently reports artifact-level progress; per-byte progress, user cancellation, and parallel downloads remain future work.

## Prerequisites

Install Rust and the platform-specific Tauri prerequisites from the official Tauri v2 documentation. Install Node.js and pnpm as well.

## Development

After the frontend dependencies are installed and the Tauri CLI is available:

- `pnpm tauri:dev` starts the desktop app.
- `pnpm tauri:build` builds a distributable app.

The Next.js app is configured for static export so Tauri can load the generated `out` directory.
