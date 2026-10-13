const getApiBase = () => {
  if (window.location.protocol === 'file:') return 'http://localhost:5050/api';
  if (window.location.port && window.location.port !== '5050') {
    return `http://${window.location.hostname || 'localhost'}:5050/api`;
  }
  return '/api';
};
const API_BASE = getApiBase();

// Data Caches
let projectsCache = [];
let experienceCache = [];
let educationCache = [];
let volunteeringCache = [];
let certificatesCache = [];
let testimonialsCache = [];
let cvCache = [];
let activeCvData = null;
let skillsCache = [];
let filesCache = [];
let inquiriesCache = [];

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  const token = localStorage.getItem('admin_token');
  if (!token) {
    showLoginScreen();
  } else {
    verifySession(token);
  }
  setupEventListeners();
}

/* ==================== AUTHENTICATION & SESSION ==================== */

function showLoginScreen() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('dashboard-layout').style.display = 'none';
}

function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard-layout').style.display = 'flex';

  // Load initial active view data
  loadAnalytics();
  loadProjects();
  loadInquiries();
}

async function verifySession(token) {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      localStorage.removeItem('admin_token');
      showLoginScreen();
      return;
    }
    const data = await res.json();

    if (data.success) {
      const userEl = document.getElementById('current-user-name');
      if (userEl) userEl.textContent = (data.user && data.user.username === 'admin') ? 'إسلام شحات' : (data.user?.username || 'إسلام شحات');
      showDashboard();
    } else {
      localStorage.removeItem('admin_token');
      showLoginScreen();
    }
  } catch (err) {
    console.error('Session verification error:', err);
    localStorage.removeItem('admin_token');
    showLoginScreen();
  }
}

// Login Form Submit
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const usernameInput = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value.trim();
    const alertBox = document.getElementById('login-alert');
    const loginBtn = document.getElementById('login-btn');

    alertBox.style.display = 'none';
    loginBtn.disabled = true;
    loginBtn.innerHTML = `<span>جاري الدخول...</span> <i class="ri-loader-4-line animate-spin"></i>`;

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });

      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        data = { success: false, message: `خطأ في استجابة الخادم (${res.status}). يرجى التأكد من تشغيل السيرفر وقاعدة البيانات.` };
      }

      if (data.success) {
        localStorage.setItem('admin_token', data.token);
        showToast('تم تسجيل الدخول بنجاح!', 'success');
        showDashboard();
      } else {
        alertBox.textContent = data.message || 'بيانات الدخول غير صحيحة';
        alertBox.style.display = 'block';
      }
    } catch (err) {
      console.error('Login request error:', err);
      alertBox.textContent = 'تعذر الاتصال بالسيرفر. يرجى التأكد من إعدادات الاستضافة.';
      alertBox.style.display = 'block';
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML = `<span>تسجيل الدخول</span> <i class="ri-arrow-left-line"></i>`;
    }
  });
}

// Logout
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('admin_token');
    showToast('تم تسجيل الخروج بنجاح', 'success');
    showLoginScreen();
  });
}

/* ==================== NAVIGATION TABS ==================== */

function setupEventListeners() {
  const navItems = document.querySelectorAll('.sidebar-menu .nav-item[data-tab]');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.getAttribute('data-tab');
      switchToTab(tabName);
    });
  });

  const searchInput = document.getElementById('project-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filterProjectsTable(e.target.value.toLowerCase());
    });
  }

  const refreshBtn = document.getElementById('refresh-stats-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadAnalytics();
      showToast('تم تحديث الإحصائيات', 'success');
    });
  }

  // Password Change Form
  const pwdForm = document.getElementById('change-password-form');
  if (pwdForm) {
    pwdForm.addEventListener('submit', handlePasswordChange);
  }
}

function toggleSidebarMobile(forceState) {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar) return;

  if (typeof forceState === 'boolean') {
    if (forceState) {
      sidebar.classList.add('show-mobile');
      if (overlay) overlay.classList.add('show');
    } else {
      sidebar.classList.remove('show-mobile');
      if (overlay) overlay.classList.remove('show');
    }
  } else {
    const isShowing = sidebar.classList.toggle('show-mobile');
    if (overlay) overlay.classList.toggle('show', isShowing);
  }
}

function switchToTab(tabName) {
  toggleSidebarMobile(false);
  document.querySelectorAll('.sidebar-menu .nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));

  const activeNav = document.querySelector(`.sidebar-menu .nav-item[data-tab="${tabName}"]`);
  const activeTab = document.getElementById(`tab-${tabName}`);

  if (activeNav) activeNav.classList.add('active');
  if (activeTab) activeTab.classList.add('active');

  const titleEl = document.getElementById('page-title');
  const subtitleEl = document.getElementById('page-subtitle');

  const titles = {
    overview: ['التحليلات والرئيسية', 'نظرة عامة على أداء الموقع وإحصائيات الزوار'],
    projects: ['إدارة المشاريع', 'إضافة وتعديل وحذف المشاريع وتحكم بحالتها وحقول يوتيوب'],
    experience: ['خبرات العمل', 'إدارة وتحديث خبراتك المهنية والوظائف المكتسبة'],
    education: ['التعليم الأكاديمي', 'إدارة المؤهلات العلمية والدراسة الأكاديمية'],
    volunteering: ['التطوع والتدريس', 'إدارة الأنشطة التطوعية والتدريبية (Support Community)'],
    certificates: ['الشهادات والاعتمادات', 'إدارة شهادات الدورات والدبلومات مع معاينات PDF'],
    testimonials: ['آراء العملاء والشركاء', 'إدارة شهادات التقدير وتوصيات العملاء مع إثباتات السكرين شوت'],
    cv: ['إدارة الـ CV والملفات', 'رفع السيرة الذاتية بصيغة PDF وتحديد النسخة المفعّلة للموقع'],
    skills: ['المهارات والتخصصات', 'إدارة وتقييم مهارات الـ Full-Stack والـ MERN Stack'],
    files: ['مدير الملفات بالسيرفر', 'عرض وتحميل وإدارة جميع الملفات المرفوعة في السيرفر'],
    inquiries: ['رسائل الزوار', 'متابعة وقراءة استفسارات التواصل الواردة من البورتفوليو'],
    settings: ['إعدادات الحساب', 'تغيير كلمة المرور والبيانات الأمنية لآدمن البورتفوليو']
  };

  if (titles[tabName]) {
    titleEl.textContent = titles[tabName][0];
    subtitleEl.textContent = titles[tabName][1];
  }

  // Dynamic fetch per active tab
  if (tabName === 'experience') loadExperience();
  if (tabName === 'education') loadEducation();
  if (tabName === 'volunteering') loadVolunteering();
  if (tabName === 'certificates') loadCertificates();
  if (tabName === 'testimonials') loadTestimonials();
  if (tabName === 'cv') loadCVs();
  if (tabName === 'skills') loadSkills();
  if (tabName === 'files') loadFiles();
  if (tabName === 'inquiries') loadInquiries();
}

/* ==================== TAB 1: ANALYTICS & OVERVIEW ==================== */

async function loadAnalytics() {
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${API_BASE}/analytics`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success && data.stats) {
      const { totalViews, totalUniqueVisitors, totalProjects, publishedProjects, draftProjects, totalInquiries, unreadInquiries, dailyBreakdown } = data.stats;

      document.getElementById('stat-total-views').textContent = totalViews.toLocaleString();
      document.getElementById('stat-unique-visitors').textContent = totalUniqueVisitors.toLocaleString();
      document.getElementById('stat-total-projects').textContent = totalProjects;
      document.getElementById('stat-projects-status').textContent = `${publishedProjects} منشور | ${draftProjects} مسودة`;
      document.getElementById('stat-total-inquiries').textContent = totalInquiries;
      document.getElementById('stat-unread-inquiries').innerHTML = `<i class="ri-mail-open-line"></i> ${unreadInquiries} غير مقروءة`;

      document.getElementById('projects-count-badge').textContent = totalProjects;
      const unreadBadge = document.getElementById('unread-inquiries-badge');
      if (unreadInquiries > 0) {
        unreadBadge.textContent = unreadInquiries;
        unreadBadge.style.display = 'inline-block';
      } else {
        unreadBadge.style.display = 'none';
      }

      renderAnalyticsTable(dailyBreakdown);
    }
  } catch (err) {
    console.error('Error loading analytics:', err);
  }
}

function renderAnalyticsTable(dailyBreakdown) {
  const tbody = document.getElementById('analytics-table-body');
  if (!dailyBreakdown || dailyBreakdown.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">لا تتوفر سجلات زيارات حالياً. قم بزيارة الموقع لتسجيل أول حركة زوار.</td></tr>`;
    return;
  }

  tbody.innerHTML = dailyBreakdown.map(item => `
    <tr>
      <td><strong>${item.date}</strong></td>
      <td><span class="badge badge-info">${item.views} زيارات</span></td>
      <td><span class="badge badge-success">${item.uniqueVisitors} زائر فريد</span></td>
    </tr>
  `).join('');
}

/* ==================== TAB 2: PROJECTS CRUD ==================== */

async function loadProjects() {
  try {
    const res = await fetch(`${API_BASE}/projects?includeDrafts=true`);
    const data = await res.json();

    if (data.success && data.data) {
      projectsCache = data.data;
      renderProjectsTable(projectsCache);
      document.getElementById('projects-count-badge').textContent = projectsCache.length;
    }
  } catch (err) {
    console.error('Error loading projects:', err);
  }
}

