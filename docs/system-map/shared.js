// Orquetrador Claude - System Map - Shared JS

const PAGES = [
  { id: 'index', title: 'Home', icon: '🏠', file: 'index.html', group: 'home' },
  { id: 'arquitetura', title: 'Arquitetura', icon: '🏗️', file: '01-arquitetura.html', group: 'core' },
  { id: 'fluxo-dados', title: 'Fluxo de Dados', icon: '🔄', file: '02-fluxo-dados.html', group: 'core' },
  { id: 'banco-dados', title: 'Banco de Dados', icon: '🗄️', file: '03-banco-dados.html', group: 'core' },
  { id: 'api-endpoints', title: 'API Endpoints', icon: '🔌', file: '04-api-endpoints.html', group: 'core' },
  { id: 'motor-execucao', title: 'Motor Execucao', icon: '⚙️', file: '05-motor-execucao.html', group: 'core' },
  { id: 'frontend', title: 'Frontend', icon: '🖥️', file: '06-frontend.html', group: 'core' },
  { id: 'seguranca', title: 'Seguranca', icon: '🔒', file: '07-seguranca.html', group: 'infra' },
  { id: 'integracoes', title: 'Integracoes', icon: '🔗', file: '08-integracoes.html', group: 'infra' },
  { id: 'mcp-server', title: 'MCP Server', icon: '🤖', file: '09-mcp-server.html', group: 'infra' },
  { id: 'tempo-real', title: 'Tempo Real', icon: '📡', file: '10-tempo-real.html', group: 'infra' },
  { id: 'workflows', title: 'Workflows', icon: '📋', file: '11-workflows.html', group: 'recursos' },
  { id: 'conversations', title: 'Conversations', icon: '💬', file: '12-conversations.html', group: 'recursos' },
  { id: 'skills', title: 'Skills', icon: '🧠', file: '13-skills.html', group: 'recursos' },
  { id: 'agents', title: 'Agents', icon: '🤖', file: '14-agents.html', group: 'recursos' },
  { id: 'rules-hooks', title: 'Rules & Hooks', icon: '📐', file: '15-rules-hooks.html', group: 'recursos' },
  { id: 'plugins', title: 'Plugins', icon: '🧩', file: '16-plugins.html', group: 'recursos' },
  { id: 'triggers', title: 'Triggers', icon: '⏰', file: '17-triggers.html', group: 'auto' },
  { id: 'webhooks', title: 'Webhooks', icon: '🪝', file: '18-webhooks.html', group: 'auto' },
  { id: 'auth', title: 'Autenticacao', icon: '🔐', file: '19-auth.html', group: 'auto' },
  { id: 'tokens-budget', title: 'Tokens & Budget', icon: '💰', file: '20-tokens-budget.html', group: 'auto' },
  { id: 'monitoramento', title: 'Monitoramento', icon: '📊', file: '21-monitoramento.html', group: 'ops' },
  { id: 'filas-bullmq', title: 'Filas BullMQ', icon: '📦', file: '22-filas-bullmq.html', group: 'ops' },
  { id: 'git-integration', title: 'Git Integration', icon: '📂', file: '23-git-integration.html', group: 'ops' },
  { id: 'admin', title: 'Admin', icon: '👑', file: '24-admin.html', group: 'ops' },
  { id: 'tags-resources', title: 'Tags & Resources', icon: '🏷️', file: '25-tags-resources.html', group: 'ops' },
  { id: 'error-handling', title: 'Error Handling', icon: '🚨', file: '26-error-handling.html', group: 'avancado' },
  { id: 'dag-executor', title: 'DAG Executor', icon: '🔀', file: '27-dag-executor.html', group: 'avancado' },
  { id: 'state-machines', title: 'State Machines', icon: '🔄', file: '28-state-machines.html', group: 'avancado' },
  { id: 'riscos', title: 'Riscos & Melhorias', icon: '⚠️', file: '29-riscos.html', group: 'avancado' },
  { id: 'glossario', title: 'Glossario', icon: '📖', file: '30-glossario.html', group: 'avancado' },
];

