// Global SPA State
let currentReviewSort = 'latest';
let editingReviewId = null;

// Toast Notification Manager
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const text = document.createElement('span');
  text.textContent = message; // Safe text rendering
  toast.appendChild(text);

  container.appendChild(toast);

  // Auto remove toast
  setTimeout(() => {
    toast.classList.add('fadeOut');
    toast.addEventListener('transitionend', () => {
      toast.remove();
    });
  }, 3000);
}

// Date Formatter Helper (YYYY-MM-DD HH:MM)
function formatDate(isoString) {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '-';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hr = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hr}:${min}`;
}

// HTML Star Builder for static displays
function renderStars(rating) {
  const wrapper = document.createElement('span');
  wrapper.className = 'review-card-stars';
  
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 !== 0;

  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('span');
    if (i <= fullStars) {
      star.className = 'star-icon-gold';
      star.textContent = '★';
    } else if (i === fullStars + 1 && hasHalf) {
      star.className = 'star-icon-gold';
      star.textContent = '⯪'; // Unicode half-star
    } else {
      star.className = 'star-icon-muted';
      star.style.color = '#333333';
      star.textContent = '★';
    }
    wrapper.appendChild(star);
  }
  return wrapper;
}

// Interactive Star Component Builder for forms
function buildInteractiveStarsComponent(initialValue, onChange) {
  const container = document.createElement('div');
  container.className = 'interactive-stars';
  let value = initialValue;

  function render(rating) {
    container.innerHTML = '';
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 !== 0;

    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      star.dataset.index = i;
      star.className = 'star-interactive-item';
      if (i <= fullStars) {
        star.className += ' star-gold';
        star.textContent = '★';
      } else if (i === fullStars + 1 && hasHalf) {
        star.className += ' star-gold';
        star.textContent = '⯪';
      } else {
        star.className += ' star-muted';
        star.textContent = '★';
      }
      container.appendChild(star);
    }
  }

  function getRatingFromEvent(e) {
    const star = e.target.closest('.star-interactive-item');
    if (!star) return null;

    const index = parseInt(star.dataset.index);
    const rect = star.getBoundingClientRect();
    const isHalf = (e.clientX - rect.left) < (rect.width / 2);
    return isHalf ? index - 0.5 : index;
  }

  container.addEventListener('mousemove', (e) => {
    const hoverVal = getRatingFromEvent(e);
    if (hoverVal !== null) {
      render(hoverVal);
    }
  });

  container.addEventListener('mouseleave', () => {
    render(value);
  });
  
  container.addEventListener('click', (e) => {
    const clickedVal = getRatingFromEvent(e);
    if (clickedVal !== null) {
      value = clickedVal;
      render(value);
      onChange(value);
    }
  });

  render(value);

  container.setValue = (newVal) => {
    value = newVal;
    render(value);
  };

  return container;
}

// Router Implementation
async function router() {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  // Show loading spinner
  appEl.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>아카이브를 불러오는 중입니다...</p>
    </div>
  `;

  const hash = window.location.hash || '#/';

  if (hash === '#/') {
    currentReviewSort = 'latest';
    editingReviewId = null;
    await renderHome(appEl);
  } else if (hash === '#/create-musical') {
    await renderCreateMusical(appEl);
  } else if (hash.startsWith('#/edit-musical/')) {
    const musicalId = hash.substring('#/edit-musical/'.length).trim();
    if (musicalId) {
      await renderEditMusical(appEl, musicalId);
    } else {
      render404(appEl);
    }
  } else if (hash.startsWith('#/musical/')) {
    const musicalId = hash.substring('#/musical/'.length).trim();
    if (musicalId) {
      await renderDetail(appEl, musicalId);
    } else {
      render404(appEl);
    }
  } else {
    render404(appEl);
  }
}

