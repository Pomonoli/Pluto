const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const version=require(path.join(root,'package.json')).version;

test('frontend versioneert ook ES module imports',()=>{
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  assert.ok(app.includes(`rules.js?v=${version}`));
  assert.ok(app.includes(`game-ui.js?v=${version}`));
  assert.ok(app.includes(`map-editor.js?v=${version}`));
});

test('service worker forceert updates buiten browsercache',()=>{
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  const sw=fs.readFileSync(path.join(root,'public/service-worker.js'),'utf8');
  assert.match(app,/updateViaCache:'none'/);
  assert.match(app,/registration\.update\(\)/);
  assert.match(sw,/cache:'no-store'/);
  assert.match(sw,/skipWaiting/);
  assert.match(sw,/clients\.claim/);
});

test('server serveert frontend-code en service worker met no-store',()=>{
  const http=fs.readFileSync(path.join(root,'src/server/http.js'),'utf8');
  assert.match(http,/service-worker\\\.js/);
  assert.match(http,/no-store, no-cache, must-revalidate, proxy-revalidate/);
});
