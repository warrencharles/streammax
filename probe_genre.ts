import axios from 'axios';
import * as cheerio from 'cheerio';

const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };

const urls = [
    'https://hdtodayz.to/genre/action',
    'https://hdtodayz.to/filter?genre=action&sort=released_at',
    'https://hdtodayz.to/filter?genre=action&type=movie&sort=released_at',
];

for (const url of urls) {
    try {
        const res = await axios.get(url, { headers, timeout: 10000 });
        const $ = cheerio.load(res.data);
        const items: string[] = [];
        $('.flw-item').each((_i: number, el: any) => {
            const title = $(el).find('.film-name').text().trim();
            if (title) items.push(title);
        });
        console.log(`\n[${url}]`);
        console.log(`  Count: ${items.length}`);
        console.log(`  Sample: ${items.slice(0, 5).join(', ')}`);

        // Check pagination links
        const pages: string[] = [];
        $('a[href*="?page="], a[href*="page/"]').each((_i: number, el: any) => {
            const href = $(el).attr('href');
            if (href && !pages.includes(href)) pages.push(href);
        });
        if (pages.length) console.log(`  Pages: ${pages.slice(0, 4).join(', ')}`);
    } catch (e: any) {
        console.log(`[${url}] FAIL: ${e.response?.status || e.message}`);
    }
}
