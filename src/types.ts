export interface DirTree {
    name?: string;
    path?: string;
    dirs: DirTree[];
    files: string[];
}

export interface VPKDirEntry {
    crc: number;
    preload_bytes: number;
    archive_index?: number;
    entry_offset?: number;
    entry_length?: number;
    // Respawn VPK
    file_parts?: VPKRespawnFilePartEntry[];
}

export interface VPKRespawnFilePartEntry {
    archive_index: number;
    load_flags: number;
    texture_flags: number;
    entry_offset: number;
    entry_length: number;
    entry_length_uncompressed: number;
}