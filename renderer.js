function constructDirTree(files) {
    var fileTree = {}
    const paths = Object.keys(files);
    paths.forEach(function(path) {
        path.split('/').reduce(function(r, e, index) {
            if(e.split('.')[1]) {
                if(!r.files) r.files = []
                let compressedSize = files[path].fileParts.reduce((a, b) => (a + b.entryLength), 0)
                let uncompressedSize = files[path].fileParts.reduce((a, b) => (a + b.entryLengthUncompressed), 0)
                r.files.push({ name: e, compressedSize, uncompressedSize, path, fileParts: files[path].fileParts })
                return r.files[r.files.length - 1]
            } else {
                if(!r.dirs) r.dirs = []
                if(r.dirs.find(d => d.name == e)) return r.dirs.find(d => d.name == e)
                let fullPath = path.split('/').slice(0, index+1).join('/')
                let allFiles = paths.filter(f => f.startsWith(fullPath));
                let totalCompressed = allFiles.reduce((p, c) => { return p + files[c].fileParts.reduce((a, b) => (a + b.entryLength), 0) }, 0)
                let totalUncompressed = allFiles.reduce((p, c) => { return p + files[c].fileParts.reduce((a, b) => (a + b.entryLengthUncompressed), 0) }, 0)
                r.dirs.push({ name: e, path: fullPath, totalFiles: allFiles.length, totalCompressed, totalUncompressed })
                return r.dirs[r.dirs.length - 1]
            }
        }, fileTree)
    })
    return fileTree;
}

let vpkPath;
let vpk;
let isVpkOpen = false;
let isDialogOpen = false;

async function selectVPK() {
    if(isDialogOpen) return;
    isDialogOpen = true;
    tmpVpkPath = await window.api.openVPK();
    isDialogOpen = false;

    if(!tmpVpkPath)
        return //document.querySelector("#dirVPKName").innerText = "VPK open cancelled";
        
    vpkPath = tmpVpkPath;

    isVpkOpen = false;

    let isDir = vpkPath.endsWith("_dir.vpk");

    if(!isDir) {
        let vpkPathSplit = vpkPath.split(/\/|\\/);
        let vpkFile = vpkPathSplit.pop();
        let lang = "english"
        vpkPath = vpkPathSplit.join('\\') + '\\' + lang + vpkFile.replace(/[0-9]{3}\.vpk$/, "dir.vpk")
    }

    vpkPath = vpkPath.replaceAll("\\", "/")

    document.querySelector("#dirVPKName").innerText = "Loading VPK...";

    vpk = await window.api.readVPKTree(vpkPath);

    if(vpk.errors.length > 0) {
        return document.querySelector("#dirVPKName").innerText = "Error parsing VPK";
    }

    var fileTree = constructDirTree(vpk.tree.files);
    console.log(fileTree);

    document.querySelector("#dirVPKName").innerText = vpkPath.split(/\/|\\/).pop();

    fileTree.name = "RootDir";
    fileTree.path = "";
    fileTree.totalFiles = Object.keys(vpk.tree.files).length;
    fileTree.totalCompressed = Object.values(vpk.tree.files).reduce((p, c) => { return p + c.fileParts.reduce((a, b) => (a + b.entryLength), 0) }, 0);
    fileTree.totalUncompressed = Object.values(vpk.tree.files).reduce((p, c) => { return p + c.fileParts.reduce((a, b) => (a + b.entryLengthUncompressed), 0) }, 0);

    showDirDetails(fileTree);
    renderTree(fileTree);

    isVpkOpen = true;
}

function renderTree(fileTree) {
    document.querySelector("#tree").innerHTML = "";
    renderDirs([fileTree], document.querySelector("#tree"))

    document.querySelector("#tree > .treeDir").classList.add("visible");
}

document.querySelector("#context").addEventListener("mousedown", e => {
    e.stopPropagation();
})
document.addEventListener("mousedown", e => {
    closeContextMenu();
})

function closeContextMenu() {
    document.querySelector("#context").classList.remove("visible");
}

function showContextMenu(type, actions, pos) {
    document.querySelector("#context > .ctxType").innerText = type;

    if(!actions || actions.length == 0) {
        document.querySelector("#context > .ctxActions").innerHTML = `<span class="ctxAction disabled">No actions</span>`;
    } else {
        document.querySelector("#context > .ctxActions").innerHTML = "";
        for(let i = 0; i < actions.length; i++) {
            let a = actions[i];
            let a_spanNode = document.createElement("span");
            let a_textNode = document.createTextNode(a.text);
            a_spanNode.classList.add("ctxAction");
            if(a.disabled)
                a_spanNode.classList.add("disabled");
            
            if(a.cb)
                a_spanNode.addEventListener("click", e => { closeContextMenu(); a.cb(e); })

            a_spanNode.appendChild(a_textNode);
            document.querySelector("#context > .ctxActions").appendChild(a_spanNode);
            
        }
    }

    document.querySelector("#context").classList.add("visible");
    document.querySelector("#context").style.top = pos.y + "px";
    document.querySelector("#context").style.left = pos.x + "px";
}

