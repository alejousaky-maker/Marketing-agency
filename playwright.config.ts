import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { config } from 'dotenv';
config({path:'.env',quiet:true});
export default defineConfig({
  testDir:'tests/e2e',fullyParallel:false,workers:1,retries:0,timeout:90000,
  expect:{timeout:15000},reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:process.env.APP_URL??'http://localhost:3000',headless:true,viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{executablePath:process.env.CHROMIUM_PATH??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:process.env.CI?['--no-sandbox']:[]}},
});