// HOME VIEW
async function renderHome(appEl) {
  let musicals = [];
  let searchQuery = '';
  let sortOption = 'latest';

  async function fetchAndRenderGrid() {
    try {
      const res = await fetch(`/api/musicals?search=${encodeURIComponent(searchQuery)}&sort=${sortOption}`);
      if (!res.ok) throw new Error();
      musicals = await res.json();
      renderGrid();
    } catch (err) {
      showToast('서버 오류', 'error');
      appEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon" style="color: var(--color-error)">⚠</div>
          <h3>네트워크 오류</h3>
          <p>서버에 연결할 수 없습니다. 페이지를 새로고침 해보세요.</p>
        </div>
      `;
    }
  }

  function renderGrid() {
    const gridContainer = appEl.querySelector('#musicals-grid');
    if (!gridContainer) return;

    gridContainer.innerHTML = '';

    if (musicals.length === 0) {
      gridContainer.className = ''; // Remove grid display for center layout
      if (!searchQuery) {
        gridContainer.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1; width: 100%">
            <div class="empty-state-icon">🎭</div>
            <h3>등록된 뮤지컬이 없습니다.</h3>
            <p>첫 번째 뮤지컬을 등록해 보세요.</p>
            <a href="#/create-musical" class="btn btn-primary" style="margin-top: 1.25rem;">첫 뮤지컬 등록하기</a>
          </div>
        `;
      } else {
        gridContainer.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1; width: 100%">
            <div class="empty-state-icon">🔍</div>
            <h3>검색 결과가 없습니다.</h3>
            <p>다른 검색어를 입력하거나 필터를 변경해 보세요.</p>
          </div>
        `;
      }
      return;
    }

    gridContainer.className = 'musicals-grid';

    musicals.forEach(m => {
      const card = document.createElement('div');
      card.className = 'musical-card';
      card.addEventListener('click', () => {
        window.location.hash = `#/musical/${m.id}`;
      });

      const top = document.createElement('div');
      top.className = 'card-top';

      const genre = document.createElement('div');
      genre.className = 'card-genre';
      genre.textContent = m.genre;

      const title = document.createElement('h3');
      title.className = 'card-title';
      title.textContent = m.title;

      const desc = document.createElement('p');
      desc.className = 'card-description';
      desc.textContent = m.description;

      top.appendChild(genre);
      top.appendChild(title);
      top.appendChild(desc);
      card.appendChild(top);

      const bottom = document.createElement('div');
      bottom.className = 'card-bottom';

      const ratingDisp = document.createElement('div');
      ratingDisp.className = 'rating-display';

      if (m.averageRating !== null) {
        const starSpan = document.createElement('span');
        starSpan.className = 'star-icon-gold';
        starSpan.textContent = '★';
        
        const numSpan = document.createElement('span');
        numSpan.className = 'rating-number';
        numSpan.textContent = m.averageRating.toFixed(1);

        ratingDisp.appendChild(starSpan);
        ratingDisp.appendChild(numSpan);
      } else {
        const noRatingSpan = document.createElement('span');
        noRatingSpan.className = 'rating-number-none';
        noRatingSpan.style.color = 'var(--text-muted)';
        noRatingSpan.style.fontSize = '0.85rem';
        noRatingSpan.textContent = '평점 없음';
        ratingDisp.appendChild(noRatingSpan);
      }
      bottom.appendChild(ratingDisp);

      const badge = document.createElement('span');
      badge.className = 'review-count-badge';
      badge.textContent = `후기 ${m.reviewCount}`;
      bottom.appendChild(badge);

      card.appendChild(bottom);
      gridContainer.appendChild(card);
    });
  }

  // Build structure
  appEl.innerHTML = `
    <div class="home-hero">
      <h1>Musical Archive</h1>
      <p>엄선된 명작 뮤지컬 아카이브와 관람객들의 품격 있는 리뷰 공간</p>
    </div>
    
    <div class="controls-bar">
      <div class="search-box-wrapper">
        <input type="text" id="search-input" class="search-input" placeholder="뮤지컬 제목, 장르, 설명 검색...">
      </div>
      
      <div class="controls-right">
        <div class="sort-selector-wrapper">
          <span class="sort-label">정렬 기준</span>
          <select id="sort-select" class="sort-select">
            <option value="latest">최신 등록순</option>
            <option value="rating">별점 높은순</option>
            <option value="reviews">후기 많은순</option>
            <option value="alphabetical">가나다순</option>
          </select>
        </div>
        
        <a href="#/create-musical" class="btn btn-primary" id="btn-create-musical">뮤지컬 등록</a>
      </div>
    </div>

    <div id="musicals-grid" class="musicals-grid"></div>
  `;

  // Attach search & sort events
  const searchInput = appEl.querySelector('#search-input');
  const sortSelect = appEl.querySelector('#sort-select');

  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = searchInput.value;
      fetchAndRenderGrid();
    }, 300);
  });

  sortSelect.addEventListener('change', () => {
    sortOption = sortSelect.value;
    fetchAndRenderGrid();
  });

  // Initial Fetch
  await fetchAndRenderGrid();
}

