import { writable } from 'svelte/store';

export const progressMessage = writable<string>('');
export const isProcessing = writable<boolean>(false);
