import { createContext, type ReactNode, useContext } from 'react';

/**
 * A slot at the top of every `Screen`'s content (above the screen's own first item), for an
 * app-wide band such as the demo-data notice. Whoever owns the band puts a `ScreenTopProvider`
 * high in the tree with the node to show (or `null`); `Screen` renders it through `ScreenTop`.
 * Without a provider, or with `null`, nothing is rendered.
 */
const ScreenTopContext = createContext<ReactNode>(null);

export function ScreenTopProvider({ value, children }: { value: ReactNode; children: ReactNode }) {
  return <ScreenTopContext.Provider value={value}>{children}</ScreenTopContext.Provider>;
}

export function ScreenTop() {
  const node = useContext(ScreenTopContext);
  return node === null || node === undefined || node === false ? null : <>{node}</>;
}