function renderProjectsTable(projects) {
  const tbody = document.getElementById('projects-table-body');
  if (!projects || projects.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">لا توجد مشاريع مضافة حالياً. اضغط "إضافة مشروع جديد" للبدء.</td></tr>`;
    return;
  }

  tbody.innerHTML = projects.map(p => {
    const isPublished = p.status === 'published';
    const statusBadge = isPublished
      ? `<span class="badge badge-success">منشور</span>`
      : `<span class="badge badge-warning">مسودة</span>`;

    const galCount = (p.gallery || p.images || []).length;
    const galleryBadge = galCount > 0
      ? `<span class="badge badge-info"><i class="ri-image-line"></i> ${galCount} صور</span>`
      : `<span class="text-muted"><i class="ri-image-line"></i> 1 (رئيسية)</span>`;

    return `
      <tr>
        <td>
          <img src="${p.coverImage || p.image || 'assets/img/backend_api.webp'}" alt="${p.title}" class="table-img" onerror="this.src='assets/img/backend_api.webp'">
        </td>
        <td>
          <strong>${p.title}</strong>
          ${p.subtitle ? `<br><small class="text-muted">${p.subtitle}</small>` : ''}
        </td>
        <td><span class="badge badge-info">${p.category}</span></td>
        <td><small>${p.date || '-'}</small></td>
        <td>${galleryBadge}</td>
        <td>${statusBadge}</td>
        <td>
          <div class="action-tools">
            <button class="btn btn-icon btn-edit" title="تعديل المشروع" onclick="openEditProjectModal('${p._id || p.id}')">
              <i class="ri-edit-line"></i>
            </button>
            <button class="btn btn-icon btn-delete" title="حذف المشروع" onclick="deleteProject('${p._id || p.id}')">
              <i class="ri-delete-bin-line"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterProjectsTable(query) {
  if (!query) {
    renderProjectsTable(projectsCache);
    return;
  }
  const filtered = projectsCache.filter(p => 
    p.title.toLowerCase().includes(query) ||
    p.category.toLowerCase().includes(query) ||
    (p.description && p.description.toLowerCase().includes(query))
  );
  renderProjectsTable(filtered);
}

function openAddProjectModal() {
  document.getElementById('project-id').value = '';
  document.getElementById('modal-title').innerHTML = `<i class="ri-folder-add-line"></i> إضافة مشروع جديد`;
  document.getElementById('project-form').reset();
  document.getElementById('p-image-url').value = 'assets/img/backend_api.webp';
  document.getElementById('image-preview').src = 'assets/img/backend_api.webp';
  const galEl = document.getElementById('p-gallery-urls');
  if (galEl) galEl.value = '';
  document.getElementById('project-modal').style.display = 'flex';
}

function openEditProjectModal(id) {
  const project = projectsCache.find(p => p._id === id || p.id === id);
  if (!project) return;

  document.getElementById('project-id').value = project._id || project.id;
  document.getElementById('modal-title').innerHTML = `<i class="ri-edit-line"></i> تعديل بيانات المشروع`;

  document.getElementById('p-title').value = project.title || '';
  document.getElementById('p-category').value = project.category || '';
  document.getElementById('p-date').value = project.date || '';
  document.getElementById('p-description').value = project.description || '';
  document.getElementById('p-image-url').value = project.coverImage || project.image || '';
  document.getElementById('p-subtitle').value = project.subtitle || '';
  document.getElementById('p-demo').value = project.demo || '';
  document.getElementById('p-github').value = project.github || '';

  const galUrls = (project.gallery || project.images || []).join(', ');
  const galEl = document.getElementById('p-gallery-urls');
  if (galEl) galEl.value = galUrls;

  document.getElementById('p-technologies').value = Array.isArray(project.technologies) ? project.technologies.join(', ') : (project.technologies || '');
  document.getElementById('p-status').value = project.status || 'published';
  document.getElementById('p-order').value = project.orderIndex || 0;

  document.getElementById('image-preview').src = project.coverImage || project.image || 'assets/img/backend_api.webp';

  document.getElementById('project-modal').style.display = 'flex';
}

function closeProjectModal() {
  document.getElementById('project-modal').style.display = 'none';
}

async function handleImageUpload(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const formData = new FormData();
  formData.append('image', file);

  const token = localStorage.getItem('admin_token');
  const statusText = document.getElementById('upload-status-text');
  statusText.textContent = 'جاري رفع الصورة...';

  try {
    const res = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById('p-image-url').value = data.filePath;
      document.getElementById('image-preview').src = data.filePath;
      statusText.textContent = 'تم رفع الصورة بنجاح!';
      showToast('تم رفع صورة المشروع بنجاح', 'success');
    } else {
      statusText.textContent = 'فشل رفع الصورة';
      showToast(data.message || 'فشل رفع الصورة', 'error');
    }
  } catch (err) {
    console.error('Image upload error:', err);
    statusText.textContent = 'خطأ أثناء رفع الصورة';
  }
}

const projectForm = document.getElementById('project-form');
if (projectForm) {
  projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('project-id').value;
    const token = localStorage.getItem('admin_token');
    const saveBtn = document.getElementById('save-project-btn');

    const cover = document.getElementById('p-image-url').value.trim() || 'assets/img/backend_api.webp';
    
    // Parse gallery URLs
    const rawGal = document.getElementById('p-gallery-urls') ? document.getElementById('p-gallery-urls').value : '';
    const parsedGallery = rawGal
      .split(/[\n,]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const projectPayload = {
      title: document.getElementById('p-title').value.trim(),
      category: document.getElementById('p-category').value.trim(),
      date: document.getElementById('p-date').value.trim(),
      description: document.getElementById('p-description').value.trim(),
      coverImage: cover,
      image: cover,
      gallery: parsedGallery.length > 0 ? parsedGallery : [cover],
      images: parsedGallery.length > 0 ? parsedGallery : [cover],
      subtitle: document.getElementById('p-subtitle').value.trim(),
      demo: document.getElementById('p-demo').value.trim(),
      github: document.getElementById('p-github').value.trim(),
      technologies: document.getElementById('p-technologies').value.trim(),
      status: document.getElementById('p-status').value,
      orderIndex: document.getElementById('p-order').value
    };

    saveBtn.disabled = true;
    saveBtn.innerHTML = `جاري الحفظ... <i class="ri-loader-4-line animate-spin"></i>`;

    try {
      const method = id ? 'PUT' : 'POST';
      const url = id ? `${API_BASE}/projects/${id}` : `${API_BASE}/projects`;

      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(projectPayload)
      });

      const data = await res.json();

      if (data.success) {
        showToast(data.message || 'تم حفظ بيانات المشروع بنجاح', 'success');
        closeProjectModal();
        loadProjects();
        loadAnalytics();
      } else {
        showToast(data.message || 'فشل حفظ البيانات', 'error');
      }
    } catch (err) {
      console.error('Save project error:', err);
      showToast('تعذر الاتصال بالسيرفر لحفظ المشروع', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<i class="ri-save-line"></i> <span>حفظ البيانات</span>`;
    }
  });
}

async function deleteProject(id) {
  if (!confirm('هل أنت تأكد من رغبتك في حذف هذا المشروع نهائياً؟')) return;
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('تم حذف المشروع بنجاح', 'success');
      loadProjects();
      loadAnalytics();
    }
  } catch (err) {
    console.error('Delete error:', err);
  }
}

/* ==================== TAB 3: EXPERIENCE CRUD ==================== */

async function loadExperience() {
  try {
    const res = await fetch(`${API_BASE}/experience`);
    const data = await res.json();
    if (data.success) {
      experienceCache = data.data;
      renderExperienceTable(experienceCache);
    }
  } catch (err) {
    console.error('Load experience error:', err);
  }
}

function renderExperienceTable(list) {
  const tbody = document.getElementById('experience-table-body');
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">لا توجد خبرات عمل مضافة.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(item => `
    <tr>
      <td><strong>${item.title}</strong></td>
      <td><span class="badge badge-info">${item.company}</span></td>
      <td><small>${item.startDate || ''} - ${item.endDate || 'Present'}</small></td>
      <td><small class="text-muted">${item.description || '-'}</small></td>
      <td>${item.orderIndex || 1}</td>
      <td>
        <div class="action-tools">
          <button class="btn btn-icon btn-edit" onclick="openEditExperienceModal('${item._id}')"><i class="ri-edit-line"></i></button>
          <button class="btn btn-icon btn-delete" onclick="deleteExperience('${item._id}')"><i class="ri-delete-bin-line"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val !== undefined && val !== null ? val : '';
}

function openAddExperienceModal() {
  setVal('exp-id', '');
  const titleEl = document.getElementById('exp-modal-title');
  if (titleEl) titleEl.innerHTML = `<i class="ri-briefcase-line"></i> إضافة خبرة عمل جديدة`;
  const form = document.getElementById('experience-form');
  if (form) form.reset();
  const modal = document.getElementById('experience-modal');
  if (modal) modal.style.display = 'flex';
}

function openEditExperienceModal(id) {
  const item = experienceCache.find(x => x._id === id || x.id === id);
  if (!item) return;
  setVal('exp-id', item._id || item.id);
  const titleEl = document.getElementById('exp-modal-title');
  if (titleEl) titleEl.innerHTML = `<i class="ri-edit-line"></i> تعديل خبرة العمل`;
  setVal('exp-title', item.title);
  setVal('exp-company', item.company);
  setVal('exp-start', item.startDate);
  setVal('exp-end', item.endDate);
  setVal('exp-description', item.description);
  setVal('exp-order', item.orderIndex || 1);
  const modal = document.getElementById('experience-modal');
  if (modal) modal.style.display = 'flex';
}

function closeExperienceModal() {
  document.getElementById('experience-modal').style.display = 'none';
}

const expForm = document.getElementById('experience-form');
if (expForm) {
  expForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('exp-id').value;
    const token = localStorage.getItem('admin_token');

    const payload = {
      title: document.getElementById('exp-title').value.trim(),
      company: document.getElementById('exp-company').value.trim(),
      startDate: document.getElementById('exp-start').value.trim(),
      endDate: document.getElementById('exp-end').value.trim(),
      description: document.getElementById('exp-description').value.trim(),
      orderIndex: document.getElementById('exp-order').value
    };

    try {
      const method = id ? 'PUT' : 'POST';
      const url = id ? `${API_BASE}/experience/${id}` : `${API_BASE}/experience`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast('تم حفظ خبرة العمل بنجاح', 'success');
        closeExperienceModal();
        loadExperience();
      }
    } catch (err) {
      console.error('Save experience error:', err);
    }
  });
}

