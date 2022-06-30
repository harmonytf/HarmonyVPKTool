"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const buffer_1 = __importDefault(require("./buffer"));
const fs = require('fs');
class CAMEntry {
    constructor(r) {
        this.magic = NaN;
        this.originalSize = NaN;
        this.compressedSize = NaN;
        this.bitrate = NaN;
        this.channels = NaN;
        this.sampleCount = NaN;
        this.headerSize = NaN;
        this.vpkContentOffset = NaN;
        this.magic = r.readUInt32();
        this.originalSize = r.readUInt32();
        this.compressedSize = r.readUInt32();
        this.bitrate = r.readUInt24();
        this.channels = r.readUInt8();
        this.sampleCount = r.readUInt32();
        this.headerSize = r.readUInt32();
        this.vpkContentOffset = r.readUInt64();
    }
}
class CAM {
    constructor(vpkPath) {
        this.entries = [];
        this.hasRead = false;
        this.camPath = vpkPath + '.cam';
    }
    read() {
        const stat = fs.statSync(this.camPath);
        let r = new buffer_1.default(stat.size, this.camPath);
        while (true) {
            if (r.tell() == stat.size)
                break;
            let entry = new CAMEntry(r);
            if (entry.magic == 3302889984)
                this.entries.push(entry);
        }
    }
}
exports.default = CAM;
//# sourceMappingURL=cam.js.map