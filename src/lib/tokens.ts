// Raw token values for places CSS variables cannot reach (viewport theme colour, Discord embeds, canvas exports).
import tokens from '../../design-system/tokens.json';

export function colorToken(name: string): string {
  const t = (tokens.color.tokens as { name: string; value: string }[]).find((x) => x.name === name);
  if (!t) throw new Error(`Unknown colour token: ${name}`);
  return t.value;
}
