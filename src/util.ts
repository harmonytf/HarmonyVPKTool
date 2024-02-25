export function bytesToSize(bytes: number): string {
    let sizes = ['bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 bytes';
    let i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 2 : 0) + ' ' + sizes[i];
}

export const AUDIO_FILE_EXTENSIONS = ["wav", "ogg"];
export const TEXT_FILE_EXTENSIONS = ["txt", "cfg", "nut", "gnut", "res", "menu", "vmt", "lst", "set", "ent"];

export function isAudioFile(file: string) {
    return AUDIO_FILE_EXTENSIONS.includes(file.split('.').pop() || '');
}

export function isTextFile(file: string) {
    return TEXT_FILE_EXTENSIONS.includes(file.split('.').pop() || '');
}

export function getTextEncoding(buf: Uint8Array): string {
    let d = buf.subarray(0, 5);
    return d[0] === 0xfe && d[1] === 0xff ? "utf-16be" : d[0] === 0xff && d[1] === 0xfe ? "utf-16le" : "utf8";
}