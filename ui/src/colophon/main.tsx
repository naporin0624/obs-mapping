import '../index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Colophon } from './Colophon';

const root = document.getElementById('root');
if (root === null) throw new Error('#root not found');
createRoot(root).render(
  <StrictMode>
    <Colophon />
  </StrictMode>,
);