async function deleteExperience(id) {
  if (!confirm('هل تأكد من حذف خبرة العمل هذه؟')) return;
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${API_BASE}/experience/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('تم حذف خبرة العمل بنجاح', 'success');
      loadExperience();
    }
  } catch (err) {
    console.error('Delete experience error:', err);
  }
}

/* ==================== TAB 4: EDUCATION CRUD ==================== */

async function loadEducation() {
  try {
    const res = await fetch(`${API_BASE}/education`);
    const data = await res.json();
    if (data.success) {
      educationCache = data.data;
      renderEducationTable(educationCache);
    }
  } catch (err) {
    console.error('Load education error:', err);
  }
}

function renderEducationTable(list) {
  const tbody = document.getElementById('education-table-body');
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">لا توجد سجلات تعليم مضافة.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(item => `
    <tr>
      <td><strong>${item.degree}</strong></td>
      <td><span class="badge badge-info">${item.institution}</span></td>
      <td><small>${item.startDate || ''} - ${item.endDate || ''}</small></td>
      <td><small class="text-muted">${item.description || '-'}</small></td>
      <td>${item.orderIndex || 1}</td>
      <td>
        <div class="action-tools">
          <button class="btn btn-icon btn-edit" onclick="openEditEducationModal('${item._id}')"><i class="ri-edit-line"></i></button>
          <button class="btn btn-icon btn-delete" onclick="deleteEducation('${item._id}')"><i class="ri-delete-bin-line"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddEducationModal() {
  setVal('edu-id', '');
  const titleEl = document.getElementById('edu-modal-title');
  if (titleEl) titleEl.innerHTML = `<i class="ri-graduation-cap-line"></i> إضافة مؤهل تعليمي`;
  const form = document.getElementById('education-form');
  if (form) form.reset();
  const modal = document.getElementById('education-modal');
  if (modal) modal.style.display = 'flex';
}

function openEditEducationModal(id) {
  const item = educationCache.find(x => x._id === id || x.id === id);
  if (!item) return;
  setVal('edu-id', item._id || item.id);
  const titleEl = document.getElementById('edu-modal-title');
  if (titleEl) titleEl.innerHTML = `<i class="ri-edit-line"></i> تعديل المؤهل التعليمي`;
  setVal('edu-degree', item.degree);
  setVal('edu-institution', item.institution);
  setVal('edu-start', item.startDate);
  setVal('edu-end', item.endDate);
  setVal('edu-description', item.description);
  const modal = document.getElementById('education-modal');
  if (modal) modal.style.display = 'flex';
}

function closeEducationModal() {
  document.getElementById('education-modal').style.display = 'none';
}

const eduForm = document.getElementById('education-form');
if (eduForm) {
  eduForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edu-id').value;
    const token = localStorage.getItem('admin_token');

    const payload = {
      degree: document.getElementById('edu-degree').value.trim(),
      institution: document.getElementById('edu-institution').value.trim(),
      startDate: document.getElementById('edu-start').value.trim(),
      endDate: document.getElementById('edu-end').value.trim(),
      description: document.getElementById('edu-description').value.trim()
    };

    try {
      const method = id ? 'PUT' : 'POST';
      const url = id ? `${API_BASE}/education/${id}` : `${API_BASE}/education`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast('تم حفظ سجل التعليم بنجاح', 'success');
        closeEducationModal();
        loadEducation();
      }
    } catch (err) {
      console.error('Save education error:', err);
    }
  });
}

async function deleteEducation(id) {
  if (!confirm('هل تأكد من حذف المؤهل التعليمي؟')) return;
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${API_BASE}/education/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('تم حذف المؤهل التعليمي بنجax', 'success');
      loadEducation();
    }
  } catch (err) {
    console.error('Delete education error:', err);
  }
}

/* ==================== TAB 5: VOLUNTEERING CRUD ==================== */

async function loadVolunteering() {
  try {
    const res = await fetch(`${API_BASE}/volunteering`);
    const data = await res.json();
    if (data.success) {
      volunteeringCache = data.data;
      renderVolunteeringTable(volunteeringCache);
    }
  } catch (err) {
    console.error('Load volunteering error:', err);
  }
}

function renderVolunteeringTable(list) {
  const tbody = document.getElementById('volunteering-table-body');
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">لا توجد أنشطة تطوعية مضافة.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(item => `
    <tr>
      <td><strong>${item.role}</strong></td>
      <td><span class="badge badge-info">${item.organization}</span></td>
      <td><small>${item.startDate || ''} - ${item.endDate || 'Present'}</small></td>
      <td><small class="text-muted">${item.description || '-'}</small></td>
      <td>
        <div class="action-tools">
          <button class="btn btn-icon btn-edit" onclick="openEditVolunteeringModal('${item._id}')"><i class="ri-edit-line"></i></button>
          <button class="btn btn-icon btn-delete" onclick="deleteVolunteering('${item._id}')"><i class="ri-delete-bin-line"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddVolunteeringModal() {
  setVal('vol-id', '');
  const titleEl = document.getElementById('vol-modal-title');
  if (titleEl) titleEl.innerHTML = `<i class="ri-heart-line"></i> إضافة نشاط تطوعي جديد`;
  const form = document.getElementById('volunteering-form');
  if (form) form.reset();
  const modal = document.getElementById('volunteering-modal');
  if (modal) modal.style.display = 'flex';
}

function openEditVolunteeringModal(id) {
  const item = volunteeringCache.find(x => x._id === id || x.id === id);
  if (!item) return;
  setVal('vol-id', item._id || item.id);
  const titleEl = document.getElementById('vol-modal-title');
  if (titleEl) titleEl.innerHTML = `<i class="ri-edit-line"></i> تعديل النشاط التطوعي`;
  setVal('vol-role', item.role);
  setVal('vol-org', item.organization);
  setVal('vol-start', item.startDate);
  setVal('vol-end', item.endDate);
  setVal('vol-description', item.description);
  const modal = document.getElementById('volunteering-modal');
  if (modal) modal.style.display = 'flex';
}

function closeVolunteeringModal() {
  document.getElementById('volunteering-modal').style.display = 'none';
}

const volForm = document.getElementById('volunteering-form');
if (volForm) {
  volForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('vol-id').value;
    const token = localStorage.getItem('admin_token');

    const payload = {
      role: document.getElementById('vol-role').value.trim(),
      organization: document.getElementById('vol-org').value.trim(),
      startDate: document.getElementById('vol-start').value.trim(),
      endDate: document.getElementById('vol-end').value.trim(),
      description: document.getElementById('vol-description').value.trim()
    };

    try {
      const method = id ? 'PUT' : 'POST';
      const url = id ? `${API_BASE}/volunteering/${id}` : `${API_BASE}/volunteering`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast('تم حفظ النشاط التطوعي بنجاح', 'success');
        closeVolunteeringModal();
        loadVolunteering();
      }
    } catch (err) {
      console.error('Save volunteering error:', err);
    }
  });
}

async function deleteVolunteering(id) {
  if (!confirm('هل تأكد من حذف هذا النشاط التطوعي؟')) return;
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${API_BASE}/volunteering/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('تم حذف النشاط التطوعي بنجاح', 'success');
      loadVolunteering();
    }
  } catch (err) {
    console.error('Delete volunteering error:', err);
  }
}

/* ==================== TAB 6: CERTIFICATES CRUD ==================== */

async function loadCertificates() {
  try {
    const res = await fetch(`${API_BASE}/certificates`);
    const data = await res.json();
    if (data.success && Array.isArray(data.data) && data.data.length > 0) {
      certificatesCache = data.data;
      renderCertificatesTable(certificatesCache);
      return;
    }
  } catch (err) {
    console.warn('API certificates load failed, trying local fallback:', err);
  }

  // Graceful fallback to static work.json
  try {
    const staticRes = await fetch('assets/data/work.json');
    if (staticRes.ok) {
      const staticData = await staticRes.json();
      if (staticData && Array.isArray(staticData.certificates) && staticData.certificates.length > 0) {
        certificatesCache = staticData.certificates.map((x, idx) => ({ ...x, _id: x._id || `cert-${idx}` }));
        renderCertificatesTable(certificatesCache);
        return;
      }
    }
  } catch (e) {}

  renderCertificatesTable(certificatesCache || []);
}

