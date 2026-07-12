const http = require('http');

http.get('http://localhost:3000/api/documents', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('--- GET /api/documents ---');
    console.log(data);
    
    // Now search for "Test"
    http.get('http://localhost:3000/api/documents/search?q=Test&mode=fuzzy', (res2) => {
      let data2 = '';
      res2.on('data', chunk => data2 += chunk);
      res2.on('end', () => {
        console.log('\n--- GET /api/documents/search?q=Test&mode=fuzzy ---');
        console.log(data2);
      });
    });
  });
}).on('error', err => console.error(err));
