const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

test('Pluto branding staat in HTML en manifest',()=>{
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/manifest.webmanifest'),'utf8'));
  assert.match(html,/<strong>Pluto<\/strong>/);
  assert.match(html,/gaming space/);
  assert.equal(manifest.name,'Pluto');
  assert.equal(manifest.short_name,'Pluto');
});

test('mobile nav bevat exact de vier gevraagde hoofdbestemmingen',()=>{
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  for(const label of ['Play','Lobby','Leaderboard','Profile']) assert.match(html,new RegExp(`>${label}<`));
  assert.match(html,/id="mobileNav"/);
});

test('sound button is icon-only en app knop heet App',()=>{
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  assert.match(html,/id="soundButton"[^>]*><\/button>/);
  assert.match(html,/id="installButton"[^>]*>App<\/button>/);
  assert.match(app,/Geluid uitzetten/);
  assert.match(app,/Geluid aanzetten/);
});
