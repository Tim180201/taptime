import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  DA5_V5_ANDROID_ARTIFACT,
  verifyDa5V5ImmutableFile,
} from '../../mobile/scripts/da5V5AndroidArtifact.mjs';
import {
  resolveSyntheticE2eHermesCompilerPath,
} from '../../mobile/scripts/verifySyntheticE2eAndroidRuntime.mjs';
import {
  verifyDa5V5ValidationToolIdentity,
} from '../../mobile/scripts/da5V5ValidationRuntimeContract.mjs';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const operatorBundle = fileURLToPath(
  new URL('../dist/da5V5Main.js', import.meta.url),
);
const operatorSourceMap = fileURLToPath(
  new URL('../dist/da5V5Main.js.map', import.meta.url),
);
const flightBundle = fileURLToPath(
  new URL('../dist/da5V5FlightMain.js', import.meta.url),
);
const flightSourceMap = fileURLToPath(
  new URL('../dist/da5V5FlightMain.js.map', import.meta.url),
);
const indexBundle = fileURLToPath(
  new URL('../dist/index.js', import.meta.url),
);
const ptyCredential = '0123456789abcdef'.repeat(4);

describe('DA5 V5 Product operator bundle start smoke', () => {
  it('bounds the GHSA-rgw5-rvv9-x895 intermediate-expansion path in a child', () => {
    const regression = spawnSync(
      process.execPath,
      [
        '--max-old-space-size=64',
        '--input-type=module',
        '--eval',
        `
          import { createRequire } from 'node:module';
          import { expand } from 'brace-expansion';

          const require = createRequire(import.meta.url);
          const { version } = require('brace-expansion/package.json');
          const part = '{' + '0'.repeat(50) + '1..100000}';
          const input = '{' + Array(400).fill(part).join(',') + '}';
          const expanded = expand(input);
          const totalLength = expanded.reduce((sum, value) => sum + value.length, 0);
          if (expanded.length === 0 || totalLength > 4_000_000) process.exit(2);
          process.stdout.write(JSON.stringify({ totalLength, version }));
        `,
      ],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: { PATH: process.env.PATH },
        maxBuffer: 64 * 1024,
        timeout: 5_000,
      },
    );

    expect(regression.error, regression.stderr).toBeUndefined();
    expect(regression.signal, regression.stderr).toBeNull();
    expect(regression.status, regression.stderr).toBe(0);
    expect(JSON.parse(regression.stdout)).toMatchObject({
      version: '5.0.9',
    });
  }, 10_000);

  it('bounds GHSA-5p4m-2wfm-xmqj !!omap resolution in a child', () => {
    expect(runBoundedDependencyRegression(`
      import { createRequire } from 'node:module';
      import yaml from 'js-yaml';

      const require = createRequire(import.meta.url);
      const { version } = require('js-yaml/package.json');
      const entries = 20_000;
      const document = '!!omap\\n'
        + Array.from(
          { length: entries },
          (_, index) => '- k' + index + ': ' + index,
        ).join('\\n')
        + '\\n';
      const parsed = yaml.load(document);
      if (!Array.isArray(parsed) || parsed.length !== entries) process.exit(2);
      process.stdout.write(JSON.stringify({ entries: parsed.length, version }));
    `)).toEqual({
      entries: 20_000,
      version: '4.3.1',
    });
  }, 10_000);

  it('bounds GHSA-28wg-ghj8-5hjv and GHSA-2v37-7h3g-55p8 generators in a child', () => {
    expect(runBoundedDependencyRegression(`
      import { createRequire } from 'node:module';
      import { customAlphabet, customRandom } from 'nanoid';
      import {
        customAlphabet as nonSecureCustomAlphabet,
        nanoid as nonSecureNanoid,
      } from 'nanoid/non-secure';

      const require = createRequire(import.meta.url);
      const { version } = require('nanoid/package.json');
      const results = {
        negativeCustomAlphabet: nonSecureCustomAlphabet('ab', -1)(),
        negativeNanoid: nonSecureNanoid(-1),
        zeroCustomAlphabet: customAlphabet('ab', 0)(),
        zeroCustomRandom: customRandom(
          'ab',
          0,
          (size) => new Uint8Array(size),
        )(),
      };
      process.stdout.write(JSON.stringify({ results, version }));
    `)).toEqual({
      results: {
        negativeCustomAlphabet: '',
        negativeNanoid: '',
        zeroCustomAlphabet: '',
        zeroCustomRandom: '',
      },
      version: '3.3.18',
    });
  }, 10_000);

  it('closes the accepted image-size high exception to reviewed Product inputs', () => {
    const lock = JSON.parse(
      readFileSync(join(repositoryRoot, 'package-lock.json'), 'utf8'),
    ) as PackageLock;
    const packages = lock.packages;

    expect({
      expo: packages['node_modules/expo']?.version,
      expoMetro: packages['node_modules/@expo/metro']?.version,
      expoToMetro:
        packages['node_modules/expo']?.dependencies?.['@expo/metro'],
      expoMetroToMetro:
        packages['node_modules/@expo/metro']?.dependencies?.metro,
      imageSize: packages['node_modules/image-size']?.version,
      metro: packages['node_modules/metro']?.version,
      metroToImageSize:
        packages['node_modules/metro']?.dependencies?.['image-size'],
    }).toEqual({
      expo: '57.0.2',
      expoMetro: '56.0.0',
      expoMetroToMetro: '0.84.4',
      expoToMetro: '~56.0.0',
      imageSize: '1.2.1',
      metro: '0.84.4',
      metroToImageSize: '^1.0.2',
    });
    expect(
      Object.entries(packages)
        .filter(([, record]) => record.dependencies?.['image-size'] !== undefined)
        .map(([path, record]) => [path, record.dependencies?.['image-size']]),
    ).toEqual([['node_modules/metro', '^1.0.2']]);

    const mobileDirectory = fileURLToPath(
      new URL('../../mobile/', import.meta.url),
    );
    const expectedAssets: Readonly<Record<string, string>> = Object.freeze({
      'apps/mobile/assets/android-icon-background.png':
        'fb139c2dee362ebf2070e23b96da6fc0d43f8492de38b8af1fd7223e19b5861d',
      'apps/mobile/assets/android-icon-foreground.png':
        '9e3d0315a33c6799de601dd34cd8bf8cc3a8d16f3bf75592baec2ceb7240b391',
      'apps/mobile/assets/android-icon-monochrome.png':
        '6371fc2c12e33ad2215a86c281db3d682a81bebe7c957a842c13b8bf00cceb83',
      'apps/mobile/assets/favicon.png':
        'a4e030697a7571b3e95d31860e4da55d2f98e5e861e2b55e414f45a8556828ba',
      'apps/mobile/assets/icon.png':
        '119462bb78eb240a65c869fc067ee599639b3cb5a41953f25c07b17d2a8c7e0f',
      'apps/mobile/assets/splash-icon.png':
        '5f4c0a732b6325bf4071d9124d2ae67e037cb24fcc9c482ef82bea742109a3b8',
    });

    expect(readImageSizeHandlerNames()).toEqual([
      'bmp',
      'cur',
      'dds',
      'gif',
      'heif',
      'icns',
      'ico',
      'j2c',
      'jp2',
      'jpg',
      'jxl',
      'jxl-stream',
      'ktx',
      'png',
      'pnm',
      'psd',
      'svg',
      'tga',
      'tiff',
      'webp',
    ]);
    expect(Object.keys(IMAGE_SIZE_HANDLER_EXTENSIONS).sort()).toEqual(
      readImageSizeHandlerNames(),
    );

    const trackedMobileFiles = listTrackedMobileFiles();
    expect(new Set(trackedMobileFiles).size).toBe(trackedMobileFiles.length);
    expect(
      trackedMobileFiles.filter((path) => path.startsWith('apps/mobile/assets/')),
    ).toEqual(Object.keys(expectedAssets).sort());
    expect(
      trackedMobileFiles.filter((path) => isSupportedImagePath(path)),
    ).toEqual(Object.keys(expectedAssets).sort());
    expect(
      trackedMobileFiles.filter((path) =>
        /^apps\/mobile\/(?:android|ios|node_modules|dist|build|\.expo)\//u
          .test(path),
      ),
    ).toEqual([]);
    for (const [path, sha256] of Object.entries(expectedAssets)) {
      const absolutePath = resolveRepositoryPath(path);
      const status = lstatSync(absolutePath);
      expect(status.isFile(), path).toBe(true);
      expect(status.isSymbolicLink(), path).toBe(false);
      expect(realpathSync(absolutePath), path).toBe(absolutePath);
      expect(
        createHash('sha256')
          .update(readFileSync(absolutePath))
          .digest('hex'),
        path,
      ).toBe(sha256);
    }

    const appJsonBytes = readFileSync(join(mobileDirectory, 'app.json'));
    expect({
      bytes: appJsonBytes.byteLength,
      sha256: createHash('sha256').update(appJsonBytes).digest('hex'),
    }).toEqual({
      bytes: 1_385,
      sha256:
        '692f6c6c3fb7214bc797af152cbc5572e393d5cdab6a0fd1062e47a0f0fa7250',
    });
    const appConfiguration = JSON.parse(appJsonBytes.toString('utf8')) as unknown;
    const appImageReferences = collectImageReferences(appConfiguration)
      .sort(([left], [right]) => left.localeCompare(right));
    expect(appImageReferences).toEqual([
      ['expo.android.adaptiveIcon.backgroundImage', './assets/android-icon-background.png'],
      ['expo.android.adaptiveIcon.foregroundImage', './assets/android-icon-foreground.png'],
      ['expo.android.adaptiveIcon.monochromeImage', './assets/android-icon-monochrome.png'],
      ['expo.icon', './assets/icon.png'],
      ['expo.web.favicon', './assets/favicon.png'],
    ]);
    for (const [, reference] of appImageReferences) {
      const resolvedReference = resolve(mobileDirectory, reference);
      expect(isPathWithin(mobileDirectory, resolvedReference), reference).toBe(true);
      expect(Object.keys(expectedAssets), reference).toContain(
        relative(repositoryRoot, resolvedReference).split(sep).join('/'),
      );
    }
    expect(
      Object.keys(expectedAssets).filter((path) =>
        !appImageReferences.some(([, reference]) =>
          resolve(mobileDirectory, reference) === resolveRepositoryPath(path),
        ),
      ),
    ).toEqual(['apps/mobile/assets/splash-icon.png']);

    const productSourceFiles = trackedMobileFiles.filter(isProductSourcePath);
    expect(productSourceFiles).toEqual(expect.arrayContaining([
      'apps/mobile/App.tsx',
      'apps/mobile/app.config.js',
      'apps/mobile/index.ts',
    ]));
    expect(findProductImageBoundaryFindings(productSourceFiles)).toEqual([]);

    const mobilePackage = JSON.parse(
      readFileSync(join(mobileDirectory, 'package.json'), 'utf8'),
    ) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    expect(mobilePackage.scripts['android:synthetic-e2e:build']).toBe(
      'node scripts/buildSyntheticE2eAndroid.mjs',
    );
    expect(
      Object.keys({
        ...mobilePackage.dependencies,
        ...mobilePackage.devDependencies,
      }).filter((name) =>
        /camera|document-picker|image-picker|media-library|upload/u.test(name),
      ),
    ).toEqual([]);
    expect(
      trackedMobileFiles.filter((path) =>
        /^apps\/mobile\/metro\.config\./u.test(path),
      ),
    ).toEqual([]);
    const productBuildBytes = readFileSync(
      join(mobileDirectory, 'scripts/buildSyntheticE2eAndroid.mjs'),
    );
    expect({
      bytes: productBuildBytes.byteLength,
      sha256: createHash('sha256').update(productBuildBytes).digest('hex'),
    }).toEqual({
      bytes: 2_224,
      sha256:
        '6ee0a512275550e4ae4058e885a1cb89a64eb2e8f860e1cead43cc56b2a9afaa',
    });
    const productBuild = productBuildBytes.toString('utf8');
    expect(productBuild).toMatch(
      /run\('npx', \['expo', 'prebuild', '--platform', 'android', '--no-install'\], \{\s+environment,\s+\}\);/u,
    );
    expect(productBuild).toContain(
      "run('./gradlew', ['--no-daemon', 'clean', 'assembleRelease'], {",
    );
    expect(productBuild).toContain(
      "run('node', ['scripts/verifySyntheticE2eAndroidRuntime.mjs']);",
    );
    expect(productBuild).not.toContain('buildDa5V5ValidationAndroid');
    expect(productBuild).not.toMatch(
      /\b(?:start|serve)\b|--host|--lan|--tunnel|watchFolders|watch-folder|(?:https?|wss?):\/\//u,
    );
    expect(
      productSourceFiles.map((path) => readFileSync(resolveRepositoryPath(path), 'utf8'))
        .join('\n'),
    ).not.toMatch(
      /watchFolders|watch-folder|(?:https?|wss?):\/\/[^\s'"`]+\.(?:avif|bmp|gif|heic|heif|icns|jpe?g|jxl|png|svg|tiff?|webp)\b/iu,
    );

    expect(DA5_V5_ANDROID_ARTIFACT).toMatchObject({
      apk: {
        bytes: 95_526_563,
        mode: 0o444,
        path:
          '/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/lean-03e0e48a-b02fdb2544225d03/app-release-b02fdb2544225d03.apk',
        sha256:
          'b02fdb2544225d03e3142fa30f12caa8fedf889a558b39cc040cca03f9539234',
      },
      manifest: {
        bytes: 1_968,
        mode: 0o444,
        path:
          '/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/lean-03e0e48a-b02fdb2544225d03/artifact-manifest.txt',
        sha256:
          '91725bb6f14306eb40d0e4414f38511fc829250799af91bacf840ac622efc577',
      },
      packageName: 'com.tim180201.mobile.synthetic',
      sourceCommit: '03e0e48ad53ff91b24ee1182abf782473317988d',
      sourceTree: '4465f8ee5be41f82cdaed5f31f2da92b839c952d',
    });

    const reachabilityMode =
      process.env.TAPTIME_DA5_V5_PRODUCT_APK_REACHABILITY;
    expect([undefined, 'required']).toContain(reachabilityMode);
    if (reachabilityMode === 'required') {
      expect(verifyProductApkDependencyAbsence()).toEqual({
        apkEntries: 1_180,
        bundleBytes: 2_408_772,
        bundleSha256:
          '3354eac63027ab94cb2691bb7eadc9643471852c5ea2f0cb37995899cc857e61',
        bytecodeDumpBytes: 15_281_132,
        bytecodeDumpSha256:
          'e72b5a828f0dc2e2ae9e11ab29c9bf4408362ad1e8691c73b9870a0a41afc99b',
        dependencyNamedEntries: 0,
        forbiddenDependencySignatures: 0,
        sourceMapEntries: 0,
        temporaryRootAbsent: true,
      });
    } else {
      const unavailableBinding: ImmutableFileBinding = {
        ...DA5_V5_ANDROID_ARTIFACT.apk,
        path: join(repositoryRoot, '.missing-da5-v5-product-apk'),
      };
      expect(() => verifyProductApkDependencyAbsence(unavailableBinding))
        .toThrow();
      process.stderr.write(
        'da5_v5_product_apk_reachability=NOT_EXECUTED '
        + 'required_mode=TAPTIME_DA5_V5_PRODUCT_APK_REACHABILITY=required\n',
      );
    }
  }, 90_000);

  it('builds and reaches the hardware-free DA5 startup guard without APK or ADB use', () => {
    const build = spawnSync(
      'npm',
      ['run', 'build', '--workspace=@taptime/synthetic-android-e2e'],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: process.env,
      },
    );
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
    const bundle = readFileSync(operatorBundle, 'utf8');
    const sourceMapBytes = readFileSync(operatorSourceMap);
    const sourceMap = JSON.parse(sourceMapBytes.toString('utf8')) as {
      sourceRoot?: unknown;
      sources: unknown;
      sourcesContent: unknown;
      version: unknown;
    };
    expect({
      bytes: Buffer.byteLength(bundle),
      sha256: createHash('sha256').update(bundle).digest('hex'),
    }).toEqual({
      bytes: 955_797,
      sha256:
        '81d006308ddf063665c2f8995362fcdb8f667ee2f1d8fb14bfa3599c053bc9c5',
    });
    expect({
      bytes: sourceMapBytes.byteLength,
      sha256: createHash('sha256').update(sourceMapBytes).digest('hex'),
    }).toEqual({
      bytes: 1_858_204,
      sha256:
        'e6f92b35c5279aa8e3fd9ba62419785280c8979a99e5eb99a2541a83a334c94d',
    });
    expect(sourceMap.version).toBe(3);
    expect(sourceMap.sourceRoot).toBeUndefined();
    expect(Array.isArray(sourceMap.sources)).toBe(true);
    expect(Array.isArray(sourceMap.sourcesContent)).toBe(true);
    expect(sourceMap.sources).toHaveLength(92);
    expect(sourceMap.sourcesContent).toHaveLength(92);
    const operatorSources = sourceMap.sources as string[];
    expect(new Set(operatorSources).size).toBe(operatorSources.length);
    expect(operatorSources).toEqual(expect.arrayContaining([
      '../src/da5V5Main.ts',
      '../../mobile/scripts/da5V5AndroidArtifact.mjs',
      '../../mobile/scripts/da5V5AndroidDevice.mjs',
    ]));
    expect(
      operatorSources.filter((source) => {
        if (
          typeof source !== 'string'
          || source.length === 0
          || isAbsolute(source)
          || source.includes('\\')
          || source.includes('\0')
        ) {
          return true;
        }
        return !isPathWithin(
          repositoryRoot,
          resolve(dirname(operatorSourceMap), source),
        );
      }),
    ).toEqual([]);
    const highDependencyNames = ['image-size', 'js-yaml', 'nanoid'];
    expect(
      operatorSources.filter((source) =>
        typeof source === 'string'
        && highDependencyNames.some((name) => source.includes(name)),
      ),
    ).toEqual([]);
    expect(bundle).not.toMatch(/\b(?:image-size|js-yaml|nanoid)\b/u);
    expect(bundle).toContain(String(DA5_V5_ANDROID_ARTIFACT.apk.bytes));
    expect(bundle).toContain(DA5_V5_ANDROID_ARTIFACT.apk.sha256);
    expect(bundle).toContain('da5_v5_android_install=mismatch category=');
    expect(bundle).toContain('armPreparedEmployee');
    for (const category of [
      'artifact_reverify',
      'child_start_transport',
      'stdin_pipe',
      'timeout',
      'child_exit',
      'package_manager_receipt',
      'installed_provenance',
      'cleanup',
      'signal_abort',
    ]) {
      expect(bundle).toContain(category);
    }
    expect(bundle).toContain('cleanup_status=');
    expect(bundle).toContain('cleanup_substage=');
    expect(bundle).toContain('install_abandon');
    expect(bundle).toContain('runner_binding');
    expect(bundle).toContain('uncertainty_escalation');
    expect(bundle).toContain('settleDa5V5BackgroundOperation');
    expect(bundle).toContain('settleForTerminalCleanup');
    expect(bundle).toContain('da5_v5_aborted');
    expect(bundle).toContain('install-create');
    expect(bundle).toContain('install-write');
    expect(bundle).toContain('install-commit');
    expect(bundle).toContain('install-abandon');
    expect(bundle).toContain('UsbFfs');
    expect(bundle).toContain(
      'employee-installation-transition-confirm <PASS|FAIL|AMBIGUOUS>',
    );
    expect(bundle).toContain('employee-ready-confirm <PASS|FAIL|AMBIGUOUS>');
    expect(bundle).toContain('| abort | stop');
    expect(bundle).toContain('da5_v5_employee_installation_transition=');
    expect(bundle).toContain('old-installation-cleaned');
    expect(bundle).toContain('replacement-installed');
    expect(bundle).toContain('replacement-cleared');
    expect(bundle).toContain('employee-prepared');
    expect(bundle).toContain('da5_v5_employee_ready=');
    expect(bundle).toContain('scan-status-ready');
    expect(bundle).toContain('uiautomator');
    expect(bundle).toContain('/dev/tty');
    expect(bundle).toContain('query-failed');
    expect(bundle).toMatch(
      /"shell",\s+"pm",\s+"clear",\s+"--user",\s+androidOwnerUser,\s+DA5_V5_ANDROID_PACKAGE/u,
    );
    expect(bundle).toContain('com.tim180201.mobile.synthetic');
    expect(bundle).not.toContain('--remove-all');
    expect(bundle).toContain('credential-field-ready <administrator|enrollment|employee> EMPTY_ACTIVE');
    expect(bundle).toContain('credential-field-confirm <administrator|enrollment|employee>');
    expect(bundle).toContain('synthetic_credential_injection=pending_human_confirmation');
    expect(bundle).toContain('da5_v5_accessibility_surface_plan=');
    expect(bundle).toContain('protected-review-error');
    expect(bundle).toContain('auth-login');
    expect(bundle).toContain('administrator-setup');
    expect(bundle).toContain('accessibility-prepare | accessibility-check');
    expect(bundle).toContain('da5_v5_accessibility_prepare=match restore_required=armed');
    expect(bundle).toContain('prepareAccessibilityProfileChange');
    expect(bundle).toContain('profile-change-prepared');
    expect(bundle).toContain('accessibility-surface-confirm <surface> <PASS|FAIL|AMBIGUOUS>');
    expect(bundle).toContain('accessibility-credential-check <administrator|employee>');
    expect(bundle).toContain('da5_v5_accessibility_restore_only=mismatch');
    expect(bundle).toContain('da5_v5_accessibility_restore_required=match');
    expect(bundle).toContain('DA5 V5 accessibility restore proof is unavailable');
    expect(bundle).toContain('standard-profile-check');
    expect(bundle).toContain('commandSubmissionTail');
    expect(bundle).toContain('requireEmptyOutput: true');
    expect(bundle).toContain('IFS= read -r v || exit 40;');
    expect(bundle).toContain('*[!0-9a-f]*');
    expect(bundle).not.toContain('credential-paste-confirm');
    expect(bundle).not.toContain('pbcopy');
    expect(bundle).not.toContain('pbpaste');

    const supervisorBundle = readFileSync(flightBundle, 'utf8');
    const supervisorSourceMapBytes = readFileSync(flightSourceMap);
    const supervisorSourceMap = JSON.parse(
      supervisorSourceMapBytes.toString('utf8'),
    ) as {
      sourceRoot?: unknown;
      sources: unknown;
      sourcesContent: unknown;
      version: unknown;
    };
    expect({
      bytes: Buffer.byteLength(supervisorBundle),
      sha256: createHash('sha256').update(supervisorBundle).digest('hex'),
    }).toEqual({
      bytes: 160_126,
      sha256:
        '1c83b1adc1bc8c738582a446e1ea169cc161d9e664abc6c6f15053c60d8aafa6',
    });
    expect({
      bytes: supervisorSourceMapBytes.byteLength,
      sha256: createHash('sha256').update(supervisorSourceMapBytes).digest('hex'),
    }).toEqual({
      bytes: 448_429,
      sha256:
        'a610cf725a9c390c6755facd5c0d5e7fc19c0e88d0e6daa5ae24b8be262d5200',
    });
    expect(supervisorSourceMap).toMatchObject({ version: 3 });
    expect(supervisorSourceMap.sourceRoot).toBeUndefined();
    expect(supervisorSourceMap.sources).toHaveLength(16);
    expect(supervisorSourceMap.sourcesContent).toHaveLength(16);
    expect(supervisorSourceMap.sources).toEqual(expect.arrayContaining([
      '../src/da5V5FlightMain.ts',
      '../src/Da5V5FlightController.ts',
      '../src/Da5V5CleanStateAttestation.ts',
    ]));
    expect(supervisorBundle).toContain('da5-v5-fast-flight-v1');
    expect(supervisorBundle).toContain('da5V5Main.js');
    expect(supervisorBundle).toContain('RECEIPT_SEAL_FAILURE');
    expect(supervisorBundle).toContain('invalid_receipt_root');
    expect(supervisorBundle).toContain('receipt_sealed');
    expect(supervisorBundle).toContain('DA5 V5 receipt schema mismatch');
    expect(supervisorBundle).toContain('DA5 V5 process attestation failed');
    expect(supervisorBundle).toContain('DA5 V5 binding set mismatch');
    expect(supervisorBundle).toContain('TAPTIME_DA5_V5_FINAL_V3_SHA256');
    expect(supervisorBundle).toContain('TAPTIME_DA5_V5_EXACT_HEAD_CI_SHA256');
    expect(supervisorBundle).toContain('TAPTIME_DA5_V5_RUNTIME_MANIFEST_SHA256');
    const syntheticPackage = JSON.parse(readFileSync(
      fileURLToPath(new URL('../package.json', import.meta.url)),
      'utf8',
    )) as { readonly scripts: Readonly<Record<string, string>> };
    expect(syntheticPackage.scripts['da5-v5:start']).toBe(
      'node dist/da5V5FlightMain.js',
    );
    expect(syntheticPackage.scripts['da5-v5:child']).toBe('node dist/da5V5Main.js');

    const environment = Object.fromEntries(
      Object.entries(process.env).filter(([name]) => !name.startsWith('TAPTIME_')),
    );
    const start = startOperatorWithFd3(environment);

    expect(start.status).toBe(1);
    expect(start.stdout).toBe('');
    expect(start.stderr).toContain(
      'DA5 V5 requires the exact explicit synthetic profile',
    );
    expect(start.stderr).not.toContain('Synthetic E2E release APK');
    expect(start.stderr).not.toContain(
      'synthetic_e2e_android_runtime_complete_verified',
    );

    const startNear = startOperatorWithFd3({
          ...environment,
          PATH: '',
          TAPTIME_DA5_V5_ANDROID_API: '35',
          TAPTIME_DA5_V5_ANDROID_BUILD: 'synthetic-build',
          TAPTIME_DA5_V5_ANDROID_RELEASE: '15',
          TAPTIME_DA5_V5_DEVICE_MODEL: 'Synthetic Galaxy',
          TAPTIME_DA5_V5_IMPLEMENTATION_COMMIT: 'a'.repeat(40),
          TAPTIME_DA5_V5_IMPLEMENTATION_TREE: 'b'.repeat(40),
          TAPTIME_DA5_V5_PG_CONFIG: `${repositoryRoot}/.missing-da5-v5-pg-config`,
          TAPTIME_DA5_V5_RUNTIME_GUARD_BINARY:
            `${repositoryRoot}/.missing-da5-v5-runtime-guard`,
          TAPTIME_DA5_V5_RUNTIME_GUARD_BINARY_SHA256: 'c'.repeat(64),
          TAPTIME_DA5_V5_RUNTIME_GUARD_MANIFEST:
            `${repositoryRoot}/.missing-da5-v5-runtime-guard-manifest`,
          TAPTIME_DA5_V5_RUNTIME_GUARD_MANIFEST_SHA256: 'd'.repeat(64),
          TAPTIME_DA5_V5_TAG_A_FINGERPRINT: 'B55E8B6AEB30',
          TAPTIME_DA5_V5_TAG_B_FINGERPRINT: '32A54C8F2F29',
          TAPTIME_DA5_V5_TAG_TECHNOLOGY: 'NfcA',
          TAPTIME_DA5_V5_TAG_X_FINGERPRINT: 'F61C9F702CFE',
          TAPTIME_DA5_V5_TALKBACK_PACKAGE:
            'com.google.android.marvin.talkback',
          TAPTIME_DA5_V5_TALKBACK_VERSION: '15.1.0',
          TAPTIME_SYNTHETIC_E2E_PROFILE: 'da5-v5',
    });

    expect(startNear.status).toBe(1);
    expect(startNear.stdout).toBe(
      'da5_v5_precleanup_snapshot={"aggregates":{"equality":"unproved","observation":"unobserved"},'
      + '"invariants":{"equality":"unproved","observation":"unobserved"},'
      + '"queue":{"equality":"unproved","observation":"unobserved",'
      + '"reason":"operator_schema_has_no_queue_field"},"schema_version":1,'
      + '"tag_roles":{"equality":"unproved","observation":"unobserved"}}\n'
      + 'da5_v5_cleanup_complete\n',
    );
    expect(startNear.stderr).toBe('da5_v5_start_failed\n');
    expect(startNear.stderr).not.toContain('Synthetic E2E release APK');

    const ptyProbe = runPtyProbe(
      ptyProbeSource(),
      ptyCredential,
      'credential',
    );

    expect(ptyProbe).toEqual({
      captureInvalid: false,
      captureMatched: true,
      captureRejected: false,
      childExit: 0,
      cleanupGroupAbsent: true,
      descendantObserved: true,
      finalRemainderScanned: true,
      readyCount: 1,
      secretOccurrences: 0,
      status: 'match',
    });

    for (const mode of [
      'duplicate',
      'unterminated-foreign',
      'valid-eof',
      'close',
      'error',
    ] as const) {
      const rejectedProbe = runPtyProbe(
        ptyProbeSource(),
        ptyCredential,
        mode,
      );
      expect(rejectedProbe, mode).toEqual({
        captureInvalid: false,
        captureMatched: false,
        captureRejected: true,
        childExit: 5,
        cleanupGroupAbsent: true,
        descendantObserved: true,
        finalRemainderScanned: true,
        readyCount: 1,
        secretOccurrences: 0,
        status: 'rejected',
      });
    }

    const invalidProbe = runPtyProbe(
      ptyProbeSource(),
      'A'.repeat(64),
      'invalid',
    );
    expect(invalidProbe).toEqual({
      captureInvalid: true,
      captureMatched: false,
      captureRejected: false,
      childExit: 4,
      cleanupGroupAbsent: true,
      descendantObserved: true,
      finalRemainderScanned: true,
      readyCount: 1,
      secretOccurrences: 0,
      status: 'rejected',
    });

    const boundedWrapperCleanupProbe = runPtyProbe(
      `
        import { spawn } from 'node:child_process';
        const descendant = spawn(
          process.execPath,
          ['--eval', "process.on('SIGHUP', () => undefined); setInterval(() => undefined, 1_000);"],
          { stdio: 'ignore' },
        );
        descendant.unref();
        setInterval(() => undefined, 1_000);
      `,
      ptyCredential,
      'wrapper-timeout',
    );
    expect(boundedWrapperCleanupProbe).toMatchObject({
      cleanupGroupAbsent: true,
      finalRemainderScanned: true,
      status: 'wrapper-process-group-cleaned',
    });

    const unterminatedScannerProbe = runPtyProbe(
      `process.stdout.write(${JSON.stringify(ptyCredential)});`,
      ptyCredential,
      'unterminated-leak',
    );
    expect(unterminatedScannerProbe).toMatchObject({
      childExit: 0,
      cleanupGroupAbsent: true,
      finalRemainderScanned: true,
      secretOccurrences: 1,
      status: 'detected',
    });
  }, 30_000);
});

