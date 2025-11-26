// Caminho: frontend/svelte.config.js
import adapter from '@sveltejs/adapter-auto'; // <--- APENAS ESTA LINHA DEVE EXISTIR
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    // ...
    preprocess: vitePreprocess(),

    kit: {
        // ...
        adapter: adapter(),
        alias: {
            $stores: 'src/lib/stores',
        },
    },
};

export default config;
