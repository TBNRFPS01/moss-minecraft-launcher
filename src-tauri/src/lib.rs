use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha1::{Digest, Sha1};
use std::{
    fs::{self, File},
    io::{self, Read, Write},
    path::{Component, Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};

const VERSION_MANIFEST_URL: &str =
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

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
    executable: String,
    version: Option<String>,
    details: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GameVersion {
    id: String,
    #[serde(rename = "type")]
    version_type: String,
    release_time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Instance {
    id: String,
    name: String,
    minecraft_version: String,
    game_directory: String,
    java_path: Option<String>,
    max_memory_mb: u32,
    installed: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallProgress {
    instance_id: String,
    version_id: String,
    completed: usize,
    total: usize,
    current_file: String,
}

#[tauri::command]
fn get_backend_status() -> BackendStatus {
    BackendStatus {
        app_name: "MOSS",
        os: std::env::consts::OS,
        architecture: std::env::consts::ARCH,
    }
}

#[tauri::command]
fn detect_java() -> JavaDetection {
    let executable = if cfg!(windows) { "java.exe" } else { "java" };
    match Command::new(executable).arg("-version").output() {
        Ok(output) => {
            let details = format!(
                "{}{}",
                String::from_utf8_lossy(&output.stderr),
                String::from_utf8_lossy(&output.stdout)
            )
            .trim()
            .to_owned();
            let version = details
                .lines()
                .find(|line| line.to_ascii_lowercase().contains("version"))
                .map(str::trim)
                .map(str::to_owned);
            JavaDetection {
                installed: output.status.success(),
                executable: executable.to_owned(),
                version,
                details,
            }
        }
        Err(error) => JavaDetection {
            installed: false,
            executable: executable.to_owned(),
            version: None,
            details: format!("Java was not found on PATH: {error}"),
        },
    }
}

fn app_data_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not locate MOSS application data: {error}"))?;
    fs::create_dir_all(&root)
        .map_err(|error| format!("Could not create MOSS application data: {error}"))?;
    Ok(root)
}

fn read_instances(root: &Path) -> Result<Vec<Instance>, String> {
    let path = root.join("instances.json");
    if !path.exists() {
        return Ok(Vec::new());
    }
    let bytes = fs::read(path).map_err(|error| format!("Could not read instance data: {error}"))?;
    serde_json::from_slice(&bytes).map_err(|error| format!("Instance data is invalid: {error}"))
}

fn save_instances(root: &Path, instances: &[Instance]) -> Result<(), String> {
    let path = root.join("instances.json");
    let temporary = root.join("instances.json.tmp");
    let backup = root.join("instances.json.bak");
    let bytes = serde_json::to_vec_pretty(instances).map_err(|error| error.to_string())?;
    fs::write(&temporary, bytes)
        .map_err(|error| format!("Could not write instance data: {error}"))?;
    if path.exists() {
        if backup.exists() {
            fs::remove_file(&backup)
                .map_err(|error| format!("Could not clear old instance-data backup: {error}"))?;
        }
        fs::rename(&path, &backup)
            .map_err(|error| format!("Could not preserve existing instance data: {error}"))?;
    }
    if let Err(error) = fs::rename(&temporary, &path) {
        if backup.exists() {
            let _ = fs::rename(&backup, &path);
        }
        let _ = fs::remove_file(&temporary);
        return Err(format!("Could not save instance data: {error}"));
    }
    if backup.exists() {
        fs::remove_file(backup).map_err(|error| {
            format!("Instance data was saved, but its backup could not be removed: {error}")
        })?;
    }
    Ok(())
}

#[tauri::command]
fn list_instances(app: AppHandle) -> Result<Vec<Instance>, String> {
    read_instances(&app_data_root(&app)?)
}

#[tauri::command]
fn create_instance(
    app: AppHandle,
    name: String,
    minecraft_version: String,
) -> Result<Instance, String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 48 {
        return Err("Instance names must contain 1 to 48 characters.".into());
    }
    validate_version_id(&minecraft_version)?;
    let root = app_data_root(&app)?;
    let mut instances = read_instances(&root)?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let id = format!("instance-{timestamp}");
    let directory = root.join("instances").join(&id).join("game");
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Could not create instance directory: {error}"))?;
    let instance = Instance {
        id,
        name: name.to_owned(),
        minecraft_version,
        game_directory: directory.to_string_lossy().into_owned(),
        java_path: None,
        max_memory_mb: 4096,
        installed: false,
    };
    instances.push(instance.clone());
    save_instances(&root, &instances)?;
    Ok(instance)
}

#[tauri::command]
fn rename_instance(
    app: AppHandle,
    instance_id: String,
    name: String,
) -> Result<Vec<Instance>, String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 48 {
        return Err("Instance names must contain 1 to 48 characters.".into());
    }
    let root = app_data_root(&app)?;
    let mut instances = read_instances(&root)?;
    let instance = instances
        .iter_mut()
        .find(|instance| instance.id == instance_id)
        .ok_or("Instance not found.")?;
    instance.name = name.to_owned();
    save_instances(&root, &instances)?;
    Ok(instances)
}

