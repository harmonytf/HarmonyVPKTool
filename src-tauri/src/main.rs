// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rayon::prelude::*;
use rfd::AsyncFileDialog;
use serde::Serialize;
use sourcepak::common::format::PakReader;
use sourcepak::pak::v1::format::VPKVersion1;
use sourcepak::{
    common::detect::{detect_pak_format, PakFormat},
    pak::revpk::format::VPKRespawn,
};
use std::sync::Mutex;
use std::{fs::File, path::PathBuf};
use tauri::http::{Request, Response};
use tauri::{AppHandle, Manager, State, Window};

pub struct AppState {
    inner: Mutex<InnerState>,
    extract_state: Mutex<ExtractState>,
}
impl AppState {
    pub fn new() -> Self {
        AppState {
            inner: Mutex::new(InnerState::new()),
            extract_state: Mutex::new(ExtractState::new()),
        }
    }
}

pub struct InnerState {
    pub vpk_path: Option<String>,
    pub loaded_format: Option<PakFormat>,
    pub revpk: Option<VPKRespawn>,
    pub vpk_version1: Option<VPKVersion1>,
}
pub struct ExtractState {
    pub running: bool,
}

impl InnerState {
    pub fn new() -> Self {
        InnerState {
            vpk_path: None,
            loaded_format: None,
            revpk: None,
            vpk_version1: None,
        }
    }

    pub fn reset(&mut self) {
        self.vpk_path = None;
        self.loaded_format = None;
        self.revpk = None;
        self.vpk_version1 = None;
    }
}

impl ExtractState {
    pub fn new() -> Self {
        ExtractState { running: false }
    }

    pub fn reset(&mut self) {
        self.running = false;
    }
}

#[tauri::command]
async fn select_vpk(window: Window) -> Option<String> {
    let file = AsyncFileDialog::new()
        .set_parent(&window)
        .set_title("Select a VPK file")
        .add_filter("VPK Files", &["vpk"])
        .pick_file()
        .await;

    Some(file?.path().to_str()?.to_string())
}

#[tauri::command]
async fn load_vpk(state: tauri::State<'_, AppState>, vpk_path: String) -> Result<(), String> {
    let mut file = File::open(&vpk_path).expect("Failed to open file");

    let pak_format = detect_pak_format(&mut file);

    match pak_format {
        PakFormat::VPKRespawn => {
            println!("VPKRespawn detected");

            let vpk = VPKRespawn::try_from(&mut file);

            match vpk {
                Ok(vpk) => {
                    let mut state_guard = state.inner.lock().unwrap();

                    println!("VPK loaded: {}", &vpk_path);

                    state_guard.vpk_path = Some(vpk_path);
                    state_guard.loaded_format = Some(PakFormat::VPKRespawn);
                    state_guard.revpk = Some(vpk);

                    Ok(())
                }
                Err(e) => {
                    println!("Error: {}", e);
                    Err(e.to_string())
                }
            }
        }
        PakFormat::VPKVersion1 => {
            println!("VPKVersion1 detected");

            let vpk = VPKVersion1::try_from(&mut file);

            match vpk {
                Ok(vpk) => {
                    let mut state_guard = state.inner.lock().unwrap();

                    println!("VPK loaded: {}", &vpk_path);

                    state_guard.vpk_path = Some(vpk_path);
                    state_guard.loaded_format = Some(PakFormat::VPKVersion1);
                    state_guard.vpk_version1 = Some(vpk);

                    Ok(())
                }
                Err(e) => {
                    println!("Error: {}", e);
                    Err(e.to_string())
                }
            }
        }
        fmt => {
            if vpk_path.ends_with(".vpk") && !vpk_path.ends_with("dir.vpk") {
                println!("Tried to open archive file: {}", fmt);
                return Err(format!("Tried to open archive file, consider opening the file ending \"dir.vpk\" instead."));
            }
            println!("Unsupported format: {}", fmt);
            return Err(format!("Unsupported format: {}", fmt).to_string());
        }
    }
}

