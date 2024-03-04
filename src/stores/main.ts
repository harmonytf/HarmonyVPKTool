import { defineStore } from 'pinia'
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { DirTree } from '../types';
import { listen } from '@tauri-apps/api/event';

export const useStore = defineStore('main', () => {
    const vpkPath = ref('');
    const loading = ref(false);
    const loaded = ref(false);
    const hasError = ref(false);
    const error = ref('');

    const showExtract = ref(false);
    const extracting = ref(false);
    const extractCancelled = ref(false);
    const extractStartTime = ref(0);
    const extractElapsedTime = ref(0);
    const extractProgress = ref(0);
    const extractTotal = ref(0);
    const extractErrors = ref<string[]>([]);

    const memoryMap = ref((localStorage.getItem("setting.memoryMap") ?? "false") == "true");

    async function loadFromPath(path: string) {
        loading.value = true;
        loaded.value = false;
        vpkPath.value = path;

        try {
            await invoke('load_vpk', { vpkPath: path });
            await getFiles();
            loading.value = false;
            loaded.value = true;
            hasError.value = false;
        } catch (e: any) {
            console.error(e);
            loading.value = false;
            loaded.value = false;
            hasError.value = true;
            error.value = JSON.parse(e);
        }
    }

    async function openVPK() {
        try {
            let path = await invoke<string | null>('select_vpk');
            if (path !== null) {
                loadFromPath(path);
            }
        } catch (e: any) {
            console.error(e);
        }
    }

    let numFiles = ref(0);
    let fileList = ref<string[]>([]);
    let fileTree = ref<DirTree>({ dirs: [], files: [] });

    async function getFiles() {
        let files = await invoke('get_file_list') as string[];
        numFiles.value = files.length;

        let tree: DirTree = { dirs: [], files: [] };

        for (const file of files.sort()) {
            let path = file.replace(/^\s\//, '').split('/');
            let dir = tree;
            for (let i = 0; i < path.length; i++) {
                if (i == path.length - 1) {
                    dir.files.push(path[i]);
                } else {
                    let folder = dir.dirs.find(f => f.name == path[i]);
                    if (folder) {
                        dir = folder;
                    } else {
                        let newFolder: DirTree = { name: path[i], path: path.slice(0, i + 1).join('/'), dirs: [], files: [] };
                        dir.dirs.push(newFolder);
                        dir = newFolder;
                    }
                }
            }
        }

        fileList.value = files;
        fileTree.value = tree;
    }

    async function extractAll() {
        let res = await open({ title: 'Select a output directory', directory: true, multiple: false })
        if (res !== null && typeof res == 'string') {
            extractElapsedTime.value = 0;
            let timerTickInterval;
            const timerTick = () => {
                extractElapsedTime.value = performance.now() - extractStartTime.value;
                timerTickInterval = requestAnimationFrame(timerTick);       
            }
            timerTickInterval = requestAnimationFrame(timerTick);

            extractProgress.value = 0;
            extractTotal.value = numFiles.value;
            extractErrors.value = [];
            showExtract.value = true;
            extracting.value = true;
            extractCancelled.value = false;
            extractStartTime.value = performance.now();
            let unlistenExtracted = await listen('extracted', () => {
                extractProgress.value++;
            });
            let unlistenExtractFail = await listen('extract-fail', (event: any) => {
                console.log(`Failed to extract ${event.payload.file}: ${event.payload.e}`);
                extractProgress.value++;
                extractErrors.value.push(event.payload.file);
            });
            await invoke('extract_all', { outDir: res });
            extracting.value = false;
            unlistenExtracted();
            unlistenExtractFail();
            cancelAnimationFrame(timerTickInterval);
            extractElapsedTime.value = performance.now() - extractStartTime.value;
        }
    }

    async function extractDir(dir: string) {
        let res = await open({ title: 'Select a output directory', directory: true, multiple: false })
        if (res !== null && typeof res == 'string') {
            extractElapsedTime.value = 0;
            let timerTickInterval;
            const timerTick = () => {
                console.log("tick");
                extractElapsedTime.value = performance.now() - extractStartTime.value;
                timerTickInterval = requestAnimationFrame(timerTick);       
            }
            timerTickInterval = requestAnimationFrame(timerTick);
            
            extractProgress.value = 0;
            extractTotal.value = await invoke('count_dir', { dir }) as number;
            extractErrors.value = [];
            showExtract.value = true;
            extracting.value = true;
            extractCancelled.value = false;
            extractStartTime.value = performance.now();
            let unlistenExtracted = await listen('extracted', () => {
                extractProgress.value++;
            });
            let unlistenExtractFail = await listen('extract-fail', (event: any) => {
                console.log(`Failed to extract ${event.payload.file}: ${event.payload.e}`);
                extractProgress.value++;
                extractErrors.value.push(event.payload.file);
            });
            await invoke('extract_dir', { dir, outDir: res });
            extracting.value = false;
            unlistenExtracted();
            unlistenExtractFail();
            cancelAnimationFrame(timerTickInterval);
            extractElapsedTime.value = performance.now() - extractStartTime.value;
        }
    }

    async function extractFile(filePath: string) {
        let res = await open({ title: 'Select a output directory', directory: true, multiple: false })
        if (res !== null && typeof res == 'string') {
            if (!filePath.includes('/')) {
                filePath = ' /' + filePath;
            }

            extractElapsedTime.value = 0;
            let timerTickInterval;
            const timerTick = () => {
                console.log("tick");
                extractElapsedTime.value = performance.now() - extractStartTime.value;
                timerTickInterval = requestAnimationFrame(timerTick);       
            }
            timerTickInterval = requestAnimationFrame(timerTick);

            extractProgress.value = 0;
            extractTotal.value = 1;
            extractErrors.value = [];
            showExtract.value = true;
            extracting.value = true;
            extractCancelled.value = false;
            extractStartTime.value = performance.now();
            let unlistenExtracted = await listen('extracted', () => {
                extractProgress.value++;
            });
            let unlistenExtractFail = await listen('extract-fail', (event: any) => {
                console.log(`Failed to extract ${event.payload.file}: ${event.payload.e}`);
                extractProgress.value++;
                extractErrors.value.push(event.payload.file);
            });
            try {
                await invoke('extract_file', { filePath, outDir: res });
            } catch (e: any) {
                console.error(e);
            }
            extracting.value = false;
            unlistenExtracted();
            unlistenExtractFail();
            cancelAnimationFrame(timerTickInterval);
            extractElapsedTime.value = performance.now() - extractStartTime.value;
        }
    }

    async function extractFiles(files: string[]) {
        let res = await open({ title: 'Select a output directory', directory: true, multiple: false })
        if (res !== null && typeof res == 'string') {
            extractElapsedTime.value = 0;
            let timerTickInterval;
            const timerTick = () => {
                console.log("tick");
                extractElapsedTime.value = performance.now() - extractStartTime.value;
                timerTickInterval = requestAnimationFrame(timerTick);       
            }
            timerTickInterval = requestAnimationFrame(timerTick);

            extractProgress.value = 0;
            extractTotal.value = files.length;
            extractErrors.value = [];
            showExtract.value = true;
            extracting.value = true;
            extractCancelled.value = false;
            extractStartTime.value = performance.now();
            let unlistenExtracted = await listen('extracted', () => {
                extractProgress.value++;
            });
            let unlistenExtractFail = await listen('extract-fail', (event: any) => {
                console.log(`Failed to extract ${event.payload.file}: ${event.payload.e}`);
                extractProgress.value++;
                extractErrors.value.push(event.payload.file);
            });
            await invoke('extract_files', { files, outDir: res });
            extracting.value = false;
            unlistenExtracted();
            unlistenExtractFail();
            cancelAnimationFrame(timerTickInterval);
            extractElapsedTime.value = performance.now() - extractStartTime.value;
        }
    }

    async function cancelExtract() {
        await invoke('extract_cancel');
        extractCancelled.value = true;
    }

    return {
        vpkPath, loading, loaded, hasError, error, fileTree, fileList,
        loadFromPath, openVPK, memoryMap, showExtract, extracting, extractTotal, extractCancelled,
        numFiles, extractProgress, extractErrors, extractAll, extractDir, extractFile, extractFiles,
        extractStartTime, extractElapsedTime, cancelExtract,
    };
})