const fs=require('fs');
const s=fs.readFileSync('/home/maitre/SMBOUTIQUE_V2/front-react/src/components/InventaireDetail.tsx','utf8');
const regex=/<\/?([A-Za-z0-9-]+)(\b[^>]*)?>/g;
let match;
const stack=[];
while((match=regex.exec(s))!==null){ const whole=match[0]; const tag=match[1]; const isClose=whole.startsWith('</'); const selfClose=whole.endsWith('/>'); if(tag.toLowerCase()==='div'){ if(!isClose && !selfClose){ stack.push({tag,line: s.slice(0,match.index).split(/\n/).length, col: match.index}); } else if(isClose){ if(stack.length===0) console.log('Extra closing div at line', s.slice(0,match.index).split(/\n/).length); else stack.pop(); } } }
console.log('Unclosed divs (top is last):', stack);