"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vpk_1 = require("./vpk");
const fs = require('fs').promises;
const { workerData, parentPort } = require("worker_threads");
let vpk = new vpk_1.VPK(workerData.vpkPath);
vpk.readTree();
parentPort.on("message", async (msg) => {
    if (msg.task === "exit") {
        parentPort.close();
    }
    else {
        if (msg.task == "copyFile") {
            const { file, destination } = msg;
            const data = await vpk.readFile(file, workerData.patchWav);
            await fs.mkdir(destination.substring(0, destination.lastIndexOf("/") + 1), { recursive: true });
            await fs.writeFile(destination, data);
            parentPort.postMessage({ type: 1 });
        }
    }
});
//# sourceMappingURL=worker.js.map