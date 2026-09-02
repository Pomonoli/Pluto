const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

test('auth wacht met login-UI tot de sessiecheck klaar is',()=>{
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'public/styles.css'),'utf8');
  assert.match(html,/<body class="auth-pending" aria-busy="true">/);
  assert.match(css,/\.auth-pending #homeGuestBar[^}]*visibility:hidden/);
  assert.match(app,/finally \{ document\.body\.classList\.remove\('auth-pending'\)/);
  assert.doesNotMatch(app,/\n  showHome\(\);\s*$/);
});

test('profiel kan de echte accountnaam via het beveiligde endpoint wijzigen',()=>{
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  const http=fs.readFileSync(path.join(root,'src/server/http.js'),'utf8');
  assert.match(html,/class="profile-edit-name hidden" id="showRenameButton"[^>]*aria-label="Naam wijzigen"/);
  assert.match(app,/fetch\('\/api\/account\/username',\{method:'PUT'/);
  assert.match(http,/app\.put\('\/api\/account\/username'/);
});