function startOperatorWithFd3(environment: NodeJS.ProcessEnv) {
  return spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `
        import { spawn } from 'node:child_process';
        const chunks = [];
        for await (const chunk of process.stdin) chunks.push(chunk);
        const credential = Buffer.concat(chunks);
        for (const chunk of chunks) chunk.fill(0);
        const child = spawn(process.execPath, [process.argv[1]], {
          cwd: process.cwd(),
          env: process.env,
          stdio: ['ignore', 'pipe', 'pipe', 'pipe'],
        });
        process.once('exit', () => credential.fill(0));
        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);
        const pipe = child.stdio[3];
        pipe.on('error', () => credential.fill(0));
        pipe.end(credential, () => credential.fill(0));
        child.once('close', (code, signal) => {
          credential.fill(0);
          process.exitCode = signal === null && code !== null ? code : 2;
        });
      `,
      operatorBundle,
    ],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: environment,
      input: ptyCredential,
      maxBuffer: 64 * 1024,
      timeout: 10_000,
    },
  );
}

const IMAGE_SIZE_HANDLER_EXTENSIONS: Readonly<
  Record<string, readonly string[]>
> = Object.freeze({
  bmp: ['bmp'],
  cur: ['cur'],
  dds: ['dds'],
  gif: ['gif'],
  heif: ['avif', 'heic', 'heif'],
  icns: ['icns'],
  ico: ['ico'],
  j2c: ['j2c', 'j2k', 'jpc'],
  jp2: ['jp2', 'jpf', 'jpm', 'jpx', 'mj2'],
  jpg: ['jpe', 'jpeg', 'jfif', 'jpg'],
  jxl: ['jxl'],
  'jxl-stream': ['jxl'],
  ktx: ['ktx'],
  png: ['png'],
  pnm: ['pam', 'pbm', 'pgm', 'pnm', 'ppm'],
  psd: ['psd'],
  svg: ['svg'],
  tga: ['tga'],
  tiff: ['tif', 'tiff'],
  webp: ['webp'],
});

