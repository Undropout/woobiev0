import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        resume: resolve(__dirname, 'resume.html'),
        goodbye: resolve(__dirname, 'goodbye.html'),
        login: resolve(__dirname, 'auth/login.html'),
        signup: resolve(__dirname, 'auth/signup.html'),
        namePicker: resolve(__dirname, 'name-picker/index.html'),
        interests: resolve(__dirname, 'interests-dealbreakers/index.html'),
        waiting: resolve(__dirname, 'interests-dealbreakers/waiting.html'),
        bio: resolve(__dirname, 'bio/index.html'),
        tier1a: resolve(__dirname, 'tier1a/index.html'),
        tier1aReveal: resolve(__dirname, 'tier1a/reveal-bios.html'),
        tier1b: resolve(__dirname, 'tier1b/index.html'),
        tier2: resolve(__dirname, 'tier2/index.html'),
        tier2Send: resolve(__dirname, 'tier2/send.html'),
        tier2Reveal: resolve(__dirname, 'tier2/reveal.html'),
        tier3: resolve(__dirname, 'tier3/index.html'),
        chat: resolve(__dirname, 'chat/index.html'),
        history: resolve(__dirname, 'shared/history.html'),
      }
    }
  }
});