function renderDirs(dirs, parentEl) {
    dirs.forEach(d => {
        let d_divNode = document.createElement("div");
        d_divNode.classList.add('treeDir');
        d_divNode.setAttribute('data-fullpath', d.path);
        let d_spanNode = document.createElement("span");
        let d_textNode = document.createTextNode(d.name);
        d_spanNode.appendChild(d_textNode);
        d_divNode.appendChild(d_spanNode);

        d_spanNode.addEventListener('click', () => { d_divNode.classList.toggle('visible'); showDirDetails(d); })

        d_spanNode.addEventListener( "contextmenu", function(e) {
            showContextMenu("Directory", [
                { text: "Show details", cb: () => { showDirDetails(d); }, disabled: false },
                { text: "Unpack directory", cb: () => { unpackDir(d); }, disabled: false }
            ], { x: e.x, y: e.y })
        });

        parentEl.appendChild(d_divNode);

        if(d.dirs) {
            renderDirs(d.dirs, d_divNode);
        }
        if(d.files) {
            d.files.forEach(f => {
                let f_divNode = document.createElement("div");
                f_divNode.classList.add('treeFile');
                f_divNode.setAttribute('data-fullpath', f.path);
                let f_spanNode = document.createElement("span");
                let f_textNode = document.createTextNode(f.name);
                f_spanNode.appendChild(f_textNode);
                f_divNode.appendChild(f_spanNode);

                f_spanNode.addEventListener("click", () => { showFileDetails(f); });

                f_spanNode.addEventListener( "contextmenu", function(e) {
                    showContextMenu(`${f.name.split(".").pop().toUpperCase()} file`, [
                        { text: "Show details", cb: () => { showFileDetails(f); }, disabled: false },
                        { text: "Preview file", cb: () => { previewFile(f); }, disabled: false },
                        { text: "Unpack file", cb: () => { unpackFile(f); }, disabled: false }
                    ], { x: e.x, y: e.y })
                });

                d_divNode.appendChild(f_divNode);
            })
        }
    })
}

function showDirDetails(d) {
    console.log("Show details:", d);
    document.querySelector("#details").classList.add("visible");
    document.querySelector("#details > .title").innerText = "Directory Details";
    document.querySelector("#detailsPreviewButton").classList.add("hidden");

    document.querySelector("#details > .path > span").innerText = d.path || "/";
    document.querySelector("#details > .fileType").classList.add("hidden");
    document.querySelector("#details > .totalFiles > span").innerText = d.totalFiles;
    document.querySelector("#details > .totalFiles").classList.remove("hidden");
    document.querySelector("#details > .totalCompressed > span").innerText = bytesToSize(d.totalCompressed);
    document.querySelector("#details > .totalUncompressed > span").innerText = bytesToSize(d.totalUncompressed);
    
    document.querySelector("#details > .filePartsTitle").classList.add("hidden");
    document.querySelector("#details > .fileParts").classList.add("hidden");

    document.querySelector("#details > #detailsUnpackButton").removeEventListeners("click");
    document.querySelector("#details > #detailsUnpackButton").addEventListener("click", () => { unpackDir(d); });
}

function showFileDetails(f) {
    console.log("Show details:", f);
    document.querySelector("#details").classList.add("visible");
    document.querySelector("#details > .title").innerText = "File Details";
    document.querySelector("#detailsPreviewButton").classList.remove("hidden");
    document.querySelector("#detailsPreviewButton").removeEventListeners("click");
    document.querySelector("#detailsPreviewButton").addEventListener("click", () => { previewFile(f) });
    
    document.querySelector("#details > .path > span").innerText = f.path;
    document.querySelector("#details > .fileType > span").innerText = f.name.split(".").pop().toUpperCase();
    document.querySelector("#details > .fileType").classList.remove("hidden");
    document.querySelector("#details > .totalFiles").classList.add("hidden");
    document.querySelector("#details > .totalCompressed > span").innerText = bytesToSize(f.compressedSize);
    document.querySelector("#details > .totalUncompressed > span").innerText = bytesToSize(f.uncompressedSize);

    document.querySelector("#details > .filePartsTitle").classList.remove("hidden");
    document.querySelector("#details > .fileParts").classList.remove("hidden");
    document.querySelector("#details > .fileParts").innerHTML = f.fileParts.map(p => {
        return `<div class="filePart"><p>Archive Index: <span>${p.archiveIndex}</span></p><p>Entry Offset: <span>${p.entryOffset}</span><p>Packed Size: <span>${p.entryLength}</span></p><p>Unpacked Size: <span>${p.entryLengthUncompressed}</span></p><p>Load Flags: <span>${p.loadFlags}</span></p><p>Texture Flags: <span>${p.textureFlags}</span></p></div>`
    }).join("")

    document.querySelector("#details > #detailsUnpackButton").removeEventListeners("click");
    document.querySelector("#details > #detailsUnpackButton").addEventListener("click", () => { unpackFile(f); });
}


