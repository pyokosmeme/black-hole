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
const lines=['# Ya Ke atlas — current info-card inventory','',`${cards.length} reachable cards. Text is unpruned. The first four stats appear on the main card; remaining stats, paragraphs, places, and notes are under World Details. Intro text is currently hidden at phone widths (600px and below).`,''];
for(const w of cards) {
  lines.push(`## ${w.name}`,'',w.kind,'',w.intro,'');
  if(w.mapLabel) lines.push(`Map label: ${w.mapLabel}`,'');
  if(w.stats?.length) {
    lines.push('### Main-card stats','');
    w.stats.slice(0,4).forEach(([k,v])=>lines.push(`- ${k}: ${v}`));
    lines.push('');
  }
  if(w.stats?.length>4 || w.paragraphs?.length || w.places?.length || w.notes?.length) {
    lines.push('### World Details','');
    if(w.stats?.length>4) {w.stats.slice(4).forEach(([k,v])=>lines.push(`- ${k}: ${v}`));lines.push('');}
    (w.paragraphs||[]).forEach(p=>lines.push(p,''));
    if(w.places?.length) {lines.push('Places & infrastructure:','');w.places.forEach(([k,v])=>lines.push(`- ${k}: ${v}`));lines.push('');}
    (w.notes||[]).forEach(p=>lines.push(p,''));
  }
}
console.log(lines.join('\n'));
