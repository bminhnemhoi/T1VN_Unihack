/** Internal reasoning must never reach the user (pattern from the Goblin bot's `stripReasoning`). */
export function stripReasoning(text: string): string {
  return text.replace(/<(think|thinking|thought)>[\s\S]*?<\/\1>/gi, '').trim();
}
