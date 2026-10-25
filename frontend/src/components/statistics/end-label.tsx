/** A short name set just past the last point of a line, in the given ink. Pass as a Line's `label`. */
export function endLabel(name: string, ink: string, last: number) {
  function EndLabel({ x, y, index }: { x?: number | string; y?: number | string; index?: number }) {
    if (index !== last || x == null || y == null) return <g />;
    return <text x={Number(x) + 8} y={Number(y) + 4} fill={ink} fontSize={12} fontWeight={500}>{name}</text>;
  }
  return EndLabel;
}
