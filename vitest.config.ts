import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
config({path:'.env',quiet:true});
export default defineConfig({test:{include:['tests/**/*.test.ts'],testTimeout:90000,hookTimeout:90000,fileParallelism:false},resolve:{alias:{'@':new URL('./src',import.meta.url).pathname}}});
