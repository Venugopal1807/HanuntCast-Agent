import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { diagnose } from './diagnostics';
import './styles.css';

window.addEventListener('error', () => diagnose('window_failure', { stage: 'render' }));
window.addEventListener('unhandledrejection', () => diagnose('window_failure', { stage: 'request' }));

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
