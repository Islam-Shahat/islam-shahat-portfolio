const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const API_BASE = 'http://localhost:5050/api';
let passes = 0;
let fails = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${testName}`);
    passes++;
  } else {
    console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${testName} ${details ? '(' + details + ')' : ''}`);
    fails++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING COMPREHENSIVE TEST SUITE: PROJECTS PIPELINE');
  console.log('======================================================\n');

  // ==========================================
  // SECTION 1: STATIC FILES & ASSET INTEGRITY
  // ==========================================
  console.log('📁 1. Static Files & Assets Integrity:');

  const indexHtmlPath = path.join(__dirname, '../client/index.html');
  const adminHtmlPath = path.join(__dirname, '../client/admin.html');
  const mainJsPath = path.join(__dirname, '../client/assets/js/main.js');
  const adminJsPath = path.join(__dirname, '../client/assets/js/admin.js');
  const stylesCssPath = path.join(__dirname, '../client/assets/css/styles.css');
  const projectsJsonPath = path.join(__dirname, '../client/assets/data/projects.json');

  assert(fs.existsSync(indexHtmlPath), 'client/index.html exists');
  assert(fs.existsSync(adminHtmlPath), 'client/admin.html exists');
  assert(fs.existsSync(mainJsPath), 'client/assets/js/main.js exists');
  assert(fs.existsSync(adminJsPath), 'client/assets/js/admin.js exists');
  assert(fs.existsSync(stylesCssPath), 'client/assets/css/styles.css exists');
  assert(fs.existsSync(projectsJsonPath), 'client/assets/data/projects.json exists');

  // Check local images referenced by projects
  const requiredLocalImages = [
    'veranda.webp',
    'aqario.webp',
    'RWD.webp',
    'atm_system.webp',
    'backend_api.webp'
  ];
  for (const imgName of requiredLocalImages) {
    const imgPath = path.join(__dirname, '../client/assets/img', imgName);
    assert(fs.existsSync(imgPath), `Local project image exists: assets/img/${imgName}`);
  }

  // ==========================================
  // SECTION 2: HTML STRUCTURE VERIFICATION
  // ==========================================
  console.log('\n🌐 2. HTML Structure & DOM IDs Verification:');

  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');

  // Index HTML checks
  assert(indexHtml.includes('id="projects-content"'), 'index.html contains #projects-content');
  assert(indexHtml.includes('id="projects-filters"'), 'index.html contains #projects-filters');
  assert(indexHtml.includes('id="proj-count-all"'), 'index.html contains #proj-count-all');
  assert(indexHtml.includes('id="proj-count-frontend"'), 'index.html contains #proj-count-frontend');
  assert(indexHtml.includes('id="proj-count-mern"'), 'index.html contains #proj-count-mern');
  assert(indexHtml.includes('id="proj-count-backend"'), 'index.html contains #proj-count-backend');
  assert(indexHtml.includes('id="proj-count-cpp"'), 'index.html contains #proj-count-cpp');
  assert(indexHtml.includes('projects__swiper-nav swiper-button-prev') || indexHtml.includes('swiper-button-prev projects__swiper-nav'), 'index.html has Swiper Prev navigation arrow');
  assert(indexHtml.includes('projects__swiper-nav swiper-button-next') || indexHtml.includes('swiper-button-next projects__swiper-nav'), 'index.html has Swiper Next navigation arrow');
  assert(indexHtml.includes('id="project-gallery-modal"'), 'index.html contains #project-gallery-modal');
  assert(indexHtml.includes('id="gallery-modal-category"'), 'index.html contains #gallery-modal-category');
  assert(indexHtml.includes('id="gallery-modal-date"'), 'index.html contains #gallery-modal-date');
  assert(indexHtml.includes('id="gallery-modal-title"'), 'index.html contains #gallery-modal-title');
  assert(indexHtml.includes('id="gallery-modal-desc"'), 'index.html contains #gallery-modal-desc');
  assert(indexHtml.includes('id="gallery-modal-tech"'), 'index.html contains #gallery-modal-tech');
  assert(indexHtml.includes('id="gallery-modal-counter"'), 'index.html contains #gallery-modal-counter');
  assert(indexHtml.includes('id="gallery-modal-main-img"'), 'index.html contains #gallery-modal-main-img');
  assert(indexHtml.includes('id="gallery-modal-thumbs"'), 'index.html contains #gallery-modal-thumbs');
  assert(indexHtml.includes('id="gallery-modal-links"'), 'index.html contains #gallery-modal-links');

  // Admin HTML checks
  assert(adminHtml.includes('id="project-modal"'), 'admin.html contains #project-modal');
  assert(adminHtml.includes('id="p-title"'), 'admin.html contains #p-title');
  assert(adminHtml.includes('id="p-category"'), 'admin.html contains #p-category');
  assert(adminHtml.includes('id="p-date"'), 'admin.html contains #p-date');
  assert(adminHtml.includes('id="p-description"'), 'admin.html contains #p-description');
  assert(adminHtml.includes('id="p-image-url"'), 'admin.html contains #p-image-url');
  assert(adminHtml.includes('id="p-gallery-urls"'), 'admin.html contains #p-gallery-urls');
  assert(adminHtml.includes('id="p-gallery-file"'), 'admin.html contains #p-gallery-file (multi-upload)');
  assert(adminHtml.includes('id="gallery-upload-status"'), 'admin.html contains #gallery-upload-status');
  assert(adminHtml.includes('id="p-demo"'), 'admin.html contains #p-demo');
  assert(adminHtml.includes('id="p-github"'), 'admin.html contains #p-github');
  assert(adminHtml.includes('id="p-technologies"'), 'admin.html contains #p-technologies');
  assert(adminHtml.includes('id="projects-table-body"'), 'admin.html contains #projects-table-body');
  assert(adminHtml.includes('id="project-search-input"'), 'admin.html contains #project-search-input');

  // ==========================================
  // SECTION 3: CSS STYLES CHECK
  // ==========================================
  console.log('\n🎨 3. CSS Stylesheet Rules Check:');
  const stylesCss = fs.readFileSync(stylesCssPath, 'utf8');

  assert(stylesCss.includes('.projects__filters'), 'styles.css defines .projects__filters');
  assert(stylesCss.includes('.projects__filter-btn'), 'styles.css defines .projects__filter-btn');
  assert(stylesCss.includes('.projects__filter-btn.active'), 'styles.css defines active filter state');
  assert(stylesCss.includes('.projects__swiper-nav'), 'styles.css defines .projects__swiper-nav');
  assert(stylesCss.includes('.gallery-modal__badge--date'), 'styles.css defines .gallery-modal__badge--date');
  assert(stylesCss.includes('.gallery-modal__desc'), 'styles.css defines .gallery-modal__desc');
  assert(stylesCss.includes('.gallery-modal__tech-tags'), 'styles.css defines .gallery-modal__tech-tags');

  // ==========================================
  // SECTION 4: SERVER API INTEGRATION TESTS
  // ==========================================
  console.log('\n⚡ 4. Live Server API Endpoints Tests:');

  // Test 4.1: Public GET /api/projects
  let publicProjects = [];
  try {
    const res = await fetch(`${API_BASE}/projects`);
    assert(res.ok, 'GET /api/projects returns HTTP 200 OK');
    const data = await res.json();
    assert(data.success === true, 'API response has success: true');
    assert(Array.isArray(data.data), 'API data is an Array');
    publicProjects = data.data;

    // Projects are fully dynamic now (no hardcoded samples). Validate shape only when present.
    if (publicProjects.length > 0) {
      const p1 = publicProjects[0];
      assert(!!p1.title, `First project has title: "${p1.title}"`);
      assert(!!p1.category, `First project has category: "${p1.category}"`);
      assert(!!p1.description, 'First project has description');
      assert(Array.isArray(p1.technologies), 'First project has technologies array');
      assert(!!p1.coverImage || !!p1.image, 'First project has valid cover image');
    } else {
      assert(true, 'Public projects feed is empty (dynamic mode — no hardcoded samples)');
    }
  } catch (err) {
    assert(false, 'GET /api/projects reachable', err.message);
  }

  // Test 4.2: Admin Authentication
  let adminToken = '';
  try {
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD
      })
    });
    const loginData = await loginRes.json();
    assert(loginRes.ok && loginData.success, 'POST /api/auth/login succeeds with valid credentials');
    adminToken = loginData.token;
    assert(typeof adminToken === 'string' && adminToken.length > 20, 'Received valid JWT admin token');
  } catch (err) {
    assert(false, 'Admin authentication test', err.message);
  }

  // Test 4.3: Admin-created published project appears in the public portfolio feed
  if (adminToken) {
    let pubTestId = null;
    try {
      const createRes = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          title: 'Automated Public Project',
          category: 'MERN Stack',
          description: 'Verifies admin-created projects appear on the public portfolio.',
          date: '2026',
          status: 'published',
          technologies: ['React', 'Node.js']
        })
      });
      const createData = await createRes.json();
      assert(createData.success, 'Admin can create a published project');
      pubTestId = createData.data?._id || createData.data?.id;

      const pubFeedRes = await fetch(`${API_BASE}/projects`);
      const pubFeed = await pubFeedRes.json();
      assert(pubFeed.data.some(p => p.title === 'Automated Public Project'), 'Admin-created project appears in public portfolio feed');

      const cleanupRes = await fetch(`${API_BASE}/projects/${pubTestId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const cleanupData = await cleanupRes.json();
      assert(cleanupData.success, 'Cleanup: published test project deleted');
    } catch (err) {
      assert(false, 'Published project lifecycle test', err.message);
      if (pubTestId) {
        await fetch(`${API_BASE}/projects/${pubTestId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${adminToken}` }
        }).catch(() => {});
      }
    }
  }

  // Test 4.4: Draft projects security & visibility
  if (adminToken) {
    let testDraftId = null;
    try {
      // Create a draft project
      const draftRes = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          title: 'Automated Draft Secret Project',
          category: 'MERN Stack',
          description: 'A draft project testing visibility restrictions.',
          date: '2026',
          status: 'draft',
          technologies: ['SecretTech', 'Node.js']
        })
      });
      const draftData = await draftRes.json();
      assert(draftData.success, 'Admin can create project with status="draft"');
      testDraftId = draftData.data?._id || draftData.data?.id;

      // Verify public GET /api/projects DOES NOT contain draft
      const pubRes = await fetch(`${API_BASE}/projects`);
      const pubData = await pubRes.json();
      const draftLeaked = pubData.data.some(p => p.title === 'Automated Draft Secret Project');
      assert(!draftLeaked, 'Public portfolio GET /api/projects correctly hides draft projects');

      // Verify admin GET /api/projects?includeDrafts=true with token DOES contain draft
      const admRes = await fetch(`${API_BASE}/projects?includeDrafts=true`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const admData = await admRes.json();
      const draftVisibleToAdmin = admData.data.some(p => p.title === 'Automated Draft Secret Project');
      assert(draftVisibleToAdmin, 'Admin request with Authorization header sees draft projects');

      // Test Updating project
      const updateRes = await fetch(`${API_BASE}/projects/${testDraftId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          title: 'Automated Draft Secret Project (Updated)',
          subtitle: 'Updated Subtitle'
        })
      });
      const updateData = await updateRes.json();
      assert(updateData.success, 'Admin PUT /api/projects/:id updates project successfully');

      // Clean up: delete test project
      const delRes = await fetch(`${API_BASE}/projects/${testDraftId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const delData = await delRes.json();
      assert(delData.success, 'Admin DELETE /api/projects/:id deletes project cleanly');
    } catch (err) {
      assert(false, 'Draft project lifecycle test', err.message);
      if (testDraftId) {
        await fetch(`${API_BASE}/projects/${testDraftId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${adminToken}` }
        }).catch(() => {});
      }
    }
  }

  // ==========================================
  // SECTION 5: FALLBACK DATA SYNC CHECK
  // ==========================================
  console.log('\n💾 5. Fallback JSON Data File Verification:');
  try {
    const rawFallback = fs.readFileSync(projectsJsonPath, 'utf8');
    const fallbackProjects = JSON.parse(rawFallback);
    assert(Array.isArray(fallbackProjects), 'projects.json contains a valid JSON array');
    // Projects are fully dynamic now: the fallback mirror may legitimately be empty
    // (no hardcoded sample projects). Only validate shape when entries exist.
    fallbackProjects.forEach((p, i) => {
      assert(typeof p.title === 'string' && p.title.length > 0, `projects.json[${i}] has a title`);
    });
  } catch (err) {
    assert(false, 'Fallback JSON validation', err.message);
  }

  // ==========================================
  // SECTION 6: CLIENT JS LOGIC SIMULATION
  // ==========================================
  console.log('\n⚙ 6. Client JS Logic Unit Simulation:');

  // Test 6.1: Sequential numbering logic
  const sampleIndices = [0, 1, 2, 8, 9, 10];
  const expectedDisplayIds = ['01', '02', '03', '09', '10', '11'];
  const actualDisplayIds = sampleIndices.map(idx => (idx + 1 < 10 ? `0${idx + 1}` : `${idx + 1}`));
  assert(
    JSON.stringify(actualDisplayIds) === JSON.stringify(expectedDisplayIds),
    'Display ID sequence generator produces clean 2-digit numbers: 01, 02, ..., 10, 11'
  );

  // Test 6.2: Category filter logic simulation
  const mockProjects = [
    { title: 'Veranda Café', category: 'Frontend', technologies: ['HTML5', 'CSS3', 'JavaScript'] },
    { title: 'Aqario Luxe', category: 'MERN Stack', technologies: ['React.js', 'Node.js', 'MongoDB'] },
    { title: 'ATM System', category: 'C++ & Software', technologies: ['C++', 'OOP'] },
    { title: 'Backend REST API', category: 'Backend', technologies: ['Node.js', 'Express', 'MongoDB'] }
  ];

  const filterFn = (category, list) => {
    if (category === 'all') return list;
    const catLower = category.toLowerCase();
    return list.filter(p => {
      const c = (p.category || '').toLowerCase();
      const t = (p.title || '').toLowerCase();
      const tech = Array.isArray(p.technologies) ? p.technologies.join(' ').toLowerCase() : (p.technologies || '').toLowerCase();
      if (category === 'Frontend') return c.includes('front') || tech.includes('html') || tech.includes('css') || tech.includes('react');
      if (category === 'MERN') return c.includes('mern') || tech.includes('mern') || tech.includes('react');
      if (category === 'Backend') return c.includes('back') || tech.includes('node') || tech.includes('express') || tech.includes('api');
      if (category === 'C++') return c.includes('c++') || tech.includes('c++') || t.includes('atm');
      return c.includes(catLower) || t.includes(catLower) || tech.includes(catLower);
    });
  };

  assert(filterFn('all', mockProjects).length === 4, 'Filter "all" returns all 4 projects');
  assert(filterFn('Frontend', mockProjects).length >= 1, 'Filter "Frontend" matches frontend projects');
  assert(filterFn('MERN', mockProjects).length >= 1, 'Filter "MERN" matches MERN projects');
  assert(filterFn('Backend', mockProjects).length >= 1, 'Filter "Backend" matches backend projects');
  assert(filterFn('C++', mockProjects).length >= 1, 'Filter "C++" matches C++ projects');

  // Summary
  console.log('\n======================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passes} PASSED | ${fails} FAILED`);
  console.log('======================================================\n');

  if (fails > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
