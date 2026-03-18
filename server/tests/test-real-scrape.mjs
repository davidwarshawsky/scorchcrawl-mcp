import fetch from 'node-fetch';

async function testScrape() {
  const url = 'http://localhost:24787/mcp';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json, text/event-stream',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'scorch_scrape',
        arguments: {
          url: 'https://pocs.click',
          formats: ['markdown']
        }
      }
    })
  });

  const text = await res.text();
  console.log('--- RESPONSE ---');
  console.log(text);
  console.log('----------------');
}

testScrape();
