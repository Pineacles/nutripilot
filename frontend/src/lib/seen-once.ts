/**
 * Remember on this device what has already been animated, so motion marks a change and does not
 * replay on every visit. Storage can be missing (private mode); then everything just shows still.
 */
export function firstTime(key: string, value: string): boolean {
  try {
    const k = `np-anim:${key}`;
    if (localStorage.getItem(k) === value) return false;
    localStorage.setItem(k, value);
    return true;
  } catch {
    return false;
  }
}
