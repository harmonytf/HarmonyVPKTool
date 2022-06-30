"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VPKCopy = void 0;
const { Worker } = require('worker_threads');
const { EventEmitter } = require('events');
class CopyWorker extends EventEmitter {
    constructor(vpkPath, patchWav = true) {
        super();
        this.vpkPath = vpkPath;
        this.self = new Worker(__dirname + '/worker.js', {
            workerData: {
                vpkPath,
                patchWav
            }
        });
        this.self.on("message", (msg) => { this.emit("message", msg); });
        this.self.on("error", (err) => { this.emit("error", err); });
        this.self.on("exit", (code) => { this.emit("exit", code); });
    }
    copyFile(file, destination) {
        this.self.postMessage({ task: "copyFile", file, destination });
    }
    exit() {
        this.self.postMessage({ task: "exit" });
    }
}
var VPKCopyMode;
(function (VPKCopyMode) {
    VPKCopyMode[VPKCopyMode["NONE"] = 0] = "NONE";
    VPKCopyMode[VPKCopyMode["COPY"] = 1] = "COPY";
})(VPKCopyMode || (VPKCopyMode = {}));
class VPKCopy extends EventEmitter {
    constructor(vpkPath, threads = 8, patchWav = true) {
        super();
        this.outPath = "";
        this.files = [];
        this.fileCount = 0;
        this.mode = VPKCopyMode.NONE;
        this.taskResolve = null;
        this.vpkPath = vpkPath;
        this.threads = threads;
        this.patchWav = patchWav;
        this.workers = [];
        for (let i = 0; i < threads; i++) {
            let worker = new CopyWorker(vpkPath, patchWav);
            worker.on("message", (msg) => { this.handleWorkerMsg(i, msg); });
            this.workers.push(worker);
        }
    }
    handleWorkerMsg(i, msg) {
        if (this.mode == VPKCopyMode.COPY) {
            if (this.files.length > 0) {
                this.workerDoCopy(i, this.files.shift());
            }
            else {
                this.mode = VPKCopyMode.NONE;
                if (this.taskResolve)
                    this.taskResolve();
            }
        }
    }
    workerDoCopy(i, file) {
        this.emit("progress", {
            workerIdx: i,
            file,
            current: this.fileCount - this.files.length,
            total: this.fileCount
        });
        this.workers[i].copyFile(file, this.outPath + '/' + file);
    }
    copy(files, outPath) {
        return new Promise(resolve => {
            this.files = files;
            this.fileCount = files.length;
            this.outPath = outPath;
            this.taskResolve = () => { this.taskResolve = null; resolve(); };
            if (files.length == 0)
                return this.taskResolve();
            this.mode = VPKCopyMode.COPY;
            for (let i = 0; i < this.files.length && i < this.workers.length; i++) {
                this.workerDoCopy(i, this.files.shift());
            }
        });
    }
    close() {
        this.workers.forEach(worker => {
            worker.exit();
        });
    }
}
exports.VPKCopy = VPKCopy;
//# sourceMappingURL=reader.js.map