#[tauri::command]
fn delete_instance(app: AppHandle, instance_id: String) -> Result<Vec<Instance>, String> {
    validate_instance_id(&instance_id)?;
    let root = app_data_root(&app)?;
    let mut instances = read_instances(&root)?;
    let instance = instances
        .iter()
        .find(|instance| instance.id == instance_id)
        .ok_or("Instance not found.")?;
    let expected = root.join("instances").join(&instance_id);
    let recorded = PathBuf::from(&instance.game_directory);
    if !recorded.starts_with(&expected) {
        return Err(
            "The instance path is outside its managed directory; refusing to delete it.".into(),
        );
    }
    fs::remove_dir_all(&expected)
        .map_err(|error| format!("Could not remove instance files: {error}"))?;
    instances.retain(|instance| instance.id != instance_id);
    save_instances(&root, &instances)?;
    Ok(instances)
}

#[tauri::command]
async fn get_versions() -> Result<Vec<GameVersion>, String> {
    tauri::async_runtime::spawn_blocking(get_versions_sync)
        .await
        .map_err(|error| format!("Version request worker failed: {error}"))?
}

fn get_versions_sync() -> Result<Vec<GameVersion>, String> {
    let client = http_client()?;
    let manifest: Value = client
        .get(VERSION_MANIFEST_URL)
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(|error| {
            format!("Could not retrieve the official Minecraft version list: {error}")
        })?
        .json()
        .map_err(|error| format!("The official version list could not be parsed: {error}"))?;
    serde_json::from_value(
        manifest
            .get("versions")
            .cloned()
            .ok_or("Official version list is missing versions.")?,
    )
    .map_err(|error| format!("Official version list has an unexpected format: {error}"))
}

#[tauri::command]
async fn install_version(app: AppHandle, instance_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || install_version_sync(app, instance_id))
        .await
        .map_err(|error| format!("Installation worker failed: {error}"))?
}

