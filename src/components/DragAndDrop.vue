<script lang="ts" setup>
import { onBeforeUnmount, ref } from 'vue';
import { getCurrent } from "@tauri-apps/api/window";
import { useStore } from '../stores/main';

const mainStore = useStore();

let fileHover = ref(false);

const unlisten = getCurrent().onFileDropEvent(event => {
    if (event.payload.type === 'hover') {
        fileHover.value = event.payload.paths.length == 1 && event.payload.paths[0].endsWith('.vpk');
    } else if (event.payload.type === 'drop') {
        fileHover.value = false;
        if (event.payload.paths.length == 1 && event.payload.paths[0].endsWith('.vpk')) {
            mainStore.loadFromPath(event.payload.paths[0]);
        }
    } else {
        fileHover.value = false;
    }
});

onBeforeUnmount(async () => {
    (await unlisten)();
});
</script>

<template>
    <div class="container">
        <div></div>
        <div class="center">
            <button class="open" @click="mainStore.openVPK">Open a VPK</button>
            <p>or</p>
            <div class="drag-drop" :class="{ hover: fileHover }">
                <b>Drag and drop a VPK file</b>
            </div>
        </div>
    </div>
</template>

<style scoped>
.container {
    display: grid;
    justify-content: center;
    align-items: center;
    height: 100%;
    grid-template-rows: 1fr auto 1fr 56px;
}

.center {
    text-align: center;
    height: fit-content;
}

.open {
    width: 12rem;
    height: 3.5rem;
}

.drag-drop {
    padding: 1rem 2rem;
    border-radius: 0.5rem;
}

.drag-drop.hover {
    background-color: var(--color-bg-dark);
}
</style>