#[tauri::command]
fn get_file_list(state: tauri::State<AppState>) -> Vec<String> {
    let state_guard = state.inner.lock().unwrap();

    match state_guard.loaded_format {
        Some(PakFormat::VPKRespawn) => {
            let vpk = state_guard.revpk.as_ref().unwrap();
            let mut file_list = Vec::new();

            for (file, _) in vpk.tree.files.iter() {
                file_list.push(file.clone());
            }

            file_list
        }
        Some(PakFormat::VPKVersion1) => {
            let vpk = state_guard.vpk_version1.as_ref().unwrap();
            let mut file_list = Vec::new();

            for (file, _) in vpk.tree.files.iter() {
                file_list.push(file.clone());
            }

            file_list
        }
        _ => Vec::new(),
    }
}

#[derive(Serialize)]
struct VPKDirEntry {
    pub crc: u32,
    pub preload_bytes: u16,
    pub archive_index: Option<u16>,
    pub entry_offset: Option<u32>,
    pub entry_length: Option<u32>,
    pub file_parts: Option<Vec<VPKRespawnFilePartEntry>>,
}

#[derive(Serialize)]
struct VPKRespawnFilePartEntry {
    pub archive_index: u16,
    pub load_flags: u16,
    pub texture_flags: u32,
    pub entry_offset: u64,
    pub entry_length: u64,
    pub entry_length_uncompressed: u64,
}

#[tauri::command]
fn get_file_entry(state: tauri::State<AppState>, path: &str) -> Option<VPKDirEntry> {
    let state_guard = state.inner.lock().unwrap();

    match state_guard.loaded_format {
        Some(PakFormat::VPKRespawn) => {
            let vpk = state_guard.revpk.as_ref().unwrap();
            if let Some(entry) = vpk.tree.files.get(path) {
                let mut file_parts = Vec::new();
                for part in &entry.file_parts {
                    file_parts.push(VPKRespawnFilePartEntry {
                        archive_index: part.archive_index,
                        load_flags: part.load_flags,
                        texture_flags: part.texture_flags,
                        entry_offset: part.entry_offset,
                        entry_length: part.entry_length,
                        entry_length_uncompressed: part.entry_length_uncompressed,
                    });
                }

                Some(VPKDirEntry {
                    crc: entry.crc,
                    preload_bytes: entry.preload_bytes,
                    archive_index: None,
                    entry_offset: None,
                    entry_length: None,
                    file_parts: Some(file_parts),
                })
            } else {
                None
            }
        }
        Some(PakFormat::VPKVersion1) => {
            let vpk = state_guard.vpk_version1.as_ref().unwrap();
            if let Some(entry) = vpk.tree.files.get(path) {
                Some(VPKDirEntry {
                    crc: entry.crc,
                    preload_bytes: entry.preload_bytes,
                    archive_index: Some(entry.archive_index),
                    entry_offset: Some(entry.entry_offset),
                    entry_length: Some(entry.entry_length),
                    file_parts: None,
                })
            } else {
                None
            }
        }
        _ => None,
    }
}

fn vpk_archive_path(path: &String) -> String {
    let mut path = PathBuf::from(path);
    path.pop();
    path.to_str().unwrap().to_string()
}

fn get_vpk_name(path: &String) -> String {
    let path = PathBuf::from(path);
    strip_lang(&path)
        .unwrap()
        .file_name()
        .unwrap()
        .to_str()
        .unwrap()
        .to_string()
        .replace("_dir.vpk", "")
}

const LANG_STRS: [&str; 11] = [
    "english",
    "french",
    "german",
    "italian",
    "japanese",
    "korean",
    "polish",
    "portugese",
    "russian",
    "spanish",
    "tchinese",
];

fn strip_lang(path: &PathBuf) -> Option<PathBuf> {
    let file_name = path.file_name()?.to_str()?.to_string();
    let stripped_name = PathBuf::from(
        LANG_STRS
            .iter()
            .find_map(|lang| {
                if file_name.starts_with(lang) {
                    Some(file_name.replacen(lang, "", 1))
                } else {
                    None
                }
            })
            .or(Some(file_name))
            .unwrap(),
    );
    Some(path.parent()?.join(stripped_name))
}

