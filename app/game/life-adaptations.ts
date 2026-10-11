export type Adaptation = 'reservoir' | 'skin';
type Adapted = {
  adaptations?: Adaptation[];
  protection?: Adaptation | null;
  adaptation?: Adaptation;
};
export function adaptationsOf(s: Adapted): Adaptation[] {
  return [
    ...new Set([
      ...(s.adaptations ?? []),
      ...(s.protection ? [s.protection] : s.adaptation ? [s.adaptation] : []),
    ]),
  ];
}
export const hasAdaptation = (s: Adapted, a: Adaptation) =>
  adaptationsOf(s).includes(a);
export function validAdaptations(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.length <= 2 &&
    new Set(v).size === v.length &&
    v.every((a) => a === 'reservoir' || a === 'skin')
  );
}