// CREATE MUSICAL VIEW
async function renderCreateMusical(appEl) {
  appEl.innerHTML = `
    <div class="form-container">
      <div class="form-card">
        <h2 class="form-card-title">새 뮤지컬 등록</h2>
        <form id="create-musical-form">
          <div class="form-group">
            <label class="form-label" for="musical-title">뮤지컬 제목 (1~100자)</label>
            <input type="text" id="musical-title" class="form-input" placeholder="제목을 입력하세요" required>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="musical-genre">장르 (1~50자)</label>
            <input type="text" id="musical-genre" class="form-input" placeholder="장르를 입력하세요 (예: Gothic Romance, 뮤지컬 코미디)" required>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="musical-description">작품 설명 (1~5000자)</label>
            <textarea id="musical-description" class="form-input" placeholder="작품 설명을 입력하세요" required></textarea>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">뮤지컬 등록</button>
            <a href="#/" class="btn btn-secondary">취소</a>
          </div>
        </form>
      </div>
    </div>
  `;

  const form = appEl.querySelector('#create-musical-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = form.querySelector('#musical-title').value.trim();
    const genre = form.querySelector('#musical-genre').value.trim();
    const description = form.querySelector('#musical-description').value.trim();

    if (title.length < 1 || title.length > 100) {
      showToast('입력값 오류: 제목은 1~100자 이내여야 합니다.', 'error');
      return;
    }
    if (genre.length < 1 || genre.length > 50) {
      showToast('입력값 오류: 장르는 1~50자 이내여야 합니다.', 'error');
      return;
    }
    if (description.length < 1 || description.length > 5000) {
      showToast('입력값 오류: 설명은 1~5000자 이내여야 합니다.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/musicals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, genre, description })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('뮤지컬 등록 완료', 'success');
        window.location.hash = `#/musical/${data.id}`;
      } else {
        showToast(data.error || '입력값 오류', 'error');
      }
    } catch (err) {
      showToast('서버 오류', 'error');
    }
  });
}

// EDIT MUSICAL VIEW
async function renderEditMusical(appEl, musicalId) {
  let musical = null;
  try {
    const res = await fetch(`/api/musicals/${musicalId}`);
    if (res.status === 404) {
      render404(appEl);
      return;
    }
    if (!res.ok) throw new Error();
    musical = await res.json();
  } catch (err) {
    showToast('서버 오류', 'error');
    render404(appEl);
    return;
  }

  appEl.innerHTML = `
    <div class="form-container">
      <div class="form-card">
        <h2 class="form-card-title">뮤지컬 수정</h2>
        <form id="edit-musical-form">
          <div class="form-group">
            <label class="form-label" for="musical-title">뮤지컬 제목 (1~100자)</label>
            <input type="text" id="musical-title" class="form-input" placeholder="제목을 입력하세요" required>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="musical-genre">장르 (1~50자)</label>
            <input type="text" id="musical-genre" class="form-input" placeholder="장르를 입력하세요" required>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="musical-description">작품 설명 (1~5000자)</label>
            <textarea id="musical-description" class="form-input" placeholder="작품 설명을 입력하세요" required></textarea>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">수정 완료</button>
            <a href="#/musical/${musicalId}" class="btn btn-secondary">취소</a>
          </div>
        </form>
      </div>
    </div>
  `;

  const form = appEl.querySelector('#edit-musical-form');
  form.querySelector('#musical-title').value = musical.title;
  form.querySelector('#musical-genre').value = musical.genre;
  form.querySelector('#musical-description').value = musical.description;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = form.querySelector('#musical-title').value.trim();
    const genre = form.querySelector('#musical-genre').value.trim();
    const description = form.querySelector('#musical-description').value.trim();

    if (title.length < 1 || title.length > 100) {
      showToast('입력값 오류: 제목은 1~100자 이내여야 합니다.', 'error');
      return;
    }
    if (genre.length < 1 || genre.length > 50) {
      showToast('입력값 오류: 장르는 1~50자 이내여야 합니다.', 'error');
      return;
    }
    if (description.length < 1 || description.length > 5000) {
      showToast('입력값 오류: 설명은 1~5000자 이내여야 합니다.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/musicals/${musicalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, genre, description })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('뮤지컬 수정 완료', 'success');
        window.location.hash = `#/musical/${musicalId}`;
      } else {
        showToast(data.error || '입력값 오류', 'error');
      }
    } catch (err) {
      showToast('서버 오류', 'error');
    }
  });
}