fn install_version_sync(app: AppHandle, instance_id: String) -> Result<(), String> {
    validate_instance_id(&instance_id)?;
    let root = app_data_root(&app)?;
    let mut instances = read_instances(&root)?;
    let index = instances
        .iter()
        .position(|instance| instance.id == instance_id)
        .ok_or("Instance not found.")?;
    let instance = instances[index].clone();
    validate_version_id(&instance.minecraft_version)?;
    let game_dir = PathBuf::from(&instance.game_directory);
    let managed_dir = root.join("instances").join(&instance.id).join("game");
    if game_dir != managed_dir {
        return Err("Instance game directory is outside its managed location.".into());
    }
    fs::create_dir_all(&game_dir)
        .map_err(|error| format!("Could not access instance game directory: {error}"))?;
    let client = http_client()?;
    let manifest: Value = client
        .get(VERSION_MANIFEST_URL)
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(|error| {
            format!("Could not retrieve the official Minecraft version list: {error}")
        })?
        .json()
        .map_err(|error| error.to_string())?;
    let version_url = manifest["versions"]
        .as_array()
        .and_then(|versions| {
            versions
                .iter()
                .find(|version| version["id"] == instance.minecraft_version)
        })
        .and_then(|version| version["url"].as_str())
        .ok_or("That version is not present in Mojang's official version manifest.")?;
    let metadata: Value = client
        .get(version_url)
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(|error| format!("Could not retrieve version metadata: {error}"))?
        .json()
        .map_err(|error| format!("Version metadata could not be parsed: {error}"))?;
    if metadata.get("inheritsFrom").is_some() {
        return Err("This version inherits from another version; inherited loader profiles are not supported yet.".into());
    }
    let downloads = metadata
        .get("downloads")
        .ok_or("Version metadata has no downloads section.")?;
    let version_dir = game_dir.join("versions").join(&instance.minecraft_version);
    fs::create_dir_all(&version_dir).map_err(|error| error.to_string())?;
    let mut files = Vec::<(String, PathBuf, Option<String>)>::new();
    let client_download = downloads
        .get("client")
        .ok_or("This version has no client download.")?;
    files.push((
        client_download["url"]
            .as_str()
            .ok_or("Client download URL is missing.")?
            .to_owned(),
        version_dir.join(format!("{}.jar", instance.minecraft_version)),
        client_download["sha1"].as_str().map(str::to_owned),
    ));
    collect_library_downloads(&metadata, &game_dir, &mut files)?;
    let asset_index = metadata
        .get("assetIndex")
        .ok_or("Version metadata has no asset index.")?;
    let asset_id = asset_index["id"]
        .as_str()
        .ok_or("Asset index ID is missing.")?;
    validate_version_id(asset_id)?;
    files.push((
        asset_index["url"]
            .as_str()
            .ok_or("Asset index URL is missing.")?
            .to_owned(),
        game_dir
            .join("assets")
            .join("indexes")
            .join(format!("{asset_id}.json")),
        asset_index["sha1"].as_str().map(str::to_owned),
    ));
    let total = files.len();
    for (completed, (url, destination, checksum)) in files.iter().enumerate() {
        app.emit(
            "install-progress",
            InstallProgress {
                instance_id: instance.id.clone(),
                version_id: instance.minecraft_version.clone(),
                completed,
                total,
                current_file: destination
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into_owned(),
            },
        )
        .map_err(|error| error.to_string())?;
        download_verified(&client, url, destination, checksum.as_deref())?;
    }
    let native_dir = version_dir.join("natives");
    fs::create_dir_all(&native_dir)
        .map_err(|error| format!("Could not create native library directory: {error}"))?;
    for (_, archive_path, _) in files
        .iter()
        .filter(|(_, path, _)| path.to_string_lossy().contains("-natives-"))
    {
        extract_natives(archive_path, &native_dir)?;
    }
    let index_path = game_dir
        .join("assets")
        .join("indexes")
        .join(format!("{asset_id}.json"));
    let index_data: Value =
        serde_json::from_slice(&fs::read(&index_path).map_err(|error| error.to_string())?)
            .map_err(|error| format!("Asset index is invalid: {error}"))?;
    let objects = index_data
        .get("objects")
        .and_then(Value::as_object)
        .ok_or("Asset index has no objects map.")?;
    for (object_name, object) in objects {
        let hash = object["hash"].as_str().ok_or("Asset entry has no hash.")?;
        if hash.len() != 40 || !hash.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err("Asset index contains an invalid content hash.".into());
        }
        let destination = game_dir
            .join("assets")
            .join("objects")
            .join(&hash[..2])
            .join(hash);
        if destination.exists() && verify_sha1(&destination, hash)? {
            continue;
        }
        let url = format!(
            "https://resources.download.minecraft.net/{}/{}",
            &hash[..2],
            hash
        );
        download_verified(&client, &url, &destination, Some(hash))
            .map_err(|error| format!("Could not install asset {object_name}: {error}"))?;
    }
    if index_data["virtual"].as_bool() == Some(true) {
        let virtual_dir = game_dir.join("assets").join("virtual").join("legacy");
        for (object_name, object) in objects {
            let hash = object["hash"].as_str().ok_or("Asset entry has no hash.")?;
            let source = game_dir
                .join("assets")
                .join("objects")
                .join(&hash[..2])
                .join(hash);
            let destination = virtual_dir.join(safe_relative_path(object_name)?);
            if let Some(parent) = destination.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            fs::copy(source, destination).map_err(|error| error.to_string())?;
        }
    }
    let version_file = version_dir.join(format!("{}.json", instance.minecraft_version));
    let metadata_bytes = serde_json::to_vec_pretty(&metadata).map_err(|error| error.to_string())?;
    fs::write(version_file, metadata_bytes).map_err(|error| error.to_string())?;
    instances[index].installed = true;
    save_instances(&root, &instances)?;
    app.emit(
        "install-progress",
        InstallProgress {
            instance_id,
            version_id: instance.minecraft_version,
            completed: total,
            total,
            current_file: "Complete".into(),
        },
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn collect_library_downloads(
    metadata: &Value,
    game_dir: &Path,
    files: &mut Vec<(String, PathBuf, Option<String>)>,
) -> Result<(), String> {
    let libraries = metadata
        .get("libraries")
        .and_then(Value::as_array)
        .ok_or("Version metadata has no libraries list.")?;
    for library in libraries {
        if !library_allowed(library) {
            continue;
        }
        let downloads = library
            .get("downloads")
            .ok_or("Library metadata has no downloads section.")?;
        if let Some(artifact) = downloads.get("artifact") {
            let relative = safe_relative_path(
                artifact["path"]
                    .as_str()
                    .ok_or("Library artifact path is missing.")?,
            )?;
            files.push((
                artifact["url"]
                    .as_str()
                    .ok_or("Library artifact URL is missing.")?
                    .to_owned(),
                game_dir.join("libraries").join(relative),
                artifact["sha1"].as_str().map(str::to_owned),
            ));
        }
        if let Some(classifiers) = downloads.get("classifiers").and_then(Value::as_object) {
            let os = if cfg!(target_os = "windows") {
                "windows"
            } else if cfg!(target_os = "macos") {
                "osx"
            } else {
                "linux"
            };
            let classifier_name = library
                .get("natives")
                .and_then(|natives| natives.get(os))
                .and_then(Value::as_str);
            if let Some(classifier_name) = classifier_name {
                let architecture = if cfg!(target_pointer_width = "64") {
                    "64"
                } else {
                    "32"
                };
                let classifier_name = classifier_name.replace("${arch}", architecture);
                if let Some(classifier) = classifiers.get(&classifier_name) {
                    let relative = safe_relative_path(
                        classifier["path"]
                            .as_str()
                            .ok_or("Native library path is missing.")?,
                    )?;
                    files.push((
                        classifier["url"]
                            .as_str()
                            .ok_or("Native library URL is missing.")?
                            .to_owned(),
                        game_dir.join("libraries").join(relative),
                        classifier["sha1"].as_str().map(str::to_owned),
                    ));
                }
            }
        }
    }
    Ok(())
}

fn extract_natives(archive_path: &Path, destination: &Path) -> Result<(), String> {
    let archive_file = File::open(archive_path)
        .map_err(|error| format!("Could not open native library archive: {error}"))?;
    let mut archive = zip::ZipArchive::new(archive_file)
        .map_err(|error| format!("Native library archive is invalid: {error}"))?;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| error.to_string())?;
        let entry_path = safe_relative_path(entry.name())?;
        if entry_path
            .components()
            .next()
            .and_then(|component| component.as_os_str().to_str())
            == Some("META-INF")
        {
            continue;
        }
        let output = destination.join(entry_path);
        if entry.is_dir() {
            fs::create_dir_all(output).map_err(|error| error.to_string())?;
            continue;
        }
        if let Some(parent) = output.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let mut file = File::create(output).map_err(|error| error.to_string())?;
        io::copy(&mut entry, &mut file).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn library_allowed(library: &Value) -> bool {
    let Some(rules) = library.get("rules").and_then(Value::as_array) else {
        return true;
    };
    let mut allowed = false;
    for rule in rules {
        let os = &rule["os"]["name"];
        let current_os = if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "macos") {
            "osx"
        } else {
            "linux"
        };
        if os.as_str().map(|value| value == current_os).unwrap_or(true) {
            allowed = rule["action"].as_str() == Some("allow");
        }
    }
    allowed
}

