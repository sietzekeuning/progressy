import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

// Check if electronAPI is available
if (!window.electronAPI) {
  console.error('electronAPI is not available. Make sure preload script is loaded.');
  document.body.innerHTML = '<div style="padding: 20px; color: red;">Error: electronAPI not available. Please check the console.</div>';
} else {
  try {
    createApp(App).mount('#app');
  } catch (error) {
    console.error('Failed to mount Vue app:', error);
    document.body.innerHTML = `<div style="padding: 20px; color: red;">Error: ${error}</div>`;
  }
}
