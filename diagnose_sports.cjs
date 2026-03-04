const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const leagues = ['PL', 'CL', 'BL1', 'SA', 'PD', 'FL1'];

async function deepSearch() {
    const results = {};
    for (const l of leagues) {
        try {
            console.log(`Scraping ${l}...`);
            const res = await axios.get(`https://native-stats.org/competition/${l}/`, {
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });

            const buf = Buffer.from(res.data);
            const html = (buf[0] === 0xff && buf[1] === 0xfe) || (buf.length > 10 && buf.slice(0, 100).filter(b => b === 0).length > 20) ? buf.toString('utf16le') : buf.toString('utf8');

            const $ = cheerio.load(html);
            results[l] = { tables: [] };

            $('table').each((i, table) => {
                const ths = $(table).find('th').map((j, th) => $(th).text().trim()).get();
                const trs = $(table).find('tbody tr');
                const rows = [];

                trs.slice(0, 2).each((j, tr) => {
                    const tds = $(tr).find('td').map((k, td) => $(td).text().trim()).get();
                    rows.push(tds);
                });

                results[l].tables.push({
                    index: i,
                    headers: ths,
                    sampleRows: rows
                });
            });
        } catch (e) {
            results[l] = { error: e.message };
        }
    }
    fs.writeFileSync('diag_results.json', JSON.stringify(results, null, 2));
    console.log('Results saved to diag_results.json');
}

deepSearch();