const GROUPS = {
  core: { label: 'Core', color: '#0d9488' },
  infra: { label: 'Infraestrutura', color: '#3b82f6' },
  recursos: { label: 'Recursos', color: '#8b5cf6' },
  auto: { label: 'Automacao', color: '#f59e0b' },
  ops: { label: 'Operacoes', color: '#22c55e' },
  avancado: { label: 'Avancado', color: '#ef4444' },
};

function getCurrentPageId() {
  const path = window.location.pathname;
  const filename = path.split('/').pop() || 'index.html';
  const page = PAGES.find(p => p.file === filename);
  return page ? page.id : 'index';
}

function getCurrentPage() {
  const id = getCurrentPageId();
  return PAGES.find(p => p.id === id) || PAGES[0];
}

function getAdjacentPages() {
  const currentId = getCurrentPageId();
  const idx = PAGES.findIndex(p => p.id === currentId);
  return {
    prev: idx > 0 ? PAGES[idx - 1] : null,
    next: idx < PAGES.length - 1 ? PAGES[idx + 1] : null,
  };
}

function renderNavBar() {
  const currentId = getCurrentPageId();
  const currentPage = getCurrentPage();

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    .sm-navbar {
      position: sticky; top: 0; z-index: 9999;
      background: rgba(10, 14, 26, 0.97);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(30, 41, 59, 0.8);
      padding: 0 1.5rem;
      height: 52px;
      display: flex; align-items: center; justify-content: space-between;
      font-family: 'Inter', -apple-system, sans-serif;
    }
    .sm-navbar * { box-sizing: border-box; }
    .sm-nav-left { display: flex; align-items: center; gap: 1rem; }
    .sm-nav-logo {
      display: flex; align-items: center; gap: 0.6rem;
      text-decoration: none; color: #f1f5f9; font-weight: 700; font-size: 0.95rem;
    }
    .sm-nav-logo:hover { color: #2dd4bf; }
    .sm-nav-logo-icon {
      width: 28px; height: 28px; border-radius: 7px;
      background: linear-gradient(135deg, #0d9488, #06b6d4);
      display: flex; align-items: center; justify-content: center;
      font-size: 0.85rem;
    }
    .sm-nav-sep { width: 1px; height: 24px; background: #1e293b; }
    .sm-nav-current {
      display: flex; align-items: center; gap: 0.5rem;
      color: #94a3b8; font-size: 0.8rem;
    }
    .sm-nav-current-title { color: #e2e8f0; font-weight: 600; }
    .sm-nav-right { display: flex; align-items: center; gap: 0.5rem; }
    .sm-nav-btn {
      display: flex; align-items: center; gap: 0.4rem;
      padding: 0.4rem 0.7rem; border-radius: 7px;
      background: none; border: 1px solid #1e293b;
      color: #94a3b8; font-size: 0.75rem; font-weight: 500;
      cursor: pointer; text-decoration: none;
      transition: all 0.2s; font-family: inherit;
    }
    .sm-nav-btn:hover { background: #1e293b; color: #e2e8f0; border-color: #334155; }
    .sm-nav-btn.active { background: rgba(13,148,136,0.15); color: #2dd4bf; border-color: rgba(13,148,136,0.3); }
    .sm-nav-arrows { display: flex; gap: 2px; }
    .sm-nav-arrow {
      width: 32px; height: 32px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      background: none; border: 1px solid #1e293b;
      color: #64748b; cursor: pointer; text-decoration: none;
      transition: all 0.2s; font-size: 0.9rem;
    }
    .sm-nav-arrow:hover { background: #1e293b; color: #e2e8f0; }
    .sm-nav-arrow.disabled { opacity: 0.3; pointer-events: none; }

    /* Mega Menu */
    .sm-mega-overlay {
      display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); z-index: 9998;
    }
    .sm-mega-overlay.open { display: block; }
    .sm-mega {
      display: none; position: fixed; top: 52px; left: 0; right: 0;
      background: rgba(15, 23, 42, 0.98); backdrop-filter: blur(20px);
      border-bottom: 1px solid #1e293b;
      padding: 1.5rem 2rem 2rem;
      z-index: 9999;
      max-height: calc(100vh - 52px); overflow-y: auto;
      animation: smSlideDown 0.2s ease;
    }
    .sm-mega.open { display: block; }
    @keyframes smSlideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
    .sm-mega-grid {
      display: grid; grid-template-columns: repeat(6, 1fr); gap: 1.5rem;
      max-width: 1400px; margin: 0 auto;
    }
    .sm-mega-group-title {
      font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; margin-bottom: 0.75rem; padding-bottom: 0.4rem;
      border-bottom: 2px solid; display: flex; align-items: center; gap: 0.4rem;
    }
    .sm-mega-link {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.4rem 0.6rem; border-radius: 6px;
      text-decoration: none; color: #94a3b8; font-size: 0.8rem;
      transition: all 0.15s; margin-bottom: 2px;
    }
    .sm-mega-link:hover { background: #1e293b; color: #e2e8f0; }
    .sm-mega-link.current { background: rgba(13,148,136,0.15); color: #2dd4bf; font-weight: 600; }
    .sm-mega-link-icon { font-size: 0.9rem; width: 20px; text-align: center; flex-shrink: 0; }
    .sm-mega-link-num { color: #475569; font-size: 0.7rem; font-family: 'JetBrains Mono', monospace; width: 18px; }
    @media (max-width: 1100px) { .sm-mega-grid { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 700px) {
      .sm-mega-grid { grid-template-columns: repeat(2, 1fr); }
      .sm-nav-current { display: none; }
    }
  `;
  document.head.appendChild(style);

  const { prev, next } = getAdjacentPages();
  const pageNum = PAGES.findIndex(p => p.id === currentId);

  const nav = document.createElement('nav');
  nav.className = 'sm-navbar';
  nav.innerHTML = `
    <div class="sm-nav-left">
      <a href="index.html" class="sm-nav-logo">
        <div class="sm-nav-logo-icon">⚡</div>
        <span>System Map</span>
      </a>
      <div class="sm-nav-sep"></div>
      <div class="sm-nav-current">
        <span>${currentPage.icon}</span>
        <span class="sm-nav-current-title">${pageNum > 0 ? String(pageNum).padStart(2, '0') + ' — ' : ''}${currentPage.title}</span>
      </div>
    </div>
    <div class="sm-nav-right">
      <div class="sm-nav-arrows">
        <a href="${prev ? prev.file : '#'}" class="sm-nav-arrow ${!prev ? 'disabled' : ''}" title="${prev ? prev.title : ''}">‹</a>
        <a href="${next ? next.file : '#'}" class="sm-nav-arrow ${!next ? 'disabled' : ''}" title="${next ? next.title : ''}">›</a>
      </div>
      <button class="sm-nav-btn" id="sm-menu-toggle">
        <span>☰</span>
        <span>Paginas</span>
        <span style="background:#1e293b;padding:1px 6px;border-radius:4px;font-size:0.7rem;color:#64748b;">30</span>
      </button>
    </div>
  `;
  document.body.prepend(nav);

  // Mega menu
  const overlay = document.createElement('div');
  overlay.className = 'sm-mega-overlay';
  overlay.id = 'sm-mega-overlay';
  document.body.appendChild(overlay);

  const mega = document.createElement('div');
  mega.className = 'sm-mega';
  mega.id = 'sm-mega-menu';

  let gridHTML = '<div class="sm-mega-grid">';
  for (const [groupId, group] of Object.entries(GROUPS)) {
    const groupPages = PAGES.filter(p => p.group === groupId);
    gridHTML += `<div>
      <div class="sm-mega-group-title" style="color:${group.color};border-color:${group.color}">${group.label}</div>
      ${groupPages.map(p => {
        const num = PAGES.indexOf(p);
        const isCurrent = p.id === currentId;
        return `<a href="${p.file}" class="sm-mega-link ${isCurrent ? 'current' : ''}">
          <span class="sm-mega-link-num">${num > 0 ? String(num).padStart(2, '0') : ''}</span>
          <span class="sm-mega-link-icon">${p.icon}</span>
          <span>${p.title}</span>
        </a>`;
      }).join('')}
    </div>`;
  }
  gridHTML += '</div>';
  mega.innerHTML = gridHTML;
  document.body.appendChild(mega);

  // Toggle menu
  const toggle = document.getElementById('sm-menu-toggle');
  toggle.addEventListener('click', () => {
    mega.classList.toggle('open');
    overlay.classList.toggle('open');
    toggle.classList.toggle('active');
  });
  overlay.addEventListener('click', () => {
    mega.classList.remove('open');
    overlay.classList.remove('open');
    toggle.classList.remove('active');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      mega.classList.remove('open');
      overlay.classList.remove('open');
      toggle.classList.remove('active');
    }
  });
}

function renderBreadcrumb(container, items) {
  container.innerHTML = items.map((item, i) => {
    if (i === items.length - 1) return `<span>${item.label}</span>`;
    return `<a href="${item.href}">${item.label}</a><span>›</span>`;
  }).join('');
}

// Tabs
function initTabs() {
  document.querySelectorAll('.tabs-container').forEach(container => {
    const buttons = container.querySelectorAll('.tab-btn');
    const contents = container.querySelectorAll('.tab-content');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const target = container.querySelector(`#${btn.dataset.tab}`);
        if (target) target.classList.add('active');
      });
    });
  });
}

// Accordions
function initAccordions() {
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      item.classList.toggle('open');
    });
  });
}

