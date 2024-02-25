<script lang="ts" setup>
import { useStore } from '../stores/main';

const mainStore = useStore();
</script>

<template>
    <div class="container">
        <div></div>
        <p>
            <span class="error-text">Encountered an error</span>
            <br>
            {{ mainStore.error }}
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

.error-text {
    /* text-align: center; */
    font-size: 1.5rem;
    font-weight: bold;
}
</style>