function renderCertificatesTable(list) {
  const tbody = document.getElementById('certificates-table-body');
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">لا توجد شهادات مضافة حالياً.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(item => {
    const fileUrl = item.image || item.pdfFile || item.fileUrl || '';
    const isImg = fileUrl.startsWith('data:image/') || fileUrl.includes('/image/upload/') || fileUrl.includes('/uploads/images/') || /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i.test(fileUrl.split('?')[0]);
    
    let previewBtn = `<span class="text-muted">-</span>`;
    if (fileUrl) {
      if (isImg) {
        previewBtn = `
          <div class="table-btn-group">
            <button type="button" onclick="openLightboxModal('${fileUrl.replace(/'/g, "\\'")}', '${item.name.replace(/'/g, "\\'")}')" class="btn btn-sm btn-info" title="معاينة الصورة"><i class="ri-image-line"></i> معاينة الصورة</button>
            <a href="${fileUrl}" target="_blank" class="btn btn-sm btn-primary" download title="تحميل"><i class="ri-download-line"></i> تحميل</a>
          </div>`;
      } else {
        previewBtn = `
          <div class="table-btn-group">
            <button type="button" onclick="openPdfModal('${fileUrl.replace(/'/g, "\\'")}', '${item.name.replace(/'/g, "\\'")}')" class="btn btn-sm btn-info" title="معاينة PDF"><i class="ri-file-pdf-line"></i> معاينة PDF</button>
            <a href="${API_BASE}/files/download?filePath=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(item.name)}" class="btn btn-sm btn-primary" download title="تحميل"><i class="ri-download-line"></i> تحميل</a>
          </div>`;
      }
    }

    return `
      <tr>
        <td><span class="badge badge-primary">#${item.orderIndex || 1}</span></td>
        <td><strong>${item.name}</strong></td>
        <td><span class="badge badge-info">${item.issuer}</span></td>
        <td><small class="text-muted">${item.issueDate || '-'}</small></td>
        <td>${previewBtn}</td>
        <td>
          <div class="action-tools">
            <button type="button" class="btn btn-icon btn-edit" title="تعديل بيانات الشهادة" onclick="openEditCertificateModal('${item._id}')"><i class="ri-edit-line"></i></button>
            <button type="button" class="btn btn-icon btn-delete" title="حذف الشهادة" onclick="deleteCertificate('${item._id}')"><i class="ri-delete-bin-line"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddCertificateModal() {
  setVal('cert-id', '');
  const titleEl = document.getElementById('cert-modal-title');
  if (titleEl) titleEl.innerHTML = `<i class="ri-award-line"></i> إضافة شهادة جديدة`;
  const form = document.getElementById('certificate-form');
  if (form) form.reset();
  setVal('cert-order', (certificatesCache.length + 1));
  const statusEl = document.getElementById('cert-upload-status');
  if (statusEl) statusEl.textContent = '';
  const modal = document.getElementById('certificate-modal');
  if (modal) modal.style.display = 'flex';
}

function openEditCertificateModal(id) {
  const item = certificatesCache.find(x => x._id === id || x.id === id);
  if (!item) return;
  setVal('cert-id', item._id || item.id);
  const titleEl = document.getElementById('cert-modal-title');
  if (titleEl) titleEl.innerHTML = `<i class="ri-edit-line"></i> تعديل بيانات الشهادة`;
  setVal('cert-name', item.name || item.title || '');
  setVal('cert-issuer', item.issuer || item.subtitle || '');
  setVal('cert-order', item.orderIndex || 1);
  setVal('cert-date', item.issueDate || item.year || '');
  setVal('cert-file', item.image || item.pdfFile || item.fileUrl || '');
  const modal = document.getElementById('certificate-modal');
  if (modal) modal.style.display = 'flex';
}

function closeCertificateModal() {
  document.getElementById('certificate-modal').style.display = 'none';
}

async function handleCertUpload(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const formData = new FormData();
  formData.append('document', file);

  const token = localStorage.getItem('admin_token');
  const statusEl = document.getElementById('cert-upload-status');
  statusEl.textContent = 'جاري رفع ملف الشهادة وتوليد المعاينة...';

  try {
    const res = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('cert-file').value = data.filePath;
      statusEl.textContent = 'تم رفع ملف الشهادة بنجاح!';
      showToast('تم رفع الملف للسيرفر', 'success');

      // If it's a PDF, automatically generate a high-res cover image via pdfjsLib
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        try {
          if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            const fileReader = new FileReader();
            fileReader.onload = async function() {
              try {
                const typedarray = new Uint8Array(this.result);
                const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');
                await page.render({ canvasContext: ctx, viewport: viewport }).promise;

                canvas.toBlob(async (blob) => {
                  if (blob) {
                    const imgFormData = new FormData();
                    const cleanName = file.name.replace(/\.[^/.]+$/, "") + "_preview.webp";
                    imgFormData.append('image', blob, cleanName);

                    const imgRes = await fetch(`${API_BASE}/files/upload`, {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}` },
                      body: imgFormData
                    });
                    const imgData = await imgRes.json();
                    if (imgData.success && imgData.filePath) {
                      window._lastUploadedCertImage = imgData.filePath;
                      statusEl.textContent = '✅ تم رفع الشهادة وتوليد صورة المعاينة بنجاح!';
                    }
                  }
                }, 'image/webp', 0.95);
              } catch (pdfErr) {
                console.warn('PDF thumbnail generation warning:', pdfErr);
              }
            };
            fileReader.readAsArrayBuffer(file);
          }
        } catch (e) {
          console.warn('PDF preview error:', e);
        }
      }
    }
  } catch (err) {
    statusEl.textContent = 'فشل الرفع';
  }
}

const certForm = document.getElementById('certificate-form');
if (certForm) {
  certForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('cert-id').value;
    const token = localStorage.getItem('admin_token');
    const fileVal = document.getElementById('cert-file').value.trim();
    const isImg = fileVal.startsWith('data:image/') || fileVal.includes('/image/upload/') || fileVal.includes('/uploads/images/') || /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i.test(fileVal.split('?')[0]);

    const payload = {
      name: document.getElementById('cert-name').value.trim(),
      issuer: document.getElementById('cert-issuer').value.trim(),
      orderIndex: parseInt(document.getElementById('cert-order').value) || 1,
      issueDate: document.getElementById('cert-date').value.trim(),
      pdfFile: fileVal,
      image: isImg ? fileVal : (window._lastUploadedCertImage || '')
    };

    try {
      const method = id ? 'PUT' : 'POST';
      const url = id ? `${API_BASE}/certificates/${id}` : `${API_BASE}/certificates`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast('تم حفظ الشهادة بنجاح', 'success');
        closeCertificateModal();
        loadCertificates();
      }
    } catch (err) {
      console.error('Save certificate error:', err);
    }
  });
}

async function deleteCertificate(id) {
  if (!confirm('هل تأكد من حذف هذه الشهادة؟')) return;
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${API_BASE}/certificates/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('تم حذف الشهادة بنجاح', 'success');
      loadCertificates();
    }
  } catch (err) {
    console.error('Delete certificate error:', err);
  }
}

/* ==================== TAB 7: TESTIMONIALS CRUD ==================== */

async function loadTestimonials() {
  try {
    const res = await fetch(`${API_BASE}/testimonials?includeDrafts=true`);
    const data = await res.json();
    if (data.success && data.data) {
      testimonialsCache = data.data;
      renderTestimonialsTable(testimonialsCache);
    }
  } catch (err) {
    console.error('Load testimonials error:', err);
  }
}

function renderTestimonialsTable(list) {
  const tbody = document.getElementById('testimonials-table-body');
  if (!tbody) return;
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">لا توجد توصيات أو آراء مضافة. اضغط "إضافة توصية / رأي جديد" للبدء.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(item => {
    const isPublished = item.status === 'published';
    const statusBadge = isPublished
      ? `<span class="badge badge-success">منشور</span>`
      : `<span class="badge badge-warning">مسودة</span>`;

    const starsHtml = '⭐'.repeat(item.rating || 5);
    const platformBadge = `<span class="badge badge-info">${item.platform || 'LinkedIn'}</span>`;
    const snippet = item.content && item.content.length > 55 ? item.content.substring(0, 55) + '...' : (item.content || '-');

    return `
      <tr>
        <td><strong>${item.name}</strong></td>
        <td>
          <span>${item.role}</span>
          ${item.company ? `<br><small class="text-muted">${item.company}</small>` : ''}
        </td>
        <td>${platformBadge}</td>
        <td><small>${starsHtml}</small></td>
        <td><small class="text-muted" title="${item.content || ''}">${snippet}</small></td>
        <td>${statusBadge}</td>
        <td>
          <div class="action-tools">
            <button class="btn btn-icon btn-edit" title="تعديل" onclick="openEditTestimonialModal('${item._id || item.id}')"><i class="ri-edit-line"></i></button>
            <button class="btn btn-icon btn-delete" title="حذف" onclick="deleteTestimonial('${item._id || item.id}')"><i class="ri-delete-bin-line"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddTestimonialModal() {
  document.getElementById('testimonial-id').value = '';
  document.getElementById('testimonial-modal-title').innerHTML = `<i class="ri-chat-quote-line"></i> إضافة توصية / رأي جديد`;
  document.getElementById('testimonial-form').reset();
  document.getElementById('testimonial-modal').style.display = 'flex';
}

function openEditTestimonialModal(id) {
  const item = testimonialsCache.find(x => x._id === id || x.id === id);
  if (!item) return;

  document.getElementById('testimonial-id').value = item._id || item.id;
  document.getElementById('testimonial-modal-title').innerHTML = `<i class="ri-edit-line"></i> تعديل بيانات التوصية`;
  document.getElementById('t-name').value = item.name || '';
  document.getElementById('t-role').value = item.role || '';
  document.getElementById('t-company').value = item.company || '';
  document.getElementById('t-platform').value = item.platform || 'LinkedIn';
  document.getElementById('t-rating').value = item.rating || 5;
  document.getElementById('t-avatar-url').value = item.avatar || '';
  document.getElementById('t-content').value = item.content || '';
  document.getElementById('t-screenshot-url').value = item.screenshotUrl || '';
  document.getElementById('t-status').value = item.status || 'published';
  document.getElementById('t-order').value = item.orderIndex || 0;

  document.getElementById('testimonial-modal').style.display = 'flex';
}

function closeTestimonialModal() {
  document.getElementById('testimonial-modal').style.display = 'none';
}

const testimonialForm = document.getElementById('testimonial-form');
if (testimonialForm) {
  testimonialForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('testimonial-id').value;
    const token = localStorage.getItem('admin_token');
    const saveBtn = document.getElementById('save-testimonial-btn');

    const payload = {
      name: document.getElementById('t-name').value.trim(),
      role: document.getElementById('t-role').value.trim(),
      company: document.getElementById('t-company').value.trim(),
      platform: document.getElementById('t-platform').value,
      rating: Number(document.getElementById('t-rating').value) || 5,
      avatar: document.getElementById('t-avatar-url').value.trim(),
      content: document.getElementById('t-content').value.trim(),
      screenshotUrl: document.getElementById('t-screenshot-url').value.trim(),
      status: document.getElementById('t-status').value,
      orderIndex: Number(document.getElementById('t-order').value) || 0
    };

    saveBtn.disabled = true;
    saveBtn.innerHTML = `جاري الحفظ... <i class="ri-loader-4-line animate-spin"></i>`;

    try {
      const method = id ? 'PUT' : 'POST';
      const url = id ? `${API_BASE}/testimonials/${id}` : `${API_BASE}/testimonials`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'تم حفظ التوصية بنجاح', 'success');
        closeTestimonialModal();
        loadTestimonials();
      } else {
        showToast(data.message || 'فشل حفظ التوصية', 'error');
      }
    } catch (err) {
      console.error('Save testimonial error:', err);
      showToast('خطأ أثناء الاتصال بالسيرفر', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<i class="ri-save-line"></i> <span>حفظ التوصية</span>`;
    }
  });
}

