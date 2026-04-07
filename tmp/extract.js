const fs = require('fs');
const content = fs.readFileSync('princetv.js', 'utf8');
const supabaseUrl = content.match(/https:\/\/[a-z0-9]+\.supabase\.co/i);
const supabaseKey = content.match(/[a-zA-Z0-9]{100,}/i); // Supabase anon keys are long
console.log('Supabase URL:', supabaseUrl ? supabaseUrl[0] : 'Not found');
console.log('Supabase Key:', supabaseKey ? supabaseKey[0] : 'Not found');