fn safe_relative_path(path: &str) -> Result<PathBuf, String> {
    let path = Path::new(path);
    if path.as_os_str().is_empty()
        || path
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err("Downloaded metadata contains an unsafe file path.".into());
    }
    Ok(path.to_path_buf())
}

fn validate_version_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.len() > 64
        || !id.bytes().all(|byte| {
            byte.is_ascii_alphanumeric() || byte == b'.' || byte == b'_' || byte == b'-'
        })
    {
        return Err("Invalid Minecraft version identifier.".into());
    }
    Ok(())
}

fn validate_instance_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || !id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
    {
        return Err("Invalid instance identifier.".into());
    }
    Ok(())
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .user_agent("MOSS-Minecraft-Launcher/0.1")
        .build()
        .map_err(|error| error.to_string())
}

fn download_verified(
    client: &Client,
    url: &str,
    destination: &Path,
    expected_sha1: Option<&str>,
) -> Result<(), String> {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    if let Some(checksum) = expected_sha1 {
        if destination.exists() && verify_sha1(destination, checksum)? {
            return Ok(());
        }
    }
    let mut last_error = String::new();
    for _ in 0..3 {
        let temporary = destination.with_extension("moss-part");
        let result = (|| -> Result<(), String> {
            let mut response = client
                .get(url)
                .send()
                .and_then(|response| response.error_for_status())
                .map_err(|error| error.to_string())?;
            let mut output = File::create(&temporary).map_err(|error| error.to_string())?;
            io::copy(&mut response, &mut output).map_err(|error| error.to_string())?;
            output.flush().map_err(|error| error.to_string())?;
            if let Some(checksum) = expected_sha1 {
                if !verify_sha1(&temporary, checksum)? {
                    return Err("SHA-1 checksum did not match the official metadata.".into());
                }
            }
            fs::rename(&temporary, destination).map_err(|error| error.to_string())?;
            Ok(())
        })();
        match result {
            Ok(()) => return Ok(()),
            Err(error) => {
                last_error = error;
                let _ = fs::remove_file(&temporary);
            }
        }
    }
    Err(format!("Download failed after 3 attempts: {last_error}"))
}

