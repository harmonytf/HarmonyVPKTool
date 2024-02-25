<script setup lang="ts">
import Loading from './components/Loading.vue';
import FileTree from './components/FileTree.vue';
import Error from './components/Error.vue';
import DragAndDrop from './components/DragAndDrop.vue';
// import Settings from './components/Settings.vue';
import { useStore } from './stores/main.ts';
// import { ref } from 'vue';

const mainStore = useStore();

// let showSettings = ref(false);
</script>

<template>
  <div class="app">
    <div class="top">
      <b>{{ mainStore.vpkPath || 'No VPK file open' }}</b>

      <!-- <button @click="showSettings = true">Settings</button> -->
      <button @click="mainStore.openVPK">Open</button>
    </div>

    <Loading class="loading" v-if="mainStore.loading" />
    <FileTree class="tree" v-else-if="mainStore.loaded" />
    <Error class="error" v-else-if="mainStore.hasError" />
    <DragAndDrop class="drag-and-drop" v-else />

    <!-- <div v-if="showSettings" class="settings">
      <Settings @close="showSettings = false" />
    </div> -->
  </div>

  <div class="extract-dialog" v-if="mainStore.showExtract">
    <div class="dialog">
      <h2 v-if="mainStore.extractCancelled">{{ mainStore.extracting ? 'Cancelling extraction...' : 'Cancelled extraction' }}</h2>
      <h2 v-else>{{ mainStore.extracting ? 'Extracting...' : 'Completed extraction' }}</h2>
      <div class="progress">
        <div class="bar">
          <div :style="{ width: mainStore.extractProgress / mainStore.extractTotal * 100 + '%' }"></div>
        </div>
        <span>{{ mainStore.extractProgress }} / {{ mainStore.extractTotal }} {{ mainStore.extractErrors.length ? `(${mainStore.extractErrors.length} failed)` : '' }}</span>
      </div>
      <template v-if="mainStore.extracting">
        <p class="timer">Elapsed {{ ((Date.now() - mainStore.extractStartTime) / 1000).toFixed(3) }}s</p>
        <button @click="mainStore.cancelExtract">Cancel</button>
      </template>
      <template v-else>
        <p class="timer">Took {{ ((mainStore.extractFinishTime - mainStore.extractStartTime) / 1000).toFixed(3) }}s</p>
        <button @click="mainStore.showExtract = false">Close</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.app {
  display: grid;
  grid-template-rows: 56px 1fr;
  height: 100%;
}

.top {
  padding: 0.75em 1em;
  background-color: var(--color-bg-dark);

  display: grid;
  align-items: center;
  /* grid-template-columns: 1fr auto auto; */
  grid-template-columns: 1fr auto;
  gap: 1rem;
}

.top > b {
  font-size: 0.875rem;
  text-wrap: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  direction: rtl;
  text-align: left;
}

.settings {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(1px);
  display: grid;
  place-items: center;
}

.extract-dialog {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(1px);
  display: grid;
  place-items: center;
}

.extract-dialog>.dialog {
  background-color: var(--color-bg-dark);
  min-width: 24rem;
  max-width: calc(100% - 4rem);
  max-height: calc(100% - 4rem);
  padding: 2rem;
  border-radius: 0.5rem;
  box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.25);
  font-size: 0.875rem;
}

.extract-dialog>.dialog>h2 {
  margin: 0 0 0.5em 0;
}

.progress>.bar {
  width: 100%;
  height: 1rem;
  background-color: var(--color-bg);
  border-radius: 0.25rem;
  overflow: hidden;
}

.progress>.bar>div {
  height: 100%;
  background-color: var(--color-primary-light);
}

.progress>span {
  font-size: 0.625rem;
  margin: 0.25rem 0.25rem 0 0.25rem;
  float: right;
}

.timer {
  font-size: 0.75rem;
  margin: 0.5rem 0rem;
}
</style>
