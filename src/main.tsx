import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppLessonPicker } from './app-lesson-picker';
import './shared/styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppLessonPicker />
  </StrictMode>,
);
