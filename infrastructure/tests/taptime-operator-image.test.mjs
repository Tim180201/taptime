import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';
const workflow=parse(readFileSync('.github/workflows/container-image.yml','utf8'));
const steps=workflow.jobs.publish.steps;
const builds=steps.filter(step=>step.uses?.startsWith('docker/build-push-action@'));
test('operator image uses the same exact source and validated public config as Admin Web',()=>{
  const admin=builds.find(step=>step.with.tags.includes(':admin-web-'));
  const operator=builds.find(step=>step.with.tags.includes(':operator-web-'));
  assert.ok(operator,'operator image publication is required');
  assert.equal(operator.with.context,admin.with.context);assert.equal(operator.with['build-args'],admin.with['build-args']);assert.equal(operator.with.labels,admin.with.labels);
  assert.match(operator.if,/operator_web_existing.outputs.publish/);
  const guard=steps.find(step=>step.id==='operator_web_existing');assert.ok(guard);assert.equal(guard.run,steps.find(step=>step.id==='admin_web_existing').run.replaceAll('Admin Web','Operator Web'));
  assert.match(guard.if,/operator_web.*true/,'legacy source refs have no operator workspace');
  const cleanup=steps.find(step=>step.name==='Remove obsolete unprotected release images');assert.ok(cleanup.env.PUBLISH_OPERATOR_WEB_IMAGE);assert.match(cleanup.run,/PUBLISH_OPERATOR_WEB_IMAGE/);
});
test('backend image capability records whether its exact source includes the operator surface',()=>{
  const metadata=steps.find(step=>step.id==='image');assert.match(metadata.run,/apps\/operator-web\/package.json/);assert.match(metadata.run,/operator_web=/);
  assert.match(builds.find(step=>step.with.file.endsWith('backend-api/Dockerfile')).with.labels,/io.taptime.operator-web=.*operator_web/);
});
test('operator checks and build run in CI and Dockerfile embeds a versioned bundle',()=>{
  const root=JSON.parse(readFileSync('package.json','utf8'));
  for(const command of ['test','typecheck'])assert.match(root.scripts[command],/--workspace=@taptime\/operator-web/);
  const ci=parse(readFileSync('.github/workflows/ci.yml','utf8'));assert.ok(ci.jobs.quality.steps.some(step=>step.run?.includes('npm run build --workspace=@taptime/operator-web')));
  const dockerfile=readFileSync('infrastructure/operator-web/Dockerfile','utf8');
  for(const expected of ['VITE_TAPTIME_SUPABASE_URL is required.','VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY is required.','--workspace=@taptime/operator-web','/releases/$TAPTIME_VERSION/','/app/apps/operator-web/dist /operator-web'])assert.ok(dockerfile.includes(expected));
});
