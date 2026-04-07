import axios from 'axios';
import fs from 'fs';

async function extract() {
  try {
    const response = await axios.get('https://www.princetv.online/assets/index-B6WlnDNv.js');
    const content = response.data;
    
    // Look for Supabase URL
    const urlMatch = content.match(/https:\/\/[a-z0-9-]+\.supabase\.co/i);
    // Look for JWT-style Anon Key
    const keyMatch = content.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);
    
    console.log('Supabase URL:', urlMatch ? urlMatch[0] : 'Not found');
    console.log('Supabase Key:', keyMatch ? keyMatch[0] : 'Not found');
    
    // Look for table names common in Lovable apps
    const tables = content.match(/"(channels|matches|sports|streams|games|live_matches|live_channels)"/g);
    console.log('Potential tables:', [...new Set(tables)]);
  } catch (err) {
    console.error(err.message);
  }
}

extract();
