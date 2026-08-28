const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;

export interface BuildIdentityPresentation {
  readonly text: string;
  readonly accessibilityLabel: string;
}

export function presentBuildIdentity(sourceCommit: unknown): BuildIdentityPresentation {
  if (typeof sourceCommit !== 'string' || !COMMIT_PATTERN.test(sourceCommit)) {
    return {
      text: 'App-Stand: nicht verfügbar',
      accessibilityLabel: 'App-Stand ist nicht verfügbar',
    };
  }
  return {
    text: `App-Stand: ${sourceCommit.slice(0, 7)}`,
    accessibilityLabel: `App-Stand: Commit ${sourceCommit}`,
  };
}
