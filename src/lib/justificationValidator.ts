/**
 * Validador de justificativa de exclusão do Sistema EPA.
 *
 * Regras:
 * - Sem limite mínimo ou máximo artificial de caracteres.
 * - Pode conter letras, números, espaços e pontuação normal.
 * - Deve validar se é uma justificativa real e relacionada à exclusão.
 * - Não aceitar preenchimentos sem sentido usados apenas para burlar a obrigatoriedade:
 *   exemplos: "xxxx", "111", "123", "aaa", "teste", "asdf", caracteres repetidos, etc.
 * - Mensagem exata exigida pelo sistema: "Informe uma justificativa válida para realizar esta exclusão."
 */

export const INVALID_JUSTIFICATION_MESSAGE =
  'Informe uma justificativa válida para realizar esta exclusão.'

const BANNED_PATTERNS = [
  /^teste+$/i,
  /^test+$/i,
  /^tst+$/i,
  /^excluir+$/i,
  /^deletar+$/i,
  /^delete+$/i,
  /^remover+$/i,
  /^apagar+$/i,
  /^ok+$/i,
  /^sim+$/i,
  /^nao+$/i,
  /^não+$/i,
  /^abc+$/i,
  /^xyz+$/i,
  /^asdf+$/i,
  /^qwer+$/i,
  /^qwerty+$/i,
  /^null+$/i,
  /^none+$/i,
  /^nenhum+$/i,
  /^nenhuma+$/i,
  /^sem motivo+$/i,
  /^qualquer+$/i,
  /^justificativa+$/i,
]

export function isValidDeletionJustification(input: unknown): boolean {
  if (typeof input !== 'string') return false
  const trimmed = input.trim()

  // Não pode ser vazio
  if (!trimmed) return false

  // Extrair apenas letras e números
  const alphanumeric = trimmed.replace(/[^\p{L}\p{N}]/gu, '')
  if (alphanumeric.length === 0) return false

  // Se for apenas dígitos e sequência simples (ex: 111, 123, 1234, 0000)
  if (/^\d+$/.test(trimmed)) {
    return false
  }

  // Verificar padrões proibidos simples
  const normalized = trimmed.toLowerCase()
  if (BANNED_PATTERNS.some((pat) => pat.test(normalized))) {
    return false
  }

  // Verificar caracteres repetidos (ex: "xxxxx", "aaaaaa", ".....", "11111")
  // Se o conjunto de caracteres únicos alfanuméricos for menor que 3 (a menos que seja palavra real como 'erro')
  const uniqueChars = new Set(alphanumeric.toLowerCase().split(''))
  if (uniqueChars.size <= 2 && !['erro', 'duplicado'].includes(normalized)) {
    return false
  }

  // Sequências de teclado comuns (asdf, zxcv, qwerty, 1234)
  const keyboardSmash = /^(asdf|qwerty|zxcv|1234|abcd)+$/i
  if (keyboardSmash.test(alphanumeric)) {
    return false
  }

  // Deve parecer minimamente um texto humano com palavras reais ou termos técnicos
  // Pelo menos 1 palavra com pelo menos 2 letras
  const words = trimmed.split(/\s+/).filter((w) => /[a-zA-ZáéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ]/.test(w))
  if (words.length === 0) return false

  return true
}