#[tauri::command]
async fn read_file(state: tauri::State<'_, AppState>, path: String) -> Result<Vec<u8>, String> {
    println!("Reading file: {}", &path);

    let state_guard = state.inner.lock().unwrap();

    match state_guard.loaded_format {
        Some(PakFormat::VPKRespawn) => {
            let vpk = state_guard.revpk.as_ref().unwrap();
            vpk.read_file(
                &vpk_archive_path(&state_guard.vpk_path.clone().unwrap()),
                &get_vpk_name(&state_guard.vpk_path.clone().unwrap()),
                &path,
            )
            .ok_or("Failed to read file".to_string())
        }
        Some(PakFormat::VPKVersion1) => {
            let vpk = state_guard.vpk_version1.as_ref().unwrap();
            vpk.read_file(
                &vpk_archive_path(&state_guard.vpk_path.clone().unwrap()),
                &get_vpk_name(&state_guard.vpk_path.clone().unwrap()),
                &path,
            )
            .ok_or("Failed to read file".to_string())
        }
        _ => Err("Unsupported format".to_string()),
    }
}

fn preview_protocol(app: &AppHandle, req: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let path = urlencoding::decode(req.uri().path()).unwrap()[1..].to_string();

    println!("Preview fetching file: \"{}\"", &path);

    let state: State<AppState> = app.state();
    let state_guard = state.inner.lock().unwrap();

    match state_guard.loaded_format {
        Some(PakFormat::VPKRespawn) => {
            let vpk = state_guard.revpk.as_ref().unwrap();
            let buf = vpk.read_file(
                &vpk_archive_path(&state_guard.vpk_path.clone().unwrap()),
                &get_vpk_name(&state_guard.vpk_path.clone().unwrap()),
                &path,
            );

            if buf.is_some() {
                tauri::http::Response::builder()
                    .header("Access-Control-Allow-Origin", "*")
                    .body(buf.unwrap())
                    .unwrap()
            } else {
                tauri::http::Response::builder()
                    .header("Access-Control-Allow-Origin", "*")
                    .status(404)
                    .body(Vec::new())
                    .unwrap()
            }
        }
        Some(PakFormat::VPKVersion1) => {
            let vpk = state_guard.vpk_version1.as_ref().unwrap();
            let buf = vpk.read_file(
                &vpk_archive_path(&state_guard.vpk_path.clone().unwrap()),
                &get_vpk_name(&state_guard.vpk_path.clone().unwrap()),
                &path,
            );

            if buf.is_some() {
                tauri::http::Response::builder()
                    .header("Access-Control-Allow-Origin", "*")
                    .body(buf.unwrap())
                    .unwrap()
            } else {
                tauri::http::Response::builder()
                    .header("Access-Control-Allow-Origin", "*")
                    .status(404)
                    .body(Vec::new())
                    .unwrap()
            }
        }
        _ => tauri::http::Response::builder()
            .header("Access-Control-Allow-Origin", "*")
            .status(400)
            .body(Vec::new())
            .unwrap(),
    }
}

#[derive(Clone, serde::Serialize)]
struct ExtractedPayload {
    file: String,
    e: Option<String>,
}

