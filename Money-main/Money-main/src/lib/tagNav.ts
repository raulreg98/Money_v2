type TagNavListener = (tagName: string) => void;
let listener: TagNavListener | null = null;

export function navigateToTag(tagName: string) {
  if (listener) listener(tagName);
}

export function setTagNavListener(fn: TagNavListener | null) {
  listener = fn;
}
