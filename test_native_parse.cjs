const fs = require('fs');
const cheerio = require('cheerio');

function testParse() {
    // Read as Buffer first to detect/handle encoding
    const buf = fs.readFileSync('native_pl.html');
    const html = buf.toString('utf16le'); // FF FE is UTF-16LE

    console.log('HTML Length (decoded):', html.length);

    const $ = cheerio.load(html);

    const tables = $('table');
    console.log('Total tables found:', tables.length);

    tables.each((i, table) => {
        const ths = $(table).find('th').map((j, th) => $(th).text().trim()).get();
        console.log(`Table ${i} Headers:`, ths.join(' | '));

        // Standings Check
        if (ths.some(h => h === 'Pos' || h === 'Team')) {
            console.log(`Found Standings Table (${i})`);
            const standings = [];
            $(table).find('tr').each((j, tr) => {
                const tds = $(tr).find('td');
                if (tds.length >= 3) {
                    standings.push({
                        rank: $(tds[0]).text().trim(),
                        team: $(tds[1]).text().trim().replace(/\s+/g, ' '),
                        played: $(tds[2]).text().trim(),
                        points: $(tds[3]).text().trim() || $(tds[tds.length - 1]).text().trim()
                    });
                }
            });
            console.log('Sample Standings:', JSON.stringify(standings.slice(0, 3), null, 2));
        }

        // Matches Check
        if (ths.some(h => h === 'Date' || h === 'Label')) {
            console.log(`Found Matches Table (${i})`);
            const matches = [];
            $(table).find('tr').each((j, tr) => {
                const tds = $(tr).find('td');
                if (tds.length >= 3) {
                    matches.push({
                        date: $(tds[0]).text().trim(),
                        label: $(tds[1]).text().trim().replace(/\s+/g, ' '),
                        score: $(tds[2]).text().trim()
                    });
                }
            });
            console.log('Sample Matches:', JSON.stringify(matches.slice(0, 3), null, 2));
        }
    });
}

testParse();
