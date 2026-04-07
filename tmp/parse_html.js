import axios from 'axios';
import * as cheerio from 'cheerio';

async function parseHtml() {
    try {
        const response = await axios.get('https://www.princetv.online/');
        const $ = cheerio.load(response.data);
        
        // Find all script tags
        $('script').each((i, el) => {
            const content = $(el).html() || "";
            if (content.includes('{') && content.includes(':')) {
                // Potential data
                console.log(`Script ${i} sample:`, content.substring(0, 200).replace(/\s+/g, ' '));
                if (content.includes('628b250c-29df-42f2-9cb9-df637f1557db')) {
                    console.log(`Found the magic UUID in script ${i}!`);
                    console.log('Full content sample around UUID:', content.substring(content.indexOf('628b250c-29df-42f2-9cb9-df637f1557db') - 100, 200));
                }
            }
        });
        
    } catch (err) {
        console.error(err.message);
    }
}

parseHtml();
