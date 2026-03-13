import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Force any waiting service worker to activate immediately on page load
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => {
      reg.update();
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
