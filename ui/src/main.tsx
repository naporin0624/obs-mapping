import './index.css';
import { getDefaultStore } from 'jotai';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyLocale } from './i18n/apply-locale';

const root = document.getElementById('root');
if (root === null) throw new Error('#root not found');
document.documentElement.lang = applyLocale(getDefaultStore(), navigator);
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
