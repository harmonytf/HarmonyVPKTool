<script lang="ts" setup>
import { ref } from 'vue';
import { useStore } from '../stores/main';

const mainStore = useStore();

let step = ref("Parsing VPK directory tree...");
</script>

<template>
    <div class="container">
        <div></div>
        <p>
            <span class="load-text">Loading VPK...</span>
            <br>
            {{ step }}
            <br>
            {{ mainStore.vpkPath }}
        </p>
    </div>
</template>

<style scoped>
.container {
    display: grid;
    justify-content: center;
    align-items: center;
    height: 100%;
    grid-template-rows: 1fr auto 1fr 56px;
    line-height: 1.5;
}

.load-text {
    /* text-align: center; */
    font-size: 1.5rem;
    font-weight: bold;
}

</style>