// DETAIL VIEW
async function renderDetail(appEl, musicalId) {
  let musical = null;
  let reviews = [];
  let formPanel = null;

  // 1. Fetch Musical Header Detail Info
  async function fetchMusicalDetail() {
    try {
      const res = await fetch(`/api/musicals/${musicalId}`);
      if (res.status === 404) {
        render404(appEl);
        return false;
      }
      if (!res.ok) throw new Error();
      musical = await res.json();
      return true;
    } catch (err) {
      showToast('서버 오류', 'error');
      render404(appEl);
      return false;
    }
  }

  // 2. Fetch and render reviews list
  async function fetchAndRenderReviews() {
    const listWrapper = appEl.querySelector('#reviews-list-wrapper');
    if (!listWrapper) return;

    listWrapper.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <div class="spinner" style="margin: 0 auto 1rem;"></div>
        <p>후기를 불러오는 중...</p>
      </div>
    `;

    try {
      const res = await fetch(`/api/musicals/${musicalId}/reviews?sort=${currentReviewSort}`);
      if (!res.ok) throw new Error();
      reviews = await res.json();
      
      listWrapper.innerHTML = '';
      const listEl = buildReviewsListElement();
      listWrapper.appendChild(listEl);
    } catch (err) {
      listWrapper.innerHTML = `
        <div class="empty-state" style="border-color: var(--color-error)">
          <h3>후기를 불러오지 못했습니다.</h3>
          <p>네트워크 상태를 확인하고 정렬을 다시 눌러보세요.</p>
        </div>
      `;
    }
  }

  // Helper to re-fetch and render ratings in header
  async function reloadHeaderStats() {
    try {
      const res = await fetch(`/api/musicals/${musicalId}`);
      if (res.ok) {
        musical = await res.json();
        
        const ratingValEl = appEl.querySelector('#header-rating-val');
        const countValEl = appEl.querySelector('#header-count-val');
        
        if (ratingValEl) {
          ratingValEl.textContent = musical.averageRating !== null ? musical.averageRating.toFixed(1) : '평점 없음';
        }
        if (countValEl) countValEl.textContent = musical.reviewCount;
      }
    } catch (e) {
      // Ignore background refresh errors
    }
  }

  function buildReviewsListElement() {
    const section = document.createElement('div');
    section.className = 'reviews-section';

    // Header
    const header = document.createElement('div');
    header.className = 'reviews-section-header';

    const title = document.createElement('h2');
    title.className = 'reviews-section-title';
    title.textContent = `관객 후기 (${reviews.length})`;
    header.appendChild(title);

    // Review Sorting Controls
    if (reviews.length > 0) {
      const sortDiv = document.createElement('div');
      sortDiv.className = 'review-list-sort';

      const sortOptions = [
        { key: 'latest', label: '최신순' },
        { key: 'highest-rating', label: '별점 높은순' },
        { key: 'lowest-rating', label: '별점 낮은순' }
      ];

      sortOptions.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = `review-sort-btn ${currentReviewSort === opt.key ? 'active' : ''}`;
        btn.textContent = opt.label;
        btn.addEventListener('click', () => {
          currentReviewSort = opt.key;
          fetchAndRenderReviews();
        });
        sortDiv.appendChild(btn);
      });
      header.appendChild(sortDiv);
    }
    section.appendChild(header);

    // Empty state
    if (reviews.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `
        <div class="empty-state-icon">✍</div>
        <h3>아직 작성된 후기가 없습니다.</h3>
        <p>첫 번째 후기를 남겨보세요.</p>
      `;
      section.appendChild(empty);
      return section;
    }

    // Review Cards
    reviews.forEach(rev => {
      const card = document.createElement('div');
      card.className = 'review-card';

      // Meta
      const meta = document.createElement('div');
      meta.className = 'review-top-meta';

      const user = document.createElement('div');
      user.className = 'review-user-info';
      const badge = document.createElement('span');
      badge.className = 'reviewer-badge';
      badge.textContent = 'AUDIENCE';
      const name = document.createElement('span');
      name.className = 'reviewer-name';
      name.textContent = rev.nickname; // Safe Assignment

      user.appendChild(badge);
      user.appendChild(name);
      meta.appendChild(user);

      const date = document.createElement('span');
      date.className = 'review-date';
      date.textContent = formatDate(rev.createdAt);
      meta.appendChild(date);
      card.appendChild(meta);

      // Stars
      const starsRow = document.createElement('div');
      starsRow.style.display = 'flex';
      starsRow.style.alignItems = 'center';
      starsRow.style.gap = '0.5rem';
      
      const stars = renderStars(rev.rating);
      const ratingText = document.createElement('span');
      ratingText.className = 'rating-number';
      ratingText.style.fontSize = '0.85rem';
      ratingText.textContent = rev.rating.toFixed(1);

      starsRow.appendChild(stars);
      starsRow.appendChild(ratingText);
      card.appendChild(starsRow);

      // Title
      const titleEl = document.createElement('h4');
      titleEl.className = 'review-title-text';
      titleEl.textContent = rev.title; // Safe Assignment
      card.appendChild(titleEl);

      // Content
      const contentEl = document.createElement('p');
      contentEl.className = 'review-content-text';
      contentEl.textContent = rev.content; // Safe Assignment
      card.appendChild(contentEl);

      // Actions
      const actions = document.createElement('div');
      actions.className = 'review-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-secondary';
      editBtn.textContent = '수정';
      editBtn.addEventListener('click', () => {
        if (formPanel) {
          formPanel.startEdit(rev);
        }
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger';
      deleteBtn.textContent = '삭제';
      deleteBtn.addEventListener('click', async () => {
        if (!confirm('정말 이 후기를 삭제하시겠습니까?')) return;
        try {
          const res = await fetch(`/api/reviews/${rev.id}`, { method: 'DELETE' });
          if (res.ok) {
            showToast('후기 삭제 완료', 'success');
            
            // If deleting a review currently being edited, reset form
            if (editingReviewId === rev.id && formPanel) {
              formPanel.resetForm();
            }

            fetchAndRenderReviews();
            reloadHeaderStats();
          } else {
            showToast('삭제 중 오류가 발생했습니다.', 'error');
          }
        } catch (e) {
          showToast('네트워크 오류가 발생했습니다.', 'error');
        }
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      card.appendChild(actions);

      section.appendChild(card);
    });

    return section;
  }

  // Load musical details first
  const loaded = await fetchMusicalDetail();
  if (!loaded) return;

  appEl.innerHTML = `
    <!-- Detail Header -->
    <div class="detail-header">
      <div class="detail-meta">
        <span class="detail-genre" id="header-genre"></span>
        <div class="detail-header-right">
          <div class="detail-stats">
            <div class="stat-item">
              <span class="stat-label">평점</span>
              <span class="stat-value" id="header-rating-val">-</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">후기</span>
              <span class="stat-value" id="header-count-val">0</span>
            </div>
          </div>
          <div class="musical-actions">
            <a href="#/edit-musical/${musicalId}" class="btn btn-secondary" id="btn-edit-musical">수정</a>
            <button class="btn btn-danger" id="btn-delete-musical">삭제</button>
          </div>
        </div>
      </div>
      <h1 class="detail-title" id="header-title"></h1>
      <p class="detail-description" id="header-description"></p>
    </div>

    <!-- Grid: Form + Reviews -->
    <div class="detail-content-grid">
      <div id="form-panel-wrapper"></div>
      <div id="reviews-list-wrapper"></div>
    </div>
  `;

  // Apply safe texts to header to avoid XSS
  appEl.querySelector('#header-genre').textContent = musical.genre;
  appEl.querySelector('#header-title').textContent = musical.title;
  appEl.querySelector('#header-description').textContent = musical.description;
  appEl.querySelector('#header-rating-val').textContent = musical.averageRating !== null ? musical.averageRating.toFixed(1) : '평점 없음';
  appEl.querySelector('#header-count-val').textContent = musical.reviewCount;

  // Handle musical delete action
  const deleteMusicalBtn = appEl.querySelector('#btn-delete-musical');
  deleteMusicalBtn.addEventListener('click', async () => {
    if (!confirm('정말 이 뮤지컬을 삭제하시겠습니까? 관련된 모든 후기도 삭제됩니다.')) return;
    try {
      const res = await fetch(`/api/musicals/${musicalId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('뮤지컬 삭제 완료', 'success');
        window.location.hash = '#/';
      } else {
        showToast('삭제 실패', 'error');
      }
    } catch (err) {
      showToast('서버 오류', 'error');
    }
  });

  // Build Review Form Panel
  const formWrapper = appEl.querySelector('#form-panel-wrapper');
  formPanel = buildReviewFormPanel(musicalId, fetchAndRenderReviews, reloadHeaderStats);
  formWrapper.appendChild(formPanel);

  // Load reviews list
  await fetchAndRenderReviews();
}

