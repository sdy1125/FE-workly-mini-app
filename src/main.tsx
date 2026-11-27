import React from 'react';
import { createRoot } from 'react-dom/client';
import appConfig from '../app-config.json';
import { App } from './App';
import './styles.css';

declare global {
  interface Window {
    APP_CONFIG?: typeof appConfig;
  }
}

window.APP_CONFIG = appConfig;
createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
