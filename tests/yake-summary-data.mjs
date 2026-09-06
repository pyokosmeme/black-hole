import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../js/yake-data.js',import.meta.url),'utf8'),context);
const data=context.window.YAKE_ATLAS;
const world=id=>data.worlds.find(w=>w.id===id);
const outerCounts={gullinkambi:108400,chanticleer:105200,five:112000,kukkuta:20000};
for(const [id,count] of Object.entries(outerCounts)) {
  const population=world(id).stats.find(([label])=>label==='Population')[1];
  assert.match(population,/thousand$/);
  assert.equal(parseFloat(population)*1000,count);
  assert.equal(data.summaryStats(world(id)).find(([label])=>label==='Population')[1],`${Math.round(count/500)/2} thousand`);
}
// Unit correction does not silently allocate the missing 90,000 people.
assert.equal(Object.values(outerCounts).reduce((sum,n)=>sum+n,0),345600);
assert.equal(435600-Object.values(outerCounts).reduce((sum,n)=>sum+n,0),90000);
assert.equal(world('xuan').stats.find(([label])=>label==='Population')[1],'0.7744 million');
assert.equal(world('marassa').stats[0][1],'~60,000 (both rings)');
for(const id of ['marassa','chawkee']) {
  assert.ok(data.summaryStats(world(id)).some(([label,value])=>label==='Weekly visitor population (est.)'&&value==='~10 thousand (station-wide)'));
  assert.ok(!world(id).stats.some(([label])=>/post-mote/i.test(label)));
}
const value=(label,text)=>data.summaryStats({stats:[[label,text]]})[0][1];
for(const [input,expected] of [['0.7744 million','774.5 thousand'],['~780,150','~780 thousand'],['~0.576 million','~576 thousand'],['~0.5 million','~500 thousand'],['~3,200','~3 thousand'],['~55,000','~55 thousand'],['1 million','1 million'],['0.39M','390 thousand'],['1.82182 million','1.82182 million']]) assert.equal(value('Population',input),expected);
assert.equal(value('Permanent residents','~3,200'),'~3 thousand');
assert.equal(value('Food production','~100,000 people/day'),'~100,000 people/day');
assert.equal(value('Orbit around Jin','1,052,112 km'),'1,052,112 km');
assert.equal(data.views.jin.ez,1560000);
assert.ok(data.worlds.find(w=>w.id==='vas').km<data.views.jin.ez);
const displayRadius=id=>[...data.views.jin.nodes,...data.views.jin.locals].find(n=>n[0]===id)[1];
assert.ok(displayRadius('plomo')>displayRadius('vas'));
for(const id of ['suseong','peng']) assert.ok(displayRadius(id)>displayRadius('skarda'));
for(const id of ['plomo','suseong','peng']) assert.equal(data.worlds.find(w=>w.id===id).km,undefined);
assert.equal(data.worlds.find(w=>w.id==='plomo').stats[0][1],'1.82182 million');
const before=JSON.stringify(data.worlds);
data.worlds.forEach(w=>assert.ok(data.summaryStats(w).length<=4));
assert.equal(JSON.stringify(data.worlds),before);
console.log('PASS summary population formatting, unchanged physical values/source counts, four-stat limit, Vas inside Jin EZ');
