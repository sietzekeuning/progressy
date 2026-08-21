<template>
  <div class="app">
    <LoginView v-if="!isAuthenticated && !isPopup" />
    <MainView v-else-if="!isPopup" />
    <PopupView v-else />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import LoginView from './views/LoginView.vue';
import MainView from './views/MainView.vue';
import PopupView from './views/PopupView.vue';

const isAuthenticated = ref(false);
const isPopup = ref(window.location.hash === '#popup' || window.location.hash === 'popup');

onMounted(async () => {
  if (!isPopup.value) {
    const token = await window.electronAPI.getGitHubToken();
    isAuthenticated.value = !!token;

    if (!isAuthenticated.value) {
      window.electronAPI.resizeWindow(440, 430);
    }
  }
});
</script>

<style scoped>
.app {
  width: 100%;
  height: 100vh;
}
</style>