function bytesToSize(bytes) {
    var sizes = [' bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes == 0) return '0 bytes';
    var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return (bytes / Math.pow(1024, i)).toFixed(2) + sizes[i];
}

async function unpackDir(d) {
    if(!isVpkOpen || isDialogOpen)
        return;
        
    console.log("Unpack:", d);

    let files = Object.keys(vpk.tree.files).filter(f => f.startsWith(d.path))
    unpack(files);
}
async function unpackFile(f) {
    if(!isVpkOpen || isDialogOpen)
        return;

    console.log("Unpack:", f);
    
    let files = [f.path]
    unpack(files);
}

async function unpack(files) {
    document.querySelector("#unpackOverlay").classList.remove("done");
    document.querySelector("#unpackPrompt > .title").innerText = "Unpacking...";
    document.querySelector("#unpackPrompt > .progressBar > .progressDone").style.width = "0%";
    document.querySelector("#unpackPrompt > .currentPath").innerText = "";
    document.querySelector("#unpackPrompt > .progress").innerText =  "0/" + files.length;

    isDialogOpen = true;
    let isUnpacking = await window.api.copyFiles(vpkPath, files)
    isDialogOpen = false;

    if(isUnpacking) {
        unpackStartTime = Date.now();
        document.querySelector("#unpackOverlay").classList.add("visible");
    }
}

let unpackStartTime;
window.api.onCopyProgress((e, p) => {
    document.querySelector("#unpackPrompt > .progressBar > .progressDone").style.width = p.current/p.total*100 + "%";
    document.querySelector("#unpackPrompt > .currentPath").innerText = p.file;
    document.querySelector("#unpackPrompt > .progress").innerText = p.current + "/" + p.total;
});
window.api.onCopyDone(e => {
    document.querySelector("#unpackPrompt > .title").innerText = "Unpacking Complete";
    document.querySelector("#unpackPrompt > .progress").innerText = `Took ${((Date.now() - unpackStartTime)/1000).toFixed(2)}s`;
    document.querySelector("#unpackOverlay").classList.add("done");
});

function closeUnpackOverlay() {
    document.querySelector("#unpackOverlay").classList.remove("visible");
}
function cancelUnpack() {
    window.api.copyCancel();
    closeUnpackOverlay();
}

let settings = {};
window.api.getSettings().then(renderSettings);

function renderSettings(s) {
    settings = s;

    document.querySelector("#setting_threadCount").value = settings.threadCount;
    document.querySelector("#setting_patchWavs").checked = settings.patchWavs;
}
function updateSettings() {
    settings.threadCount = document.querySelector("#setting_threadCount").value;
    settings.patchWavs = document.querySelector("#setting_patchWavs").checked;
    window.api.updateSettings(settings);
}

function openSettingsPrompt() {
    document.querySelector("#settingsOverlay").classList.add("visible");
}
function closeSettingsAndSave() {
    document.querySelector("#settingsOverlay").classList.remove("visible");
    updateSettings();
}

const TEXT_FILE_EXTENSIONS = ["txt", "cfg", "nut", "gnut", "res", "menu", "vmt", "lst"];

let previewFileOutPath;
async function previewFile(file) {
    console.log("Preview:", file);

    document.querySelector("#previewOverlay").classList.add("visible");
    document.querySelector("#previewPrompt").classList.remove("text");
    document.querySelector("#previewPrompt").classList.remove("unsupported");

    document.querySelector("#previewPrompt").classList.add("loading");

    document.querySelector("#previewPrompt > .filePath").innerText = file.path;

    let isText = TEXT_FILE_EXTENSIONS.includes(file.name.split(".").pop().toLowerCase());
    let res = await window.api.previewFile(vpkPath, file.path, isText);
    previewFileOutPath = res.outPath;

    document.querySelector("#previewPrompt").classList.remove("loading");

    if(isText) {
        document.querySelector("#previewPrompt").classList.add("text");
        
        document.querySelector("#previewPrompt > #textPreview").scrollTop = 0;
        document.querySelector("#previewPrompt > #textPreview").innerText = res.buf;
    } else {
        let fileType = file.name.split(".").pop().toLowerCase();
        switch (fileType) {
            case "wav":
                document.querySelector("#previewPrompt > #miscPreview").innerHTML = `<audio controls="controls" style="width: 420px;" src="${res.outPath}" type="audio/wav">`;
                document.querySelector("#previewPrompt > #miscPreview > audio").volume = 0.5;
                break;
            default:
                document.querySelector("#previewPrompt").classList.add("unsupported");
        }
    }
}
async function closePreview() {
    document.querySelector("#previewOverlay").classList.remove("visible");
}
async function browsePreviewFile() {
    window.api.browsePreviewFile(previewFileOutPath);
}

window.api.getCustomCSS().then(cssString => {
    const styleNode = document.createElement('style');
    styleNode.textContent = cssString;
    document.head.appendChild(styleNode);
})