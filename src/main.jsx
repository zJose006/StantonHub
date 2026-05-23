import React from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/styles.css';
import { App } from './App.jsx';

/** Punto de entrada de React: monta la aplicacion en #root. */
createRoot(document.getElementById('root')).render(<App />);
