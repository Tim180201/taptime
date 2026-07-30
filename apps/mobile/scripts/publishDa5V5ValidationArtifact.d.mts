import type {
  Da5V5ValidationAndroidSdkAuthority,
  Da5V5ValidationApkInspection,
  Da5V5ValidationFileBinding,
  Da5V5ValidationSourceRecord,
} from './da5V5ValidationArtifact.mjs';

export interface Da5V5ValidationPublisherDependencies {
  readonly inspectApk: (
    path: string,
    androidSdkAuthority: Da5V5ValidationAndroidSdkAuthority,
  ) => Da5V5ValidationApkInspection;
}
export interface Da5V5ValidationPublicationInterruption {
  checkpoint(label: string): Promise<void>;
}
export interface Da5V5ValidationPublicationReceipt {
  readonly apk: Da5V5ValidationFileBinding;
  readonly directory: string;
  readonly manifest: Da5V5ValidationFileBinding;
  readonly publicationName: string;
  readonly sourceCommit: string;
  readonly sourceClosure: readonly Da5V5ValidationSourceRecord[];
  readonly sourceTree: string;
  commit(): void;
  isRevocable(): boolean;
  rollback(): void;
}

export function publishDa5V5ValidationArtifact(
  options: {
    readonly environment?: NodeJS.ProcessEnv;
    readonly interruption: Da5V5ValidationPublicationInterruption;
    readonly outputDirectory: string;
    readonly repositoryRoot: string;
    readonly sourceApkPath: string;
    readonly sourceCommit: string;
    readonly sourceClosure: readonly Da5V5ValidationSourceRecord[];
    readonly sourceTree: string;
  },
  dependencies?: Da5V5ValidationPublisherDependencies,
): Promise<Readonly<Da5V5ValidationPublicationReceipt>>;