fn verify_sha1(path: &Path, expected: &str) -> Result<bool, String> {
    let mut file = File::open(path).map_err(|error| error.to_string())?;
    let mut hasher = Sha1::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let count = file.read(&mut buffer).map_err(|error| error.to_string())?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hasher.finalize()).eq_ignore_ascii_case(expected))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_backend_status,
            detect_java,
            get_versions,
            list_instances,
            create_instance,
            rename_instance,
            delete_instance,
            install_version
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

    #[test]
    fn rejects_path_traversal_in_metadata_paths() {
        assert!(super::safe_relative_path("../../outside.jar").is_err());
        assert!(super::safe_relative_path("com/example/library.jar").is_ok());
    }

    #[test]
    fn validates_version_and_instance_identifiers() {
        assert!(super::validate_version_id("1.21.4").is_ok());
        assert!(super::validate_version_id("../outside").is_err());
        assert!(super::validate_instance_id("instance-123").is_ok());
        assert!(super::validate_instance_id("../outside").is_err());
    }

    #[test]
    fn parses_version_manifest_entries() {
        let versions: Vec<super::GameVersion> = serde_json::from_value(serde_json::json!([{
            "id": "1.21.4", "type": "release", "releaseTime": "2024-12-03T00:00:00+00:00"
        }]))
        .unwrap();
        assert_eq!(versions[0].id, "1.21.4");
        assert_eq!(versions[0].version_type, "release");
    }

    #[test]
    fn rejects_native_archive_traversal() {
        assert!(super::safe_relative_path("../../outside.dll").is_err());
        assert!(super::safe_relative_path("org/lwjgl/native.dll").is_ok());
    }

    #[test]
    fn instance_data_survives_repeated_atomic_saves() {
        let root = std::env::temp_dir().join(format!("moss-test-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let first = super::Instance {
            id: "instance-test".into(),
            name: "First".into(),
            minecraft_version: "1.21.4".into(),
            game_directory: root.join("game").to_string_lossy().into_owned(),
            java_path: None,
            max_memory_mb: 4096,
            installed: false,
        };
        super::save_instances(&root, std::slice::from_ref(&first)).unwrap();
        let mut updated = first;
        updated.name = "Renamed".into();
        super::save_instances(&root, std::slice::from_ref(&updated)).unwrap();
        let saved = super::read_instances(&root).unwrap();
        assert_eq!(saved[0].name, "Renamed");
        std::fs::remove_dir_all(root).unwrap();
    }
}
