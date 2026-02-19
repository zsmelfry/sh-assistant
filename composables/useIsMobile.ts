const isMobile = ref(false);
let initialized = false;

function update(mql: MediaQueryList | MediaQueryListEvent) {
  isMobile.value = mql.matches;
}

export function useIsMobile() {
  if (import.meta.client && !initialized) {
    const mql = window.matchMedia('(max-width: 768px)');
    isMobile.value = mql.matches;
    mql.addEventListener('change', update);
    initialized = true;
  }
  return isMobile;
}
