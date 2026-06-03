import browser from 'webextension-polyfill';

browser.runtime.onInstalled.addListener(() => {
  console.log("AI Exporter: Extensión instalada.");
});
