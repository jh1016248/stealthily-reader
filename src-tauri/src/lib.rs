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
    bg_color: String,
    bg_opacity: u32,
    hide_on_leave: bool,
}

#[derive(Serialize, Deserialize, Clone)]
struct WindowBounds {
    width: u32,
    height: u32,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            font_size: 16,
            text_color: "#e0e0e0".to_string(),
            bg_color: "#1a1a1a".to_string(),
            bg_opacity: 85,
            hide_on_leave: true,
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Progress {
    entries: std::collections::HashMap<String, serde_json::Value>,
}

#[command]
async fn select_file(app: tauri::AppHandle) -> Option<String> {
    let dlg = app.dialog().file()
        .add_filter("Novel", &["epub", "txt"]);
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

use std::sync::OnceLock;

static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();

#[cfg(target_os = "macos")]
mod macos_tracking {
    use std::ffi::c_void;
    use tauri::Emitter;

    extern "C" {
        fn sel_registerName(name: *const i8) -> *const c_void;
        fn objc_getClass(name: *const i8) -> *const c_void;
        fn objc_allocateClassPair(superclass: *const c_void, name: *const i8, extra_bytes: usize) -> *mut c_void;
        fn objc_registerClassPair(cls: *mut c_void);
        fn class_addMethod(cls: *mut c_void, name: *const c_void, imp: *const c_void, types: *const i8) -> i8;

        // objc_msgSend has multiple signatures depending on return type and arch
        #[cfg(target_arch = "x86_64")]
        fn objc_msgSend(obj: *mut c_void, sel: *const c_void, ...) -> *mut c_void;
        #[cfg(target_arch = "aarch64")]
        fn objc_msgSend(obj: *mut c_void, sel: *const c_void, ...) -> *mut c_void;
    }

    fn sel(name: &[u8]) -> *const c_void {
        unsafe { sel_registerName(name.as_ptr() as *const i8) }
    }

    unsafe fn send_id(obj: *mut c_void, s: *const c_void) -> *mut c_void {
        objc_msgSend(obj, s)
    }

    unsafe fn send_void2(obj: *mut c_void, s: *const c_void, a: *mut c_void) {
        objc_msgSend(obj, s, a);
    }

    #[cfg(target_arch = "x86_64")]
    unsafe fn send_init(area: *mut c_void, s: *const c_void, rect: &[f64; 4], opts: u64, owner: *mut c_void, info: *mut c_void) -> *mut c_void {
        objc_msgSend(area, s, rect, opts, owner, info)
    }

    #[cfg(target_arch = "aarch64")]
    unsafe fn send_init(area: *mut c_void, s: *const c_void, x: f64, y: f64, w: f64, h: f64, opts: u64, owner: *mut c_void, info: *mut c_void) -> *mut c_void {
        objc_msgSend(area, s, x, y, w, h, opts, owner, info)
    }

    extern "C" fn on_mouse_enter(_: *mut c_void, _: *const c_void, _: *mut c_void) {
        if let Some(h) = crate::APP_HANDLE.get() { let _ = h.emit("cursor-enter", ()); }
    }

    extern "C" fn on_mouse_exit(_: *mut c_void, _: *const c_void, _: *mut c_void) {
        if let Some(h) = crate::APP_HANDLE.get() { let _ = h.emit("cursor-leave", ()); }
    }

    pub fn setup(ns_window: *mut c_void) {
        unsafe {
            let superclass = objc_getClass(b"NSObject\0".as_ptr() as *const i8);
            if superclass.is_null() { return; }

            let cls = objc_allocateClassPair(superclass, b"StealthilyTrackingOwner\0".as_ptr() as *const i8, 0);
            if cls.is_null() { return; }

            let types = b"v@:@\0";
            class_addMethod(cls, sel(b"mouseEntered:\0"), on_mouse_enter as *const c_void, types.as_ptr() as *const i8);
            class_addMethod(cls, sel(b"mouseExited:\0"), on_mouse_exit as *const c_void, types.as_ptr() as *const i8);
            objc_registerClassPair(cls);

            let owner_cls = objc_getClass(b"StealthilyTrackingOwner\0".as_ptr() as *const i8);
            if owner_cls.is_null() { return; }

            let owner = send_id(send_id(owner_cls as *mut c_void, sel(b"alloc\0")), sel(b"init\0"));
            if owner.is_null() { return; }

            let content_view = send_id(ns_window, sel(b"contentView\0"));
            if content_view.is_null() { return; }

            let tracking_cls = objc_getClass(b"NSTrackingArea\0".as_ptr() as *const i8);
            if tracking_cls.is_null() { return; }

            let area = send_id(tracking_cls as *mut c_void, sel(b"alloc\0"));
            if area.is_null() { return; }

            #[cfg(target_arch = "aarch64")]
            let area = {
                send_init(area, sel(b"initWithRect:options:owner:userInfo:\0"), 0.0f64, 0.0f64, 10000.0f64, 10000.0f64, 0x281u64, owner, std::ptr::null_mut())
            };

            if !area.is_null() {
                send_void2(content_view, sel(b"addTrackingArea:\0"), area);
            }
        }
    }
}

fn save_window_bounds(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        if let Ok(size) = win.outer_size() {
            let bounds = WindowBounds {
                width: size.width,
                height: size.height,
            };
            let _ = fs::write(
                app_data_dir(app).join("window_bounds.json"),
                serde_json::to_string(&bounds).unwrap_or_default(),
            );
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        .setup(|app| {
            APP_HANDLE.set(app.handle().clone()).ok();

            // 恢复窗口大小（不恢复位置，避免多屏幕问题）
            let bounds_path = app_data_dir(&app.handle()).join("window_bounds.json");
            if let Ok(content) = fs::read_to_string(&bounds_path) {
                if let Ok(bounds) = serde_json::from_str::<WindowBounds>(&content) {
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.set_size(tauri::Size::Physical(
                            tauri::PhysicalSize::new(bounds.width, bounds.height),
                        ));
                    }
                }
            }

            // macOS: 设置原生鼠标追踪，应用不活跃时也能响应鼠标移入移出
            #[cfg(target_os = "macos")]
            {
                if let Some(win) = app.get_webview_window("main") {
                    if let Ok(ns_window) = win.ns_window() {
                        macos_tracking::setup(ns_window);
                    }
                }
            }

            // 监听窗口移动/缩放事件保存 bounds
            let app_handle = app.handle().clone();
            if let Some(win) = app.get_webview_window("main") {
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) = event {
                        save_window_bounds(&app_handle);
                    }
                });
            }

            Ok(())
        })
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