#[tauri::command]
async fn extract_all(
    window: Window,
    state: tauri::State<'_, AppState>,
    out_dir: &str,
) -> Result<(), String> {
    let state_guard = state.inner.lock().unwrap();

    let archive_path = vpk_archive_path(
        &state_guard
            .vpk_path
            .clone()
            .ok_or("Couldn't clone VPK path")?,
    );
    let vpk_name = get_vpk_name(
        &state_guard
            .vpk_path
            .clone()
            .ok_or("Couldn't clone VPK path")?,
    );

    let running = true;
    {
        let mut state_guard = state.extract_state.lock().unwrap();
        state_guard.running = true;
    }

    match state_guard.loaded_format {
        Some(PakFormat::VPKRespawn) => {
            let vpk = state_guard.revpk.as_ref().unwrap();

            vpk.tree
                .files
                .par_iter()
                .for_each_with(running, |running, (file_path, _)| {
                    if *running {
                        let state_guard = state.extract_state.lock().unwrap();
                        *running = state_guard.running;
                    }

                    if !*running {
                        return;
                    }

                    let path = if file_path.starts_with(" /") {
                        file_path[2..].to_string()
                    } else {
                        file_path.clone()
                    };

                    let res = vpk.extract_file(
                        &archive_path,
                        &vpk_name,
                        &file_path,
                        &format!("{}/{}", out_dir, path),
                    );
                    match res {
                        Ok(_) => {
                            println!("Extracted: {}", &file_path);
                            window
                                .emit(
                                    "extracted",
                                    ExtractedPayload {
                                        file: file_path.clone(),
                                        e: None,
                                    },
                                )
                                .unwrap();
                        }
                        Err(e) => {
                            println!("Failed to extract {}: {}", &file_path, e);
                            window
                                .emit(
                                    "extract-fail",
                                    ExtractedPayload {
                                        file: file_path.clone(),
                                        e: Some(e),
                                    },
                                )
                                .unwrap();
                        }
                    }
                });

            Ok(())
        }
        Some(PakFormat::VPKVersion1) => {
            let vpk = state_guard.vpk_version1.as_ref().unwrap();

            vpk.tree
                .files
                .par_iter()
                .for_each_with(running, |running, (file_path, _)| {
                    if *running {
                        let state_guard = state.extract_state.lock().unwrap();
                        *running = state_guard.running;
                    }

                    if !*running {
                        return;
                    }

                    let path = if file_path.starts_with(" /") {
                        file_path[2..].to_string()
                    } else {
                        file_path.clone()
                    };

                    let res = vpk.extract_file(
                        &archive_path,
                        &vpk_name,
                        &file_path,
                        &format!("{}/{}", out_dir, path),
                    );
                    match res {
                        Ok(_) => {
                            println!("Extracted: {}", &file_path);
                            window
                                .emit(
                                    "extracted",
                                    ExtractedPayload {
                                        file: file_path.clone(),
                                        e: None,
                                    },
                                )
                                .unwrap();
                        }
                        Err(e) => {
                            println!("Failed to extract {}: {}", &file_path, e);
                            window
                                .emit(
                                    "extract-fail",
                                    ExtractedPayload {
                                        file: file_path.clone(),
                                        e: Some(e),
                                    },
                                )
                                .unwrap();
                        }
                    }
                });

            Ok(())
        }
        _ => Err("Unsupported format".to_string()),
    }
}

#[tauri::command]
fn count_dir(state: tauri::State<'_, AppState>, dir: &str) -> usize {
    let state_guard = state.inner.lock().unwrap();

    match state_guard.loaded_format {
        Some(PakFormat::VPKRespawn) => {
            let vpk = state_guard.revpk.as_ref().unwrap();

            vpk.tree
                .files
                .iter()
                .filter(|(f, _)| f.starts_with(dir))
                .collect::<Vec<_>>()
                .len()
        }
        Some(PakFormat::VPKVersion1) => {
            let vpk = state_guard.vpk_version1.as_ref().unwrap();

            vpk.tree
                .files
                .iter()
                .filter(|(f, _)| f.starts_with(dir))
                .collect::<Vec<_>>()
                .len()
        }
        _ => 0,
    }
}

