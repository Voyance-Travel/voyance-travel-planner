/**
 * Scroll utilities for smooth navigation
 */

/**
 * Scroll to top of page
 */
export function scrollToTop(smooth = true) {
  window.scrollTo({
    top: 0,
    behavior: smooth ? 'smooth' : 'auto',
  });
}

/**
 * Scroll to element by ID
 */
export function scrollToElement(elementId: string, offset = 80) {
  const element = document.getElementById(elementId);
  if (element) {
    const top = element.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({
      top,
      behavior: 'smooth',
    });
  }
}

/**
 * Scroll to element smoothly with header offset
 */
export function smoothScrollTo(element: HTMLElement, offset = 80) {
  const top = element.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({
    top,
    behavior: 'smooth',
  });
}
