import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { normalizeUnsplashUrl, PLACEHOLDER_TRAVEL_SRC } from "./utils/unsplash";

function installUnsplashSrcNormalizer() {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  if (!descriptor?.get || !descriptor?.set) return;

  Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true,
    enumerable: descriptor.enumerable,
    get: descriptor.get,
    set(value: string) {
      const next = typeof value === "string" ? normalizeUnsplashUrl(value) : value;
      descriptor.set?.call(this, next);
    },
  });
}

function installGlobalUnsplashGuard() {
  const patchImage = (img: HTMLImageElement) => {
    const originalSrc = img.getAttribute("src");

    if (originalSrc && (
      originalSrc.includes('/storage/v1/object/') ||
      originalSrc.startsWith('data:')
    )) {
      return;
    }

    if (originalSrc) {
      const normalized = normalizeUnsplashUrl(originalSrc);
      if (normalized !== originalSrc) {
        img.setAttribute("src", normalized);
      }
    }

    if (img.dataset.safeImageBound === "true") return;
    img.dataset.safeImageBound = "true";

    img.addEventListener("error", () => {
      if (img.dataset.fallbackApplied === "true") return;
      img.dataset.fallbackApplied = "true";
      img.src = PLACEHOLDER_TRAVEL_SRC;
    });
  };

  document.querySelectorAll("img").forEach((node) => patchImage(node as HTMLImageElement));

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "attributes" && mutation.target instanceof HTMLImageElement) {
        patchImage(mutation.target);
        return;
      }

      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node instanceof HTMLImageElement) {
          patchImage(node);
        }
        node.querySelectorAll("img").forEach((img) => patchImage(img as HTMLImageElement));
      });
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"],
  });
}

installUnsplashSrcNormalizer();
installGlobalUnsplashGuard();

// Unregister all service workers and purge caches to stop serving stale bundles
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => reg.unregister());
  });
}
if ('caches' in window) {
  caches.keys().then(names => {
    names.forEach(name => caches.delete(name));
  });
}

createRoot(document.getElementById("root")!).render(<App />);