const SUPPORTED_IMAGE_EXTENSIONS = new Set(
  Object.values(IMAGE_SIZE_HANDLER_EXTENSIONS).flat(),
);

const FORBIDDEN_PRODUCT_BUNDLE_SIGNATURES = Object.freeze([
  'image-size',
  'node_modules/image-size',
  'disabled file type: ',
  'unsupported file type: ',
  'invalid invocation. input should be a uint8array',
  'icn#',
  'icm#',
  'icp4',
  'ic14',
  'no codestream found in jxl container',
  'jxlc',
  'jxlp',
  'invalid heif, no size found',
  'mif1',
  'msf1',
  'hevx',
  'iprp',
  'ipco',
  'node_modules/metro',
  'metro/src',
  'metro-config',
  'metro-file-map',
  'metro-resolver',
  'watchfolders',
]);

function readImageSizeHandlerNames(): string[] {
  const source = readFileSync(
    join(repositoryRoot, 'node_modules/image-size/dist/types/index.js'),
    'utf8',
  );
  const marker = 'exports.typeHandlers = {';
  const start = source.indexOf(marker);
  const end = source.indexOf('\n};', start);
  if (start < 0 || end < 0) {
    throw new Error('image-size handler declaration mismatch');
  }
  return [...source.slice(start + marker.length, end).matchAll(
    /^\s+(?:'([^']+)'|([a-z0-9-]+)):/gmu,
  )]
    .map((match) => match[1] ?? match[2] ?? '')
    .filter((name) => name.length > 0)
    .sort();
}

