import { RULE_TOPICS, type RuleTopic } from '../schemas';
import { RULE_TEXTS, type RuleText } from './texts';

export type { RuleText };

/** Output of `explain_rule` (docs/05 12.2): exactly these fields. */
export function explainRule(topic: RuleTopic): RuleText {
  return RULE_TEXTS[topic];
}

export const allRuleTopics = (): readonly RuleTopic[] => RULE_TOPICS;
