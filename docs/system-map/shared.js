// Orquetrador Claude - System Map - Shared JS

const PAGES = [
  { id: 'index', title: 'Home', icon: '🏠', file: 'index.html' },
  { id: 'arquitetura', title: 'Arquitetura', icon: '🏗️', file: '01-arquitetura.html' },
  { id: 'fluxo-dados', title: 'Fluxo de Dados', icon: '🔄', file: '02-fluxo-dados.html' },
  { id: 'banco-dados', title: 'Banco de Dados', icon: '🗄️', file: '03-banco-dados.html' },
  { id: 'api-endpoints', title: 'API Endpoints', icon: '🔌', file: '04-api-endpoints.html' },
  { id: 'motor-execucao', title: 'Motor Execucao', icon: '⚙️', file: '05-motor-execucao.html' },
  { id: 'frontend', title: 'Frontend', icon: '🖥️', file: '06-frontend.html' },
  { id: 'seguranca', title: 'Seguranca', icon: '🔒', file: '07-seguranca.html' },
  { id: 'integracoes', title: 'Integracoes', icon: '🔗', file: '08-integracoes.html' },
  { id: 'mcp-server', title: 'MCP Server', icon: '🤖', file: '09-mcp-server.html' },
  { id: 'tempo-real', title: 'Tempo Real', icon: '📡', file: '10-tempo-real.html' },
  { id: 'workflows', title: 'Workflows', icon: '📋', file: '11-workflows.html' },
  { id: 'conversations', title: 'Conversations', icon: '💬', file: '12-conversations.html' },
  { id: 'skills', title: 'Skills', icon: '🧠', file: '13-skills.html' },
  { id: 'agents', title: 'Agents', icon: '🤖', file: '14-agents.html' },
  { id: 'rules-hooks', title: 'Rules & Hooks', icon: '📐', file: '15-rules-hooks.html' },
  { id: 'plugins', title: 'Plugins', icon: '🧩', file: '16-plugins.html' },
  { id: 'triggers', title: 'Triggers', icon: '⏰', file: '17-triggers.html' },
  { id: 'webhooks', title: 'Webhooks', icon: '🪝', file: '18-webhooks.html' },
  { id: 'auth', title: 'Autenticacao', icon: '🔐', file: '19-auth.html' },
  { id: 'tokens-budget', title: 'Tokens & Budget', icon: '💰', file: '20-tokens-budget.html' },
  { id: 'monitoramento', title: 'Monitoramento', icon: '📊', file: '21-monitoramento.html' },
  { id: 'filas-bullmq', title: 'Filas BullMQ', icon: '📦', file: '22-filas-bullmq.html' },
  { id: 'git-integration', title: 'Git Integration', icon: '📂', file: '23-git-integration.html' },
  { id: 'admin', title: 'Admin', icon: '👑', file: '24-admin.html' },
  { id: 'tags-resources', title: 'Tags & Resources', icon: '🏷️', file: '25-tags-resources.html' },
  { id: 'error-handling', title: 'Error Handling', icon: '🚨', file: '26-error-handling.html' },
  { id: 'dag-executor', title: 'DAG Executor', icon: '🔀', file: '27-dag-executor.html' },
  { id: 'state-machines', title: 'State Machines', icon: '🔄', file: '28-state-machines.html' },
  { id: 'riscos', title: 'Riscos & Melhorias', icon: '⚠️', file: '29-riscos.html' },
  { id: 'glossario', title: 'Glossario', icon: '📖', file: '30-glossario.html' },
];

function getCurrentPageId() {
  const path = window.location.pathname;
  const filename = path.split('/').pop();
  const page = PAGES.find(p => p.file === filename);
  return page ? page.id : 'index';
}

function renderNavBar() {
  const currentId = getCurrentPageId();
  const nav = document.createElement('nav');
  nav.className = 'nav-bar';
  nav.innerHTML = `
    <a href="index.html" class="logo">
      <div class="logo-icon">⚡</div>
      <span>System Map</span>
    </a>
    <div class="nav-links">
      ${PAGES.map(p => `
        <a href="${p.file}" class="${p.id === currentId ? 'active' : ''}" title="${p.title}">
          ${p.icon} ${p.title}
        </a>
      `).join('')}
    </div>
  `;
  document.body.prepend(nav);
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
    btn.style.cssText = 'position:absolute;top:8px;right:8px;background:var(--bg-accent);color:white;border:none;padding:4px 10px;border-radius:6px;font-size:0.75rem;cursor:pointer;opacity:0;transition:opacity 0.2s;font-family:inherit;';
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

// Init all on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  renderNavBar();
  initTabs();
  initAccordions();
  initSearch();
  initScrollAnimations();
  initCodeCopy();
  animateCounters();
  initBadgeFilters();
});