// FORM PANEL BUILDER
function buildReviewFormPanel(musicalId, onReviewsChanged, onHeaderStatsChanged) {
  const panel = document.createElement('div');
  panel.className = 'form-panel';
  panel.id = 'review-form-section';

  const title = document.createElement('h3');
  title.className = 'panel-title';
  title.textContent = '관람 후기 작성';
  panel.appendChild(title);

  const form = document.createElement('form');
  
  // Nickname Group
  const nicknameGroup = document.createElement('div');
  nicknameGroup.className = 'form-group';
  nicknameGroup.innerHTML = `<label class="form-label" for="form-nickname">닉네임 (2~15자)</label>`;
  const nicknameInput = document.createElement('input');
  nicknameInput.type = 'text';
  nicknameInput.id = 'form-nickname';
  nicknameInput.className = 'form-input';
  nicknameInput.placeholder = '닉네임을 입력하세요';
  nicknameInput.required = true;
  nicknameGroup.appendChild(nicknameInput);
  form.appendChild(nicknameGroup);

  // Rating Group
  const ratingGroup = document.createElement('div');
  ratingGroup.className = 'form-group';
  ratingGroup.innerHTML = `<label class="form-label">별점 (클릭/드래그하여 0.5단위 선택)</label>`;
  
  const ratingContainer = document.createElement('div');
  ratingContainer.className = 'rating-container';
  
  let selectedRating = 5.0;

  const starsSelector = buildInteractiveStarsComponent(5.0, (val) => {
    selectedRating = val;
    sliderVal.textContent = val.toFixed(1);
  });

  const sliderVal = document.createElement('span');
  sliderVal.className = 'rating-display-value';
  sliderVal.textContent = '5.0';

  ratingContainer.appendChild(starsSelector);
  ratingContainer.appendChild(sliderVal);
  ratingGroup.appendChild(ratingContainer);
  form.appendChild(ratingGroup);

  // Title Group
  const titleGroup = document.createElement('div');
  titleGroup.className = 'form-group';
  titleGroup.innerHTML = `<label class="form-label" for="form-title-input">제목 (1~100자)</label>`;
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.id = 'form-title-input';
  titleInput.className = 'form-input';
  titleInput.placeholder = '제목을 입력하세요';
  titleInput.required = true;
  titleGroup.appendChild(titleInput);
  form.appendChild(titleGroup);

  // Content Group
  const contentGroup = document.createElement('div');
  contentGroup.className = 'form-group';
  contentGroup.innerHTML = `<label class="form-label" for="form-content-input">내용 (1~3000자)</label>`;
  const contentInput = document.createElement('textarea');
  contentInput.id = 'form-content-input';
  contentInput.className = 'form-input';
  contentInput.placeholder = '관람 후기 내용을 작성해주세요';
  contentInput.required = true;
  contentGroup.appendChild(contentInput);
  form.appendChild(contentGroup);

  // Form actions
  const actions = document.createElement('div');
  actions.className = 'form-actions';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn btn-primary';
  submitBtn.textContent = '후기 등록하기';
  actions.appendChild(submitBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.textContent = '취소';
  cancelBtn.style.display = 'none';
  actions.appendChild(cancelBtn);

  form.appendChild(actions);
  panel.appendChild(form);

  // Reset form helper
  function resetForm() {
    editingReviewId = null;
    title.textContent = '관람 후기 작성';
    submitBtn.textContent = '후기 등록하기';
    cancelBtn.style.display = 'none';
    form.reset();
    selectedRating = 5.0;
    starsSelector.setValue(5.0);
    sliderVal.textContent = '5.0';
  }

  panel.resetForm = resetForm; // Expose to parent

  cancelBtn.addEventListener('click', resetForm);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nickname = nicknameInput.value.trim();
    const rating = selectedRating;
    const revTitle = titleInput.value.trim();
    const revContent = contentInput.value.trim();

    // Client-side Validation Checks
    if (nickname.length < 2 || nickname.length > 15) {
      showToast('입력값 오류: 닉네임은 2~15자 사이여야 합니다.', 'error');
      return;
    }
    if (revTitle.length < 1 || revTitle.length > 100) {
      showToast('입력값 오류: 제목은 1~100자 사이여야 합니다.', 'error');
      return;
    }
    if (revContent.length < 1 || revContent.length > 3000) {
      showToast('입력값 오류: 내용은 1~3000자 사이여야 합니다.', 'error');
      return;
    }
    if (isNaN(rating) || rating < 0.5 || rating > 5.0 || rating * 2 !== Math.floor(rating * 2)) {
      showToast('입력값 오류: 올바르지 않은 평점입니다.', 'error');
      return;
    }

    const payload = { nickname, rating, title: revTitle, content: revContent };

    try {
      let res;
      if (editingReviewId) {
        res = await fetch(`/api/reviews/${editingReviewId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            musicalId
          })
        });
      }

      const data = await res.json();
      if (res.ok) {
        showToast(editingReviewId ? '후기 수정 완료' : '후기 등록 완료', 'success');
        resetForm();
        onReviewsChanged();
        onHeaderStatsChanged();
      } else {
        showToast(data.error || '입력값 오류', 'error');
      }
    } catch (e) {
      showToast('서버 오류', 'error');
    }
  });

  // Start edit helper (exposed to parent)
  panel.startEdit = (review) => {
    editingReviewId = review.id;
    title.textContent = '후기 수정하기';
    submitBtn.textContent = '수정 완료';
    cancelBtn.style.display = 'block';

    nicknameInput.value = review.nickname;
    selectedRating = review.rating;
    starsSelector.setValue(review.rating);
    sliderVal.textContent = review.rating.toFixed(1);
    titleInput.value = review.title;
    contentInput.value = review.content;

    panel.scrollIntoView({ behavior: 'smooth' });
  };

  return panel;
}

// 404 VIEW
function render404(appEl) {
  appEl.innerHTML = `
    <div class="not-found-view">
      <div class="not-found-code">404</div>
      <h2>요청하신 페이지를 찾을 수 없습니다.</h2>
      <p>존재하지 않는 주소이거나, 지정한 뮤지컬 정보가 삭제되었을 수 있습니다.</p>
      <a href="#/" class="btn btn-primary">홈으로 돌아가기</a>
    </div>
  `;
}

// Handle Routing Listeners
window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
