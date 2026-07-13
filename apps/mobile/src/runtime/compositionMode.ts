export type MobileCompositionMode = 'product' | 'demo' | 'demo_forbidden';

export function selectMobileCompositionMode(
  demoRequested: boolean,
  developmentBuild: boolean,
): MobileCompositionMode {
  if (!demoRequested) {
    return 'product';
  }
  return developmentBuild ? 'demo' : 'demo_forbidden';
}
