<script lang="ts" setup>
import TreeFolder from './TreeFolder.vue';
import { type DirTree } from '../types';

const props = defineProps<{ dir: DirTree, root?: boolean, showCheckBoxes?: boolean, checkedFiles?: Set<string> }>();
const emit = defineEmits<{
    select: [path: string],
    check: [path: string, check: boolean],
}>();

function anyChecked(dir: DirTree): boolean {
    return dir.files.some(file => props.checkedFiles?.has(dir.path + '/' + file)) || dir.dirs.some(anyChecked);
}
function everyChecked(dir: DirTree): boolean {
    return dir.files.every(file => props.checkedFiles?.has(dir.path + '/' + file)) && dir.dirs.every(everyChecked);
}

</script>

<template>
    <div v-if="props.root" class="root">
        <TreeFolder class="dir" v-for="dir in props.dir.dirs" :dir="dir" :key="dir.name"
            :show-check-boxes="props.showCheckBoxes" :checked-files="props.checkedFiles"
            @select="path => emit('select', dir.name + '/' + path)" @check="(path, check) => emit('check', path, check)" />
        <p v-for="file in props.dir.files" class="file" :key="dir.path + '/' + file" @click="emit('select', file)">
            {{ file }}
            <input type="checkbox" v-show="props.showCheckBoxes"
                :checked="props.checkedFiles?.has(dir.path + '/' + file)"
                @change="emit('check', ' /' + file, ($event.target as HTMLInputElement).checked)" />
        </p>
    </div>
    <details class="folder" v-else>
        <summary @click="emit('select', '')" @click.right.prevent="emit('select', '')">
            {{ props.dir.name ?? "Unnamed" }}
            <input type="checkbox" v-show="props.showCheckBoxes" :checked="everyChecked(dir)" :indeterminate="!everyChecked(dir) && anyChecked(dir)"
                @change="emit('check', dir.path + '/', ($event.target as HTMLInputElement).checked)" />
        </summary>
        <TreeFolder class="dir" v-for="dir in props.dir.dirs" :dir="dir" :key="dir.name"
            :show-check-boxes="props.showCheckBoxes" :checked-files="props.checkedFiles"
            @select="path => emit('select', dir.name + '/' + path)" @check="(path, check) => emit('check', path, check)" />
        <p v-for="file in props.dir.files" class="file" :key="dir.path + '/' + file" @click="emit('select', file)">
            {{ file }}
            <input type="checkbox" v-show="props.showCheckBoxes"
                :checked="props.checkedFiles?.has(dir.path + '/' + file)"
                @change="emit('check', dir.path + '/' + file, ($event.target as HTMLInputElement).checked)" />
        </p>
    </details>
</template>

<style scoped>
details {
    padding-left: 16px;
}

details>.dir {
    margin: 0;
    margin-left: 4px;
    padding-left: 16px;
    border-left: 2px solid var(--color-border);
}

.file {
    margin: 0;
    padding-left: 16px;
}

details>.file {
    margin-left: 4px;
    border-left: 2px solid var(--color-border);
}
</style>