async function deleteTestimonial(id) {
  if (!confirm('هل أنت متأكد من حذف هذه التوصية؟')) return;
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${API_BASE}/testimonials/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('تم حذف التوصية بنجاح', 'success');
      loadTestimonials();
    } else {
      showToast(data.message || 'فشل الحذف', 'error');
    }
  } catch (err) {
    console.error('Delete testimonial error:', err);
    showToast('تعذر حذف التوصية', 'error');
  }
}

/* ==================== TAB 8: CV MANAGEMENT ==================== */

let uploadedCvBase64 = '';

function downloadFileBlob(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download.pdf';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      if (a.parentNode) document.body.removeChild(a);
    } catch (e) {}
  }, 1000);
}

function handleActiveCvView() {
  if (activeCvData && activeCvData._id) {
    window.open(`${API_BASE}/cv/view/${activeCvData._id}`, '_blank');
  } else {
    window.open(`${API_BASE}/cv/view`, '_blank');
  }
}

function handleActiveCvDownload() {
  const url = (activeCvData && activeCvData._id) ? `${API_BASE}/cv/download/${activeCvData._id}` : `${API_BASE}/cv/download`;
  const name = (activeCvData && (activeCvData.originalName || activeCvData.name)) || 'Islam_Shahat_CV.pdf';
  downloadFileBlob(url, name);
}

async function loadCVs() {
  try {
    const res = await fetch(`${API_BASE}/cv`);
    const data = await res.json();
    if (data.success) {
      cvCache = data.data || [];
      activeCvData = cvCache.find(x => x.active) || cvCache[0];
      renderActiveCvBanner(activeCvData);
      renderCvTable(cvCache);
    }
  } catch (err) {
    console.error('Load CV error:', err);
  }
}

function renderActiveCvBanner(cv) {
  if (!cv) {
    document.getElementById('active-cv-name').textContent = 'لا يوجد CV مفعّل حالياً';
    document.getElementById('active-cv-meta').textContent = 'قم برفع ملف PDF وتفعيله كـ CV للموقع';
    return;
  }
  document.getElementById('active-cv-name').textContent = cv.name || cv.originalName || 'Islam_Shahat_CV.pdf';
  document.getElementById('active-cv-meta').textContent = `نسخة ${cv.version || 'v1.0'} | مرفوعة في ${new Date(cv.createdAt || Date.now()).toLocaleDateString('ar-EG')}`;
}

function renderCvTable(list) {
  const tbody = document.getElementById('cv-table-body');
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">لا توجد نسخ CV سابقة.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(cv => {
    const isActive = cv.active;
    const statusBadge = isActive
      ? `<span class="badge badge-success"><i class="ri-checkbox-circle-fill"></i> مفعّل حالياً</span>`
      : `<button class="btn btn-sm btn-secondary" onclick="setActiveCv('${cv._id}')">تفعيل الآن</button>`;

    const formattedDate = new Date(cv.createdAt || Date.now()).toLocaleDateString('ar-EG');
    const dlUrl = `${API_BASE}/cv/download/${cv._id}`;
    const viewUrl = `${API_BASE}/cv/view/${cv._id}`;

    return `
      <tr>
        <td><strong>${cv.name}</strong></td>
        <td><span class="badge badge-info">${cv.version || 'v1.0'}</span></td>
        <td><small class="text-muted">${formattedDate}</small></td>
        <td>${statusBadge}</td>
        <td>
          <div class="action-tools">
            <button class="btn btn-icon btn-edit" title="معاينة" onclick="window.open('${viewUrl}', '_blank')"><i class="ri-eye-line"></i></button>
            <button class="btn btn-icon btn-edit" title="تحميل" onclick="downloadFileBlob('${dlUrl}', '${(cv.originalName || cv.name).replace(/'/g, "\\'")}')"><i class="ri-download-line"></i></button>
            ${!isActive ? `<button class="btn btn-icon btn-delete" title="حذف" onclick="deleteCv('${cv._id}')"><i class="ri-delete-bin-line"></i></button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddCvModal() {
  document.getElementById('cv-form').reset();
  document.getElementById('cv-upload-status').textContent = '';
  uploadedCvBase64 = '';
  document.getElementById('cv-modal').style.display = 'flex';
}

function closeCvModal() {
  document.getElementById('cv-modal').style.display = 'none';
}

async function handleCvUpload(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const formData = new FormData();
  formData.append('cv', file);

  // Read Base64 locally in browser as guaranteed fallback
  const reader = new FileReader();
  reader.onload = function(e) {
    if (e.target.result) {
      uploadedCvBase64 = e.target.result.split(',')[1] || '';
    }
  };
  reader.readAsDataURL(file);

  const token = localStorage.getItem('admin_token');
  const statusEl = document.getElementById('cv-upload-status');
  statusEl.textContent = 'جاري رفع وتخزين ملف السيرة الذاتية...';

  try {
    const res = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('cv-path').value = data.filePath;
      if (!document.getElementById('cv-name').value) {
        document.getElementById('cv-name').value = data.originalName || file.name;
      }
      statusEl.textContent = `تم الرفع بنجاح: ${data.originalName || file.name}`;
      showToast('تم رفع ملف الـ CV بنجاح', 'success');
    }
  } catch (err) {
    statusEl.textContent = 'فشل الرفع';
  }
}

const cvForm = document.getElementById('cv-form');
if (cvForm) {
  cvForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('admin_token');

    const payload = {
      name: document.getElementById('cv-name').value.trim(),
      version: document.getElementById('cv-version').value.trim() || 'v1.0',
      pdfFile: document.getElementById('cv-path').value.trim() || '/assets/pdf/Islam_Shahat_CV.pdf',
      active: document.getElementById('cv-set-active').checked,
      fileData: uploadedCvBase64
    };

    try {
      const res = await fetch(`${API_BASE}/cv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast('تم حفظ وتفعيل الـ CV الجديد بنجاح', 'success');
        closeCvModal();
        loadCVs();
      } else {
        showToast(data.message || 'حدث خطأ أثناء حفظ الـ CV', 'error');
      }
    } catch (err) {
      console.error('Save CV error:', err);
      showToast('تعذر الاتصال بالسيرفر لحفظ الـ CV', 'error');
    }
  });
}

async function setActiveCv(id) {
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${API_BASE}/cv/${id}/active`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('تم تعيين الـ CV كـ مفعّل للموقع', 'success');
      loadCVs();
    }
  } catch (err) {
    console.error('Activate CV error:', err);
  }
}

async function deleteCv(id) {
  if (!confirm('هل أنت متأكد من رغبتك في حذف نسخة الـ CV هذه؟')) return;
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${API_BASE}/cv/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('تم حذف الـ CV بنجاح', 'success');
      loadCVs();
    }
  } catch (err) {
    console.error('Delete CV error:', err);
  }
}

/* ==================== DIRECT NATIVE PDF VIEWER & DOWNLOAD ENGINE ==================== */

const STATIC_ADMIN_CV_PATH = 'assets/pdf/Islam_Shahat_CV.pdf';

/**
 * Resolves any raw PDF path to candidate URLs (API download, API view, direct asset)
 */
function resolveAdminPdfUrls(rawPath, fileName) {
  const targetName = fileName || 'Islam_Shahat_CV.pdf';
  let pathStr = (rawPath || STATIC_ADMIN_CV_PATH).trim();

  if (pathStr.startsWith('http://') || pathStr.startsWith('https://')) {
    return {
      directUrl: pathStr,
      viewUrl: pathStr,
      downloadUrl: pathStr,
      fileName: targetName
    };
  }

  const clean = pathStr.replace(/^[/\\]+/, '');
  const downloadUrl = `${API_BASE}/files/download?filePath=${encodeURIComponent(clean)}&name=${encodeURIComponent(targetName)}`;
  const viewUrl = `${API_BASE}/files/view-pdf?filePath=${encodeURIComponent(clean)}`;
  const directUrl = clean.startsWith('uploads/') ? `/${clean}` : `/${clean}`;

  return {
    clean,
    directUrl,
    viewUrl,
    downloadUrl,
    fileName: targetName
  };
}

/**
 * Direct & Reliable File Downloader for Admin
 */
function downloadFileBlob(url, filename) {
  const targetName = filename || 'Islam_Shahat_CV.pdf';
  try {
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url || `/assets/pdf/Islam_Shahat_CV.pdf`;
    a.download = targetName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { if (a.parentNode) document.body.removeChild(a); } catch (e) {}
    }, 500);
  } catch (err) {
    window.location.href = url || `/assets/pdf/Islam_Shahat_CV.pdf`;
  }
}

function triggerDirectDownload(url, filename) {
  downloadFileBlob(url, filename);
}

