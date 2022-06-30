"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VPK = void 0;
const crc_1 = __importDefault(require("./crc"));
const buffer_1 = __importDefault(require("./buffer"));
const cam_1 = __importDefault(require("./cam"));
const HEADER_196610_LENGTH = 16;
const fs = require('fs');
const lzham = require('./build/Release/lzham.node');
function stripPakLang(directoryPath) {
    let stripped = directoryPath.replace(/english|french|german|italian|japanese|korean|polish|portugese|russian|spanish|tchinese/, '');
    return stripped;
}
class VPKHeader {
    constructor(path) {
        this.errors = [];
        this.signature = NaN;
        this.version = NaN;
        this.treeLength = NaN;
        this.unknown1 = NaN;
        this.directoryPath = path;
    }
    read() {
        let r = new buffer_1.default(HEADER_196610_LENGTH, this.directoryPath);
        this.signature = r.readUInt32();
        this.version = r.readUInt32();
        this.treeLength = r.readUInt32();
        this.unknown1 = r.readUInt32();
    }
    isValid() {
        let valid = true;
        if (this.signature != 0x55aa1234) {
            this.errors.push("Invalid header signature");
            valid = false;
        }
        if (this.version != 196610) {
            this.errors.push("Invalid header version");
            valid = false;
        }
        if (this.treeLength == 0) {
            this.errors.push("Invalid tree length (0)");
            valid = false;
        }
        if (this.unknown1 != 0) {
            this.errors.push("unknown1 was not 0!");
            valid = false;
        }
        return valid;
    }
}
class VPKDirectoryEntry {
    constructor(r) {
        this.preloadOffset = NaN;
        this.crc = r.readUInt32();
        this.preloadBytes = r.readUInt16();
        this.fileParts = [];
        let part = new VPKFilePartEntry(r);
        while (part.valid) {
            this.fileParts.push(part);
            if (!part.valid)
                break;
            part = new VPKFilePartEntry(r);
        }
        if (this.preloadBytes)
            this.preloadOffset = r.tell();
    }
}
class VPKTree {
    constructor(path) {
        this.files = {};
        this.entries = {};
        this.numFiles = 0;
        this.hasRead = false;
        this.directoryPath = path;
    }
    read() {
        const stat = fs.statSync(this.directoryPath);
        let r = new buffer_1.default(stat.size, this.directoryPath);
        r.skip(HEADER_196610_LENGTH);
        while (true) {
            let extension = r.readString();
            if (extension === '') {
                break;
            }
            if (!this.entries[extension])
                this.entries[extension] = {};
            while (true) {
                let directory = r.readString();
                ;
                if (directory === '') {
                    break;
                }
                if (!this.entries[extension][directory])
                    this.entries[extension][directory] = {};
                while (true) {
                    let filename = r.readString();
                    if (filename === '') {
                        break;
                    }
                    if (!this.entries[extension][directory][filename])
                        this.entries[extension][directory][filename] = {};
                    let fullPath = filename;
                    if (fullPath === ' ') {
                        fullPath = '';
                    }
                    if (extension !== ' ') {
                        fullPath += '.' + extension;
                    }
                    if (directory !== ' ') {
                        fullPath = directory + '/' + fullPath;
                    }
                    let entry = new VPKDirectoryEntry(r);
                    r.skip(entry.preloadBytes);
                    this.files[fullPath] = entry;
                    this.entries[extension][directory][filename] = entry;
                    this.numFiles++;
                }
            }
        }
        this.hasRead = true;
    }
}
var EPackedLoadFlags;
(function (EPackedLoadFlags) {
    EPackedLoadFlags[EPackedLoadFlags["LOAD_NONE"] = 0] = "LOAD_NONE";
    EPackedLoadFlags[EPackedLoadFlags["LOAD_VISIBLE"] = 1] = "LOAD_VISIBLE";
    EPackedLoadFlags[EPackedLoadFlags["LOAD_CACHE"] = 256] = "LOAD_CACHE";
    EPackedLoadFlags[EPackedLoadFlags["LOAD_TEXTURE_UNK0"] = 262144] = "LOAD_TEXTURE_UNK0";
    EPackedLoadFlags[EPackedLoadFlags["LOAD_TEXTURE_UNK1"] = 524288] = "LOAD_TEXTURE_UNK1";
    EPackedLoadFlags[EPackedLoadFlags["LOAD_TEXTURE_UNK2"] = 1048576] = "LOAD_TEXTURE_UNK2";
})(EPackedLoadFlags || (EPackedLoadFlags = {}));
;
var EPackedTextureFlags;
(function (EPackedTextureFlags) {
    EPackedTextureFlags[EPackedTextureFlags["TEXTURE_NONE"] = 0] = "TEXTURE_NONE";
    EPackedTextureFlags[EPackedTextureFlags["TEXTURE_DEFAULT"] = 8] = "TEXTURE_DEFAULT";
    EPackedTextureFlags[EPackedTextureFlags["TEXTURE_ENVIRONMENT_MAP"] = 1024] = "TEXTURE_ENVIRONMENT_MAP";
})(EPackedTextureFlags || (EPackedTextureFlags = {}));
;
class VPKFilePartEntry {
    constructor(r) {
        this.loadFlags = EPackedLoadFlags.LOAD_NONE;
        this.textureFlags = EPackedTextureFlags.TEXTURE_NONE;
        this.entryOffset = NaN;
        this.entryLength = NaN;
        this.entryLengthUncompressed = NaN;
        this.isCompressed = false;
        this.valid = true;
        this.archiveIndex = r.readUInt16();
        if (this.archiveIndex === 0xFFFF) {
            this.valid = false;
        }
        else {
            this.loadFlags = r.readUInt16();
            this.textureFlags = r.readUInt32();
            this.entryOffset = r.readUInt64();
            this.entryLength = r.readUInt64();
            this.entryLengthUncompressed = r.readUInt64();
            this.isCompressed = (this.entryLength != this.entryLengthUncompressed);
        }
    }
}
class VPK {
    constructor(path) {
        this.errors = [];
        this.cams = {};
        this.readHandles = {};
        this.directoryPath = path;
        this.tree = new VPKTree(this.directoryPath);
        this.header = new VPKHeader(this.directoryPath);
        if (this.isValid()) {
            this.header.read();
        }
    }
    isValid() {
        let valid = true;
        if (this.directoryPath.split('_').pop() != 'dir.vpk') {
            this.errors.push('Not a "_dir.vpk" file');
            valid = false;
        }
        if (!fs.existsSync(this.directoryPath)) {
            this.errors.push("File doesn't exist");
            valid = false;
        }
        return valid;
    }
    readTree() {
        if (this.tree instanceof VPKTree)
            this.tree.read();
    }
    get files() {
        return Object.keys(this.tree instanceof VPKTree ? this.tree.files : []);
    }
    close() {
        Promise.all(Object.values(this.readHandles).map(h => h.close()))
            .then(() => { this.readHandles = {}; });
    }
    async readFile(path, patchWav = true) {
        if (!this.isValid())
            throw new Error('VPK isn\'t valid');
        if (!this.header.isValid())
            throw new Error('VPK header is not valid');
        if (!(this.tree.hasRead))
            throw new Error('VPK tree has not yet been read');
        let entry = this.tree.files[path];
        if (!entry) {
            return null;
        }
        let entryLength = 0;
        for (const part of entry.fileParts) {
            entryLength += part.entryLengthUncompressed;
        }
        let file = Buffer.alloc(entry.preloadBytes + entryLength);
        let currentLength = 0;
        if (entry.preloadBytes > 0) {
            if (!this.readHandles[this.directoryPath])
                this.readHandles[this.directoryPath] = await fs.promises.open(this.directoryPath, 'r');
            await this.readHandles[this.directoryPath].read(file, 0, entry.preloadBytes, entry.preloadOffset);
            currentLength += entry.preloadBytes;
        }
        let camEntry;
        if (entryLength > 0) {
            for (let i = 0; i < entry.fileParts.length; i++) {
                const part = entry.fileParts[i];
                let fileIndex = ('000' + part.archiveIndex).slice(-3);
                let archivePath = stripPakLang(this.directoryPath).replace(/_dir\.vpk$/, '_' + fileIndex + '.vpk');
                let buf = Buffer.alloc(part.entryLength);
                if (!this.readHandles[archivePath])
                    this.readHandles[archivePath] = await fs.promises.open(archivePath, 'r');
                await this.readHandles[archivePath].read(buf, 0, part.entryLength, part.entryOffset);
                if (!part.isCompressed) {
                    buf.copy(file, currentLength);
                }
                else {
                    let decompressedBuf = lzham.decompress(buf, part.entryLengthUncompressed);
                    decompressedBuf.copy(file, currentLength);
                }
                currentLength += part.entryLengthUncompressed;
                if (i == 0 && path.endsWith('.wav')) {
                    if (!this.cams[archivePath]) {
                        let newCam = new cam_1.default(archivePath);
                        newCam.read();
                        this.cams[archivePath] = newCam;
                    }
                    camEntry = this.cams[archivePath].entries.find(e => e.vpkContentOffset == part.entryOffset);
                }
            }
        }
        if (patchWav && path.endsWith('.wav') && camEntry) {
            let checksum = file.subarray(4, 12);
            let firstByteIdx = 12;
            let padByte;
            padByte = file[firstByteIdx];
            while (padByte == 0xCB) {
                padByte = file[firstByteIdx];
                firstByteIdx++;
            }
            firstByteIdx -= 1;
            let lastByteIdx = file.byteLength - 1;
            padByte = file[lastByteIdx];
            while (padByte == 0xBC) {
                padByte = file[lastByteIdx];
                lastByteIdx--;
            }
            let headerSize = camEntry.headerSize;
            let realLength = headerSize + (2 * camEntry.sampleCount * camEntry.channels);
            file = file.subarray(headerSize, realLength + 1);
            let sampleRate = (camEntry === null || camEntry === void 0 ? void 0 : camEntry.bitrate) || 44100;
            let sampleDepth = 16;
            let channels = (camEntry === null || camEntry === void 0 ? void 0 : camEntry.channels) || 1;
            let wavHeader = Buffer.alloc(44);
            wavHeader.writeUInt32BE(0x52494646, 0);
            wavHeader.writeUInt32LE(file.byteLength - 8 + 44, 4);
            wavHeader.writeUInt32BE(0x57415645, 8);
            wavHeader.writeUInt32BE(0x666D7420, 12);
            wavHeader.writeUInt32LE(16, 16);
            wavHeader.writeUInt16LE(1, 20);
            wavHeader.writeUInt16LE(channels, 22);
            wavHeader.writeUInt32LE(sampleRate, 24);
            wavHeader.writeUInt32LE(sampleRate * sampleDepth * channels / 8, 28);
            wavHeader.writeUInt16LE(sampleDepth * channels / 8, 32);
            wavHeader.writeUInt16LE(sampleDepth, 34);
            wavHeader.writeUInt32BE(0x64617461, 36);
            wavHeader.writeUInt32LE(file.byteLength, 40);
            file = Buffer.concat([wavHeader, file]);
        }
        else if (!path.endsWith('.wav') && (0, crc_1.default)(file) !== entry.crc) {
            throw new Error('CRC does not match');
        }
        return file;
    }
}
exports.VPK = VPK;
//# sourceMappingURL=vpk.js.map