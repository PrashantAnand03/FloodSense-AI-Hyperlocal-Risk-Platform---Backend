import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

async function test() {
  try {
    // 1. Login
    const loginRes = await axios.post(API_BASE + '/auth/login', {
      email: 'testuser@floodsense.com',
      password: 'Test@1234'
    });
    const token = loginRes.data.session.access_token;
    console.log('Login successful');

    // 2. Try fetching history
    try {
      const histRes = await axios.get(API_BASE + '/history', {
        headers: { Authorization: 'Bearer ' + token }
      });
      console.log('History fetched:', histRes.data);
    } catch(err) {
      console.error('History GET error:', err.response?.status, err.response?.data);
    }

    // 3. Try saving a location
    try {
      const locRes = await axios.post(API_BASE + '/locations', {
        name: 'London', lat: 51.5, lon: -0.1
      }, {
        headers: { Authorization: 'Bearer ' + token }
      });
      console.log('Location saved:', locRes.data);
    } catch(err) {
      console.error('Location POST error:', err.response?.status, err.response?.data);
    }
  } catch(e) {
    console.error('Login failed:', e.message);
  }
}
test();
