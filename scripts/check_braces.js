const fs=require('fs');
const s=fs.readFileSync('front-react/src/components/CommandeFournisseur.tsx','utf8');
const lines=s.split('\n');
let cum=0;
for(let i=0;i<lines.length;i++){
  const ln=lines[i];
  // naive count
  for(const ch of ln){ if(ch==='{') cum++; if(ch==='}') cum--; }
  if(cum<0){ console.log('Negative at',i+1); break; }
  if(i>560 && i<640) console.log(i+1, ln, 'cum=',cum);
}
console.log('Final cum=', cum);
