#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::{sync::Mutex, time::Duration};
use tauri::{Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};

#[derive(Clone, Serialize)]
struct Connection {
    url: String,
    token: String,
}

#[derive(Default)]
struct Backend {
    ui_ready: bool,
    child: Option<CommandChild>,
    connection: Option<Connection>,
    error: Option<String>,
}

impl Backend {
    fn guards_close(&self) -> bool {
        self.ui_ready
    }
}

#[tauri::command]
fn register_close_handler(state: State<'_, Mutex<Backend>>) -> Result<(), String> {
    state
        .lock()
        .map_err(|_| "Service state unavailable")?
        .ui_ready = true;
    Ok(())
}

fn stop_backend(app: &tauri::AppHandle) {
    if let Ok(mut state) = app.state::<Mutex<Backend>>().lock() {
        if let Some(child) = state.child.take() {
            let _ = child.kill();
        }
    }
}

#[tauri::command]
async fn backend_connection(state: State<'_, Mutex<Backend>>) -> Result<Connection, String> {
    for _ in 0..300 {
        {
            let data = state.lock().map_err(|_| "Service state unavailable")?;
            if let Some(error) = &data.error {
                return Err(error.clone());
            }
            if let Some(connection) = &data.connection {
                return Ok(connection.clone());
            }
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    Err("Local service did not become ready. Restart StyleDNA.".into())
}

fn valid_export_path(path: &str) -> bool {
    regex::Regex::new(
        r"^/api/skills/[a-f0-9]{32}/export\?format=(zip|json|markdown)&revision=[1-9][0-9]{0,8}$",
    )
    .expect("constant regular expression")
    .is_match(path)
}

#[tauri::command]
fn close_application(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
async fn save_export(
    app: tauri::AppHandle,
    state: State<'_, Mutex<Backend>>,
    filename: String,
    path: String,
) -> Result<bool, String> {
    if !valid_export_path(&path) || filename.len() > 160 || filename.contains(['/', '\\', ':']) {
        return Err("Invalid export request".into());
    }
    let connection = state
        .lock()
        .map_err(|_| "Service state unavailable")?
        .connection
        .clone()
        .ok_or("Local service unavailable")?;
    let destination = app
        .dialog()
        .file()
        .set_file_name(&filename)
        .blocking_save_file();
    let Some(destination) = destination else {
        return Ok(false);
    };
    let destination = destination
        .into_path()
        .map_err(|_| "Choose a local file destination")?;
    let client = reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|_| "Could not initialize export")?;
    let mut response = client
        .get(format!("{}{}", connection.url, path))
        .bearer_auth(connection.token)
        .send()
        .await
        .map_err(|_| "Local export request failed")?;
    if !response.status().is_success() {
        return Err("Could not export the saved revision".into());
    }
    let parent = destination.parent().ok_or("Invalid save location")?;
    let temporary =
        tempfile::NamedTempFile::new_in(parent).map_err(|_| "Cannot write to save location")?;
    let mut file =
        tokio::fs::File::from_std(temporary.reopen().map_err(|_| "Cannot open export file")?);
    use tokio::io::AsyncWriteExt;
    let mut total: usize = 0;
    while let Some(bytes) = response.chunk().await.map_err(|_| "Export interrupted")? {
        total += bytes.len();
        if total > 250 * 1024 * 1024 {
            return Err("Export exceeds 250 MiB".into());
        }
        file.write_all(&bytes)
            .await
            .map_err(|_| "Cannot write export file")?;
    }
    file.flush().await.map_err(|_| "Cannot finish export")?;
    drop(file);
    temporary
        .persist(destination)
        .map_err(|_| "Cannot finish saving export file")?;
    Ok(true)
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(Backend::default()))
        .setup(|app| {
            let root = std::env::var_os("STYLEDNA_DATA_DIR")
                .map(std::path::PathBuf::from)
                .unwrap_or(app.path().app_data_dir()?);
            std::fs::create_dir_all(&root)?;
            let mut secret = [0u8; 32];
            getrandom::fill(&mut secret).map_err(|_| "Could not create local session secret")?;
            let token: String = secret.iter().map(|byte| format!("{byte:02x}")).collect();
            let (mut receiver, mut child) = app.shell().sidecar("styledna-service")?
                .args(["--data-dir", root.to_str().ok_or("Invalid data directory")?]).spawn()?;
            if let Err(error) = child.write(format!("{{\"token\":\"{token}\"}}\n").as_bytes()) {
                let _ = child.kill();
                return Err(error.into());
            }
            app.state::<Mutex<Backend>>().lock().unwrap().child = Some(child);
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let ready = tokio::time::timeout(Duration::from_secs(30), async {
                    while let Some(event) = receiver.recv().await {
                        match event {
                            CommandEvent::Stdout(bytes) => {
                                if let Ok(message) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                                    if message["event"] == "ready" {
                                        if let Some(url) = message["url"].as_str() {
                                            if url.starts_with("http://127.0.0.1:") {
                                                return Some(url.to_owned());
                                            }
                                        }
                                    }
                                }
                            },
                            CommandEvent::Terminated(_) | CommandEvent::Error(_) => return None,
                            _ => {}
                        }
                    }
                    None
                }).await;
                if let Ok(Some(url)) = ready {
                    handle.state::<Mutex<Backend>>().lock().unwrap().connection = Some(Connection { url, token });
                    while let Some(event) = receiver.recv().await {
                        if matches!(event, CommandEvent::Terminated(_) | CommandEvent::Error(_)) {
                            let binding = handle.state::<Mutex<Backend>>();
                            let mut state = binding.lock().unwrap();
                            state.connection = None;
                            state.error = Some("Local service stopped. Restart StyleDNA.".into());
                            break;
                        }
                    }
                } else {
                    stop_backend(&handle);
                    handle.state::<Mutex<Backend>>().lock().unwrap().error = Some(
                        "Local service failed to start. Check installation permissions and restart.".into());
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let binding = window.state::<Mutex<Backend>>();
                let ready = binding.lock().map(|state| state.guards_close()).unwrap_or(false);
                if ready {
                    api.prevent_close();
                    let _ = window.emit("desktop-close-requested", ());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![backend_connection, save_export, close_application, register_close_handler])
        .build(tauri::generate_context!())
        .expect("Could not start StyleDNA");
    app.run(|handle, event| {
        if let tauri::RunEvent::Exit = event {
            stop_backend(handle);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::valid_export_path;
    #[test]
    fn frontend_close_guard_survives_backend_disconnect() {
        let state = super::Backend {
            ui_ready: true,
            connection: None,
            ..Default::default()
        };
        assert!(state.guards_close());
        assert!(!super::Backend::default().guards_close());
    }
    #[test]
    fn export_route_is_restricted_to_saved_skill_exports() {
        assert!(valid_export_path(&format!(
            "/api/skills/{}/export?format=zip&revision=1",
            "a".repeat(32)
        )));
        assert!(!valid_export_path("/api/settings"));
        assert!(!valid_export_path("http://example.com"));
        assert!(!valid_export_path(
            "/api/skills/../../export?format=zip&revision=1"
        ));
    }
}
