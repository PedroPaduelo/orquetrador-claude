/**
 * Conditions Evaluation Service
 *
 * Avalia condições configuradas em workflow steps para determinar
 * o próximo passo do fluxo (avançar, voltar, retry, etc).
 */

/**
 * Tipos de condição suportados:
 * - contains: output contém o texto
 * - not_contains: output NÃO contém o texto
 * - equals: output é exatamente igual ao texto
 * - starts_with: output começa com o texto
 * - ends_with: output termina com o texto
 * - regex: output corresponde à expressão regular
 * - length_gt: output tem mais de X caracteres
 * - length_lt: output tem menos de X caracteres
 */

/**
 * Avalia as condições configuradas contra o output
 * @param {string} output - Output do step atual
 * @param {object} conditions - Objeto de condições configurado no step
 * @returns {{matched: boolean, action: string, rule?: object, retryMessage?: string}}
 */
export function evaluateConditions(output, conditions) {
  if (!conditions || !conditions.rules || conditions.rules.length === 0) {
    return {
      matched: false,
      action: conditions?.default || 'next',
    };
  }

  // Normalizar output para comparação
  const normalizedOutput = (output || '').trim();

  // Avaliar cada regra em ordem
  for (const rule of conditions.rules) {
    if (matchesCondition(normalizedOutput, rule)) {
      return {
        matched: true,
        action: rule.goto || 'next',
        rule: rule,
        retryMessage: rule.retry_message || null,
        maxRetries: rule.max_retries || 0,
      };
    }
  }

  // Nenhuma regra correspondeu, usar ação padrão
  return {
    matched: false,
    action: conditions.default || 'next',
  };
}

/**
 * Verifica se o output corresponde a uma regra específica
 * @param {string} output - Output normalizado
 * @param {object} rule - Regra a ser avaliada
 * @returns {boolean}
 */
function matchesCondition(output, rule) {
  const type = rule.type || 'contains';
  const match = rule.match || '';

  switch (type) {
    case 'contains':
      return output.toLowerCase().includes(match.toLowerCase());

    case 'not_contains':
      return !output.toLowerCase().includes(match.toLowerCase());

    case 'equals':
      return output.toLowerCase() === match.toLowerCase();

    case 'starts_with':
      return output.toLowerCase().startsWith(match.toLowerCase());

    case 'ends_with':
      return output.toLowerCase().endsWith(match.toLowerCase());

    case 'regex':
      try {
        const regex = new RegExp(match, 'i');
        return regex.test(output);
      } catch {
        console.error(`Invalid regex pattern: ${match}`);
        return false;
      }

    case 'length_gt':
      return output.length > parseInt(match, 10);

    case 'length_lt':
      return output.length < parseInt(match, 10);

    default:
      console.warn(`Unknown condition type: ${type}`);
      return false;
  }
}

/**
 * Determina o próximo step baseado na ação
 * @param {string} action - Ação a ser executada (next, previous, step_id, finish, retry)
 * @param {array} steps - Lista de steps do workflow
 * @param {number} currentStepIndex - Índice do step atual
 * @param {string} currentStepId - ID do step atual
 * @returns {{nextStepIndex: number, nextStepId: string|null, isFinished: boolean, isRetry: boolean}}
 */
export function resolveNextStep(action, steps, currentStepIndex, currentStepId) {
  // Ação de retry
  if (action === 'retry' || action === currentStepId) {
    return {
      nextStepIndex: currentStepIndex,
      nextStepId: currentStepId,
      isFinished: false,
      isRetry: true,
    };
  }

  // Avançar para próximo step
  if (action === 'next') {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= steps.length) {
      return {
        nextStepIndex: -1,
        nextStepId: null,
        isFinished: true,
        isRetry: false,
      };
    }
    return {
      nextStepIndex: nextIndex,
      nextStepId: steps[nextIndex].id,
      isFinished: false,
      isRetry: false,
    };
  }

  // Voltar para step anterior
  if (action === 'previous') {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex < 0) {
      return {
        nextStepIndex: 0,
        nextStepId: steps[0].id,
        isFinished: false,
        isRetry: false,
      };
    }
    return {
      nextStepIndex: prevIndex,
      nextStepId: steps[prevIndex].id,
      isFinished: false,
      isRetry: false,
    };
  }

  // Finalizar workflow
  if (action === 'finish' || action === 'end') {
    return {
      nextStepIndex: -1,
      nextStepId: null,
      isFinished: true,
      isRetry: false,
    };
  }

  // Ir para step específico (por ID ou por índice)
  const targetStep = steps.find(s => s.id === action);
  if (targetStep) {
    const targetIndex = steps.findIndex(s => s.id === action);
    return {
      nextStepIndex: targetIndex,
      nextStepId: targetStep.id,
      isFinished: false,
      isRetry: targetStep.id === currentStepId,
    };
  }

  // Tentar como índice numérico (1-based)
  const stepIndex = parseInt(action, 10);
  if (!isNaN(stepIndex) && stepIndex >= 1 && stepIndex <= steps.length) {
    const idx = stepIndex - 1;
    return {
      nextStepIndex: idx,
      nextStepId: steps[idx].id,
      isFinished: false,
      isRetry: steps[idx].id === currentStepId,
    };
  }

  // Fallback: avançar
  console.warn(`Unknown action: ${action}, defaulting to next`);
  const nextIndex = currentStepIndex + 1;
  if (nextIndex >= steps.length) {
    return {
      nextStepIndex: -1,
      nextStepId: null,
      isFinished: true,
      isRetry: false,
    };
  }
  return {
    nextStepIndex: nextIndex,
    nextStepId: steps[nextIndex].id,
    isFinished: false,
    isRetry: false,
  };
}

/**
 * Valida a estrutura de condições
 * @param {object} conditions - Objeto de condições a validar
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateConditions(conditions) {
  const errors = [];

  if (!conditions) {
    return { valid: true, errors: [] };
  }

  if (conditions.rules && !Array.isArray(conditions.rules)) {
    errors.push('conditions.rules deve ser um array');
  }

  if (conditions.rules && Array.isArray(conditions.rules)) {
    conditions.rules.forEach((rule, index) => {
      if (!rule.match && rule.type !== 'length_gt' && rule.type !== 'length_lt') {
        errors.push(`Rule ${index + 1}: match é obrigatório`);
      }
      if (!rule.goto) {
        errors.push(`Rule ${index + 1}: goto é obrigatório`);
      }
      const validTypes = ['contains', 'not_contains', 'equals', 'starts_with', 'ends_with', 'regex', 'length_gt', 'length_lt'];
      if (rule.type && !validTypes.includes(rule.type)) {
        errors.push(`Rule ${index + 1}: tipo '${rule.type}' não é válido`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Formata uma mensagem de retry com o contexto do erro
 * @param {string} template - Template da mensagem (pode conter {error}, {output})
 * @param {string} output - Output do step
 * @param {object} rule - Regra que disparou o retry
 * @returns {string}
 */
export function formatRetryMessage(template, output, rule) {
  if (!template) {
    return `O step anterior retornou um resultado que requer correção. Output: ${output.substring(0, 500)}`;
  }

  return template
    .replace('{error}', output.substring(0, 500))
    .replace('{output}', output.substring(0, 500))
    .replace('{match}', rule?.match || '')
    .replace('{type}', rule?.type || 'contains');
}

export default {
  evaluateConditions,
  resolveNextStep,
  validateConditions,
  formatRetryMessage,
};