function listTrackedMobileFiles(): string[] {
  const result = spawnSync(
    'git',
    ['ls-files', '-z', '--', 'apps/mobile'],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: { PATH: process.env.PATH },
      killSignal: 'SIGTERM',
      maxBuffer: 4 * 1024 * 1024,
      timeout: 5_000,
    },
  );
  if (
    result.error !== undefined
    || result.signal !== null
    || result.status !== 0
  ) {
    throw new Error('tracked Product graph enumeration failed');
  }
  const paths = result.stdout.split('\0').filter((path) => path.length > 0);
  if (paths.some((path) => !path.startsWith('apps/mobile/'))) {
    throw new Error('tracked Product graph escaped its repository scope');
  }
  return paths.sort();
}

function isSupportedImagePath(path: string): boolean {
  const withoutQuery = path.split(/[?#]/u, 1)[0] ?? '';
  const extension = withoutQuery.includes('.')
    ? withoutQuery.slice(withoutQuery.lastIndexOf('.') + 1).toLowerCase()
    : '';
  return SUPPORTED_IMAGE_EXTENSIONS.has(extension);
}

function collectImageReferences(
  value: unknown,
  path: readonly string[] = [],
): [string, string][] {
  if (typeof value === 'string') {
    return isSupportedImagePath(value) ? [[path.join('.'), value]] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      collectImageReferences(entry, [...path, String(index)]),
    );
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([name, entry]) => collectImageReferences(entry, [...path, name]));
  }
  return [];
}