// Search/Filter tables
function initSearch() {
  document.querySelectorAll('[data-search-target]').forEach(input => {
    const targetId = input.dataset.searchTarget;
    const table = document.getElementById(targetId);
    if (!table) return;
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase();
      table.querySelectorAll('tbody tr').forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
      });
    });
  });
}

// Animate on scroll
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fade-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.card, .section, .stat-box').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });
}

// Copy code blocks
function initCodeCopy() {
  document.querySelectorAll('.code-block').forEach(block => {
    const btn = document.createElement('button');
    btn.textContent = 'Copiar';
    btn.style.cssText = 'position:absolute;top:8px;right:8px;background:var(--bg-accent,#0d9488);color:white;border:none;padding:4px 10px;border-radius:6px;font-size:0.75rem;cursor:pointer;opacity:0;transition:opacity 0.2s;font-family:inherit;';
    block.style.position = 'relative';
    block.appendChild(btn);
    block.addEventListener('mouseenter', () => btn.style.opacity = '1');
    block.addEventListener('mouseleave', () => btn.style.opacity = '0');
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(block.textContent.replace('Copiar', '').trim());
      btn.textContent = 'Copiado!';
      setTimeout(() => btn.textContent = 'Copiar', 1500);
    });
  });
}

// Page counter / stats animation
function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count);
    const duration = 1200;
    const start = performance.now();
    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased);
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  });
}

