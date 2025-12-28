const fs=require('fs');
const s=fs.readFileSync('front-react/src/components/CommandeFournisseur.tsx','utf8');
const lines=s.split('\n');
const stack=[];
const regex=/<\s*(\/)?\s*([A-Za-z][A-Za-z0-9-]*)[^>]*?(\/?)\s*>/g;
let lineNo=0;
for (let i=0;i<lines.length;i++){
  const ln=lines[i];
  let m;
  while((m=regex.exec(ln))){
    const isClose=!!m[1];
    const tag=m[2];
    const selfClose=!!m[3] || /\/\s*>$/.test(ln.slice(m.index));
    // ignore fragments <> or closing fragments </>
    if(tag === undefined) continue;
    if(!isClose && !selfClose){
      stack.push({tag,line:i+1,col:m.index+1});
    } else if(isClose){
      // pop until matching tag found
      let found=false;
      while(stack.length>0){
        const top=stack.pop();
        if(top.tag === tag){ found=true; break; }
      }
      if(!found){
        console.log('Unmatched closing tag', tag, 'at line', i+1);
      }
    }
  }
}
if(stack.length>0){
  console.log('Remaining unclosed tags (top last):');
  console.log(stack.slice(-10));
} else {
  console.log('No unmatched tags found');
}
