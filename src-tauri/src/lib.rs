use serde::Serialize;
use std::process::Command;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackendStatus {
    app_name: &'static str,
    os: &'static str,
    architecture: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct JavaDetection {
    installed: bool,
    executable: &'static str,
    version: Option<String>,
    details: String,
}

#[tauri::command]
fn get_backend_status() -> BackendStatus {
    BackendStatus {
        app_name: "MOSS",
        os: std::env::consts::OS,
        architecture: std::env::consts::ARCH,
    }
}

/// Checks whether a Java runtime is available on PATH.
/// This is a first step; later versions can also search common installation paths
/// and select a compatible runtime for a specific Minecraft version.
#[tauri::command]
fn detect_java() -> JavaDetection {
    let executable = if cfg!(windows) { "java.exe" } else { "java" };

    match Command::new(executable).arg("-version").output() {
        Ok(output) => {
            let mut details = String::from_utf8_lossy(&output.stderr).trim().to_owned();
            if details.is_empty() {
                details = String::from_utf8_lossy(&output.stdout).trim().to_owned();
            }

            let version = details
                .lines()
                .find(|line| line.to_ascii_lowercase().contains("version"))
                .map(str::trim)
                .map(str::to_owned);

            JavaDetection {
                installed: output.status.success(),
                executable,
                version,
                details: if details.is_empty() {
                    format!("Java exited with status: {}", output.status)
                } else {
                    details
                },
            }
        }
        Err(error) => JavaDetection {
            installed: false,
            executable,
            version: None,
            details: format!("Java was not found on PATH: {error}"),
        },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_backend_status,
            detect_java
        ])
        .run(tauri::generate_context!())
        .expect("error while running MOSS");
}

#[cfg(test)]
mod tests {
    #[test]
    fn app_name_is_moss() {
        assert_eq!(super::get_backend_status().app_name, "MOSS");
    }
}