#[tauri::command]
async fn extract_dir(
    window: Window,
    state: tauri::State<'_, AppState>,
    dir: &str,
    out_dir: &str,
) -> Result<(), String> {
    let state_guard = state.inner.lock().unwrap();

    let archive_path = vpk_archive_path(
        &state_guard
            .vpk_path
            .clone()
            .ok_or("Couldn't clone VPK path")?,
    );
    let vpk_name = get_vpk_name(
        &state_guard
            .vpk_path
            .clone()
            .ok_or("Couldn't clone VPK path")?,
    );

    let running = true;
    {
        let mut state_guard = state.extract_state.lock().unwrap();
        state_guard.running = true;
    }

    match state_guard.loaded_format {
        Some(PakFormat::VPKRespawn) => {
            let vpk = state_guard.revpk.as_ref().unwrap();

            vpk.tree
                .files
                .par_iter()
                .filter(|(f, _)| f.starts_with(dir))
                .for_each_with(running, |running, (file_path, _)| {
                    if *running {
                        let state_guard = state.extract_state.lock().unwrap();
                        *running = state_guard.running;
                    }

                    if !*running {
                        return;
                    }

                    let path = if file_path.starts_with(" /") {
                        file_path[2..].to_string()
                    } else {
                        file_path.clone()
                    };

                    let res = vpk.extract_file(
                        &archive_path,
                        &vpk_name,
                        &file_path,
                        &format!("{}/{}", out_dir, path),
                    );
                    match res {
                        Ok(_) => {
                            println!("Extracted: {}", &file_path);
                            window
                                .emit(
                                    "extracted",
                                    ExtractedPayload {
                                        file: file_path.clone(),
                                        e: None,
                                    },
                                )
                                .unwrap();
                        }
                        Err(e) => {
                            println!("Failed to extract {}: {}", &file_path, e);
                            window
                                .emit(
                                    "extract-fail",
                                    ExtractedPayload {
                                        file: file_path.clone(),
                                        e: Some(e),
                                    },
                                )
                                .unwrap();
                        }
                    }
                });

            Ok(())
        }
        Some(PakFormat::VPKVersion1) => {
            let vpk = state_guard.vpk_version1.as_ref().unwrap();

            vpk.tree
                .files
                .par_iter()
                .filter(|(f, _)| f.starts_with(dir))
                .for_each_with(running, |running, (file_path, _)| {
                    if *running {
                        let state_guard = state.extract_state.lock().unwrap();
                        *running = state_guard.running;
                    }

                    if !*running {
                        return;
                    }

                    let path = if file_path.starts_with(" /") {
                        file_path[2..].to_string()
                    } else {
                        file_path.clone()
                    };

                    let res = vpk.extract_file(
                        &archive_path,
                        &vpk_name,
                        &file_path,
                        &format!("{}/{}", out_dir, path),
                    );
                    match res {
                        Ok(_) => {
                            println!("Extracted: {}", &file_path);
                            window
                                .emit(
                                    "extracted",
                                    ExtractedPayload {
                                        file: file_path.clone(),
                                        e: None,
                                    },
                                )
                                .unwrap();
                        }
                        Err(e) => {
                            println!("Failed to extract {}: {}", &file_path, &e);
                            window
                                .emit(
                                    "extract-fail",
                                    ExtractedPayload {
                                        file: file_path.clone(),
                                        e: Some(e),
                                    },
                                )
                                .unwrap();
                        }
                    }
                });

            Ok(())
        }
        _ => Err("Unsupported format".to_string()),
    }
}

#[tauri::command]
async fn extract_file(
    window: Window,
    state: tauri::State<'_, AppState>,
    file_path: String,
    out_dir: &str,
) -> Result<(), String> {
    let state_guard = state.inner.lock().unwrap();

    let archive_path = vpk_archive_path(
        &state_guard
            .vpk_path
            .clone()
            .ok_or("Couldn't clone VPK path")?,
    );
    let vpk_name = get_vpk_name(
        &state_guard
            .vpk_path
            .clone()
            .ok_or("Couldn't clone VPK path")?,
    );

    match state_guard.loaded_format {
        Some(PakFormat::VPKRespawn) => {
            let vpk = state_guard.revpk.as_ref().unwrap();

            let path = if file_path.starts_with(" /") {
                file_path[2..].to_string()
            } else {
                file_path.clone()
            };

            let res = vpk.extract_file(
                &archive_path,
                &vpk_name,
                &file_path,
                &format!("{}/{}", out_dir, path),
            );

            match res {
                Ok(_) => {
                    println!("Extracted: {}", &file_path);
                    window
                        .emit(
                            "extracted",
                            ExtractedPayload {
                                file: file_path.clone(),
                                e: None,
                            },
                        )
                        .unwrap();
                    Ok(())
                }
                Err(e) => {
                    println!("Failed to extract {}: {}", &file_path, &e);
                    window
                        .emit(
                            "extract-fail",
                            ExtractedPayload {
                                file: file_path.clone(),
                                e: Some(e.clone()),
                            },
                        )
                        .unwrap();
                    Err(e)
                }
            }
        }
        Some(PakFormat::VPKVersion1) => {
            let vpk = state_guard.vpk_version1.as_ref().unwrap();

            let path = if file_path.starts_with(" /") {
                file_path[2..].to_string()
            } else {
                file_path.clone()
            };

            let res = vpk.extract_file(
                &archive_path,
                &vpk_name,
                &file_path,
                &format!("{}/{}", out_dir, path),
            );

            match res {
                Ok(_) => {
                    println!("Extracted: {}", &file_path);
                    window
                        .emit(
                            "extracted",
                            ExtractedPayload {
                                file: file_path.clone(),
                                e: None,
                            },
                        )
                        .unwrap();
                    Ok(())
                }
                Err(e) => {
                    println!("Failed to extract {}: {}", &file_path, &e);
                    window
                        .emit(
                            "extract-fail",
                            ExtractedPayload {
                                file: file_path.clone(),
                                e: Some(e.clone()),
                            },
                        )
                        .unwrap();
                    Err(e)
                }
            }
        }
        _ => Err("Unsupported format".to_string()),
    }
}