/* ==================== STATEFUL HIGH-DPI PDF VIEWER ==================== */
let _adminPdfDoc = null;
let _adminPdfScale = 1.15;
let _adminPdfPath = null;
let _adminPdfName = null;
let _adminPdfMode = 'canvas'; // 'canvas' | 'native'

function openPdfModal(pdfUrl, title, originalFileName) {
  const modal = document.getElementById("pdf-viewer-modal");
  const container = document.getElementById("pdf-modal-container");
  const titleEl = document.getElementById("pdf-modal-title");
  const downloadBtn = document.getElementById("pdf-modal-download-btn");

  if (!modal || !container) return;

  _adminPdfPath = pdfUrl || STATIC_ADMIN_CV_PATH;
  _adminPdfName = originalFileName || (title ? `${title}.pdf` : 'Islam_Shahat_Resume.pdf');
  _adminPdfScale = window.innerWidth < 768 ? 0.8 : 1.15;
  _adminPdfMode = 'canvas';

  const resolved = resolveAdminPdfUrls(_adminPdfPath, _adminPdfName);

  if (titleEl) {
    titleEl.innerHTML = `<i class="ri-file-pdf-2-line text-primary"></i> ${title || _adminPdfName}`;
  }

  if (downloadBtn) {
    downloadBtn.onclick = (e) => {
      e.preventDefault();
      downloadFileBlob(resolved.downloadUrl, _adminPdfName);
    };
  }

  modal.style.display = "flex";
  renderAdminPdfViewerUI(resolved);
}

function renderAdminPdfViewerUI(resolved) {
  const container = document.getElementById('pdf-modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="pdf-modal-toolbar">
      <div class="pdf-toolbar-group">
        <button type="button" class="pdf-tool-btn" onclick="zoomAdminPdfView(-0.15)" title="تصغير">
          <i class="ri-zoom-out-line"></i>
        </button>
        <button type="button" class="pdf-tool-btn" onclick="resetAdminPdfZoom()" title="إعادة ضبط الحجم">
          <span id="admin-pdf-zoom-level">${Math.round(_adminPdfScale * 100)}%</span>
        </button>
        <button type="button" class="pdf-tool-btn" onclick="zoomAdminPdfView(0.15)" title="تكبير">
          <i class="ri-zoom-in-line"></i>
        </button>
        <span id="admin-pdf-page-indicator" class="pdf-page-indicator">جاري التحميل...</span>
      </div>

      <div class="pdf-toolbar-group">
        <button type="button" class="pdf-tool-btn" id="admin-pdf-toggle-btn" onclick="toggleAdminPdfMode()" title="تبديل وضع العرض">
          <i class="ri-pages-line"></i> العرض الأصلي
        </button>
        <a href="${resolved.viewUrl}" target="_blank" class="pdf-tool-btn" title="فتح في نافذة جديدة">
          <i class="ri-external-link-line"></i> نافذة جديدة
        </a>
      </div>
    </div>

    <div id="admin-pdf-viewport" class="pdf-viewport">
      <div class="pdf-loading-state" id="admin-pdf-loading">
        <div class="pdf-loading-spinner"></div>
        <p>جاري معالجة مستند الـ PDF وعرض الصفحات بدقة عالية (HD)...</p>
      </div>
    </div>
  `;

  loadAndRenderAdminPdf(resolved);
}

async function loadAndRenderAdminPdf(resolved) {
  const viewport = document.getElementById('admin-pdf-viewport');
  const pageIndicator = document.getElementById('admin-pdf-page-indicator');
  if (!viewport) return;

  const candidateUrls = [
    resolved.viewUrl,
    resolved.directUrl,
    resolved.downloadUrl,
    `/${STATIC_ADMIN_CV_PATH}`,
    STATIC_ADMIN_CV_PATH
  ].filter(Boolean);

  if (typeof pdfjsLib === 'undefined') {
    renderAdminNativeFallback(resolved);
    return;
  }

  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  } catch (e) {}

  let pdfBuffer = null;

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf && buf.byteLength > 100) {
          pdfBuffer = buf;
          break;
        }
      }
    } catch (e) {}
  }

  try {
    const loadingTask = pdfBuffer
      ? pdfjsLib.getDocument({
          data: pdfBuffer,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/'
        })
      : pdfjsLib.getDocument(resolved.viewUrl || resolved.directUrl);

    _adminPdfDoc = await loadingTask.promise;
    const totalPages = _adminPdfDoc.numPages;

    if (pageIndicator) {
      pageIndicator.textContent = `عدد الصفحات: ${totalPages}`;
    }

    renderAllAdminPdfPages(_adminPdfDoc, _adminPdfScale);
  } catch (err) {
    console.warn('[Admin PDF.js Render Fallback]:', err);
    renderAdminNativeFallback(resolved);
  }
}

async function renderAllAdminPdfPages(pdfDoc, scale) {
  const viewport = document.getElementById('admin-pdf-viewport');
  if (!viewport || !pdfDoc) return;

  viewport.innerHTML = '';
  const dpr = window.devicePixelRatio || 1;

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const initialViewport = page.getViewport({ scale: 1 });

      let effectiveScale = scale;
      if (window.innerWidth < 768) {
        const availableWidth = Math.min(window.innerWidth - 48, 800);
        effectiveScale = (availableWidth / initialViewport.width) * scale;
      }

      const pageViewport = page.getViewport({ scale: effectiveScale });

      const pageBox = document.createElement('div');
      pageBox.className = 'pdf-page-container';

      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-canvas';
      const ctx = canvas.getContext('2d', { alpha: false });

      canvas.width = Math.floor(pageViewport.width * dpr);
      canvas.height = Math.floor(pageViewport.height * dpr);
      canvas.style.width = `${Math.floor(pageViewport.width)}px`;
      canvas.style.height = `${Math.floor(pageViewport.height)}px`;

      ctx.scale(dpr, dpr);
      pageBox.appendChild(canvas);
      viewport.appendChild(pageBox);

      await page.render({
        canvasContext: ctx,
        viewport: pageViewport
      }).promise;
    } catch (err) {
      console.error(`Page ${pageNum} render error:`, err);
    }
  }
}

function renderAdminNativeFallback(resolved) {
  const viewport = document.getElementById('admin-pdf-viewport');
  const toggleBtn = document.getElementById('admin-pdf-toggle-btn');
  const pageIndicator = document.getElementById('admin-pdf-page-indicator');
  if (!viewport) return;

  if (pageIndicator) pageIndicator.textContent = 'العرض المباشر';
  if (toggleBtn) toggleBtn.innerHTML = '<i class="ri-image-line"></i> عرض Canvas HD';

  viewport.innerHTML = `
    <div style="width:100%; height:100%; min-height:75vh; border-radius:8px; overflow:hidden;">
      <iframe src="${resolved.viewUrl}#toolbar=1" style="width:100%; height:100%; min-height:75vh; border:none;" title="PDF Preview">
        <div class="pdf-loading-state">
          <p>تعذر العرض المباشر في المتصفح.</p>
          <button class="btn btn-primary" onclick="downloadFileBlob('${resolved.downloadUrl}', '${_adminPdfName}')">
            <i class="ri-download-line"></i> تحميل ملف الـ PDF
          </button>
        </div>
      </iframe>
    </div>
  `;
}

function zoomAdminPdfView(delta) {
  _adminPdfScale = Math.max(0.5, Math.min(2.5, _adminPdfScale + delta));
  const zoomLevelEl = document.getElementById('admin-pdf-zoom-level');
  if (zoomLevelEl) zoomLevelEl.textContent = `${Math.round(_adminPdfScale * 100)}%`;

  if (_adminPdfDoc && _adminPdfMode === 'canvas') {
    renderAllAdminPdfPages(_adminPdfDoc, _adminPdfScale);
  }
}

function resetAdminPdfZoom() {
  _adminPdfScale = window.innerWidth < 768 ? 0.8 : 1.15;
  const zoomLevelEl = document.getElementById('admin-pdf-zoom-level');
  if (zoomLevelEl) zoomLevelEl.textContent = `${Math.round(_adminPdfScale * 100)}%`;

  if (_adminPdfDoc && _adminPdfMode === 'canvas') {
    renderAllAdminPdfPages(_adminPdfDoc, _adminPdfScale);
  }
}

function toggleAdminPdfMode() {
  const resolved = resolveAdminPdfUrls(_adminPdfPath, _adminPdfName);
  const toggleBtn = document.getElementById('admin-pdf-toggle-btn');

  if (_adminPdfMode === 'canvas') {
    _adminPdfMode = 'native';
    if (toggleBtn) toggleBtn.innerHTML = '<i class="ri-image-line"></i> عرض Canvas HD';
    renderAdminNativeFallback(resolved);
  } else {
    _adminPdfMode = 'canvas';
    if (toggleBtn) toggleBtn.innerHTML = '<i class="ri-pages-line"></i> العرض الأصلي';
    loadAndRenderAdminPdf(resolved);
  }
}

function closePdfModal() {
  const modal = document.getElementById("pdf-viewer-modal");
  const container = document.getElementById("pdf-modal-container");
  if (modal) {
    if (container) container.innerHTML = "";
    modal.style.display = "none";
  }
  _adminPdfDoc = null;
}

function handleActiveCvView() {
  const path = activeCvData ? activeCvData.pdfFile : 'assets/pdf/Islam_Shahat_CV.pdf';
  const name = activeCvData ? (activeCvData.originalName || activeCvData.name) : 'Islam_Shahat_CV.pdf';
  openPdfModal(path, name, name);
}

function handleActiveCvDownload() {
  const path = activeCvData ? activeCvData.pdfFile : 'assets/pdf/Islam_Shahat_CV.pdf';
  const name = activeCvData ? (activeCvData.originalName || activeCvData.name) : 'Islam_Shahat_CV.pdf';
  const cleanName = name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`;
  const downloadUrl = `${API_BASE}/files/download?filePath=${encodeURIComponent(path)}&name=${encodeURIComponent(cleanName)}`;

  downloadFileBlob(downloadUrl, cleanName);
}

/* ==================== TAB 9: SKILLS CRUD WITH FILTERING & SEARCH ==================== */

let currentSkillCategory = 'all';
let currentSkillSearch = '';

async function loadSkills() {
  const tbody = document.getElementById('skills-table-body');
  try {
    const res = await fetch(`${API_BASE}/skills`);
    const data = await res.json();
    if (data.success && Array.isArray(data.data) && data.data.length > 0) {
      skillsCache = data.data;
      updateSkillCategoryCounts();
      applySkillsFilter();
      return;
    }
  } catch (err) {
    console.warn('API skills load failed, trying local fallback:', err);
  }

  // Graceful fallback to static skills.json
  try {
    const staticRes = await fetch('assets/data/skills.json');
    if (staticRes.ok) {
      const staticData = await staticRes.json();
      if (Array.isArray(staticData) && staticData.length > 0) {
        skillsCache = staticData;
        updateSkillCategoryCounts();
        applySkillsFilter();
        return;
      }
    }
  } catch (e) {}

  if (skillsCache && skillsCache.length > 0) {
    updateSkillCategoryCounts();
    applySkillsFilter();
  } else if (tbody) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">لا توجد مهارات مضافة.</td></tr>`;
  }
}

