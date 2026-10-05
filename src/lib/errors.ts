// Traduz erros do banco em mensagens para o usuário.

const MESSAGES: Record<string, string> = {
  TRANSICAO_INVALIDA: "Esta ação não é possível no estado atual da solicitação. Atualize a página.",
  ACAO_NAO_PERMITIDA: "Esta ação cabe à outra parte da solicitação.",
  SOLICITACAO_INEXISTENTE: "Solicitação não encontrada.",
  PROPOSTA_INVALIDA: "Esta proposta não está mais disponível (pode ter sido substituída).",
  PROPOSTA_INEXISTENTE: "Proposta não encontrada.",
  SERVICO_INDISPONIVEL: "Este serviço não está disponível para contratação.",
  PROPRIO_SERVICO: "Você não pode contratar o próprio serviço.",
  DATA_PASSADA: "A data desejada não pode estar no passado.",
  MOTIVO_OBRIGATORIO: "Informe o motivo.",
  AVALIACAO_SO_APOS_CONCLUSAO: "A avaliação fica disponível depois que você confirma a conclusão do serviço.",
  JA_AVALIADO: "Você já avaliou esta contratação.",
  USUARIO_SUSPENSO: "Sua conta está suspensa pela moderação e não pode realizar esta ação.",
  SOMENTE_MODERADORES: "Somente moderadores podem fazer isso.",
  DENUNCIA_INEXISTENTE: "Denúncia não encontrada ou já resolvida.",
  ALVO_INEXISTENTE: "O item moderado não existe mais.",
  ACAO_INVALIDA: "Ação de moderação inválida.",
  NAO_AUTENTICADO: "Sua sessão expirou. Entre novamente.",
};

export const GENERIC_ERROR = "Não foi possível concluir a ação. Tente novamente em instantes.";

export function friendlyDbError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return GENERIC_ERROR;
  const key = Object.keys(MESSAGES).find((k) => error.message?.includes(k));
  if (key) return MESSAGES[key];
  if (error.code === "23505") return "Você já tem uma denúncia aberta sobre este item.";
  if (error.code === "42501" || error.message?.includes("row-level security")) return "Você não tem permissão para esta ação.";
  return GENERIC_ERROR;
}

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  email_not_confirmed: "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.",
  user_already_exists: "Já existe uma conta com este e-mail.",
  weak_password: "Senha fraca. Use ao menos 8 caracteres, com letras e números.",
  over_request_rate_limit: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  over_email_send_rate_limit: "Muitos e-mails enviados. Aguarde alguns minutos e tente novamente.",
};

export function friendlyAuthError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return GENERIC_ERROR;
  return (error.code && AUTH_MESSAGES[error.code]) || GENERIC_ERROR;
}
