const fs=require('fs');
const s=fs.readFileSync('front-react/src/components/CommandeFournisseur.tsx','utf8');
let stack=[];
let inSingle=false,inDouble=false,inBack=false,inLineComment=false,inBlockComment=false,braceDepth=0;
for(let i=0;i<s.length;i++){
  const ch=s[i];
  const next=s[i+1]||'';
  // handle comments
  if(inLineComment){ if(ch==='\n') inLineComment=false; continue; }
  if(inBlockComment){ if(ch==='*' && next==='/'){ inBlockComment=false; i++; } continue; }
  if(!inSingle && !inDouble && !inBack && ch==='/' && next==='/') { inLineComment=true; i++; continue; }
  if(!inSingle && !inDouble && !inBack && ch==='/' && next==='*') { inBlockComment=true; i++; continue; }
  if(!inSingle && !inBack && ch==='"' && !inDouble) { inDouble=true; continue; }
  else if(inDouble && ch==='"' && s[i-1] !== '\\') { inDouble=false; continue; }
  if(!inDouble && !inBack && ch==="'" && !inSingle) { inSingle=true; continue; }
  else if(inSingle && ch==="'" && s[i-1] !== '\\') { inSingle=false; continue; }
  if(!inSingle && !inDouble && ch==='`') { inBack=!inBack; continue; }
  if(inSingle || inDouble || inBack) continue;
  if(ch==='{') { braceDepth++; continue; }
  if(ch==='}') { if(braceDepth>0) braceDepth--; continue; }
  // treat '<' as start of JSX tag only when it's not part of a TS generic or type parameter
  const prev = s[i-1] || '';
  if(ch==='<' && s.slice(i, i+4) !== '<!--' && (/[A-Za-z\/]/).test(next) && !(/[A-Za-z0-9.)\]>]/).test(prev)){
    // parse tag
    let j=i+1;
    let closing=false;
    if(s[j]==='/'){ closing=true; j++; }
    // skip whitespace
    while(/\s/.test(s[j])) j++;
    // read tag name
    let name='';
    while(j<s.length && /[A-Za-z0-9-]/.test(s[j])){ name+=s[j]; j++; }
    if(!name) continue;
    // find end of tag '>' considering attributes and strings
    let k=j; let inS=false,inD=false,inB=false, escaped=false;
    for(;k<s.length;k++){
      const c=s[k];
      if(inS){ if(!escaped && c==="'") inS=false; else if(c==='\\') escaped=!escaped; else escaped=false; continue; }
      if(inD){ if(!escaped && c==='"') inD=false; else if(c==='\\') escaped=!escaped; else escaped=false; continue; }
      if(inB){ if(c==='`') inB=false; continue; }
      if(c==="'") { inS=true; continue; }
      if(c==='"') { inD=true; continue; }
      if(c==='`') { inB=true; continue; }
      if(c==='>' ) break;
    }
    const tagText = s.slice(i, k+1);
    const selfClose = /\/>\s*$/.test(tagText);
    const line = s.slice(0,i).split('\n').length;
    if(closing){
      if(stack.length===0){ console.log('Unmatched closing', name, 'at line', line); }
      else{
        const top=stack.pop();
        if(top.name!==name){ console.log('Mismatched closing tag', name, 'at line', line, 'expected', top.name, 'opened at', top.line); }
      }
    } else if(!selfClose){
      stack.push({name, line});
    }
    i=k; // advance
  }
}
if(stack.length) console.log('Remaining unclosed tags (top last):', stack.slice(-10)); else console.log('No remaining unclosed tags');
