const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const qs = require('querystring');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get('/', (req, res) => {
  res.send('CYBTV Parser is online 🚀');
});

app.get('/api/parse', async (req, res) => {
  const { id } = req.query;
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  const url = `https://join-digitalworld.com/nf/access/web${id}`;
  try {
    // ⛏️ Step 1: Scrape email/password dari digitalworld
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const $ = cheerio.load(response.data);
    const email = $('[data-email]').attr('data-email')?.trim();
    const password = $('label:contains("Password")').next('span').text()?.trim();
    const days = $('span')
      .filter((i, el) => $(el).text().includes('Validity Left'))
      .text()
      ?.trim();

    if (!email || !password || !days) {
      return res.status(404).json({ error: 'Data tidak dijumpai' });
    }

    // 🔐 Step 2: Login ke Netflix untuk dapatkan cookie
    const payload = qs.stringify({
      userLoginId: email,
      password: password,
      rememberMe: true,
      flow: 'websiteSignUp',
      mode: 'login',
      action: 'loginAction'
    });

    const loginRes = await axios.post('https://www.netflix.com/login', payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.netflix.com/login'
      },
      maxRedirects: 0,
      validateStatus: () => true
    });

    const cookieRaw = loginRes.headers['set-cookie'] || [];
    const cookieString = cookieRaw
      .filter(c => c.includes('NetflixId') || c.includes('SecureNetflixId') || c.includes('flwssn'))
      .map(c => c.split(';')[0])
      .join('; ');

    // 🤖 Step 3: Validate cookie melalui external checker
    let cookieStatus = 'unknown';
    let cookieMessage = '❔ Cookie belum disemak';

    if (cookieString) {
      try {
        const checkRes = await axios.post('https://netflix-cookie-checker.onrender.com/check-cookie', {
          cookie: cookieString
        }, {
          headers: { 'Content-Type': 'application/json' }
        });

        cookieStatus = checkRes.data.status;
        cookieMessage = checkRes.data.message;
      } catch (err) {
        console.error('Gagal validate cookie:', err.message);
        cookieMessage = '⚠️ Gagal semak cookie';
      }
    }

    // 🔄 Step 4: Return semua data ke frontend
    return res.json({
      email,
      password,
      days,
      cookieStatus,
      cookieMessage
    });

  } catch (err) {
    console.error('Fetch error:', err.message);
    return res.status(500).json({ error: 'Gagal ambil data atau login Netflix' });
  }
});

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});