function isProductSourcePath(path: string): boolean {
  if (/(?:^|\/)(?:__tests__|tests)(?:\/|$)|\.test\.[^/]+$/u.test(path)) {
    return false;
  }
  if (!/\.(?:cjs|gradle|java|js|jsx|json|kt|mjs|properties|ts|tsx|xml)$/u.test(path)) {
    return false;
  }
  return /^(?:apps\/mobile\/(?:App\.tsx|app\.config\.js|index\.ts)|apps\/mobile\/(?:modules|plugins|src)\/)/u
    .test(path);
}

function findProductImageBoundaryFindings(paths: readonly string[]): string[] {
  const extensions = [...SUPPORTED_IMAGE_EXTENSIONS]
    .sort()
    .join('|');
  const imageLiteral = new RegExp(
    `["'][^"'\\r\\n]+\\.(?:${extensions})(?:[?#][^"']*)?["']`,
    'iu',
  );
  const externalImageInput =
    /\b(?:FormData|Image|ImageBackground)\b|camera|document-picker|expo-image|image-picker|media-library|multipart\/form-data|upload/iu;
  const findings: string[] = [];
  for (const path of paths) {
    const source = readFileSync(resolveRepositoryPath(path), 'utf8');
    if (imageLiteral.test(source)) {
      findings.push(`${path}:image-literal`);
    }
    if (externalImageInput.test(source)) {
      findings.push(`${path}:external-image-input`);
    }
  }
  return findings;
}

