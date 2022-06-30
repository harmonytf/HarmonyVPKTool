"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('fs');
class ReadBuffer {
    constructor(lengthOrBuffer, inputPath = undefined) {
        this.offset = 0;
        if (typeof lengthOrBuffer == 'number') {
            this.buffer = Buffer.alloc(lengthOrBuffer);
        }
        else {
            this.buffer = Buffer.alloc(lengthOrBuffer.byteLength);
            lengthOrBuffer.copy(this.buffer);
        }
        if (inputPath) {
            let file = fs.openSync(inputPath, 'r');
            fs.readSync(file, this.buffer, 0, this.buffer.length, 0);
            fs.closeSync(file);
        }
        this.offset = 0;
    }
    readBytes(lengthBytes) {
        let ret = this.buffer.subarray(this.offset, this.offset + lengthBytes);
        this.offset += lengthBytes;
        return ret;
    }
    readInt8() {
        let ret = this.buffer.readInt8(this.offset);
        this.offset += 1;
        return ret;
    }
    readUInt8() {
        let ret = this.buffer.readUInt8(this.offset);
        this.offset += 1;
        return ret;
    }
    readInt16() {
        let ret = this.buffer.readInt16LE(this.offset);
        this.offset += 2;
        return ret;
    }
    readUInt16() {
        let ret = this.buffer.readUInt16LE(this.offset);
        this.offset += 2;
        return ret;
    }
    readInt24() {
        let ret = this.buffer.readIntLE(this.offset, 3);
        this.offset += 3;
        return ret;
    }
    readUInt24() {
        let ret = this.buffer.readUIntLE(this.offset, 3);
        this.offset += 3;
        return ret;
    }
    readInt32() {
        let ret = this.buffer.readUInt32LE(this.offset);
        this.offset += 4;
        return ret;
    }
    readUInt32() {
        let ret = this.buffer.readUInt32LE(this.offset);
        this.offset += 4;
        return ret;
    }
    readUInt32BE() {
        let ret = this.buffer.readUInt32BE(this.offset);
        this.offset += 4;
        return ret;
    }
    readUInt64() {
        const hi = this.buffer.readUInt32LE(this.offset + 4);
        const lo = this.buffer.readUInt32LE(this.offset);
        this.offset += 8;
        return lo + 2 ** 32 * hi;
    }
    readString() {
        let termninatorIndex = this.buffer.indexOf('\0', this.offset);
        let ret = this.buffer.subarray(this.offset, termninatorIndex).toString();
        this.offset = termninatorIndex + 1;
        return ret;
    }
    skip(bytes) {
        this.offset += bytes;
    }
    setOffset(bytes) {
        this.offset = bytes;
    }
    tell() {
        return this.offset;
    }
}
exports.default = ReadBuffer;
DataView.prototype.getBigUint64;
//# sourceMappingURL=buffer.js.map