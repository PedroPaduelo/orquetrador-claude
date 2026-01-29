// State
let state = {
  workflows: [],
  conversations: [],
  currentConversation: null,
  currentWorkflow: null,
  isExecuting: false,
};

// API helper
async function api(endpoint, options = {}) {
  const headers = { ...options.headers };

  // Only set Content-Type for requests with body
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Toast notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Load workflows
async function loadWorkflows() {
  try {
    state.workflows = await api('/workflows');
    renderWorkflowSelect();
    renderWorkflowsList();
  } catch (error) {
    showToast('Erro ao carregar workflows: ' + error.message, 'error');
  }
}

// Render workflows list in modal
function renderWorkflowsList() {
  const list = document.getElementById('workflows-list');
  if (!list) return;

  if (state.workflows.length === 0) {
    list.innerHTML = '<p class="empty-message">Nenhum workflow criado ainda</p>';
    return;
  }

  list.innerHTML = state.workflows.map(workflow => `
    <div class="workflow-list-item" data-id="${workflow.id}">
      <div class="workflow-list-info">
        <div class="workflow-list-name">${escapeHtml(workflow.name)}</div>
        <div class="workflow-list-meta">
          <span class="workflow-list-type">${workflow.type === 'sequential' ? 'Sequencial' : 'Passo a Passo'}</span>
          <span class="workflow-list-steps">${workflow.step_count || 0} steps</span>
        </div>
        ${workflow.description ? `<div class="workflow-list-desc">${escapeHtml(workflow.description)}</div>` : ''}
      </div>
      <div class="workflow-list-actions">
        <button class="btn btn-sm btn-secondary" onclick="viewWorkflowDetails('${workflow.id}')">Ver</button>
        <button class="btn btn-sm btn-primary" onclick="editWorkflow('${workflow.id}')">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="deleteWorkflow('${workflow.id}')">Excluir</button>
      </div>
    </div>
  `).join('');
}

// View workflow details
async function viewWorkflowDetails(id) {
  try {
    const workflow = await api(`/workflows/${id}`);

    let stepsHtml = '';
    if (workflow.steps && workflow.steps.length > 0) {
      stepsHtml = `
        <div class="workflow-details-steps">
          <h4>Steps:</h4>
          ${workflow.steps.map((step, i) => `
            <div class="workflow-detail-step">
              <strong>${i + 1}. ${escapeHtml(step.name)}</strong>
              <div class="step-url-detail">${escapeHtml(step.base_url)}</div>
              ${step.system_prompt ? `<div class="step-prompt-detail">Prompt: ${escapeHtml(step.system_prompt.substring(0, 100))}${step.system_prompt.length > 100 ? '...' : ''}</div>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    }

    const detailsHtml = `
      <div class="workflow-details">
        <h3>${escapeHtml(workflow.name)}</h3>
        <p><strong>Tipo:</strong> ${workflow.type === 'sequential' ? 'Sequencial' : 'Passo a Passo'}</p>
        ${workflow.description ? `<p><strong>Descrição:</strong> ${escapeHtml(workflow.description)}</p>` : ''}
        ${workflow.project_path ? `<p><strong>Projeto:</strong> <code>${escapeHtml(workflow.project_path)}</code></p>` : ''}
        ${stepsHtml}
      </div>
    `;

    // Show in a simple alert for now, or you could create another modal
    const list = document.getElementById('workflows-list');
    list.innerHTML = `
      <button class="btn btn-sm btn-secondary" onclick="renderWorkflowsList()" style="margin-bottom: 16px">&larr; Voltar</button>
      ${detailsHtml}
    `;
  } catch (error) {
    showToast('Erro ao carregar detalhes: ' + error.message, 'error');
  }
}

// Delete workflow
async function deleteWorkflow(id) {
  if (!confirm('Tem certeza que deseja excluir este workflow? Todas as conversas associadas também serão excluídas.')) {
    return;
  }

  try {
    await api(`/workflows/${id}`, { method: 'DELETE' });
    await loadWorkflows();
    await loadConversations();
    showToast('Workflow excluído com sucesso', 'success');
  } catch (error) {
    showToast('Erro ao excluir workflow: ' + error.message, 'error');
  }
}

// Edit workflow - load data into form
let editingWorkflowId = null;

async function editWorkflow(id) {
  try {
    const workflow = await api(`/workflows/${id}`);

    editingWorkflowId = id;

    // Fill form
    document.getElementById('workflow-name').value = workflow.name;
    document.getElementById('workflow-description').value = workflow.description || '';
    document.getElementById('workflow-type').value = workflow.type;
    document.getElementById('workflow-project-path').value = workflow.project_path || '';

    // Fill steps
    workflowSteps = (workflow.steps || []).map(s => ({
      name: s.name,
      base_url: s.base_url,
      system_prompt: s.system_prompt || '',
      system_prompt_note_id: s.system_prompt_note_id || null,
      context_note_ids: s.context_note_ids || [],
      memory_note_ids: s.memory_note_ids || [],
      conditions: s.conditions || { rules: [], default: 'next' },
      max_retries: s.max_retries || 3,
      backend: s.backend || 'claude',
    }));
    renderWorkflowSteps();

    // Update modal title and button
    document.getElementById('workflow-modal-title').textContent = 'Editar Workflow';
    document.getElementById('workflow-modal-submit').textContent = 'Salvar';

    closeModal('workflows-list-modal');
    openModal('workflow-modal');
  } catch (error) {
    showToast('Erro ao carregar workflow: ' + error.message, 'error');
  }
}

// Save workflow (create or update)
async function saveWorkflow() {
  const name = document.getElementById('workflow-name').value.trim();
  const description = document.getElementById('workflow-description').value.trim();
  const type = document.getElementById('workflow-type').value;
  const projectPath = document.getElementById('workflow-project-path').value.trim();

  if (!name || !type) {
    showToast('Nome e tipo são obrigatórios', 'error');
    return;
  }

  if (workflowSteps.length === 0) {
    showToast('Adicione pelo menos um step', 'error');
    return;
  }

  // Validate steps
  for (let i = 0; i < workflowSteps.length; i++) {
    if (!workflowSteps[i].name || !workflowSteps[i].base_url) {
      showToast(`Step ${i + 1}: Nome e URL são obrigatórios`, 'error');
      return;
    }
  }

  try {
    if (editingWorkflowId) {
      // Update existing
      await api(`/workflows/${editingWorkflowId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name,
          description,
          type,
          project_path: projectPath || null,
          steps: workflowSteps,
        }),
      });
      showToast('Workflow atualizado com sucesso', 'success');
    } else {
      // Create new
      await api('/workflows', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          type,
          project_path: projectPath || null,
          steps: workflowSteps,
        }),
      });
      showToast('Workflow criado com sucesso', 'success');
    }

    closeModal('workflow-modal');
    resetWorkflowForm();
    await loadWorkflows();
  } catch (error) {
    showToast('Erro ao salvar workflow: ' + error.message, 'error');
  }
}