#[tauri::command]
async fn extract_files(
    window: Window,
    state: tauri::State<'_, AppState>,
    files: Vec<String>,
    out_dir: &str,
) -> Result<(), String> {
    let state_guard = state.inner.lock().unwrap();

    let archive_path = vpk_archive_path(
        &state_guard
            .vpk_path
            .clone()
            .ok_or("Couldn't clone VPK path")?,
    );
    let vpk_name = get_vpk_name(
        &state_guard
            .vpk_path
            .clone()
            .ok_or("Couldn't clone VPK path")?,
    );

    let running = true;
    {
        let mut state_guard = state.extract_state.lock().unwrap();
        state_guard.running = true;
    }

    match state_guard.loaded_format {
        Some(PakFormat::VPKRespawn) => {
            let vpk = state_guard.revpk.as_ref().unwrap();

            vpk.tree
                .files
                .par_iter()
                .filter(|(f, _)| files.contains(&f))
                .for_each_with(running, |running, (file_path, _)| {
                    if *running {
                        let state_guard = state.extract_state.lock().unwrap();
                        *running = state_guard.running;
                    }

                    if !*running {
                        return;
                    }

                    let path = if file_path.starts_with(" /") {
                        file_path[2..].to_string()
                    } else {
                        file_path.clone()
                    };

                    let res = vpk.extract_file(
                        &archive_path,
                        &vpk_name,
                        &file_path,
                        &format!("{}/{}", out_dir, path),
                    );
                    match res {
                        Ok(_) => {
                            println!("Extracted: {}", &file_path);
                            window
                                .emit(
                                    "extracted",
                                    ExtractedPayload {
                                        file: file_path.clone(),
                                        e: None,
                                    },
                                )
                                .unwrap();
                        }
                        Err(e) => {
                            println!("Failed to extract {}: {}", &file_path, e);
                            window
                                .emit(
                                    "extract-fail",
                                    ExtractedPayload {
                                        file: file_path.clone(),
                                        e: Some(e),
                                    },
                                )
                                .unwrap();
                        }
                    }
                });

            Ok(())
        }
        Some(PakFormat::VPKVersion1) => {
            let vpk = state_guard.vpk_version1.as_ref().unwrap();

            vpk.tree
                .files
                .par_iter()
                .filter(|(f, _)| files.contains(&f))
                .for_each_with(running, |running, (file_path, _)| {
                    if *running {
                        let state_guard = state.extract_state.lock().unwrap();
                        *running = state_guard.running;
                    }

                    if !*running {
                        return;
                    }

                    let path = if file_path.starts_with(" /") {
                        file_path[2..].to_string()
                    } else {
                        file_path.clone()
                    };

                    let res = vpk.extract_file(
                        &archive_path,
                        &vpk_name,
                        &file_path,
                        &format!("{}/{}", out_dir, path),
                    );
                    match res {
                        Ok(_) => {
                            println!("Extracted: {}", &file_path);
                            window
                                .emit(
                                    "extracted",
                                    ExtractedPayload {
                                        file: file_path.clone(),
                                        e: None,
                                    },
                                )
                                .unwrap();
                        }
                        Err(e) => {
                            println!("Failed to extract {}: {}", &file_path, &e);
                            window
                                .emit(
                                    "extract-fail",
                                    ExtractedPayload {
                                        file: file_path.clone(),
                                        e: Some(e),
                                    },
                                )
                                .unwrap();
                        }
                    }
                });

            Ok(())
        }
        _ => Err("Unsupported format".to_string()),
    }
}

#[tauri::command]
fn extract_cancel(state: tauri::State<AppState>) {
    let mut state_guard = state.extract_state.lock().unwrap();
    state_guard.running = false;
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            select_vpk,
            load_vpk,
            get_file_list,
            get_file_entry,
            extract_all,
            extract_dir,
            extract_file,
            extract_files,
            count_dir,
            extract_cancel,
            read_file,
        ])
        .register_uri_scheme_protocol("preview", preview_protocol)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
