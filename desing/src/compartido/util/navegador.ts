const NAVEGADORES: [string, RegExp][] = [
  ["Edge", /Edg\/(\d+)/],
  ["Firefox", /Firefox\/(\d+)/],
  ["Chrome", /Chrome\/(\d+)/],
  ["Safari", /Version\/(\d+).*Safari/],
];

const SISTEMAS: [string, RegExp][] = [
  ["Windows", /Windows/],
  ["Android", /Android/],
  ["iOS", /iPhone|iPad/],
  ["macOS", /Mac OS X|Macintosh/],
  ["Linux", /Linux/],
];

/** User-Agent → "Chrome 131 · macOS" (o "Otro cliente"). */
export function navegador(userAgent: string | null | undefined): string {
  if (!userAgent) return "—";
  const version = NAVEGADORES.map(([n, p]) => [n, p.exec(userAgent)?.[1]] as const).find(([, v]) => v);
  const sistema = SISTEMAS.find(([, p]) => p.test(userAgent))?.[0];
  const cliente = version ? `${version[0]} ${version[1]}` : "Otro cliente";
  return sistema ? `${cliente} · ${sistema}` : cliente;
}