function resolveRepositoryPath(repositoryPath: string): string {
  const absolutePath = resolve(repositoryRoot, ...repositoryPath.split('/'));
  if (!isPathWithin(repositoryRoot, absolutePath)) {
    throw new Error('repository path escaped its root');
  }
  return absolutePath;
}

function isPathWithin(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate);
  return relativePath === ''
    || (
      relativePath !== '..'
      && !relativePath.startsWith(`..${sep}`)
      && !isAbsolute(relativePath)
    );
}

function verifyProductApkDependencyAbsence(
  apkBinding: ImmutableFileBinding = DA5_V5_ANDROID_ARTIFACT.apk,
): ProductApkDependencyEvidence {
  const initialApk = verifyDa5V5ImmutableFile(apkBinding);
  verifyDa5V5ImmutableFile(DA5_V5_ANDROID_ARTIFACT.manifest);
  const unzipBinding: ImmutableFileBinding = {
    bytes: 454_560,
    mode: 0o755,
    path: '/usr/bin/unzip',
    sha256: 'a07e8b49ac7c1f1fffd8b45544dc69a9cd71a7015f63e6e139c582cff2a56f33',
  };
  const hermesBinding: ImmutableFileBinding = {
    bytes: 8_862_552,
    mode: 0o755,
    path: resolveSyntheticE2eHermesCompilerPath(),
    sha256: 'c7450cc82978f67052a46dbf8e29ccc4b71107e042154c38907829bf046025be',
  };
  verifyDa5V5ValidationToolIdentity(unzipBinding);
  verifyDa5V5ValidationToolIdentity(hermesBinding);

  const temporaryRoot = mkdtempSync(
    join(tmpdir(), 'taptime-da5-product-apk-'),
  );
  chmodSync(temporaryRoot, 0o700);
  if (
    (lstatSync(temporaryRoot).mode & 0o777) !== 0o700
    || !isPathWithin(realpathSync(tmpdir()), realpathSync(temporaryRoot))
  ) {
    rmSync(temporaryRoot, { force: true, recursive: true });
    throw new Error('Product APK inspection root boundary mismatch');
  }

  let evidence: Omit<ProductApkDependencyEvidence, 'temporaryRootAbsent'>
    | undefined;
  try {
    const listing = spawnSync(
      unzipBinding.path,
      ['-Z1', apkBinding.path],
      {
        encoding: 'utf8',
        env: { LANG: 'C', LC_ALL: 'C', PATH: process.env.PATH },
        killSignal: 'SIGTERM',
        maxBuffer: 32 * 1024 * 1024,
        timeout: 30_000,
      },
    );
    if (
      listing.error !== undefined
      || listing.signal !== null
      || listing.status !== 0
    ) {
      throw new Error('Product APK entry inspection failed');
    }
    const entries = listing.stdout.split(/\r?\n/u).filter(Boolean);
    if (
      new Set(entries).size !== entries.length
      || entries.some((entry) =>
        isAbsolute(entry)
        || entry.includes('\\')
        || entry.split('/').includes('..'),
      )
    ) {
      throw new Error('Product APK entry boundary mismatch');
    }
    const bundleEntries = entries.filter((entry) =>
      entry === 'assets/index.android.bundle',
    );
    const sourceMapEntries = entries.filter((entry) => /\.map$/iu.test(entry));
    const dependencyNamedEntries = entries.filter((entry) =>
      /(?:^|\/)(?:image-size|metro(?:-[^/]+)?)(?:\/|$)|(?:^|\/)(?:heif|icns|jxl)(?:[./-]|$)/iu
        .test(entry),
    );
    const bundleEntry = bundleEntries[0];
    if (
      bundleEntry === undefined
      || bundleEntries.length !== 1
      || sourceMapEntries.length !== 0
      || dependencyNamedEntries.length !== 0
    ) {
      throw new Error('Product APK executable graph boundary mismatch');
    }

    const extraction = spawnSync(
      unzipBinding.path,
      ['-p', apkBinding.path, bundleEntry],
      {
        encoding: null,
        env: { LANG: 'C', LC_ALL: 'C', PATH: process.env.PATH },
        killSignal: 'SIGTERM',
        maxBuffer: 128 * 1024 * 1024,
        timeout: 30_000,
      },
    );
    if (
      extraction.error !== undefined
      || extraction.signal !== null
      || extraction.status !== 0
    ) {
      throw new Error('Product Hermes bundle extraction failed');
    }
    const bundlePath = join(temporaryRoot, 'index.android.bundle');
    writeFileSync(bundlePath, extraction.stdout);
    const bytecode = spawnSync(
      hermesBinding.path,
      ['-b', '-dump-bytecode', '-pretty', bundlePath],
      {
        encoding: 'utf8',
        env: { LANG: 'C', LC_ALL: 'C', PATH: process.env.PATH },
        killSignal: 'SIGTERM',
        maxBuffer: 256 * 1024 * 1024,
        timeout: 60_000,
      },
    );
    if (
      bytecode.error !== undefined
      || bytecode.signal !== null
      || bytecode.status !== 0
      || !bytecode.stdout.includes('Function<metroRequire>')
    ) {
      throw new Error('Product Hermes bytecode dump inspection failed');
    }
    const executableText = `${extraction.stdout.toString('latin1')}\n${bytecode.stdout}`
      .toLowerCase();
    const forbiddenSignatures = FORBIDDEN_PRODUCT_BUNDLE_SIGNATURES
      .filter((signature) => executableText.includes(signature));
    if (forbiddenSignatures.length !== 0) {
      throw new Error('Product Hermes dependency reachability mismatch');
    }
    evidence = {
      apkEntries: entries.length,
      bundleBytes: extraction.stdout.byteLength,
      bundleSha256: createHash('sha256').update(extraction.stdout).digest('hex'),
      bytecodeDumpBytes: Buffer.byteLength(bytecode.stdout),
      bytecodeDumpSha256:
        createHash('sha256').update(bytecode.stdout).digest('hex'),
      dependencyNamedEntries: dependencyNamedEntries.length,
      forbiddenDependencySignatures: forbiddenSignatures.length,
      sourceMapEntries: sourceMapEntries.length,
    };
    const finalApk = verifyDa5V5ImmutableFile(apkBinding);
    if (
      finalApk.identity.dev !== initialApk.identity.dev
      || finalApk.identity.ino !== initialApk.identity.ino
    ) {
      throw new Error('Product APK identity changed during inspection');
    }
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
  if (evidence === undefined || existsSync(temporaryRoot)) {
    throw new Error('Product APK inspection cleanup mismatch');
  }
  return { ...evidence, temporaryRootAbsent: true };
}

function runBoundedDependencyRegression(source: string): unknown {
  const regression = spawnSync(
    process.execPath,
    ['--max-old-space-size=64', '--input-type=module', '--eval', source],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: { PATH: process.env.PATH },
      killSignal: 'SIGTERM',
      maxBuffer: 64 * 1024,
      timeout: 5_000,
    },
  );
  expect(regression.error, regression.stderr).toBeUndefined();
  expect(regression.signal, regression.stderr).toBeNull();
  expect(regression.status, regression.stderr).toBe(0);
  return JSON.parse(regression.stdout) as unknown;
}

