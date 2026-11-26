import type { AgentSnapshotPayload, ProjectPlacementPayload } from "@getpaseo/protocol/messages";
import { scoreTextFields } from "@getpaseo/protocol/search/text-match";

export interface AgentHistorySearchCandidate {
  agent: AgentSnapshotPayload;
  project: ProjectPlacementPayload;
}

/** An agent-ID query: hex digits and dashes only (mirrors workspace-search.ts). */
const AGENT_ID_QUERY = /^[0-9a-f-]+$/i;
const MIN_AGENT_ID_PREFIX = 4;
const MIN_AGENT_ID_SUBSTRING = 6;

function matchesAgentIdQuery(query: string, agentId: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!AGENT_ID_QUERY.test(normalized)) return false;
  const id = agentId.toLowerCase();
  if (normalized.length >= MIN_AGENT_ID_PREFIX && id.startsWith(normalized)) return true;
  return normalized.length >= MIN_AGENT_ID_SUBSTRING && id.includes(normalized);
}

/** Search the names people recall, never an incomplete subset of transcripts. */
export function matchesAgentHistoryQuery(
  query: string,
  { agent, project }: AgentHistorySearchCandidate,
): boolean {
  if (matchesAgentIdQuery(query, agent.id)) return true;
  return (
    scoreTextFields(
      query,
      [
        project.workspaceName ?? "",
        agent.title ?? "",
        project.checkout.currentBranch ?? "",
        project.projectName,
      ],
      { typoTolerant: true },
    ) !== null
  );
}
