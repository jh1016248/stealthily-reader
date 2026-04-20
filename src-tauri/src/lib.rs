use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{command, Manager};
use tauri_plugin_dialog::DialogExt;

fn app_data_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn books_dir(app: &tauri::AppHandle) -> PathBuf {
    app_data_dir(app).join("books")
}

#[derive(Serialize, Deserialize, Clone)]
struct BookMetadata {
    id: String,
    title: String,
    author: String,
    language: String,
    created_at: String,
}

#[derive(Serialize, Deserialize)]
struct Settings {
    font_size: u32,
    text_color: String,
    window_bounds: Option<WindowBounds>,
}

#[derive(Serialize, Deserialize, Clone)]
struct WindowBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            font_size: 16,
            text_color: "#e0e0e0".to_string(),
            window_bounds: None,
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Progress {
    #[serde(flatten)]
    entries: std::collections::HashMap<String, String>,
}

#[command]
async fn select_file(app: tauri::AppHandle, filters: Vec<Vec<String>>) -> Option<String> {
    let mut dlg = app.dialog().file();
    for f in &filters {
        let name = f.first().cloned().unwrap_or_default();
        let extensions: Vec<&str> = f.get(1..).map(|s| s.iter().map(|x| x.as_str()).collect()).unwrap_or_default();
        dlg = dlg.add_filter(name, &extensions);
    }
    let (tx, rx) = std::sync::mpsc::channel();
    dlg.pick_file(move |path| {
        let _ = tx.send(path.map(|p| p.to_string()));
    });
    rx.recv().ok().flatten()
}

#[command]
fn read_file_binary(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| e.to_string())
}

#[command]
fn list_books(app: tauri::AppHandle) -> Result<Vec<BookMetadata>, String> {
    let dir = books_dir(&app);
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut books = vec![];
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let meta_path = entry.path().join("book.json");
        if let Ok(content) = fs::read_to_string(&meta_path) {
            if let Ok(meta) = serde_json::from_str::<BookMetadata>(&content) {
                books.push(meta);
            }
        }
    }
    Ok(books)
}

#[command]
fn save_book(app: tauri::AppHandle, metadata: BookMetadata) -> Result<(), String> {
    let book_dir = books_dir(&app).join(&metadata.id);
    fs::create_dir_all(book_dir.join("chapters")).map_err(|e| e.to_string())?;
    let content = serde_json::to_string_pretty(&metadata).map_err(|e| e.to_string())?;
    fs::write(book_dir.join("book.json"), content).map_err(|e| e.to_string())
}

#[command]
fn save_chapter(
    app: tauri::AppHandle,
    book_id: String,
    chapter_id: String,
    content: String,
) -> Result<(), String> {
    let chapter_dir = books_dir(&app).join(&book_id).join("chapters").join(&chapter_id);
    fs::create_dir_all(&chapter_dir).map_err(|e| e.to_string())?;
    fs::write(chapter_dir.join("content.txt"), content).map_err(|e| e.to_string())
}

#[command]
fn list_chapters(app: tauri::AppHandle, book_id: String) -> Result<Vec<String>, String> {
    let chapters_dir = books_dir(&app).join(&book_id).join("chapters");
    if !chapters_dir.exists() {
        return Ok(vec![]);
    }

    let mut chapters: Vec<String> = fs::read_dir(&chapters_dir)
        .map_err(|e| e.to_string())?
        .flatten()
        .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect();

    chapters.sort();
    Ok(chapters)
}

#[command]
fn read_chapter(
    app: tauri::AppHandle,
    book_id: String,
    chapter_id: String,
) -> Result<String, String> {
    let path = books_dir(&app)
        .join(&book_id)
        .join("chapters")
        .join(&chapter_id)
        .join("content.txt");
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[command]
fn delete_book(app: tauri::AppHandle, book_id: String) -> Result<(), String> {
    let book_dir = books_dir(&app).join(&book_id);
    if book_dir.exists() {
        fs::remove_dir_all(&book_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
fn save_settings(app: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    let path = app_data_dir(&app).join("settings.json");
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

#[command]
fn load_settings(app: tauri::AppHandle) -> Result<Settings, String> {
    let path = app_data_dir(&app).join("settings.json");
    if !path.exists() {
        return Ok(Settings::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[command]
fn save_progress(app: tauri::AppHandle, progress: Progress) -> Result<(), String> {
    let path = app_data_dir(&app).join("progress.json");
    let content = serde_json::to_string_pretty(&progress).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

#[command]
fn load_progress(app: tauri::AppHandle) -> Result<Progress, String> {
    let path = app_data_dir(&app).join("progress.json");
    if !path.exists() {
        return Ok(Progress {
            entries: std::collections::HashMap::new(),
        });
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            select_file,
            read_file_binary,
            list_books,
            save_book,
            save_chapter,
            list_chapters,
            read_chapter,
            delete_book,
            save_settings,
            load_settings,
            save_progress,
            load_progress,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