interface PackageLock {
  readonly packages: Readonly<Record<string, LockPackageRecord>>;
}

interface LockPackageRecord {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly version?: string;
}

interface ImmutableFileBinding {
  readonly bytes: number;
  readonly mode: number;
  readonly path: string;
  readonly sha256: string;
}

interface ProductApkDependencyEvidence {
  readonly apkEntries: number;
  readonly bundleBytes: number;
  readonly bundleSha256: string;
  readonly bytecodeDumpBytes: number;
  readonly bytecodeDumpSha256: string;
  readonly dependencyNamedEntries: number;
  readonly forbiddenDependencySignatures: number;
  readonly sourceMapEntries: number;
  readonly temporaryRootAbsent: boolean;
}

interface PtyProbeResult {
  readonly captureInvalid: boolean;
  readonly captureMatched: boolean;
  readonly captureRejected: boolean;
  readonly childExit: number | null;
  readonly cleanupGroupAbsent: boolean;
  readonly descendantObserved: boolean;
  readonly finalRemainderScanned: boolean;
  readonly readyCount: number;
  readonly secretOccurrences: number;
  readonly status:
    | 'detected'
    | 'match'
    | 'mismatch'
    | 'rejected'
    | 'wrapper-process-group-cleaned';
}

function runPtyProbe(
  childSource: string,
  secret: string,
  mode: 'close' | 'credential' | 'duplicate' | 'error' | 'invalid'
    | 'unterminated-foreign' | 'unterminated-leak' | 'valid-eof'
    | 'wrapper-timeout',
): PtyProbeResult {
  const secretBytes = Buffer.from(secret, 'ascii');
  try {
    const probe = spawnSync(
      'python3',
      [
        '-c',
        PTY_PROBE,
        process.execPath,
        Buffer.from(childSource, 'utf8').toString('base64'),
        secretBytes.toString('base64'),
        mode,
      ],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: { PATH: process.env.PATH },
        killSignal: 'SIGTERM',
        maxBuffer: 64 * 1024,
        timeout: 10_000,
      },
    );
    if (probe.error !== undefined || probe.signal !== null || probe.status !== 0) {
      throw new Error('DA5 V5 PTY wrapper failed');
    }
    try {
      return JSON.parse(probe.stdout) as PtyProbeResult;
    } catch {
      throw new Error('DA5 V5 PTY wrapper result mismatch');
    }
  } finally {
    secretBytes.fill(0);
  }
}

function ptyProbeSource(): string {
  return `
    import { spawn } from 'node:child_process';
    import { createInterface } from 'node:readline';
    import {
      Da5V5InputOwnership,
      readDa5V5HiddenCredential,
    } from ${JSON.stringify(pathToFileURL(indexBundle).href)};

    const descendant = spawn(
      process.execPath,
      ['--eval', "process.on('SIGHUP', () => undefined); setInterval(() => undefined, 1_000);"],
      { stdio: 'ignore' },
    );
    descendant.unref();

    const ownership = new Da5V5InputOwnership();
    const commandInput = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      historySize: 0,
    });
    ownership.attachCommand(commandInput);
    process.stdout.write('BOOT\\n');
    commandInput.on('line', async (line) => {
      if (line !== 'credential-check') process.exit(3);
      try {
        const credential = await readDa5V5HiddenCredential(
          ownership,
          process.stdin,
          () => {
            process.stdout.write('synthetic_password_input_ready\\n');
            if (process.env.DA5_V5_PTY_PROBE_MODE === 'error') {
              process.stdin.emit('error', new Error('private PTY probe detail'));
            }
          },
        );
        const length = credential.length;
        credential.fill(0);
        process.stdout.write('CAPTURED=' + length + '\\n');
        process.exit(length === 64 ? 0 : 4);
      } catch {
        process.stdout.write('CAPTURE_FAILED\\n');
        process.exit(5);
      }
    });
    commandInput.once('close', () => {
      if (ownership.command() === commandInput) process.exit(6);
    });
  `;
}

