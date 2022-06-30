"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crcTable = [
    0x00000000, 0x1db71064, 0x3b6e20c8, 0x26d930ac, 0x76dc4190, 0x6b6b51f4, 0x4db26158, 0x5005713c,
    0xedb88320, 0xf00f9344, 0xd6d6a3e8, 0xcb61b38c, 0x9b64c2b0, 0x86d3d2d4, 0xa00ae278, 0xbdbdf21c,
];
function crc32(buf) {
    var crc = 0 ^ (-1);
    for (var i = 0; i < buf.byteLength; i++) {
        crc = (crc >>> 4) ^ crcTable[(crc & 0xF) ^ (buf[i] & 0xF)];
        crc = (crc >>> 4) ^ crcTable[(crc & 0xF) ^ (buf[i] >> 4)];
    }
    return (crc ^ (-1)) >>> 0;
}
exports.default = crc32;
;
//# sourceMappingURL=crc.js.map