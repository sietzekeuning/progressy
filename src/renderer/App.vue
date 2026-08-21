<template>
  <div class="app">
    <PopupView v-if="isPopup" />
    <LoginView v-else-if="ready && !signedIn" />
    <MainView v-else-if="ready" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import LoginView from './views/LoginView.vue';
import MainView from './views/MainView.vue';
import PopupView from './views/PopupView.vue';

const signedIn = ref(false);
const ready = ref(false);
const isPopup = ref(window.location.hash === '#popup' || window.location.hash === 'popup');

onMounted(async () => {
  if (isPopup.value) {
    return;
  }

  const auth = await window.electronAPI.getAuthState();
  signedIn.value = auth.signedIn;
  ready.value = true;
});
</script>

<style scoped>
.app {
  width: 100%;
  height: 100vh;
}
</style>
