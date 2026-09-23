import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { parse } from 'yaml';
const steps=parse(readFileSync('.github/workflows/container-image.yml','utf8')).jobs.publish.steps;
test('landing publication requires source capability and an absent immutable tag',()=>{
  const backend=steps.find(s=>s.name==='Build and publish the backend image once');
  assert.match(backend.with.labels,/io\.taptime\.landing-web=\$\{\{ steps\.image\.outputs\.landing_web \}\}/);
  const landing=steps.find(s=>s.name==='Build and publish the Landing Web image once');
  assert.equal(landing.if,"steps.landing_web_existing.outputs.publish == 'true'");
  assert.equal(steps.find(s=>s.id==='landing_web_existing').if,"steps.image.outputs.landing_web == 'true'");
  assert.equal(landing.with.context,'source');
  assert.match(landing.with.tags,/:landing-web-/);
  const pruning=steps.find(s=>s.name==='Remove obsolete unprotected release images');
  assert.ok(pruning.env.PUBLISH_LANDING_WEB_IMAGE);
  assert.match(pruning.run,/if \[\[ "\$PUBLISH_LANDING_WEB_IMAGE" == 'true' \]\]; then\s+new_image_count=\$\(\(new_image_count \+ 1\)\)/);
});
test('approved operational additions can be staged into a historical source without landing',()=>{
  const root=mkdtempSync(join(tmpdir(),'t031-historical-source-'));
  try {
    mkdirSync(join(root,'control/infrastructure/operations'),{recursive:true});
    for(const file of ['taptime-bootstrap','taptime-landing-password'])writeFileSync(join(root,'control/infrastructure/operations',file),readFileSync('infrastructure/operations/'+file));
    execFileSync('bash',['-c',steps.find(s=>s.name==='Stage the approved console bootstrap for old source refs').run],{cwd:root});
    for(const file of ['taptime-bootstrap','taptime-landing-password'])assert.equal(readFileSync(join(root,'source/infrastructure/operations',file),'utf8'),readFileSync('infrastructure/operations/'+file,'utf8'));
    assert.equal(existsSync(join(root,'source/apps/landing-web')),false);
  } finally {rmSync(root,{recursive:true,force:true});}
});
