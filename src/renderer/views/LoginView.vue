<template>
  <div class="login-container">
    <div class="login-card">
      <h1>Connect to GitHub</h1>
      <p class="subtitle">Authorize Progressy to access your GitHub Actions</p>

      <div class="form-group">
        <label for="token">Personal Access Token</label>
        <input
          id="token"
          v-model="token"
          type="password"
          placeholder="ghp_xxxxxxxxxxxx"
          @keyup.enter="handleLogin"
        />
        <small>
          <a href="https://github.com/settings/tokens" target="_blank">
            Generate a token
          </a>
          with <code>repo</code> and <code>workflow</code> scopes
        </small>
      </div>

      <button class="btn-primary" @click="handleLogin" :disabled="!token || loading">
        {{ loading ? 'Connecting...' : 'Connect' }}
      </button>

      <div v-if="error" class="error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const token = ref('');
const loading = ref(false);
const error = ref('');

async function handleLogin() {
  if (!token.value) {
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const success = await window.electronAPI.setGitHubToken(token.value);
    if (success) {
      window.location.reload();
    } else {
      error.value = 'Failed to save token';
    }
  } catch (err) {
    error.value = 'Failed to connect to GitHub';
    console.error(err);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
}

.login-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 2rem;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

h1 {
  color: #f0f6fc;
  margin-bottom: 0.5rem;
  font-size: 1.5rem;
}

.subtitle {
  color: #8b949e;
  margin-bottom: 2rem;
  font-size: 0.9rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  color: #c9d1d9;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
}

input {
  width: 100%;
  padding: 0.75rem;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  font-size: 0.9rem;
  transition: border-color 0.2s;
}

input:focus {
  outline: none;
  border-color: #58a6ff;
}

small {
  display: block;
  color: #8b949e;
  margin-top: 0.5rem;
  font-size: 0.8rem;
}

small a {
  color: #58a6ff;
  text-decoration: none;
}

small a:hover {
  text-decoration: underline;
}

small code {
  background: #21262d;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-size: 0.75rem;
}

.btn-primary {
  width: 100%;
  padding: 0.75rem;
  background: #238636;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #2ea043;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #da3633;
  color: white;
  border-radius: 6px;
  font-size: 0.9rem;
}
</style>
