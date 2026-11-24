/**
 * Minimal robots.txt evaluator (RFC 9309): picks the most specific matching
 * user-agent group (falling back to "*"), then the longest matching
 * Allow/Disallow rule wins, Allow winning ties. Supports "*" and "$".
 */

interface Rule {
  allow: boolean;
  pattern: string;
}

interface Group {
  agents: string[];
  rules: Rule[];
}

export interface RobotsRules {
  groups: Group[];
  sitemaps: string[];
}

export function parseRobots(text: string): RobotsRules {
  const groups: Group[] = [];
  const sitemaps: string[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (field === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }
    if (!current) continue;
    if (field === "allow" || field === "disallow") {
      // An empty Disallow means "allow everything" — no rule needed.
      if (value) current.rules.push({ allow: field === "allow", pattern: value });
    }
  }
  return { groups, sitemaps };
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

export function isAllowedByRobots(rules: RobotsRules, userAgentToken: string, pathWithQuery: string): boolean {
  const ua = userAgentToken.toLowerCase();
  let best: Group[] = [];
  let bestLen = -1;
  for (const group of rules.groups) {
    for (const agent of group.agents) {
      if (agent !== "*" && ua.includes(agent) && agent.length > bestLen) {
        best = [group];
        bestLen = agent.length;
      } else if (agent !== "*" && ua.includes(agent) && agent.length === bestLen) {
        best.push(group);
      }
    }
  }
  if (best.length === 0) best = rules.groups.filter((g) => g.agents.includes("*"));
  if (best.length === 0) return true;

  let decision: Rule | null = null;
  for (const group of best) {
    for (const rule of group.rules) {
      if (!patternToRegex(rule.pattern).test(pathWithQuery)) continue;
      if (
        !decision ||
        rule.pattern.length > decision.pattern.length ||
        (rule.pattern.length === decision.pattern.length && rule.allow && !decision.allow)
      ) {
        decision = rule;
      }
    }
  }
  return decision ? decision.allow : true;
}
