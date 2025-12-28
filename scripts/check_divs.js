const fs=require('fs');
const s=fs.readFileSync('front-react/src/components/CommandeFournisseur.tsx','utf8');
const lines=s.split('\n');
let stack=[];
lines.forEach((ln,i)=>{
  const regex=/<\/?([A-Za-z0-9-]+)/g;
  let m;
  while((m=regex.exec(ln))){
    const whole=m[0];
    const tag=m[1];
    const isClose=whole.startsWith('</');
    const selfClose=ln.slice(m.index).includes('/>');
    if(tag.toLowerCase()==='div'){
      if(!isClose && !selfClose){
        stack.push({tag,line:i+1, col: m.index+1});
      } else if(isClose){
        if(stack.length===0) console.log('Extra closing div at',i+1);
        else stack.pop();
      }
    }
  }
});
console.log('Unclosed divs (top is last):', stack);
