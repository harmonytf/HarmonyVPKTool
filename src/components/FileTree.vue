<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useStore } from '../stores/main';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';
import TreeFolder from './TreeFolder.vue';
import { VPKDirEntry } from '../types';
import { bytesToSize, getTextEncoding, isAudioFile, isTextFile } from '../util';

const mainStore = useStore();
const platformName = platform();

let selectedPath = ref<string | null>(null);
let selectedEntry = ref<VPKDirEntry | undefined>(undefined);

let showPreview = ref<boolean>(false);
let previewLoading = ref<boolean>(false);
let previewDidError = ref<boolean>(false);
let previewError = ref<string | null>(null);
let previewPath = ref<string>('');
let previewURL = ref<string | null>(null);
let previewText = ref<string>('');

async function selectFile(path: string) {
    selectedEntry.value = undefined;
    selectedPath.value = path;

    if (!path.includes('/')) {
        path = ' /' + path;
    }
    selectedEntry.value = await invoke('get_file_entry', { path });
}

async function previewFile(path: string) {
    previewPath.value = path;

    if (!path.includes('/')) {
        path = ' /' + path;
    }

    showPreview.value = true;

    try {
        if (isTextFile(previewPath.value)) {
            previewLoading.value = true;
            const arr  = new Uint8Array(await invoke('read_file', { path }));
            previewText.value = new TextDecoder(getTextEncoding(arr)).decode(arr);
            previewLoading.value = false;
        } else if (isAudioFile(previewPath.value)) {
            if (await platformName === 'windows') {
                previewURL.value = convertFileSrc(path, 'preview');
            } else {
                previewLoading.value = true;
                const arr  = new Uint8Array(await invoke('read_file', { path }));
                const blob = new Blob([arr]);
                previewURL.value = URL.createObjectURL(blob);
                previewLoading.value = false;
            }
        }
    } catch (e: any) {
        previewLoading.value = false;
        previewDidError.value = true;
        previewError.value = JSON.parse(e);
    }
}

function closePreview() {
    previewPath.value = '';

    showPreview.value = false;
    previewDidError.value = false;
    previewURL.value = null;
    previewText.value = '';
}

let checkedFiles = ref<Set<string>>(new Set());
function checkPath(path: string, check: boolean) {
    if (check) {
        if (path.endsWith('/')) {
            for (let file of mainStore.fileList.filter(p => p.startsWith(path))) {
                checkedFiles.value.add(file);
            }
        } else {
            checkedFiles.value.add(path);
        }
    } else {
        if (path.endsWith('/')) {
            for (let file of mainStore.fileList.filter(p => p.startsWith(path))) {
                checkedFiles.value.delete(file);
            }
        } else {
            checkedFiles.value.delete(path);
        }
    }
}

let selectMode = ref<boolean>(false);
watch(selectMode, (newVal) => {
    if (newVal) {
        checkedFiles.value.clear();
    }
});
</script>