// Load conversations
async function loadConversations() {
  try {
    state.conversations = await api('/conversations');
    renderConversationList();
  } catch (error) {
    showToast('Erro ao carregar conversas: ' + error.message, 'error');
  }
}

// Load conversation
async function loadConversation(id) {
  try {
    state.currentConversation = await api(`/conversations/${id}`);
    state.currentWorkflow = state.workflows.find(w => w.id === state.currentConversation.workflow_id);
    renderChat();
    renderWorkflowPanel();
    updateActiveConversation();
  } catch (error) {
    showToast('Erro ao carregar conversa: ' + error.message, 'error');
  }
}

// Render conversation list
function renderConversationList() {
  const list = document.getElementById('conversation-list');

  if (state.conversations.length === 0) {
    list.innerHTML = '<p class="empty-message">Nenhuma conversa ainda</p>';
    return;
  }

  list.innerHTML = state.conversations.map(conv => `
    <div class="conversation-item ${state.currentConversation?.id === conv.id ? 'active' : ''}"
         data-id="${conv.id}">
      <div class="conversation-item-content" onclick="loadConversation('${conv.id}')">
        <div class="conversation-item-title">${escapeHtml(conv.title)}</div>
        <div class="conversation-item-meta">
          ${conv.workflow_name || 'Sem workflow'} - ${conv.message_count || 0} mensagens
        </div>
      </div>
      <button class="conversation-delete-btn" onclick="event.stopPropagation(); deleteConversation('${conv.id}')" title="Excluir conversa">
        &times;
      </button>
    </div>
  `).join('');
}

// Update active conversation highlight
function updateActiveConversation() {
  document.querySelectorAll('.conversation-item').forEach(item => {
    item.classList.toggle('active', item.dataset.id === state.currentConversation?.id);
  });
}

