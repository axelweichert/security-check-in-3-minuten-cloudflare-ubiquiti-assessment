import '@/lib/errorReporter';
import { enableMapSet } from "immer";
enableMapSet();
import { createRoot } from 'react-dom/client';
import '@/index.css';
import '@/lib/i18n'; // Initialize i18next
import App from './App';
createRoot(document.getElementById('root')!).render(<App />);