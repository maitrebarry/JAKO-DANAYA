const path = require('path');
const XLSX = require('xlsx');
const p = process.argv[2] || path.join(__dirname, '..', 'front-react', 'public', 'produits_template.xlsx');
try {
  const wb = XLSX.readFile(p);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const headers = rows && rows.length ? rows[0] : null;
  console.log('FILE:', p);
  console.log('HEADERS:', headers ? headers.join(',') : 'NO_HEADERS');
} catch (err) {
  console.error('ERROR:', err && err.message ? err.message : err);
  process.exit(2);
}
