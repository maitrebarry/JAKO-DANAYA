/*
 Simple generator: CSV -> XLSX (exports first sheet only)
 Usage:
   node tools/generate_produits_template.js input.csv output.xlsx

 This script is intentionally dependency-light: it uses the `xlsx` package.
 Install: npm i xlsx
*/
const fs = require('fs');
const XLSX = require('xlsx');

const inPath = process.argv[2];
const outPath = process.argv[3];
if (!inPath || !outPath) {
  console.error('Usage: node tools/generate_produits_template.js input.csv output.xlsx');
  process.exit(2);
}

const csv = fs.readFileSync(inPath, 'utf8');

// lightweight CSV -> 2D array parser that handles quoted fields ("...")
function parseCSV(str) {
  return str.split(/\r?\n/).filter(l => l.length > 0).map(line => {
    // split on commas that are not inside quotes
    const parts = line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
    return parts.map(cell => {
      let v = cell.trim();
      if (v.startsWith('"') && v.endsWith('"')) {
        v = v.slice(1, -1).replace(/""/g, '"');
      }
      return v;
    });
  });
}

const aoa = parseCSV(csv);
const ws = XLSX.utils.aoa_to_sheet(aoa);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'produits');
XLSX.writeFile(wb, outPath);
console.log('Wrote', outPath);