function updateSkillCategoryCounts() {
  const counts = {
    all: skillsCache.length,
    Frontend: 0,
    Backend: 0,
    Database: 0,
    Tools: 0
  };

  skillsCache.forEach(s => {
    const cat = s.category || 'Frontend';
    if (counts[cat] !== undefined) {
      counts[cat]++;
    } else if (cat.toLowerCase().includes('front')) {
      counts.Frontend++;
    } else if (cat.toLowerCase().includes('back')) {
      counts.Backend++;
    } else if (cat.toLowerCase().includes('data')) {
      counts.Database++;
    } else {
      counts.Tools++;
    }
  });

  const allEl = document.getElementById('count-skill-all');
  const frontEl = document.getElementById('count-skill-frontend');
  const backEl = document.getElementById('count-skill-backend');
  const dbEl = document.getElementById('count-skill-database');
  const toolsEl = document.getElementById('count-skill-tools');

  if (allEl) allEl.textContent = counts.all;
  if (frontEl) frontEl.textContent = counts.Frontend;
  if (backEl) backEl.textContent = counts.Backend;
  if (dbEl) dbEl.textContent = counts.Database;
  if (toolsEl) toolsEl.textContent = counts.Tools;
}

function setSkillCategoryFilter(category, buttonEl) {
  currentSkillCategory = category;

  // Update active pill styling
  const pills = document.querySelectorAll('#skill-category-filters .filter-pill');
  pills.forEach(p => p.classList.remove('active'));
  if (buttonEl) {
    buttonEl.classList.add('active');
  }

  applySkillsFilter();
}

function handleSkillSearch(query) {
  currentSkillSearch = (query || '').trim().toLowerCase();
  applySkillsFilter();
}

function applySkillsFilter() {
  let filtered = [...skillsCache];

  // 1. Filter by category
  if (currentSkillCategory !== 'all') {
    filtered = filtered.filter(s => {
      const cat = (s.category || '').toLowerCase();
      const target = currentSkillCategory.toLowerCase();
      return cat === target || cat.includes(target);
    });
  }

  // 2. Filter by search query
  if (currentSkillSearch) {
    filtered = filtered.filter(s => {
      const name = (s.name || '').toLowerCase();
      const cat = (s.category || '').toLowerCase();
      const icon = (s.iconClass || s.icon || '').toLowerCase();
      const level = (s.level || '').toLowerCase();
      return name.includes(currentSkillSearch) || cat.includes(currentSkillSearch) || icon.includes(currentSkillSearch) || level.includes(currentSkillSearch);
    });
  }

  // 3. Smart Sorting: Category order first (Frontend -> Backend -> Database -> Tools), then orderIndex
  const categoryPriority = { 'frontend': 1, 'backend': 2, 'database': 3, 'tools': 4 };
  filtered.sort((a, b) => {
    const prioA = categoryPriority[(a.category || '').toLowerCase()] || 99;
    const prioB = categoryPriority[(b.category || '').toLowerCase()] || 99;
    if (prioA !== prioB) return prioA - prioB;
    return (a.orderIndex || 0) - (b.orderIndex || 0);
  });

  renderSkillsTable(filtered);
}

function renderSkillsTable(list) {
  const tbody = document.getElementById('skills-table-body');
  if (!tbody) return;
  if (!list || list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="padding: 30px 15px;">
          <i class="ri-search-line" style="font-size: 26px; color: var(--color-text-muted); display: block; margin-bottom: 8px;"></i>
          <span class="text-muted">لا توجد مهارات مطابقة للتصنيف أو البحث الحالي.</span>
        </td>
      </tr>
    `;
    return;
  }
  tbody.innerHTML = list.map((item, idx) => {
    const iconClass = item.iconClass || item.icon || 'ri-code-line';
    const isPublished = item.status === 'published' || item.active !== false;
    const categoryBadge = item.category === 'Frontend' ? 'badge-primary'
      : item.category === 'Backend' ? 'badge-info'
      : item.category === 'Database' ? 'badge-warning'
      : 'badge-secondary';

    return `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="badge badge-secondary" style="font-size: 11px;">#${item.orderIndex || (idx + 1)}</span>
          <strong>${item.name}</strong>
        </div>
      </td>
      <td><span class="badge ${categoryBadge}">${item.category}</span></td>
      <td>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="badge badge-success">${item.proficiency || 85}%</span>
          <small class="text-muted">${item.level || 'Advanced'}</small>
        </div>
      </td>
      <td>
        <span style="display: inline-flex; align-items: center; gap: 6px;">
          <i class="${iconClass} font-18" style="color: var(--color-primary);"></i>
          <code style="font-size: 11px; background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px;">${iconClass}</code>
        </span>
      </td>
      <td>${isPublished ? '<span class="badge badge-success"><i class="ri-checkbox-circle-line"></i> نشط</span>' : '<span class="badge badge-danger"><i class="ri-eye-off-line"></i> مخفي</span>'}</td>
      <td>
        <div class="action-tools">
          <button type="button" class="btn btn-icon btn-edit" title="تعديل المهارة" onclick="openEditSkillModal('${item._id}')"><i class="ri-edit-line"></i></button>
          <button type="button" class="btn btn-icon btn-delete" title="حذف المهارة" onclick="deleteSkill('${item._id}')"><i class="ri-delete-bin-line"></i></button>
        </div>
      </td>
    </tr>
  `;
  }).join('');
}

function openAddSkillModal() {
  const form = document.getElementById('skill-form');
  if (form) form.reset();
  document.getElementById('skill-id').value = '';
  document.getElementById('skill-modal-title').innerHTML = `<i class="ri-code-box-line"></i> إضافة مهارة جديدة`;

  // Default category to active filter if specific
  if (document.getElementById('skill-category') && currentSkillCategory !== 'all') {
    document.getElementById('skill-category').value = currentSkillCategory;
  }
  if (document.getElementById('skill-proficiency')) document.getElementById('skill-proficiency').value = 90;
  if (document.getElementById('skill-level')) document.getElementById('skill-level').value = 'Advanced';
  if (document.getElementById('skill-order')) document.getElementById('skill-order').value = (skillsCache.length + 1);
  if (document.getElementById('skill-status')) document.getElementById('skill-status').value = 'published';
  document.getElementById('skill-modal').style.display = 'flex';
}

function openEditSkillModal(id) {
  const item = skillsCache.find(x => x._id === id || String(x._id) === String(id));
  if (!item) return;
  document.getElementById('skill-id').value = item._id;
  document.getElementById('skill-modal-title').innerHTML = `<i class="ri-edit-line"></i> تعديل المهارة: ${item.name || ''}`;
  document.getElementById('skill-name').value = item.name || '';
  document.getElementById('skill-category').value = item.category || 'Frontend';
  if (document.getElementById('skill-level')) {
    document.getElementById('skill-level').value = item.level || 'Advanced';
  }
  if (document.getElementById('skill-proficiency')) {
    document.getElementById('skill-proficiency').value = item.proficiency || 85;
  }
  if (document.getElementById('skill-icon')) {
    document.getElementById('skill-icon').value = item.iconClass || item.icon || '';
  }
  if (document.getElementById('skill-order')) {
    document.getElementById('skill-order').value = item.orderIndex !== undefined ? item.orderIndex : 1;
  }
  if (document.getElementById('skill-status')) {
    document.getElementById('skill-status').value = item.status || (item.active ? 'published' : 'draft');
  }
  document.getElementById('skill-modal').style.display = 'flex';
}

function closeSkillModal() {
  document.getElementById('skill-modal').style.display = 'none';
}

const skillForm = document.getElementById('skill-form');
if (skillForm) {
  skillForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('skill-id').value;
    const token = localStorage.getItem('admin_token');
    const saveBtn = document.getElementById('save-skill-btn') || skillForm.querySelector('button[type="submit"]');

    const name = document.getElementById('skill-name').value.trim();
    if (!name) {
      showToast('يرجى كتابة اسم المهارة', 'error');
      return;
    }

    const payload = {
      name,
      category: document.getElementById('skill-category').value,
      level: document.getElementById('skill-level') ? document.getElementById('skill-level').value : 'Advanced',
      proficiency: document.getElementById('skill-proficiency') ? parseInt(document.getElementById('skill-proficiency').value, 10) : 85,
      icon: document.getElementById('skill-icon') ? document.getElementById('skill-icon').value.trim() : 'ri-code-line',
      iconClass: document.getElementById('skill-icon') ? document.getElementById('skill-icon').value.trim() : 'ri-code-line',
      orderIndex: document.getElementById('skill-order') ? parseInt(document.getElementById('skill-order').value, 10) : 1,
      status: document.getElementById('skill-status') ? document.getElementById('skill-status').value : 'published',
      active: document.getElementById('skill-status') ? (document.getElementById('skill-status').value === 'published') : true
    };

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<i class="ri-loader-4-line animate-spin"></i> جاري الحفظ...`;
    }

    try {
      const method = id ? 'PUT' : 'POST';
      const url = id ? `${API_BASE}/skills/${id}` : `${API_BASE}/skills`;
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(id ? 'تم تحديث المهارة بنجاح' : 'تمت إضافة المهارة بنجاح', 'success');
        closeSkillModal();
        await loadSkills();
      } else {
        showToast(data.message || 'فشل في حفظ المهارة', 'error');
      }
    } catch (err) {
      console.error('Save skill error:', err);
      showToast('حدث خطأ أثناء حفظ المهارة. تأكد من اتصال السيرفر.', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="ri-save-line"></i> حفظ المهارة`;
      }
    }
  });
}

async function deleteSkill(id) {
  if (!confirm('هل أنت متأكد من حذف هذه المهارة؟')) return;
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${API_BASE}/skills/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('تم حذف المهارة بنجاح', 'success');
      await loadSkills();
    } else {
      showToast(data.message || 'فشل في حذف المهارة', 'error');
    }
  } catch (err) {
    console.error('Delete skill error:', err);
    showToast('تعذر الاتصال بالسيرفر لحذف المهارة', 'error');
  }
}

/* ==================== TAB 10: FILE MANAGER ==================== */

async function loadFiles() {
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${API_BASE}/files`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      filesCache = data.data;
      renderFilesTable(filesCache);
    }
  } catch (err) {
    console.error('Load files error:', err);
  }
}