<template>
    <div class="container">
        <div class="file-tree">
            <TreeFolder :dir="mainStore.fileTree" root @select="selectFile" @check="checkPath" :show-check-boxes="selectMode" :checked-files="checkedFiles" key="fileTree" />
        </div>
        <div class="file-details" v-if="selectedPath">
            <template v-if="selectedPath.endsWith('/')">
                <b class="title">Directory details</b>
                <br>
                <span class="file-path">{{ selectedPath.replace(/\/$/, '') }}</span>
                <br><br>
                <button class="extract" @click="mainStore.extractDir(selectedPath)">Extract</button>
            </template>
            <template v-else>
                <b class="title">File details</b>
                <br>
                <span class="file-path">{{ selectedPath }}</span>
                <br><br>
                <button class="extract" @click="mainStore.extractFile(selectedPath)">Extract</button>
                <button @click="previewFile(selectedPath)">Preview</button>
                <br><br>
                <span><b>File type:</b> {{ selectedPath.split(".").pop()?.toUpperCase() }}</span>
                <template v-if="selectedEntry">
                    <br>
                    <span><b>CRC:</b> 0x{{ selectedEntry.crc.toString(16).toUpperCase() }}</span>
                    <br>
                    <span><b>Preload size:</b> {{ bytesToSize(selectedEntry.preload_bytes ?? 0) }}</span>
                    <span v-if="selectedEntry.archive_index != undefined">
                        <br>
                        <b>Archive index:</b>
                        {{ selectedEntry.archive_index }}
                    </span>
                    <span v-if="selectedEntry.entry_offset != undefined"><br><b>Offset:</b> 0x{{
                        selectedEntry.entry_offset.toString(16).toUpperCase() }}</span>
                    <span v-if="selectedEntry.entry_length != undefined"><br><b>Size:</b> {{
                        bytesToSize(selectedEntry.entry_length) }}</span>
                    <span v-else-if="selectedEntry.file_parts"><br><b>Size:</b> {{
                        bytesToSize(selectedEntry.file_parts.reduce((acc, part) => acc + part.entry_length, 0)) }}</span>
                    <template v-if="selectedEntry.file_parts">
                        <br>
                        <br>
                        <b>File parts</b>
                        <ul>
                            <li v-for="part in selectedEntry.file_parts" :key="part.entry_offset">
                                <span><b>Archive index:</b> {{ part.archive_index }}</span>
                                <br>
                                <span><b>Offset:</b> 0x{{ part.entry_offset.toString(16).toUpperCase() }}</span>
                                <br>
                                <span><b>Packed size:</b> {{ bytesToSize(part.entry_length) }}</span>
                                <br>
                                <span><b>Unpacked size:</b> {{ bytesToSize(part.entry_length_uncompressed) }}</span>
                                <br>
                                <span><b>Load flags:</b> {{ part.load_flags }}</span>
                                <br>
                                <span><b>Texture flags:</b> {{ part.texture_flags }}</span>
                            </li>
                        </ul>
                    </template>
                </template>
            </template>
        </div>

        <div class="preview" v-if="showPreview">
            <div class="overlay" @click="closePreview"></div>
            <div class="dialog">
                <h3>File preview</h3>
                <span class="path">{{ previewPath }}</span>
                <br>
                <template v-if="previewLoading">
                    <br>
                    <b>Loading...</b>
                    <br>
                </template>
                <template v-else-if="previewDidError">
                    <br>
                    <b>Error:</b> {{ previewError }}
                    <br>
                </template>
                <template v-else>
                    <template v-if="previewURL && isAudioFile(previewPath)">
                        <br>
                        <audio controls :key="previewURL">
                            <source :src="previewURL" type="audio/wav" />
                        </audio>
                        <br>
                    </template>
                    <pre v-else-if="isTextFile(previewPath)">{{ previewText }}</pre>
                    <template v-else>
                        <br>
                        <b>File type unsupported</b>
                        <br>
                    </template>
                </template>
                <br>
                <button class="close" @click="closePreview">Close</button>
            </div>
        </div>

        <div class="floating-buttons">
            <b v-if="selectMode">{{ checkedFiles.size }} files selected</b>
            <br>
            <label>
                <span>Select mode</span>
                <input type="checkbox" v-model="selectMode">
            </label>
            <br>
            <button v-if="selectMode" @click="mainStore.extractFiles([...checkedFiles])" :disabled="checkedFiles.size == 0">Extract selected</button>
            <button v-else @click="mainStore.extractAll">Extract all</button>
        </div>
    </div>
</template>

<style scoped>
.container {
    height: 100%;
    display: grid;
    grid-template-columns: 3fr minmax(240px, 1fr);
    overflow-y: hidden;
}

.file-tree {
    height: 100%;
    padding: 1rem;
    overflow-x: hidden;
    overflow-y: auto;
}

.file-details {
    height: 100%;
    padding: 1rem 1rem 3rem 1rem;
    overflow-x: hidden;
    overflow-y: auto;
    border-left: 1px solid var(--color-bg-dark);
}

.file-details {
    font-size: 0.75rem;
    word-wrap: break-word;
}

.file-details>.title {
    font-size: 1rem;
}

.file-details>ul {
    list-style: none;
    padding-left: 0;
}

.file-details>ul>li {
    border-left: 2px solid var(--color-bg-dark);
    padding-left: 1em;
    margin-bottom: 1em;
}

.file-details span {
    user-select: text;
}

.extract {
    margin-right: 1em;
}

.preview {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(1px);
    display: grid;
    place-items: center;
    z-index: 10;
}

.preview>.overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
}

.preview>.dialog {
    background-color: var(--color-bg-dark);
    min-width: 24rem;
    max-width: calc(100% - 4rem);
    max-height: calc(100% - 4rem);
    padding: 2rem;
    border-radius: 0.5rem;
    box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.25);
    font-size: 0.875rem;
}

.preview>.dialog>h3 {
    margin: 0;
    font-size: 1.5rem;
}

.preview>.dialog>.path {
    font-size: 0.75rem;
}

.preview>.dialog>audio {
    width: 420px;
}

.preview>.dialog>pre {
    font-size: 0.75rem;
    padding: 1rem;
    border-radius: 0.25rem;
    background-color: var(--color-bg);
    max-width: 100%;
    min-height: 16rem;
    max-height: calc(100vh - 20rem);
    overflow: auto;

    user-select: text;
}

.floating-buttons {
    position: fixed;
    bottom: 0;
    right: 0;
    padding: 1rem;
    text-align: right;
}
.floating-buttons b {
    font-size: 0.75rem;
}
.floating-buttons button {
    margin-top: 0.25rem;
}
</style>
