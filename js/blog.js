/* ============================================================
   Mapnovate Blog
   Client-side blog: posts (with cover images) + comments,
   persisted in the browser's localStorage. No backend required.
   ============================================================ */
(function () {
  'use strict';

  var POSTS_KEY = 'mapnovate_blog_posts_v1';

  var CATEGORY_COLORS = {
    'GIS Solutions': '#00A896',
    'Geomatics': '#2ECC80',
    'Data Science': '#00A896',
    'Web Mapping': '#2ECC80',
    'Remote Sensing': '#00A896',
    'Company News': '#2ECC80'
  };

  var seedPosts = [
    {
      id: 'seed-3',
      title: 'Five ways satellite imagery is changing land-use monitoring in East Africa',
      category: 'Remote Sensing',
      author: 'Mapnovate Team',
      date: daysAgo(4),
      excerpt: 'From deforestation alerts to crop health, freely available satellite feeds are giving planners a near real-time view of the land.',
      content:
        'Free and commercial satellite constellations now revisit most of East Africa every few days, which changes what land-use monitoring can look like in practice.\n\nInstead of an annual survey, teams can watch change happen: a new informal settlement, a burn scar, a shift in irrigated area. Paired with simple classification models, that cadence turns imagery into an early-warning tool rather than a historical record.\n\nWe are increasingly pairing Sentinel-2 and PlanetScope feeds with lightweight machine learning models trained on local ground-truth data, which keeps accuracy high without needing a supercomputer to run.\n\nThe result for our clients is simpler reporting, faster response to encroachment or flooding, and a much shorter gap between "something changed" and "someone knows about it."',
      image: null,
      comments: [
        { id: 'c1', name: 'Achieng O.', date: daysAgo(3), text: 'Would love a follow-up on which indices you use for burn scar detection.' }
      ]
    },
    {
      id: 'seed-2',
      title: 'Building web maps that survive contact with real users',
      category: 'Web Mapping',
      author: 'Mapnovate Team',
      date: daysAgo(9),
      excerpt: 'Interactive maps are easy to demo and hard to ship. Here is what actually matters once real users and real data show up.',
      content:
        'Most web mapping demos look great with a handful of clean points on a basemap. Production usage looks different: thousands of features, patchy connectivity, and users who are not GIS specialists.\n\nWe design for that reality from day one. Vector tiles instead of huge GeoJSON payloads, clustering that adapts to zoom level, and interfaces that assume the person on the other end just wants an answer, not a GIS course.\n\nPerformance budgets matter as much as visual design. A map that takes eight seconds to become interactive on a mid-range phone will lose users before they see any of the analysis underneath it.\n\nThe teams that get the most value from a web map are the ones who treat it as a product with real users, not a one-off visualization.',
      image: null,
      comments: []
    },
    {
      id: 'seed-1',
      title: 'Welcome to the Mapnovate blog',
      category: 'Company News',
      author: 'Mapnovate Team',
      date: daysAgo(15),
      excerpt: 'A new place for field notes, case studies and ideas from our GIS, geomatics and data science team.',
      content:
        'We work across GIS, geomatics, data science and web mapping every day, and along the way we pick up lessons worth sharing: what worked on a project, what surprised us, and what we would do differently next time.\n\nThis blog is where we will post those notes, along with the occasional deeper dive into a tool, technique, or dataset we think is worth your attention.\n\nHave something to add? Every post here accepts comments, and if you would like to contribute a post of your own, use the "New Post" button above.',
      image: null,
      comments: [
        { id: 'c2', name: 'James K.', date: daysAgo(14), text: 'Looking forward to more posts like this — subscribe button when?' },
        { id: 'c3', name: 'Wanjiru M.', date: daysAgo(13), text: 'Great to see this launch. The remote sensing piece was a great read.' }
      ]
    }
  ];

  function daysAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  }

  function uid() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return '';
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Turn plain text with blank-line paragraphs into safe HTML paragraphs
  function renderParagraphs(text) {
    return String(text || '')
      .split(/\n\s*\n/)
      .map(function (p) { return p.trim(); })
      .filter(Boolean)
      .map(function (p) { return '<p>' + escapeHtml(p).replace(/\n/g, '<br>') + '</p>'; })
      .join('');
  }

  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/);
    var i = (parts[0] ? parts[0][0] : '') + (parts[1] ? parts[1][0] : '');
    return i.toUpperCase() || '?';
  }

  /* ---------------- storage ---------------- */

  function loadPosts() {
    try {
      var raw = localStorage.getItem(POSTS_KEY);
      if (!raw) {
        localStorage.setItem(POSTS_KEY, JSON.stringify(seedPosts));
        return clone(seedPosts);
      }
      return JSON.parse(raw);
    } catch (e) {
      console.error('Mapnovate blog: could not read localStorage, using defaults', e);
      return clone(seedPosts);
    }
  }

  function savePosts(posts) {
    try {
      localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
      return true;
    } catch (e) {
      console.error('Mapnovate blog: could not save to localStorage', e);
      alert('Your post could not be saved. Your browser storage may be full or private browsing may be blocking it.');
      return false;
    }
  }

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  var posts = loadPosts();
  var activePostId = null;

  /* ---------------- element refs ---------------- */

  var el = {
    listView: document.getElementById('listView'),
    detailView: document.getElementById('detailView'),
    grid: document.getElementById('blogGrid'),
    empty: document.getElementById('blogEmpty'),
    search: document.getElementById('searchInput'),
    categoryFilter: document.getElementById('categoryFilter'),
    newPostBtn: document.getElementById('newPostBtn'),
    backBtn: document.getElementById('backBtn'),

    detailCategory: document.getElementById('detailCategory'),
    detailTitle: document.getElementById('detailTitle'),
    detailMeta: document.getElementById('detailMeta'),
    detailMedia: document.getElementById('detailMedia'),
    detailContent: document.getElementById('detailContent'),
    deletePostBtn: document.getElementById('deletePostBtn'),

    commentsHeading: document.getElementById('commentsHeading'),
    commentList: document.getElementById('commentList'),
    commentEmpty: document.getElementById('commentEmpty'),
    commentForm: document.getElementById('commentForm'),
    commentName: document.getElementById('commentName'),
    commentText: document.getElementById('commentText'),

    modalOverlay: document.getElementById('modalOverlay'),
    modalClose: document.getElementById('modalClose'),
    cancelPostBtn: document.getElementById('cancelPostBtn'),
    postForm: document.getElementById('postForm'),
    postTitle: document.getElementById('postTitle'),
    postCategory: document.getElementById('postCategory'),
    postAuthor: document.getElementById('postAuthor'),
    postExcerpt: document.getElementById('postExcerpt'),
    postContent: document.getElementById('postContent'),
    postImage: document.getElementById('postImage'),
    fileInputName: document.getElementById('fileInputName'),
    imagePreview: document.getElementById('imagePreview'),
    imagePreviewImg: document.getElementById('imagePreviewImg'),
    imagePreviewRemove: document.getElementById('imagePreviewRemove')
  };

  var pendingImageData = null;

  /* ---------------- category filter options ---------------- */

  function populateCategoryFilter() {
    var cats = [];
    posts.forEach(function (p) {
      if (cats.indexOf(p.category) === -1) cats.push(p.category);
    });
    cats.sort();
    el.categoryFilter.innerHTML = '<option value="all">All categories</option>' +
      cats.map(function (c) { return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>'; }).join('');
  }

  /* ---------------- rendering: grid ---------------- */

  function postMediaHtml(post, isCard) {
    if (post.image) {
      return '<img src="' + post.image + '" alt="' + escapeHtml(post.title) + '">';
    }
    var color = CATEGORY_COLORS[post.category] || '#00A896';
    return '<div class="post-img-placeholder" style="background:linear-gradient(135deg,' + color + ',#081D3A)">' +
      '<svg width="' + (isCard ? 30 : 42) + '" height="' + (isCard ? 30 : 42) + '" viewBox="0 0 24 24" fill="none">' +
      '<path d="M12 2C8 2 5 5.5 5 9.5 5 15 12 22 12 22s7-7 7-12.5C19 5.5 16 2 12 2z" stroke="#fff" stroke-width="1.6"/>' +
      '<circle cx="12" cy="9.5" r="2.4" stroke="#fff" stroke-width="1.6"/></svg></div>';
  }

  function renderGrid() {
    var term = (el.search.value || '').trim().toLowerCase();
    var cat = el.categoryFilter.value;

    var filtered = posts.filter(function (p) {
      var matchesCat = cat === 'all' || p.category === cat;
      var matchesTerm = !term ||
        p.title.toLowerCase().indexOf(term) !== -1 ||
        p.excerpt.toLowerCase().indexOf(term) !== -1 ||
        (p.author || '').toLowerCase().indexOf(term) !== -1;
      return matchesCat && matchesTerm;
    });

    filtered.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

    el.empty.hidden = filtered.length !== 0;
    el.grid.innerHTML = filtered.map(function (p) {
      var commentCount = (p.comments || []).length;
      return (
        '<article class="post-card" data-id="' + p.id + '">' +
          '<div class="post-card-media">' + postMediaHtml(p, true) + '</div>' +
          '<div class="post-card-body">' +
            '<span class="post-badge">' + escapeHtml(p.category) + '</span>' +
            '<h3>' + escapeHtml(p.title) + '</h3>' +
            '<p>' + escapeHtml(p.excerpt) + '</p>' +
            '<div class="post-card-meta">' +
              '<span>' + escapeHtml(p.author) + ' · ' + formatDate(p.date) + '</span>' +
              '<span class="post-comment-count">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 12a8 8 0 11-3.2-6.4L21 4l-1 4.5" stroke="#5B6770" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                commentCount +
              '</span>' +
            '</div>' +
          '</div>' +
        '</article>'
      );
    }).join('');
  }

  /* ---------------- rendering: detail ---------------- */

  function renderComments(post) {
    var comments = post.comments || [];
    el.commentsHeading.textContent = 'Comments (' + comments.length + ')';
    el.commentEmpty.hidden = comments.length !== 0;
    el.commentList.innerHTML = comments.map(function (c) {
      return (
        '<div class="comment-item">' +
          '<div class="comment-avatar">' + escapeHtml(initials(c.name)) + '</div>' +
          '<div class="comment-body">' +
            '<div class="comment-head"><span class="comment-name">' + escapeHtml(c.name) + '</span>' +
            '<span class="comment-date">' + formatDate(c.date) + '</span></div>' +
            '<p>' + escapeHtml(c.text) + '</p>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function renderDetail(post) {
    el.detailCategory.textContent = post.category;
    el.detailTitle.textContent = post.title;
    el.detailMeta.textContent = 'By ' + post.author + ' · ' + formatDate(post.date);
    el.detailMedia.innerHTML = postMediaHtml(post, false);
    el.detailContent.innerHTML = renderParagraphs(post.content);
    renderComments(post);
  }

  function showList() {
    activePostId = null;
    el.listView.hidden = false;
    el.detailView.hidden = true;
    renderGrid();
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    window.scrollTo({ top: document.getElementById('blogMain').offsetTop - 90, behavior: 'smooth' });
  }

  function showDetail(id) {
    var post = posts.find(function (p) { return p.id === id; });
    if (!post) { showList(); return; }
    activePostId = id;
    el.listView.hidden = true;
    el.detailView.hidden = false;
    renderDetail(post);
    location.hash = 'post-' + id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- events: grid & filters ---------------- */

  el.search.addEventListener('input', renderGrid);
  el.categoryFilter.addEventListener('change', renderGrid);

  el.grid.addEventListener('click', function (e) {
    var card = e.target.closest('.post-card');
    if (card) showDetail(card.getAttribute('data-id'));
  });

  el.backBtn.addEventListener('click', showList);

  /* ---------------- events: delete post ---------------- */

  el.deletePostBtn.addEventListener('click', function () {
    if (!activePostId) return;
    if (!confirm('Delete this post and all of its comments? This cannot be undone.')) return;
    posts = posts.filter(function (p) { return p.id !== activePostId; });
    savePosts(posts);
    populateCategoryFilter();
    showList();
  });

  /* ---------------- events: comments ---------------- */

  el.commentForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!activePostId) return;
    var post = posts.find(function (p) { return p.id === activePostId; });
    if (!post) return;

    var name = el.commentName.value.trim();
    var text = el.commentText.value.trim();
    if (!name || !text) return;

    post.comments = post.comments || [];
    post.comments.push({ id: uid(), name: name, text: text, date: new Date().toISOString() });

    savePosts(posts);
    renderComments(post);
    el.commentForm.reset();
  });

  /* ---------------- events: new post modal ---------------- */

  function openModal() {
    el.modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    el.postTitle.focus();
  }

  function closeModal() {
    el.modalOverlay.hidden = true;
    document.body.style.overflow = '';
    el.postForm.reset();
    pendingImageData = null;
    el.fileInputName.textContent = 'No file chosen';
    el.imagePreview.hidden = true;
    el.imagePreviewImg.src = '';
  }

  el.newPostBtn.addEventListener('click', openModal);
  el.modalClose.addEventListener('click', closeModal);
  el.cancelPostBtn.addEventListener('click', closeModal);
  el.modalOverlay.addEventListener('click', function (e) {
    if (e.target === el.modalOverlay) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !el.modalOverlay.hidden) closeModal();
  });

  el.postImage.addEventListener('change', function () {
    var file = el.postImage.files && el.postImage.files[0];
    if (!file) {
      el.fileInputName.textContent = 'No file chosen';
      el.imagePreview.hidden = true;
      pendingImageData = null;
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      alert('Please choose an image smaller than 4MB.');
      el.postImage.value = '';
      return;
    }
    el.fileInputName.textContent = file.name;
    var reader = new FileReader();
    reader.onload = function (evt) {
      pendingImageData = evt.target.result;
      el.imagePreviewImg.src = pendingImageData;
      el.imagePreview.hidden = false;
    };
    reader.readAsDataURL(file);
  });

  el.imagePreviewRemove.addEventListener('click', function () {
    pendingImageData = null;
    el.postImage.value = '';
    el.fileInputName.textContent = 'No file chosen';
    el.imagePreview.hidden = true;
  });

  el.postForm.addEventListener('submit', function (e) {
    e.preventDefault();

    var newPost = {
      id: uid(),
      title: el.postTitle.value.trim(),
      category: el.postCategory.value,
      author: el.postAuthor.value.trim(),
      excerpt: el.postExcerpt.value.trim(),
      content: el.postContent.value.trim(),
      image: pendingImageData,
      date: new Date().toISOString(),
      comments: []
    };

    if (!newPost.title || !newPost.excerpt || !newPost.content || !newPost.author) return;

    posts.unshift(newPost);
    if (!savePosts(posts)) return;

    populateCategoryFilter();
    closeModal();
    showDetail(newPost.id);
  });

  /* ---------------- init ---------------- */

  populateCategoryFilter();
  renderGrid();

  var hashMatch = /^#post-(.+)$/.exec(location.hash);
  if (hashMatch && posts.some(function (p) { return p.id === hashMatch[1]; })) {
    showDetail(hashMatch[1]);
  }

  window.addEventListener('hashchange', function () {
    var m = /^#post-(.+)$/.exec(location.hash);
    if (m && posts.some(function (p) { return p.id === m[1]; })) {
      showDetail(m[1]);
    } else if (!location.hash) {
      showList();
    }
  });

})();
