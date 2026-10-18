# MOSS Rust backend

This folder contains the initial Tauri 2 desktop shell and Rust command layer.

## Commands currently available

- `get_backend_status`: returns the app name, operating system, and architecture.
- `detect_java`: checks whether `java` is available on PATH and returns its version output.

These commands are an initial foundation, not a complete Minecraft launcher. Java detection currently checks PATH only. Minecraft version manifests, downloads, Microsoft authentication, Fabric/Modrinth support, and game launching are not implemented yet.

## Prerequisites

Install Rust and the platform-specific Tauri prerequisites from the official Tauri v2 documentation. Install Node.js and pnpm as well.

## Development

After the frontend dependencies are installed and the Tauri CLI is available:

- `pnpm tauri:dev` starts the desktop app.
- `pnpm tauri:build` builds a distributable app.

The Next.js app is configured for static export so Tauri can load the generated `out` directory.
