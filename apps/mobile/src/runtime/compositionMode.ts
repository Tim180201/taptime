export type MobileCompositionMode =
  | 'product'
  | 'demo'
  | 'physical_validation'
  | 'configuration_forbidden';

export function selectMobileCompositionMode(
  physicalValidationRequested: boolean,
  demoRequested: boolean,
  developmentBuild: boolean,
): MobileCompositionMode {
  if (physicalValidationRequested && demoRequested) {
    return 'configuration_forbidden';
  }
  if (physicalValidationRequested) {
    return 'physical_validation';
  }
  if (!demoRequested) {
    return 'product';
  }
  return developmentBuild ? 'demo' : 'configuration_forbidden';
}
