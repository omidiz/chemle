/** Mobile = touch-first device; desktop browsers get the clipboard instead. */
function canUseWebShare(data: ShareData): boolean {
  if (typeof navigator.share !== 'function') return false;
  if (!window.matchMedia('(pointer: coarse)').matches) return false;
  return typeof navigator.canShare !== 'function' || navigator.canShare(data);
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Older browsers / non-secure contexts.
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.append(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('Copy failed');
}

let toastTimer: number | undefined;

export function showToast(message: string): void {
  let toast = document.querySelector<HTMLDivElement>('#toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add('toast-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('toast-visible'), 2000);
}

/** Share via the native share sheet on mobile, else copy with a toast. */
export async function shareResult(text: string): Promise<void> {
  const data = { text };
  if (canUseWebShare(data)) {
    try {
      await navigator.share(data);
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // user cancelled
      // Otherwise fall through to the clipboard.
    }
  }
  try {
    await copyText(text);
    showToast('Copied');
  } catch {
    showToast('Could not copy');
  }
}
