const fs=require('fs');
const s=fs.readFileSync('front-react/src/components/CommandeFournisseur.tsx','utf8');
const lines=s.split('\n');
let cum=0;
for(let i=0;i<lines.length;i++){
  const ln=lines[i];
  for(const ch of ln){ if(ch==='(') cum++; if(ch===')') cum--; }
  if(i>560 && i<760) console.log(i+1, 'cum=',cum, ln.trim());
}
console.log('Final cum parens=', cum);