const PTY_PROBE = String.raw`
import base64
import errno
import json
import os
import pty
import select
import signal
import sys
import time

node = sys.argv[1]
source = base64.b64decode(sys.argv[2]).decode('utf-8')
secret = bytearray(base64.b64decode(sys.argv[3]))
mode = sys.argv[4]
deadline = time.monotonic() + (0.25 if mode == 'wrapper-timeout' else 5.0)
child_pid = None
master_fd = None
child_status = None
child_reaped = False
line_tail = bytearray()
marker_window = bytearray()
secret_occurrences = 0
ready_count = 0
command_sent = False
secret_sent = False
capture_matched = False
capture_rejected = False
capture_invalid = False
final_remainder_scanned = False
descendant_observed = False
cleanup_group_absent = False
failure = None

class ProbeSignal(Exception):
    pass

class ProbeTimeout(Exception):
    pass

def stop_on_signal(_number, _frame):
    raise ProbeSignal()

for signal_name in ('SIGHUP', 'SIGINT', 'SIGTERM'):
    signal.signal(getattr(signal, signal_name), stop_on_signal)

def zero(buffer):
    for index in range(len(buffer)):
        buffer[index] = 0

def count_secret(buffer):
    count = 0
    start = 0
    while True:
        found = buffer.find(secret, start)
        if found < 0:
            return count
        count += 1
        start = found + max(1, len(secret))

def scan_chunk(chunk):
    global secret_occurrences
    line_tail.extend(chunk)
    if len(line_tail) > 65536:
        raise RuntimeError('bounded_output_exceeded')
    while True:
        newline = line_tail.find(b'\n')
        if newline < 0:
            return
        line = bytearray(line_tail[:newline + 1])
        del line_tail[:newline + 1]
        secret_occurrences += count_secret(line)
        zero(line)

def scan_final_remainder():
    global final_remainder_scanned, secret_occurrences
    secret_occurrences += count_secret(line_tail)
    final_remainder_scanned = True
    zero(line_tail)
    line_tail.clear()

def write_all(buffer):
    view = memoryview(buffer)
    offset = 0
    try:
        while offset < len(buffer):
            written = os.write(master_fd, view[offset:])
            if written <= 0:
                raise RuntimeError('pty_write_failed')
            offset += written
    finally:
        view.release()
        zero(buffer)

def write_once(buffer):
    view = memoryview(buffer)
    try:
        if len(buffer) == 0:
            return
        written = os.write(master_fd, view)
        if written != len(buffer):
            raise RuntimeError('pty_partial_sensitive_write')
    finally:
        view.release()
        zero(buffer)

def group_exists():
    if child_pid is None:
        return False
    try:
        os.killpg(child_pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True

def reap_nonblocking():
    global child_reaped, child_status
    if child_pid is None or child_reaped:
        return
    try:
        waited, status = os.waitpid(child_pid, os.WNOHANG)
    except ChildProcessError:
        child_reaped = True
        return
    if waited == child_pid:
        child_reaped = True
        child_status = status

def terminate_group():
    global cleanup_group_absent
    if child_pid is None:
        cleanup_group_absent = True
        return
    if group_exists():
        try:
            os.killpg(child_pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    grace = time.monotonic() + 0.5
    while time.monotonic() < grace:
        reap_nonblocking()
        if not group_exists():
            cleanup_group_absent = True
            return
        time.sleep(0.01)
    if group_exists():
        try:
            os.killpg(child_pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    kill_grace = time.monotonic() + 1.0
    while time.monotonic() < kill_grace:
        reap_nonblocking()
        if not group_exists():
            cleanup_group_absent = True
            return
        time.sleep(0.01)
    cleanup_group_absent = not group_exists()

try:
    child_pid, master_fd = pty.fork()
    if child_pid == 0:
        os.environ['DA5_V5_PTY_PROBE_MODE'] = mode
        os.execv(node, [node, '--input-type=module', '--eval', source])

    while True:
        if time.monotonic() >= deadline:
            raise ProbeTimeout()
        readable, _, _ = select.select([master_fd], [], [], max(0.0, deadline - time.monotonic()))
        if not readable:
            raise ProbeTimeout()
        try:
            raw_chunk = os.read(master_fd, 4096)
        except OSError as error:
            if error.errno == errno.EIO:
                break
            raise
        if not raw_chunk:
            break
        chunk = bytearray(raw_chunk)
        try:
            scan_chunk(chunk)
            marker_window.extend(chunk)
            if len(marker_window) > 16384:
                del marker_window[:-8192]
            if mode in (
                'credential',
                'duplicate',
                'unterminated-foreign',
                'valid-eof',
                'close',
                'error',
                'invalid',
            ):
                if not command_sent and b'BOOT\r\n' in marker_window:
                    command_sent = True
                    write_all(bytearray(b'credential-check\n'))
                marker = b'synthetic_password_input_ready\r\n'
                observed_ready_count = marker_window.count(marker)
                if observed_ready_count > ready_count:
                    ready_count = observed_ready_count
                if ready_count == 1 and not secret_sent:
                    secret_sent = True
                    if mode == 'close':
                        secret_write = bytearray([4])
                    elif mode == 'error':
                        secret_write = bytearray()
                    else:
                        secret_write = bytearray(secret)
                        secret_write.append(10)
                        if mode == 'duplicate':
                            secret_write.extend(b'foreign\n')
                        elif mode == 'unterminated-foreign':
                            secret_write.extend(b'foreign')
                        elif mode == 'valid-eof':
                            secret_write.append(4)
                    write_once(secret_write)
                capture_matched = b'CAPTURED=64\r\n' in marker_window
                capture_rejected = b'CAPTURE_FAILED\r\n' in marker_window
                capture_invalid = b'CAPTURED=0\r\n' in marker_window
        finally:
            zero(chunk)

    scan_final_remainder()
    _, child_status = os.waitpid(child_pid, 0)
    child_reaped = True
    descendant_observed = group_exists()
except ProbeSignal:
    failure = 'signal'
except ProbeTimeout:
    failure = 'timeout'
except Exception:
    failure = 'wrapper_failure'
finally:
    if not final_remainder_scanned:
        scan_final_remainder()
    if master_fd is not None:
        try:
            os.close(master_fd)
        except OSError:
            pass
    terminate_group()
    reap_nonblocking()
    if child_pid is not None and not child_reaped:
        try:
            _, child_status = os.waitpid(child_pid, 0)
            child_reaped = True
        except ChildProcessError:
            child_reaped = True

child_exit = None
if child_status is not None:
    child_exit = os.waitstatus_to_exitcode(child_status)

if mode == 'credential':
    matched = (
        failure is None
        and child_exit == 0
        and command_sent
        and secret_sent
        and capture_matched
        and ready_count == 1
        and secret_occurrences == 0
        and final_remainder_scanned
        and descendant_observed
        and cleanup_group_absent
    )
    status = 'match' if matched else 'mismatch'
elif mode in ('duplicate', 'unterminated-foreign', 'valid-eof', 'close', 'error'):
    rejected = (
        failure is None
        and child_exit == 5
        and command_sent
        and secret_sent
        and capture_rejected
        and ready_count == 1
        and secret_occurrences == 0
        and final_remainder_scanned
        and descendant_observed
        and cleanup_group_absent
    )
    status = 'rejected' if rejected else 'mismatch'
elif mode == 'invalid':
    rejected = (
        failure is None
        and child_exit == 4
        and command_sent
        and secret_sent
        and capture_invalid
        and ready_count == 1
        and secret_occurrences == 0
        and final_remainder_scanned
        and descendant_observed
        and cleanup_group_absent
    )
    status = 'rejected' if rejected else 'mismatch'
elif mode == 'wrapper-timeout':
    cleaned = (
        failure == 'timeout'
        and final_remainder_scanned
        and cleanup_group_absent
    )
    status = 'wrapper-process-group-cleaned' if cleaned else 'mismatch'
else:
    detected = (
        failure is None
        and child_exit == 0
        and secret_occurrences == 1
        and final_remainder_scanned
        and cleanup_group_absent
    )
    status = 'detected' if detected else 'mismatch'

zero(marker_window)
marker_window.clear()
zero(secret)
print(json.dumps({
    'captureInvalid': capture_invalid,
    'captureMatched': capture_matched,
    'captureRejected': capture_rejected,
    'childExit': child_exit,
    'cleanupGroupAbsent': cleanup_group_absent,
    'descendantObserved': descendant_observed,
    'finalRemainderScanned': final_remainder_scanned,
    'readyCount': ready_count,
    'secretOccurrences': secret_occurrences,
    'status': status,
}, separators=(',', ':')))
`;