// Filter badges
function initBadgeFilters() {
  document.querySelectorAll('[data-filter-group]').forEach(group => {
    const badges = group.querySelectorAll('[data-filter]');
    const targetId = group.dataset.filterGroup;
    const target = document.getElementById(targetId);
    if (!target) return;
    badges.forEach(badge => {
      badge.style.cursor = 'pointer';
      badge.addEventListener('click', () => {
        badges.forEach(b => b.style.opacity = '0.5');
        badge.style.opacity = '1';
        const filter = badge.dataset.filter;
        target.querySelectorAll('[data-category]').forEach(item => {
          item.style.display = (filter === 'all' || item.dataset.category === filter) ? '' : 'none';
        });
      });
    });
  });
}

// Remove duplicate internal navbars from pages that have their own
function removeInternalNavs() {
  // Pages with Tailwind CDN have their own <nav> which conflicts
  const internalNavs = document.querySelectorAll('body > nav:not(.sm-navbar)');
  internalNavs.forEach(nav => {
    // Don't remove if it's the only nav content (some pages use nav for sections)
    if (nav.querySelector('a[href="index.html"]') || nav.querySelector('a[href*="visao-geral"]') || nav.querySelector('a[href*="01-"]')) {
      nav.remove();
    }
  });
}

// Init all on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  renderNavBar();
  removeInternalNavs();
  initTabs();
  initAccordions();
  initSearch();
  initScrollAnimations();
  initCodeCopy();
  animateCounters();
  initBadgeFilters();
});