function renderFilesTable(list) {
  const tbody = document.getElementById('files-table-body');
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">لا توجد ملفات مرفوعة بالسيرفر حالياً.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(item => {
    const sizeKb = (item.size / 1024).toFixed(1);
    const formattedDate = new Date(item.createdAt).toLocaleDateString('ar-EG');

    return `
      <tr>
        <td><strong>${item.originalName || item.filename}</strong></td>
        <td><small class="text-muted">${item.path}</small></td>
        <td><span class="badge badge-info">${item.category || 'general'}</span></td>
        <td><small>${sizeKb} KB</small></td>
        <td><small class="text-muted">${formattedDate}</small></td>
        <td>
          <div class="action-tools">
            <a href="${API_BASE}/files/download?filePath=${encodeURIComponent(item.path)}&name=${encodeURIComponent(item.originalName)}" class="btn btn-icon btn-edit" title="تحميل"><i class="ri-download-line"></i></a>
            <button class="btn btn-icon btn-delete" title="حذف" onclick="deleteFileRecord('${item._id}')"><i class="ri-delete-bin-line"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleFileManagerUpload(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const formData = new FormData();
  formData.append('document', file);

  const token = localStorage.getItem('admin_token');

  try {
    const res = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      showToast('تم رفع الملف إلى السيرفر بنجاح', 'success');
      loadFiles();
    } else {
      showToast(data.message || 'فشل رفع الملف', 'error');
    }
  } catch (err) {
    console.error('File upload error:', err);
  }
}

async function deleteFileRecord(id) {
  if (!confirm('هل تأكد من حذف هذا الملف من السيرفر نهائياً؟')) return;
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${API_BASE}/files/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('تم حذف الملف من السيرفر', 'success');
      loadFiles();
    }
  } catch (err) {
    console.error('Delete file error:', err);
  }
}

/* ==================== TAB 11: INQUIRIES & MESSAGES ==================== */

async function loadInquiries() {
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${API_BASE}/inquiries`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      inquiriesCache = data.data;
      renderInquiriesTable(inquiriesCache);
    }
  } catch (err) {
    console.error('Load inquiries error:', err);
  }
}

function renderInquiriesTable(inquiries) {
  const tbody = document.getElementById('inquiries-table-body');
  if (!inquiries || inquiries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">لا توجد رسائل واردة من الزوار حتى الآن.</td></tr>`;
    return;
  }

  tbody.innerHTML = inquiries.map(item => {
    const isUnread = item.status === 'unread';
    const statusBadge = isUnread
      ? `<span class="badge badge-warning">جديدة</span>`
      : `<span class="badge badge-secondary">مقروءة</span>`;

    const formattedDate = new Date(item.createdAt).toLocaleDateString('ar-EG', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return `
      <tr style="${isUnread ? 'font-weight: 600; background: rgba(245, 158, 11, 0.05);' : ''}">
        <td>${item.name}</td>
        <td><a href="mailto:${item.email}" class="text-primary">${item.email}</a></td>
        <td>
          <div style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${item.message}
          </div>
        </td>
        <td><small class="text-muted">${formattedDate}</small></td>
        <td>${statusBadge}</td>
        <td>
          <div class="action-tools">
            <button class="btn btn-icon btn-edit" title="قراءة الرسالة" onclick="openInquiryModal('${item._id}')">
              <i class="ri-mail-open-line"></i>
            </button>
            <button class="btn btn-icon btn-delete" title="حذف الرسالة" onclick="deleteInquiry('${item._id}')">
              <i class="ri-delete-bin-line"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openInquiryModal(id) {
  const item = inquiriesCache.find(i => i._id === id);
  if (!item) return;

  document.getElementById('inq-detail-name').textContent = item.name;
  document.getElementById('inq-detail-email').textContent = item.email;
  document.getElementById('inq-detail-email-link').href = `mailto:${item.email}`;
  document.getElementById('inq-detail-date').textContent = new Date(item.createdAt).toLocaleString('ar-EG');
  document.getElementById('inq-detail-message').textContent = item.message;
  document.getElementById('inq-reply-btn').href = `mailto:${item.email}?subject=RE: ${encodeURIComponent(item.subject || 'Portfolio Inquiry')}`;

  document.getElementById('inquiry-modal').style.display = 'flex';

  if (item.status === 'unread') {
    markInquiryStatus(id, 'read');
  }
}

function closeInquiryModal() {
  document.getElementById('inquiry-modal').style.display = 'none';
}

async function markInquiryStatus(id, status) {
  const token = localStorage.getItem('admin_token');
  try {
    await fetch(`${API_BASE}/inquiries/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    loadInquiries();
    loadAnalytics();
  } catch (err) {
    console.error('Error updating inquiry status:', err);
  }
}

async function deleteInquiry(id) {
  if (!confirm('هل أنت تأكد من حذف هذه الرسالة؟')) return;
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${API_BASE}/inquiries/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('تم حذف الرسالة بنجاح', 'success');
      loadInquiries();
      loadAnalytics();
    }
  } catch (err) {
    console.error('Delete inquiry error:', err);
  }
}

/* ==================== TAB 12: SETTINGS & PASSWORD CHANGE ==================== */

async function handlePasswordChange(e) {
  e.preventDefault();
  const currentPassword = document.getElementById('current-password').value.trim();
  const newPassword = document.getElementById('new-password').value.trim();
  const token = localStorage.getItem('admin_token');
  const saveBtn = document.getElementById('save-password-btn');

  if (newPassword.length < 6) {
    showToast('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل', 'error');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.innerHTML = `جاري الحفظ... <i class="ri-loader-4-line animate-spin"></i>`;

  try {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'تم تغيير كلمة المرور بنجاح', 'success');
      document.getElementById('change-password-form').reset();
    } else {
      showToast(data.message || 'فشل تغيير كلمة المرور', 'error');
    }
  } catch (err) {
    console.error('Change password error:', err);
    showToast('خطأ أثناء التواصل مع السيرفر', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = `<i class="ri-save-line"></i> <span>حفظ التغييرات</span>`;
  }
}

/* ==================== UTILS: TOAST NOTIFICATIONS ==================== */

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="${type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

/* ==================== LIGHTBOX MODAL ==================== */
function openLightboxModal(imageUrl, title) {
  const modal = document.getElementById("image-lightbox-modal");
  const imgEl = document.getElementById("lightbox-modal-img");
  const titleEl = document.getElementById("lightbox-modal-title");
  const downloadBtn = document.getElementById("lightbox-modal-download-btn");

  if (!modal || !imgEl) return;

  if (titleEl) {
    titleEl.innerHTML = `<i class="ri-image-line text-primary"></i> ${title || 'معاينة الصورة'}`;
  }
  imgEl.src = imageUrl;
  if (downloadBtn) {
    downloadBtn.href = imageUrl;
    downloadBtn.download = (title ? `${title.replace(/[^\w\s\u0600-\u06FF-]/g, '_')}.png` : 'certificate.png');
  }
  modal.style.display = "flex";
}

function closeLightboxModal() {
  const modal = document.getElementById("image-lightbox-modal");
  if (modal) {
    modal.style.display = "none";
    const imgEl = document.getElementById("lightbox-modal-img");
    if (imgEl) imgEl.src = "";
  }
}

function closePdfModal() {
  const modal = document.getElementById("pdf-viewer-modal");
  if (modal) modal.style.display = "none";
  const container = document.getElementById("pdf-modal-container");
  if (container) container.innerHTML = "";
}

function toggleSidebarMobile(forceState) {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  if (!sidebar) return;

  if (typeof forceState === 'boolean') {
    if (forceState) {
      sidebar.classList.add("show");
      if (overlay) overlay.style.display = "block";
    } else {
      sidebar.classList.remove("show");
      if (overlay) overlay.style.display = "none";
    }
  } else {
    const isShowing = sidebar.classList.toggle("show");
    if (overlay) overlay.style.display = isShowing ? "block" : "none";
  }
}

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLightboxModal();
    closePdfModal();
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(m => {
      if (m.style.display === 'flex' || m.style.display === 'block') {
        m.style.display = 'none';
      }
    });
  }
});