// Render chat
function renderChat() {
  const container = document.getElementById('chat-container');
  const inputContainer = document.getElementById('input-container');

  if (!state.currentConversation) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Selecione ou crie uma conversa</h3>
        <p>Escolha uma conversa na barra lateral ou crie uma nova</p>
      </div>
    `;
    inputContainer.classList.add('hidden');
    return;
  }

  inputContainer.classList.remove('hidden');

  const messages = state.currentConversation.messages || [];

  if (messages.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Comece a conversa</h3>
        <p>Envie uma mensagem para iniciar</p>
      </div>
    `;
    return;
  }

  container.innerHTML = messages.map(msg => `
    <div class="message ${msg.role}">
      <div class="message-avatar">${msg.role === 'user' ? 'U' : 'C'}</div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-role">${msg.role === 'user' ? 'Você' : 'Claude'}</span>
          ${msg.step_name ? `<span class="message-step">${escapeHtml(msg.step_name)}</span>` : ''}
        </div>
        <div class="message-text">${escapeHtml(msg.content)}</div>
        ${msg.role === 'assistant' && state.currentConversation.workflow_type === 'step_by_step' ? `
          <div class="message-actions">
            <label class="message-select">
              <input type="checkbox"
                     ${msg.selected_for_context ? 'checked' : ''}
                     onchange="toggleMessageContext('${msg.id}', this.checked)">
              Incluir no contexto
            </label>
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// Render workflow panel
function renderWorkflowPanel() {
  const panel = document.getElementById('workflow-panel');

  if (!state.currentConversation) {
    panel.classList.add('hidden');
    return;
  }

  panel.classList.remove('hidden');

  const workflow = state.currentWorkflow;
  const steps = state.currentConversation.steps || [];
  const currentStep = state.currentConversation.current_step;

  document.getElementById('workflow-info').innerHTML = `
    <div class="workflow-name">${workflow ? escapeHtml(workflow.name) : 'Workflow não encontrado'}</div>
    <div class="workflow-type">${workflow?.type === 'sequential' ? 'Sequencial' : 'Passo a Passo'}</div>
    ${workflow?.project_path ? `<div class="workflow-project-path" title="${escapeHtml(workflow.project_path)}">📁 ${escapeHtml(workflow.project_path.split('/').pop())}</div>` : ''}
  `;

  document.getElementById('steps-list').innerHTML = steps.map((step, index) => {
    const isActive = currentStep?.id === step.id;
    const isCompleted = currentStep && step.step_order < currentStep.step_order;

    return `
      <div class="step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}">
        <div class="step-header">
          <div class="step-number">${index + 1}</div>
          <div class="step-name">${escapeHtml(step.name)}</div>
        </div>
        <div class="step-url">${escapeHtml(step.base_url)}</div>
      </div>
    `;
  }).join('');

  // Panel actions
  const actions = document.getElementById('panel-actions');
  if (workflow?.type === 'step_by_step' && currentStep) {
    const canAdvance = steps.findIndex(s => s.id === currentStep.id) < steps.length - 1;
    const canGoBack = steps.findIndex(s => s.id === currentStep.id) > 0;

    actions.innerHTML = `
      <button class="btn btn-secondary" onclick="goBackStep()" ${!canGoBack ? 'disabled' : ''}>
        Voltar Step
      </button>
      <button class="btn btn-primary" onclick="advanceStep()" ${!canAdvance ? 'disabled' : ''}>
        Avançar Step
      </button>
    `;
  } else {
    actions.innerHTML = '';
  }
}

// Render workflow select in modal
function renderWorkflowSelect() {
  const select = document.getElementById('workflow-select');
  if (!select) return;

  select.innerHTML = `
    <option value="">Selecione um workflow</option>
    ${state.workflows.map(w => `
      <option value="${w.id}">${escapeHtml(w.name)} (${w.type === 'sequential' ? 'Sequencial' : 'Passo a Passo'})</option>
    `).join('')}
  `;
}

// Send message with streaming
async function sendMessage() {
  const input = document.getElementById('message-input');
  const content = input.value.trim();

  if (!content || !state.currentConversation) return;

  const sendBtn = document.getElementById('send-btn');
  const cancelBtn = document.getElementById('cancel-btn');

  sendBtn.disabled = true;
  sendBtn.classList.add('hidden');
  cancelBtn.classList.remove('hidden');
  input.disabled = true;
  state.isExecuting = true;

  input.value = '';

  // State for streaming
  let currentStreamingMessage = null;
  let streamingContent = '';
  let streamingActions = [];
  let currentStepName = '';

  try {
    // Use fetch with streaming for SSE
    const response = await fetch(`/api/conversations/${state.currentConversation.id}/messages/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = 'message';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
          continue;
        }
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            handleStreamEvent(currentEvent, data);
          } catch (e) {
            console.error('Error parsing SSE data:', e, line);
          }
        }
      }
    }

  } catch (error) {
    showToast('Erro ao enviar mensagem: ' + error.message, 'error');
  } finally {
    sendBtn.disabled = false;
    sendBtn.classList.remove('hidden');
    cancelBtn.classList.add('hidden');
    input.disabled = false;
    state.isExecuting = false;
    input.focus();

    // Reload conversation to get final state
    await loadConversation(state.currentConversation.id);
  }

  // Process Claude message content array
  function processMessageContent(contentArray, stepName) {
    // Ensure streaming message exists
    const container = document.getElementById('chat-container');
    if (!container.querySelector('.message-streaming-container')) {
      createStreamingMessage(stepName || currentStepName || 'Processando');
    }

    for (const block of contentArray) {
      if (block.type === 'text' && block.text) {
        streamingContent += block.text;
      } else if (block.type === 'thinking' && block.thinking) {
        streamingActions.push({
          type: 'thinking',
          content: block.thinking
        });
      } else if (block.type === 'tool_use') {
        streamingActions.push({
          type: 'tool_use',
          name: block.name || 'unknown',
          input: block.input || {},
          id: block.id
        });
      } else if (block.type === 'tool_result') {
        streamingActions.push({
          type: 'tool_result',
          name: block.name || 'tool',
          output: block.content || '',
          id: block.tool_use_id
        });
      }
    }

    updateStreamingMessage(streamingContent, streamingActions, stepName || currentStepName);
  }

  function handleStreamEvent(eventType, data) {
    const container = document.getElementById('chat-container');

    switch (eventType) {
      case 'user_message':
        // User message saved
        addUserMessage(data);
        break;

      case 'step_start':
        // New step starting
        currentStepName = data.step;
        streamingContent = '';
        streamingActions = [];
        updateStepStatus(data.step, data.step_order, 'processing');
        createStreamingMessage(data.step);

        // Update progress bar
        if (data.total_steps) {
          const steps = state.currentConversation?.steps || [];
          if (steps.length > 0) {
            showWorkflowProgress(steps);
          }
          const retryInfo = data.retry ? { current: data.retry, max: data.max_retries || 3 } : null;
          updateWorkflowProgress(data.step_order - 1, data.total_steps, 'running', retryInfo);
        }
        break;

      case 'stream':
        // Try to find content array in various locations
        let contentArray = null;

        if (data.content && data.content.content && Array.isArray(data.content.content)) {
          contentArray = data.content.content;
        } else if (data.content && Array.isArray(data.content)) {
          contentArray = data.content;
        } else if (data.event && data.event.content && Array.isArray(data.event.content)) {
          contentArray = data.event.content;
        }

        if (contentArray) {
          processMessageContent(contentArray, data.step || currentStepName);
        } else if (data.type === 'content' && typeof data.content === 'string') {
          streamingContent += data.content;
          updateStreamingMessage(streamingContent, streamingActions, data.step || currentStepName);
        } else if (data.type === 'action' && data.action) {
          streamingActions.push(data.action);
          updateStreamingMessage(streamingContent, streamingActions, data.step || currentStepName);
        }
        break;

      case 'message_saved':
        // Message was saved to database
        if (data.role === 'assistant') {
          finalizeStreamingMessage(data);
          streamingContent = '';
          streamingActions = [];
        } else if (data.role === 'system') {
          addSystemMessage(data);
        }
        break;

      case 'step_complete':
        updateStepStatus(data.step, data.step_order, 'completed');
        if (data.step_order && state.currentConversation?.steps?.length) {
          updateWorkflowProgress(data.step_order - 1, state.currentConversation.steps.length, 'completed');
        }
        if (data.finished) {
          setTimeout(hideWorkflowProgress, 2000);
        }
        break;

      case 'condition_retry':
        // Condition triggered a retry
        showToast(`Retry ${data.retry}/${data.max_retries}: ${data.condition_matched}`, 'info');
        updateWorkflowProgress(
          state.currentConversation?.steps?.findIndex(s => s.name === data.step) || 0,
          state.currentConversation?.steps?.length || 1,
          'retry',
          { current: data.retry, max: data.max_retries }
        );
        break;

      case 'condition_jump':
        // Condition triggered a jump to another step
        showToast(`Condição "${data.condition_matched}" → ${data.to_step}`, 'info');
        break;

      case 'max_retries_reached':
        // Max retries reached
        showToast(`Max retries (${data.max_retries}) atingido no step ${data.step}`, 'warning');
        break;

      case 'step_error':
        showToast(`Erro no step ${data.step}: ${data.error}`, 'error');
        break;

      case 'cancelled':
        showToast('Execução cancelada', 'info');
        break;

      case 'error':
        showToast('Erro: ' + (data.error || 'Unknown error'), 'error');
        break;

      case 'complete':
        // All done
        console.log('Stream complete');
        setTimeout(hideWorkflowProgress, 1500);
        break;

      default:
        console.log('Unknown event:', eventType, data);
    }

    container.scrollTop = container.scrollHeight;
  }

  function addUserMessage(msg) {
    const container = document.getElementById('chat-container');

    // Remove empty state if present
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const div = document.createElement('div');
    div.className = 'message user';
    div.innerHTML = `
      <div class="message-avatar">U</div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-role">Você</span>
        </div>
        <div class="message-text">${escapeHtml(msg.content)}</div>
      </div>
    `;
    container.appendChild(div);
  }

  function createStreamingMessage(stepName) {
    const container = document.getElementById('chat-container');

    // Remove previous streaming message if exists
    const existing = container.querySelector('.message-streaming-container');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.className = 'message assistant message-streaming-container';
    div.innerHTML = `
      <div class="message-avatar">C</div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-role">Claude</span>
          <span class="message-step">${escapeHtml(stepName || 'Processando')}</span>
        </div>
        <div class="message-text message-streaming">
          <span class="streaming-content"></span>
          <span class="streaming-cursor">▊</span>
        </div>
        <div class="actions-log">
          <div class="actions-log-header" onclick="toggleActionsLog(this)">
            <span>Ações do Claude</span>
            <span class="actions-log-toggle">▼</span>
          </div>
          <div class="actions-log-content">
            <div class="action-item"><em>Aguardando ações...</em></div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(div);
  }

  function updateStreamingMessage(content, actions, stepName) {
    const container = document.getElementById('chat-container');
    let msgDiv = container.querySelector('.message-streaming-container');

    // Create streaming message if it doesn't exist
    if (!msgDiv) {
      // Remove empty state if present
      const emptyState = container.querySelector('.empty-state');
      if (emptyState) emptyState.remove();

      createStreamingMessage(stepName || 'Processando');
      msgDiv = container.querySelector('.message-streaming-container');
    }

    if (!msgDiv) return; // Safety check

    // Update text content
    const contentEl = msgDiv.querySelector('.streaming-content');
    if (contentEl) {
      contentEl.textContent = typeof content === 'string' ? content : '';
    }

    // Update step name if provided
    if (stepName) {
      const stepTag = msgDiv.querySelector('.message-step');
      if (stepTag) stepTag.textContent = stepName;
    }

    // Update actions log
    const actionsEl = msgDiv.querySelector('.actions-log-content');
    if (actionsEl) {
      if (actions && actions.length > 0) {
        actionsEl.innerHTML = actions.map(action => renderAction(action)).join('');
        actionsEl.scrollTop = actionsEl.scrollHeight;
      } else {
        actionsEl.innerHTML = '<div class="action-item"><em>Aguardando ações...</em></div>';
      }
    }

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  function finalizeStreamingMessage(msg) {
    const container = document.getElementById('chat-container');
    const streamingDiv = container.querySelector('.message-streaming-container');

    if (streamingDiv) {
      streamingDiv.classList.remove('message-streaming-container');
      const textDiv = streamingDiv.querySelector('.message-text');
      if (textDiv) {
        textDiv.classList.remove('message-streaming');
        // Ensure content is a string
        const contentStr = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        textDiv.innerHTML = escapeHtml(contentStr);
      }

      // Remove cursor
      const cursor = streamingDiv.querySelector('.streaming-cursor');
      if (cursor) cursor.remove();

      // Update actions from metadata
      if (msg.metadata) {
        try {
          const meta = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
          if (meta.actions && meta.actions.length > 0) {
            const actionsEl = streamingDiv.querySelector('.actions-log-content');
            if (actionsEl) {
              actionsEl.innerHTML = meta.actions.map(action => renderAction(action)).join('');
            }
          }
        } catch (e) {
          console.error('Error parsing metadata:', e);
        }
      }

      // Add step tag if present
      let stepName = msg.step_name;
      if (!stepName && msg.metadata) {
        try {
          const meta = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
          stepName = meta.step_name;
        } catch (e) {}
      }
      const stepTag = streamingDiv.querySelector('.message-step');
      if (stepTag && stepName) {
        stepTag.textContent = stepName;
      }
    }
  }

  function addSystemMessage(msg) {
    const container = document.getElementById('chat-container');
    const div = document.createElement('div');
    div.className = 'message system';
    div.innerHTML = `
      <div class="message-content">
        <div class="message-text">${escapeHtml(msg.content)}</div>
      </div>
    `;
    container.appendChild(div);
  }

  function updateStepStatus(stepName, stepOrder, status) {
    const stepsContainer = document.getElementById('steps-list');
    if (!stepsContainer) return;

    const stepItems = stepsContainer.querySelectorAll('.step-item');
    stepItems.forEach((item, index) => {
      item.classList.remove('processing', 'completed');
      if (index + 1 === stepOrder) {
        item.classList.add(status);
      } else if (index + 1 < stepOrder) {
        item.classList.add('completed');
      }
    });
  }
}

function renderAction(action) {
  let className = 'action-item';
  let typeLabel = '';
  let content = '';

  switch (action.type) {
    case 'tool_use':
      className += ' tool-use';
      typeLabel = 'Tool';
      content = `<span class="action-name">${escapeHtml(action.name)}</span>`;
      if (action.input) {
        const inputStr = typeof action.input === 'string' ? action.input : JSON.stringify(action.input);
        content += `<div class="action-detail">${escapeHtml(inputStr.substring(0, 200))}${inputStr.length > 200 ? '...' : ''}</div>`;
      }
      break;

    case 'tool_result':
      className += ' tool-result';
      typeLabel = 'Result';
      content = `<span class="action-name">${escapeHtml(action.name || 'Output')}</span>`;
      if (action.output) {
        const outputStr = typeof action.output === 'string' ? action.output : JSON.stringify(action.output);
        content += `<div class="action-detail">${escapeHtml(outputStr.substring(0, 200))}${outputStr.length > 200 ? '...' : ''}</div>`;
      }
      break;

    case 'thinking':
      className += ' thinking';
      typeLabel = 'Thinking';
      if (action.content) {
        content = `<div class="action-detail">${escapeHtml(action.content.substring(0, 300))}${action.content.length > 300 ? '...' : ''}</div>`;
      }
      break;

    case 'error':
      className += ' error';
      typeLabel = 'Error';
      content = `<div class="action-detail">${escapeHtml(action.message || 'Unknown error')}</div>`;
      break;

    case 'stderr':
      className += ' error';
      typeLabel = 'Stderr';
      content = `<div class="action-detail">${escapeHtml(action.content || '')}</div>`;
      break;

    default:
      typeLabel = action.type || 'Event';
      content = `<div class="action-detail">${escapeHtml(JSON.stringify(action).substring(0, 200))}</div>`;
  }

  return `
    <div class="${className}">
      <div class="action-type">${typeLabel}</div>
      ${content}
    </div>
  `;
}

function toggleActionsLog(header) {
  const content = header.nextElementSibling;
  const toggle = header.querySelector('.actions-log-toggle');
  if (content.classList.contains('collapsed')) {
    content.classList.remove('collapsed');
    toggle.textContent = '▼';
  } else {
    content.classList.add('collapsed');
    toggle.textContent = '▶';
  }
}

// Cancel execution
async function cancelExecution() {
  if (!state.currentConversation || !state.isExecuting) return;

  try {
    await api(`/conversations/${state.currentConversation.id}/cancel`, {
      method: 'POST',
    });
    showToast('Execução cancelada', 'success');
  } catch (error) {
    // May fail if already finished, that's ok
    console.log('Cancel request:', error.message);
  }
}

// Toggle message context
async function toggleMessageContext(messageId, selected) {
  try {
    await api(`/messages/${messageId}/select`, {
      method: 'PUT',
      body: JSON.stringify({ selected }),
    });

    // Update local state
    const message = state.currentConversation.messages.find(m => m.id === messageId);
    if (message) {
      message.selected_for_context = selected;
    }
  } catch (error) {
    showToast('Erro ao atualizar contexto: ' + error.message, 'error');
  }
}

// Context selection state
let contextSelectionMessages = [];
let selectedContextIds = new Set();

// Advance step - open context selection modal
async function advanceStep() {
  if (!state.currentConversation) return;

  const currentStep = state.currentConversation.current_step;
  if (!currentStep) {
    showToast('Step atual não encontrado', 'error');
    return;
  }

  try {
    // Load messages from current step for context selection
    const messages = await api(`/conversations/${state.currentConversation.id}/steps/${currentStep.id}/messages`);
    contextSelectionMessages = messages;
    selectedContextIds = new Set();

    renderContextMessages();
    openModal('context-modal');
  } catch (error) {
    showToast('Erro ao carregar mensagens: ' + error.message, 'error');
  }
}

// Render context messages in modal
function renderContextMessages() {
  const list = document.getElementById('context-messages-list');

  if (contextSelectionMessages.length === 0) {
    list.innerHTML = '<p class="empty-message">Nenhuma mensagem neste step</p>';
    updateContextSelectedCount();
    return;
  }

  list.innerHTML = contextSelectionMessages.map(msg => `
    <div class="context-message-item ${selectedContextIds.has(msg.id) ? 'selected' : ''}"
         onclick="toggleContextMessage('${msg.id}')">
      <div class="context-message-checkbox">
        <input type="checkbox"
               ${selectedContextIds.has(msg.id) ? 'checked' : ''}
               onclick="event.stopPropagation(); toggleContextMessage('${msg.id}')">
      </div>
      <div class="context-message-content">
        <div class="context-message-header">
          <span class="context-message-role ${msg.role}">${msg.role === 'user' ? 'Você' : 'Claude'}</span>
        </div>
        <div class="context-message-text">${escapeHtml(msg.content)}</div>
      </div>
    </div>
  `).join('');

  updateContextSelectedCount();
}

// Toggle context message selection
function toggleContextMessage(messageId) {
  if (selectedContextIds.has(messageId)) {
    selectedContextIds.delete(messageId);
  } else {
    selectedContextIds.add(messageId);
  }
  renderContextMessages();
}

// Select all context messages
function selectAllContextMessages() {
  contextSelectionMessages.forEach(msg => selectedContextIds.add(msg.id));
  renderContextMessages();
}

// Deselect all context messages
function deselectAllContextMessages() {
  selectedContextIds.clear();
  renderContextMessages();
}

// Update selected count display
function updateContextSelectedCount() {
  const countEl = document.querySelector('.context-selected-count');
  if (countEl) {
    countEl.textContent = `${selectedContextIds.size} selecionada${selectedContextIds.size !== 1 ? 's' : ''}`;
  }
}

// Confirm advance step with selected context
async function confirmAdvanceStep() {
  if (!state.currentConversation) return;

  try {
    // Save selected messages as context
    await api(`/conversations/${state.currentConversation.id}/select-context`, {
      method: 'POST',
      body: JSON.stringify({ messageIds: Array.from(selectedContextIds) }),
    });

    // Advance to next step
    await api(`/conversations/${state.currentConversation.id}/advance`, {
      method: 'POST',
    });

    closeModal('context-modal');
    await loadConversation(state.currentConversation.id);
    showToast('Step avançado com sucesso', 'success');
  } catch (error) {
    showToast('Erro ao avançar step: ' + error.message, 'error');
  }
}

// Go back step
async function goBackStep() {
  if (!state.currentConversation) return;

  try {
    await api(`/conversations/${state.currentConversation.id}/go-back`, {
      method: 'POST',
    });

    await loadConversation(state.currentConversation.id);
    showToast('Voltou ao step anterior', 'success');
  } catch (error) {
    showToast('Erro ao voltar step: ' + error.message, 'error');
  }
}

// Modal functions
function openModal(modalId) {
  document.getElementById(modalId).classList.remove('hidden');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

// Create workflow
let workflowSteps = [];

function addWorkflowStep() {
  workflowSteps.push({
    name: '',
    base_url: '',
    system_prompt: '',
    system_prompt_note_id: null,
    context_note_ids: [],
    memory_note_ids: [],
    conditions: { rules: [], default: 'next' },
    max_retries: 3,
    backend: 'claude',
  });
  renderWorkflowSteps();
}

function removeWorkflowStep(index) {
  workflowSteps.splice(index, 1);
  renderWorkflowSteps();
}

function updateWorkflowStep(index, field, value) {
  workflowSteps[index][field] = value;
}

function renderWorkflowSteps() {
  const container = document.getElementById('workflow-steps-editor');

  container.innerHTML = workflowSteps.map((step, index) => `
    <div class="step-editor-item">
      <div class="step-editor-header">
        <span>Step ${index + 1}</span>
        <button type="button" class="btn btn-sm btn-danger" onclick="removeWorkflowStep(${index})">Remover</button>
      </div>
      <div class="step-editor-fields">
        <input type="text" placeholder="Nome do step" value="${escapeHtml(step.name)}"
               onchange="updateWorkflowStep(${index}, 'name', this.value)">
        <input type="text" placeholder="URL base (ex: https://api.example.com)" value="${escapeHtml(step.base_url)}"
               onchange="updateWorkflowStep(${index}, 'base_url', this.value)">
        <textarea placeholder="System prompt (opcional)"
                  onchange="updateWorkflowStep(${index}, 'system_prompt', this.value)">${escapeHtml(step.system_prompt)}</textarea>
      </div>
    </div>
  `).join('');
}

async function createWorkflow() {
  // Use saveWorkflow for both create and update
  await saveWorkflow();
}

function resetWorkflowForm() {
  editingWorkflowId = null;
  document.getElementById('workflow-name').value = '';
  document.getElementById('workflow-description').value = '';
  document.getElementById('workflow-type').value = 'sequential';
  document.getElementById('workflow-project-path').value = '';
  workflowSteps = [];
  renderWorkflowSteps();

  // Reset modal title and button
  const titleEl = document.getElementById('workflow-modal-title');
  const submitEl = document.getElementById('workflow-modal-submit');
  if (titleEl) titleEl.textContent = 'Criar Workflow';
  if (submitEl) submitEl.textContent = 'Criar Workflow';
}

// Create conversation
async function createConversation() {
  const workflowId = document.getElementById('workflow-select').value;
  const title = document.getElementById('conversation-title').value.trim();

  if (!workflowId) {
    showToast('Selecione um workflow', 'error');
    return;
  }

  try {
    const conversation = await api('/conversations', {
      method: 'POST',
      body: JSON.stringify({
        workflow_id: workflowId,
        title: title || undefined,
      }),
    });

    closeModal('conversation-modal');
    document.getElementById('workflow-select').value = '';
    document.getElementById('conversation-title').value = '';

    await loadConversations();
    await loadConversation(conversation.id);
    showToast('Conversa criada com sucesso', 'success');
  } catch (error) {
    showToast('Erro ao criar conversa: ' + error.message, 'error');
  }
}

// Delete conversation
async function deleteConversation(id) {
  if (!confirm('Tem certeza que deseja deletar esta conversa?')) return;

  try {
    await api(`/conversations/${id}`, { method: 'DELETE' });

    if (state.currentConversation?.id === id) {
      state.currentConversation = null;
      renderChat();
      renderWorkflowPanel();
    }

    await loadConversations();
    showToast('Conversa deletada', 'success');
  } catch (error) {
    showToast('Erro ao deletar conversa: ' + error.message, 'error');
  }
}

// Escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Handle Enter key in message input
function handleMessageKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

// ============================================
// SMART NOTES INTEGRATION
// ============================================

let allNotes = [];
let allFolders = [];
let selectedNoteIds = new Set();
let notesModalMode = 'single'; // 'single' or 'multiple'
let notesModalCallback = null;
let currentEditingStepIndex = null;
let currentNoteField = null; // 'system_prompt', 'context', 'memory'

// Load Smart Notes data
async function loadSmartNotesData() {
  try {
    const [foldersRes, notesRes] = await Promise.all([
      fetch('/api/smart-notes/folders').then(r => r.json()).catch(() => []),
      fetch('/api/smart-notes/notes').then(r => r.json()).catch(() => []),
    ]);
    allFolders = Array.isArray(foldersRes) ? foldersRes : [];
    allNotes = Array.isArray(notesRes) ? notesRes : [];
  } catch (error) {
    console.error('Error loading Smart Notes:', error);
    allFolders = [];
    allNotes = [];
  }
}

// Open notes modal
function openNotesModal(mode = 'single', field = 'system_prompt', stepIndex = null, callback = null) {
  notesModalMode = mode;
  notesModalCallback = callback;
  currentEditingStepIndex = stepIndex;
  currentNoteField = field;
  selectedNoteIds.clear();

  // Pre-select existing notes if editing
  if (stepIndex !== null && workflowSteps[stepIndex]) {
    const step = workflowSteps[stepIndex];
    if (field === 'system_prompt' && step.system_prompt_note_id) {
      selectedNoteIds.add(step.system_prompt_note_id);
    } else if (field === 'context' && step.context_note_ids) {
      step.context_note_ids.forEach(id => selectedNoteIds.add(id));
    } else if (field === 'memory' && step.memory_note_ids) {
      step.memory_note_ids.forEach(id => selectedNoteIds.add(id));
    }
  }

  const titleMap = {
    'system_prompt': 'Selecionar System Prompt',
    'context': 'Selecionar Notas de Contexto',
    'memory': 'Selecionar Notas de Memória',
  };
  document.getElementById('notes-modal-title').textContent = titleMap[field] || 'Selecionar Nota';

  renderFolderFilter();
  renderNotesList();
  updateNotesSelectedCount();
  openModal('notes-modal');
}

function closeNotesModal() {
  closeModal('notes-modal');
  hideNotePreview();
}

function renderFolderFilter() {
  const select = document.getElementById('notes-folder-filter');
  select.innerHTML = `
    <option value="">Todas as pastas</option>
    ${allFolders.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('')}
  `;
}

function renderNotesList(filteredNotes = null) {
  const list = document.getElementById('notes-list');
  const notes = filteredNotes || allNotes;

  if (notes.length === 0) {
    list.innerHTML = '<p class="empty-message">Nenhuma nota encontrada</p>';
    return;
  }

  list.innerHTML = notes.map(note => {
    const folder = allFolders.find(f => f.id === note.folderId);
    const isSelected = selectedNoteIds.has(note.id);
    const preview = (note.content || note.contentPreview || '').substring(0, 100);

    return `
      <div class="note-item ${isSelected ? 'selected' : ''}" data-note-id="${note.id}" onclick="toggleNoteSelection('${note.id}')">
        <div class="note-item-checkbox">
          <input type="${notesModalMode === 'single' ? 'radio' : 'checkbox'}"
                 name="note-selection"
                 ${isSelected ? 'checked' : ''}
                 onclick="event.stopPropagation(); toggleNoteSelection('${note.id}')">
        </div>
        <div class="note-item-content">
          <div class="note-item-title">${escapeHtml(note.title)}</div>
          ${folder ? `<div class="note-item-folder">📁 ${escapeHtml(folder.name)}</div>` : ''}
          <div class="note-item-preview">${escapeHtml(preview)}${preview.length >= 100 ? '...' : ''}</div>
        </div>
        <div class="note-item-actions">
          <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); previewNote('${note.id}')">Preview</button>
        </div>
      </div>
    `;
  }).join('');
}

function toggleNoteSelection(noteId) {
  if (notesModalMode === 'single') {
    selectedNoteIds.clear();
    selectedNoteIds.add(noteId);
  } else {
    if (selectedNoteIds.has(noteId)) {
      selectedNoteIds.delete(noteId);
    } else {
      selectedNoteIds.add(noteId);
    }
  }
  renderNotesList();
  updateNotesSelectedCount();
}

function updateNotesSelectedCount() {
  document.getElementById('notes-selected-count').textContent =
    `${selectedNoteIds.size} selecionada(s)`;
}

function filterNotes(query) {
  if (!query) {
    renderNotesList();
    return;
  }
  const filtered = allNotes.filter(n =>
    n.title.toLowerCase().includes(query.toLowerCase()) ||
    (n.content || '').toLowerCase().includes(query.toLowerCase())
  );
  renderNotesList(filtered);
}

function filterNotesByFolder(folderId) {
  if (!folderId) {
    renderNotesList();
    return;
  }
  const filtered = allNotes.filter(n => n.folderId === folderId);
  renderNotesList(filtered);
}

async function previewNote(noteId) {
  try {
    const note = await fetch(`/api/smart-notes/notes/${noteId}`).then(r => r.json());
    document.getElementById('note-preview-content').textContent = note.content || 'Sem conteúdo';
    document.getElementById('note-preview').classList.remove('hidden');
  } catch {
    showToast('Erro ao carregar preview', 'error');
  }
}

function hideNotePreview() {
  document.getElementById('note-preview').classList.add('hidden');
}

function confirmNoteSelection() {
  if (currentEditingStepIndex !== null && workflowSteps[currentEditingStepIndex]) {
    const step = workflowSteps[currentEditingStepIndex];
    const ids = Array.from(selectedNoteIds);

    if (currentNoteField === 'system_prompt') {
      step.system_prompt_note_id = ids[0] || null;
      step.system_prompt = ''; // Clear text prompt when using note
    } else if (currentNoteField === 'context') {
      step.context_note_ids = ids;
    } else if (currentNoteField === 'memory') {
      step.memory_note_ids = ids;
    }

    renderWorkflowSteps();
  }

  if (notesModalCallback) {
    notesModalCallback(Array.from(selectedNoteIds));
  }

  closeNotesModal();
}

// ============================================
// CONDITIONS EDITOR
// ============================================

let editingConditionsStepIndex = null;
let conditionRules = [];

function openConditionsModal(stepIndex) {
  editingConditionsStepIndex = stepIndex;
  const step = workflowSteps[stepIndex];

  // Load existing conditions
  if (step.conditions && step.conditions.rules) {
    conditionRules = JSON.parse(JSON.stringify(step.conditions.rules));
  } else {
    conditionRules = [];
  }

  // Set default action
  const defaultAction = step.conditions?.default || 'next';
  document.getElementById('conditions-default-action').value = defaultAction;

  // Populate steps dropdown for goto options
  renderConditionRules();
  openModal('conditions-modal');
}

function closeConditionsModal() {
  closeModal('conditions-modal');
  editingConditionsStepIndex = null;
  conditionRules = [];
}

function renderConditionRules() {
  const container = document.getElementById('conditions-rules');

  if (conditionRules.length === 0) {
    container.innerHTML = '<p class="empty-message">Nenhuma regra configurada. Clique em "Adicionar Regra" para começar.</p>';
    return;
  }

  container.innerHTML = conditionRules.map((rule, index) => `
    <div class="condition-rule" data-index="${index}">
      <div class="condition-rule-header">
        <span>Regra ${index + 1}</span>
        <button class="btn btn-sm btn-danger" onclick="removeConditionRule(${index})">Remover</button>
      </div>
      <div class="condition-rule-fields">
        <div class="form-group">
          <label>Tipo de condição</label>
          <select onchange="updateConditionRule(${index}, 'type', this.value)">
            <option value="contains" ${rule.type === 'contains' ? 'selected' : ''}>Output contém</option>
            <option value="not_contains" ${rule.type === 'not_contains' ? 'selected' : ''}>Output NÃO contém</option>
            <option value="equals" ${rule.type === 'equals' ? 'selected' : ''}>Output igual a</option>
            <option value="starts_with" ${rule.type === 'starts_with' ? 'selected' : ''}>Output começa com</option>
            <option value="ends_with" ${rule.type === 'ends_with' ? 'selected' : ''}>Output termina com</option>
            <option value="regex" ${rule.type === 'regex' ? 'selected' : ''}>Regex</option>
          </select>
        </div>
        <div class="form-group">
          <label>Valor para corresponder</label>
          <input type="text" value="${escapeHtml(rule.match || '')}"
                 onchange="updateConditionRule(${index}, 'match', this.value)"
                 placeholder="Ex: FAIL, ERRO, PASS">
        </div>
        <div class="form-group">
          <label>Ação quando corresponder</label>
          <select onchange="updateConditionRule(${index}, 'goto', this.value)">
            <option value="next" ${rule.goto === 'next' ? 'selected' : ''}>Avançar para próximo</option>
            <option value="retry" ${rule.goto === 'retry' ? 'selected' : ''}>Repetir este step (retry)</option>
            <option value="previous" ${rule.goto === 'previous' ? 'selected' : ''}>Voltar para anterior</option>
            <option value="finish" ${rule.goto === 'finish' ? 'selected' : ''}>Finalizar workflow</option>
            ${workflowSteps.map((s, i) =>
              `<option value="${i + 1}" ${rule.goto === String(i + 1) ? 'selected' : ''}>Ir para Step ${i + 1}: ${escapeHtml(s.name || 'Sem nome')}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Max retries (se retry)</label>
          <input type="number" value="${rule.max_retries || 3}" min="1" max="10"
                 onchange="updateConditionRule(${index}, 'max_retries', parseInt(this.value))">
        </div>
        <textarea placeholder="Mensagem de retry (opcional). Use {error} para incluir o output."
                  onchange="updateConditionRule(${index}, 'retry_message', this.value)">${escapeHtml(rule.retry_message || '')}</textarea>
      </div>
    </div>
  `).join('');
}

function addConditionRule() {
  conditionRules.push({
    type: 'contains',
    match: '',
    goto: 'next',
    max_retries: 3,
    retry_message: '',
  });
  renderConditionRules();
}

function removeConditionRule(index) {
  conditionRules.splice(index, 1);
  renderConditionRules();
}

function updateConditionRule(index, field, value) {
  conditionRules[index][field] = value;
}

function saveConditions() {
  if (editingConditionsStepIndex === null) return;

  const defaultAction = document.getElementById('conditions-default-action').value;

  workflowSteps[editingConditionsStepIndex].conditions = {
    rules: conditionRules,
    default: defaultAction,
  };

  renderWorkflowSteps();
  closeConditionsModal();
  showToast('Condições salvas', 'success');
}

// ============================================
// WORKFLOW PROGRESS BAR
// ============================================

function showWorkflowProgress(steps) {
  const progressContainer = document.getElementById('workflow-progress');
  const stepsContainer = document.getElementById('progress-steps');

  stepsContainer.innerHTML = steps.map((step, i) => `
    <div class="progress-step pending" data-step-index="${i}">
      <div class="progress-step-number">${i + 1}</div>
      <div class="progress-step-name">${escapeHtml(step.name)}</div>
    </div>
  `).join('');

  document.getElementById('progress-bar').style.width = '0%';
  document.getElementById('progress-status').textContent = 'Iniciando...';
  progressContainer.classList.remove('hidden');
}

function updateWorkflowProgress(stepIndex, totalSteps, status, retryInfo = null) {
  const stepsContainer = document.getElementById('progress-steps');
  const progressBar = document.getElementById('progress-bar');
  const progressStatus = document.getElementById('progress-status');

  // Update step statuses
  const stepElements = stepsContainer.querySelectorAll('.progress-step');
  stepElements.forEach((el, i) => {
    el.classList.remove('pending', 'running', 'completed', 'retry', 'failed');
    if (i < stepIndex) {
      el.classList.add('completed');
    } else if (i === stepIndex) {
      el.classList.add(status);
      if (retryInfo) {
        let retryLabel = el.querySelector('.progress-step-retry');
        if (!retryLabel) {
          retryLabel = document.createElement('span');
          retryLabel.className = 'progress-step-retry';
          el.appendChild(retryLabel);
        }
        retryLabel.textContent = `(${retryInfo.current}/${retryInfo.max})`;
      }
    } else {
      el.classList.add('pending');
    }
  });

  // Update progress bar
  const progress = ((stepIndex + (status === 'completed' ? 1 : 0.5)) / totalSteps) * 100;
  progressBar.style.width = `${Math.min(progress, 100)}%`;

  // Update status text
  const statusMessages = {
    running: `Executando step ${stepIndex + 1} de ${totalSteps}...`,
    retry: `Retry no step ${stepIndex + 1}...`,
    completed: stepIndex + 1 === totalSteps ? 'Workflow completo!' : `Step ${stepIndex + 1} completo`,
    failed: `Erro no step ${stepIndex + 1}`,
  };
  progressStatus.textContent = statusMessages[status] || '';
}

function hideWorkflowProgress() {
  document.getElementById('workflow-progress').classList.add('hidden');
}

// ============================================
// ENHANCED STEP EDITOR
// ============================================

function renderWorkflowSteps() {
  const container = document.getElementById('workflow-steps-editor');

  container.innerHTML = workflowSteps.map((step, index) => {
    const hasSystemPromptNote = !!step.system_prompt_note_id;
    const systemPromptNote = hasSystemPromptNote ? allNotes.find(n => n.id === step.system_prompt_note_id) : null;
    const contextNotes = (step.context_note_ids || []).map(id => allNotes.find(n => n.id === id)).filter(Boolean);
    const hasConditions = step.conditions && step.conditions.rules && step.conditions.rules.length > 0;

    return `
      <div class="step-editor-item">
        <div class="step-editor-header">
          <span>Step ${index + 1}</span>
          <button type="button" class="btn btn-sm btn-danger" onclick="removeWorkflowStep(${index})">Remover</button>
        </div>
        <div class="step-editor-fields">
          <div class="step-editor-row">
            <input type="text" placeholder="Nome do step" value="${escapeHtml(step.name)}"
                   onchange="updateWorkflowStep(${index}, 'name', this.value)">
            <input type="text" placeholder="URL base" value="${escapeHtml(step.base_url)}"
                   onchange="updateWorkflowStep(${index}, 'base_url', this.value)">
          </div>

          <div class="form-group">
            <label style="font-size: 0.75rem; color: var(--text-secondary);">System Prompt</label>
            <div class="step-prompt-source">
              <label>
                <input type="radio" name="prompt-source-${index}"
                       ${!hasSystemPromptNote ? 'checked' : ''}
                       onchange="setPromptSource(${index}, 'text')">
                Texto direto
              </label>
              <label>
                <input type="radio" name="prompt-source-${index}"
                       ${hasSystemPromptNote ? 'checked' : ''}
                       onchange="setPromptSource(${index}, 'note')">
                Smart Notes
              </label>
            </div>

            ${!hasSystemPromptNote ? `
              <textarea placeholder="System prompt (opcional)"
                        onchange="updateWorkflowStep(${index}, 'system_prompt', this.value)">${escapeHtml(step.system_prompt || '')}</textarea>
            ` : `
              <div class="step-note-selector">
                <div class="selected-note has-note">
                  📝 ${systemPromptNote ? escapeHtml(systemPromptNote.title) : 'Nota selecionada'}
                </div>
                <button type="button" class="btn btn-sm btn-secondary" onclick="openNotesModal('single', 'system_prompt', ${index})">
                  Trocar
                </button>
                <button type="button" class="btn btn-sm btn-secondary" onclick="clearStepNote(${index}, 'system_prompt')">
                  Limpar
                </button>
              </div>
            `}
          </div>

          <div class="form-group">
            <label style="font-size: 0.75rem; color: var(--text-secondary);">
              Contexto (Smart Notes)
              <button type="button" class="btn btn-sm btn-secondary" style="margin-left: 8px;"
                      onclick="openNotesModal('multiple', 'context', ${index})">
                + Adicionar
              </button>
            </label>
            ${contextNotes.length > 0 ? `
              <div class="step-context-tags">
                ${contextNotes.map(n => `
                  <span class="context-tag">
                    ${escapeHtml(n.title)}
                    <button type="button" onclick="removeContextNote(${index}, '${n.id}')">&times;</button>
                  </span>
                `).join('')}
              </div>
            ` : '<small style="color: var(--text-secondary);">Nenhuma nota de contexto selecionada</small>'}
          </div>

          <div class="step-editor-actions">
            <button type="button" class="btn btn-sm btn-secondary" onclick="openConditionsModal(${index})">
              ${hasConditions ? '✓ ' : ''}Condições${hasConditions ? ` (${step.conditions.rules.length})` : ''}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function setPromptSource(index, source) {
  if (source === 'text') {
    workflowSteps[index].system_prompt_note_id = null;
  } else {
    workflowSteps[index].system_prompt = '';
    openNotesModal('single', 'system_prompt', index);
  }
  renderWorkflowSteps();
}

function clearStepNote(index, field) {
  if (field === 'system_prompt') {
    workflowSteps[index].system_prompt_note_id = null;
  } else if (field === 'context') {
    workflowSteps[index].context_note_ids = [];
  } else if (field === 'memory') {
    workflowSteps[index].memory_note_ids = [];
  }
  renderWorkflowSteps();
}

function removeContextNote(stepIndex, noteId) {
  const ids = workflowSteps[stepIndex].context_note_ids || [];
  workflowSteps[stepIndex].context_note_ids = ids.filter(id => id !== noteId);
  renderWorkflowSteps();
}

// ============================================
// INITIALIZATION
// ============================================

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadWorkflows();
  await loadConversations();
  await loadSmartNotesData();

  // Auto-resize textarea
  const textarea = document.getElementById('message-input');
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  });
});
