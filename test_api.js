const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });
    req.on('error', (err) => reject(err));
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING API VERIFICATION ---');
  try {
    // 1. Get initial musicals
    console.log('1. GET /api/musicals');
    const getRes = await request('GET', '/api/musicals');
    if (getRes.statusCode !== 200 || !Array.isArray(getRes.body)) {
      throw new Error(`Failed GET /api/musicals. Code: ${getRes.statusCode}`);
    }
    console.log(`Success: Found ${getRes.body.length} musicals.`);

    // 2. POST a new musical
    console.log('\n2. POST /api/musicals');
    const newMusicalData = {
      title: 'Rebecca Test',
      genre: 'Gothic Thriller',
      description: 'A dark thriller romance test musical.'
    };
    const postRes = await request('POST', '/api/musicals', newMusicalData);
    if (postRes.statusCode !== 201 || !postRes.body.id) {
      throw new Error(`Failed POST /api/musicals. Code: ${postRes.statusCode}, Body: ${JSON.stringify(postRes.body)}`);
    }
    const musicalId = postRes.body.id;
    console.log(`Success: Created musical ${musicalId}`);

    // 3. GET the newly created musical
    console.log(`\n3. GET /api/musicals/${musicalId}`);
    const getSingleRes = await request('GET', `/api/musicals/${musicalId}`);
    if (getSingleRes.statusCode !== 200 || getSingleRes.body.title !== 'Rebecca Test') {
      throw new Error(`Failed GET single musical. Code: ${getSingleRes.statusCode}, Body: ${JSON.stringify(getSingleRes.body)}`);
    }
    console.log(`Success: Title matches: ${getSingleRes.body.title}`);

    // 4. PUT to update the musical
    console.log(`\n4. PUT /api/musicals/${musicalId}`);
    const updateData = {
      title: 'Rebecca Test Updated',
      genre: 'Gothic Thriller / Romance',
      description: 'An updated description for the test.'
    };
    const putRes = await request('PUT', `/api/musicals/${musicalId}`, updateData);
    if (putRes.statusCode !== 200 || putRes.body.title !== 'Rebecca Test Updated') {
      throw new Error(`Failed PUT /api/musicals. Code: ${putRes.statusCode}, Body: ${JSON.stringify(putRes.body)}`);
    }
    console.log(`Success: Title updated to: ${putRes.body.title}`);

    // 5. POST a review for the musical
    console.log(`\n5. POST /api/reviews`);
    const reviewData = {
      musicalId: musicalId,
      nickname: '테스터123',
      rating: 4.5,
      title: '정말 좋네요',
      content: '추천합니다.'
    };
    const postReviewRes = await request('POST', '/api/reviews', reviewData);
    if (postReviewRes.statusCode !== 201 || !postReviewRes.body.id) {
      throw new Error(`Failed POST /api/reviews. Code: ${postReviewRes.statusCode}, Body: ${JSON.stringify(postReviewRes.body)}`);
    }
    const reviewId = postReviewRes.body.id;
    console.log(`Success: Created review ${reviewId}`);

    // 6. GET reviews for the musical
    console.log(`\n6. GET /api/musicals/${musicalId}/reviews`);
    const getReviewsRes = await request('GET', `/api/musicals/${musicalId}/reviews`);
    if (getReviewsRes.statusCode !== 200 || getReviewsRes.body.length !== 1) {
      throw new Error(`Failed GET reviews. Code: ${getReviewsRes.statusCode}`);
    }
    console.log(`Success: Found ${getReviewsRes.body.length} reviews.`);

    // 7. PUT/Update review
    console.log(`\n7. PUT /api/reviews/${reviewId}`);
    const updateReviewData = {
      nickname: '테스터555',
      rating: 5.0,
      title: '최고입니다',
      content: '강추합니다.'
    };
    const putReviewRes = await request('PUT', `/api/reviews/${reviewId}`, updateReviewData);
    if (putReviewRes.statusCode !== 200 || putReviewRes.body.rating !== 5) {
      throw new Error(`Failed PUT /api/reviews. Code: ${putReviewRes.statusCode}, Body: ${JSON.stringify(putReviewRes.body)}`);
    }
    console.log(`Success: Review rating updated to ${putReviewRes.body.rating}`);

    // 8. GET stats on musical (verify review count and average rating)
    console.log(`\n8. GET /api/musicals/${musicalId} stats check`);
    const statsRes = await request('GET', `/api/musicals/${musicalId}`);
    if (statsRes.body.averageRating !== 5.0 || statsRes.body.reviewCount !== 1) {
      throw new Error(`Stats check failed. Average: ${statsRes.body.averageRating}, Count: ${statsRes.body.reviewCount}`);
    }
    console.log(`Success: averageRating is 5.0, reviewCount is 1`);

    // 9. DELETE review
    console.log(`\n9. DELETE /api/reviews/${reviewId}`);
    const deleteReviewRes = await request('DELETE', `/api/reviews/${reviewId}`);
    if (deleteReviewRes.statusCode !== 200) {
      throw new Error(`Failed DELETE /api/reviews. Code: ${deleteReviewRes.statusCode}`);
    }
    console.log(`Success: Review deleted.`);

    // 10. Stats check after review deletion
    console.log(`\n10. GET /api/musicals/${musicalId} stats check after delete`);
    const statsAfterDeleteRes = await request('GET', `/api/musicals/${musicalId}`);
    if (statsAfterDeleteRes.body.averageRating !== null || statsAfterDeleteRes.body.reviewCount !== 0) {
      throw new Error(`Stats check after delete failed. Average: ${statsAfterDeleteRes.body.averageRating}, Count: ${statsAfterDeleteRes.body.reviewCount}`);
    }
    console.log(`Success: averageRating is null (평점 없음), reviewCount is 0`);

    // 11. DELETE musical (cascade reviews check)
    console.log(`\n11. DELETE /api/musicals/${musicalId}`);
    const deleteMusicalRes = await request('DELETE', `/api/musicals/${musicalId}`);
    if (deleteMusicalRes.statusCode !== 200) {
      throw new Error(`Failed DELETE /api/musicals. Code: ${deleteMusicalRes.statusCode}`);
    }
    console.log(`Success: Musical deleted.`);

    // 12. GET deleted musical (verify 404)
    console.log(`\n12. GET /api/musicals/${musicalId} check 404`);
    const getDeletedRes = await request('GET', `/api/musicals/${musicalId}`);
    if (getDeletedRes.statusCode !== 404) {
      throw new Error(`Musical deletion check failed. Expected 404, got ${getDeletedRes.statusCode}`);
    }
    console.log(`Success: Deleted musical returns 404.`);

    console.log('\n--- ALL API TESTS PASSED SUCCESSFULLY! ---');
  } catch (err) {
    console.error('\n--- API TEST FAILED ---');
    console.error(err);
    process.exit(1);
  }
}

runTests();
