import axios from 'axios';
import * as cheerio from 'cheerio';

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function listGenres() {
    try {
        const res = await axios.get('https://hdtodayz.to/', { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(res.data);
        const genres: any[] = [];
        $('.nav-item.dropdown .dropdown-item').each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.includes('/genre/')) {
                genres.push({
                    name: $(el).text().trim(),
                    slug: href.split('/').pop()
                });
            }
        });
        console.log(JSON.stringify(genres, null, 2));
    } catch (err: any) {
        console.error(err.message);
    }
}

listGenres();
