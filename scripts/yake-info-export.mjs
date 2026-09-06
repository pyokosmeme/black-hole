// Export exactly the reachable card content; reference-only records stay out.
import fs from 'node:fs';
import vm from 'node:vm';
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../js/yake-data.js',import.meta.url),'utf8'), context);
const data=context.window.YAKE_ATLAS;
const ids=new Set();
for(const name of ['system','jin','shu','xuan']) {
  const view=data.views[name];
  [view.parent,...view.nodes.map(n=>n[0]),...(view.locals||[]).map(n=>n[0]),...(view.ezLocals||[]).map(n=>n.id)].forEach(id=>ids.add(id));
}
if(ids.has('marassa')) ['buka','chawkee'].forEach(id=>ids.add(id));
const cards=data.worlds.filter(w=>ids.has(w.id)&&!w.hidden);
const lines=['# Ya Ke atlas — current info-card inventory','',`${cards.length} reachable summary cards. Only name, type, introduction, and up to four stats are displayed. World Details is removed. Small populations are shown in thousands, rounded to the nearest 500. Map actions are outside the cards.`,''];
for(const w of cards) {
  lines.push(`## ${w.name}`,'',w.kind,'',w.intro,'');
  if(w.mapLabel) lines.push(`Map label: ${w.mapLabel}`,'');
  if(w.stats?.length) {
    lines.push('### Main-card stats','');
    data.summaryStats(w).forEach(([k,v])=>lines.push(`- ${k}: ${v}`));
    lines.push('');
  }
}
console.log(lines.join('\n'));
