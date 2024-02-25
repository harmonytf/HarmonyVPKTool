<script lang="ts" setup>
import { useStore } from '../stores/main';

const mainStore = useStore();
const emit = defineEmits(['close']);

function saveMemoryMap(e: Event) {
    localStorage.setItem("setting.memoryMap", (e.target as HTMLInputElement).checked.toString());
}
</script>

<template>
    <div class="overlay" @click="emit('close')"></div>
    <div class="dialog">
        <h1>Settings</h1>
        <label>
            <input type="checkbox" v-model="mainStore.memoryMap" @input="saveMemoryMap">
            <span>Use memory-mapped extraction</span>
        </label>
        <br><br>
        <button @click="emit('close')">OK</button>
    </div>
</template>

<style scoped>
.overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
}
.dialog {
    background-color: var(--color-bg-dark);
    min-width: 24rem;
    max-width: calc(100% - 4rem);
    max-height: calc(100% - 4rem);
    padding: 2rem;
    border-radius: 0.5rem;
    box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.25);
    font-size: 0.875rem;
}

h1 {
    margin: 0;
}

label > * {
    vertical-align: middle;
}

input[type="checkbox"] {
    margin-right: 0.5rem;
}
</style>