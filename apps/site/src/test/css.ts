/** A small CSS block parser for the token tests: selector → declarations, every block kept. */
export type Decls = Map<string, string>;

export const parseBlocks = (css: string): Map<string, Decls[]> => {
  const out = new Map<string, Decls[]>();
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    const selector = (m[1] ?? '').trim().replace(/\s+/g, ' ');
    if (selector.startsWith('@')) continue;
    const decls: Decls = new Map();
    for (const d of (m[2] ?? '').split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      decls.set(d.slice(0, i).trim(), d.slice(i + 1).trim().replace(/\s+/g, ' '));
    }
    const list = out.get(selector) ?? [];
    list.push(decls);
    out.set(selector, list);
  }
  return out;
};

/** "r g b" → [r, g, b] */
export const channels = (v: string): [number, number, number] => {
  const [r, g, b] = v.split(/\s+/).map(Number);
  return [r ?? 0, g ?? 0, b ?? 0];
};

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
export const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
