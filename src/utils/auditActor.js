export function formatAuditActor(log, actorName) {
  return log.actor_email?.trim() || `${actorName ?? 'User'} #${log.actor_id}`
}
