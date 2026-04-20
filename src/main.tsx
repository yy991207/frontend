import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

declare global {
  interface Window {
    __POWERED_BY_QIANKUN__?: boolean;
  }
}

export async function mount(props: any) {
  const { container } = props;
  const root = container
    ? container.querySelector('#root')
    : document.getElementById('root');

  if (root) {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }
}

export async function unmount(props: any) {
  const { container } = props;
  const root = container
    ? container.querySelector('#root')
    : document.getElementById('root');

  if (root) {
    root.innerHTML = '';
  }
}

if (!window.__POWERED_BY_QIANKUN__) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
