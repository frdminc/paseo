import { readFileSync } from "node:fs";
import { setImmediate as waitForImmediate } from "node:timers/promises";
import { expect, test } from "vitest";
import pino from "pino";
import { PiRpcAgentClient } from "../../agent.js";
import { PiHistoryMapper } from "../../history-mapper.js";
import { parseToolResult } from "../../tool-call-mapper.js";
import { FakePi } from "../../test-utils/fake-pi.js";
import { createPiExtensionHost } from "../index.js";
import { rpivAskUserQuestion } from "./index.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/rpc-session.json", import.meta.url), "utf8"),
);
const [start, ...rest] = fixture.frames;
const dialogs = rest.filter((frame: { type: string }) => frame.type === "extension_ui_request");
const end = rest.find((frame: { type: string }) => frame.type === "tool_execution_end");

function startedHost() {
  const host = createPiExtensionHost();
  host.onToolStart({
    callId: start.toolCallId,
    toolName: start.toolName,
    args: start.args,
    status: "running",
    result: null,
  });
  const mapped = host.mapDialog(dialogs[0], "pi");
  if (mapped?.type !== "permission") throw new Error("Question permission missing");
  return { host, permission: mapped.request, firstDialog: dialogs[0] };
}

test("the form opens when the tool asks, and carries every question", () => {
  const host = createPiExtensionHost();
  expect(
    host.onToolStart({
      callId: start.toolCallId,
      toolName: start.toolName,
      args: start.args,
      status: "running",
      result: null,
    }),
  ).toBeUndefined();
  expect(host.mapDialog(dialogs[0], "pi")).toMatchObject({
    type: "permission",
    request: {
      kind: "question",
      input: {
        questions: [
          {
            header: "Snack",
            options: [{ description: "Fresh fruit" }, { description: "Sweet treat" }],
            allowOther: true,
            multiSelect: false,
          },
          { header: "Colors", multiSelect: true },
          { header: "Project", allowOther: true },
        ],
      },
    },
  });
});

test("real rpiv RPC dialogs use one form and preserve choices, multi-select, and custom text", () => {
  const { host, permission } = startedHost();
  expect(
    host.respondToPermission(permission, {
      behavior: "allow",
      updatedInput: {
        answers: { Snack: "Cookie", Colors: "Red, Blue", Project: "Nebula" },
      },
    }),
  ).toEqual({ responses: [{ id: dialogs[0].id, response: { value: dialogs[0].options[1] } }] });
  expect(host.mapDialog(dialogs[1], "pi")).toEqual({
    type: "response",
    response: { value: "1,2" },
  });
  expect(host.mapDialog(dialogs[2], "pi")).toEqual({
    type: "response",
    response: { value: dialogs[2].options[2] },
  });
  expect(host.mapDialog(dialogs[3], "pi")).toEqual({
    type: "response",
    response: { value: "Nebula" },
  });
});

test("cancellation declines the open dialog and each remaining real RPC dialog", () => {
  const { host, permission, firstDialog } = startedHost();
  expect(host.respondToPermission(permission, { behavior: "deny" })).toEqual({
    responses: [{ id: firstDialog.id, response: { cancelled: true } }],
  });
  for (const dialog of dialogs.slice(1)) {
    expect(host.mapDialog(dialog, "pi")).toEqual({
      type: "response",
      response: { cancelled: true },
    });
  }
});

test("a questionnaire pi would reject over its own caps never opens a form", () => {
  const host = createPiExtensionHost();
  const rejected = structuredClone(start.args);
  rejected.questions[0].header = "Brainstorm cadence"; // 18 chars, pi caps headers at 16
  host.onToolStart({
    callId: "rejected-call",
    toolName: start.toolName,
    args: rejected,
    status: "running",
    result: null,
  });
  // No orphan card, and the tool never reaches the point of asking, so the
  // generic dialog fallback stays available instead.
  expect(
    host.mapDialog({ ...dialogs[0], id: "orphan", title: "[Brainstorm cadence] Pick one?" }, "pi")
      ?.type,
  ).toBeUndefined();
});

test("two questionnaires keep separate forms and one form cannot cancel the other", () => {
  const host = createPiExtensionHost();
  const second = {
    questions: [
      {
        question: "Which drink?",
        header: "Drink",
        options: [
          { label: "Water", description: "Plain" },
          { label: "Juice", description: "Sweet" },
        ],
      },
    ],
  };
  host.onToolStart({
    callId: start.toolCallId,
    toolName: start.toolName,
    args: start.args,
    status: "running",
    result: null,
  });
  host.onToolStart({
    callId: "call_second",
    toolName: "ask_user_question",
    args: second,
    status: "running",
    result: null,
  });
  const firstForm = host.mapDialog(dialogs[0], "pi");
  const drinkDialog = {
    id: "drink-dialog",
    type: "extension_ui_request",
    method: "select",
    title: "[Drink] Which drink?",
    options: ["1. Water — Plain", "2. Juice — Sweet", "3. Type something."],
  };
  const secondForm = host.mapDialog(drinkDialog, "pi");
  expect(firstForm?.type).toBe("permission");
  expect(secondForm?.type).toBe("permission");

  // Closing the first questionnaire must not touch the second one.
  expect(host.respondToPermission(firstForm.request, { behavior: "deny" })).toEqual({
    responses: [{ id: dialogs[0].id, response: { cancelled: true } }],
  });
  expect(
    host.respondToPermission(secondForm.request, {
      behavior: "allow",
      updatedInput: { answers: { Drink: "Juice" } },
    }),
  ).toEqual({
    responses: [{ id: drinkDialog.id, response: { value: drinkDialog.options[1] } }],
  });
});

test("a form whose tool call already ended resolves nothing", () => {
  const { host, permission } = startedHost();
  host.onToolEnd({
    callId: start.toolCallId,
    toolName: start.toolName,
    args: start.args,
    status: "failed",
    result: null,
  });
  expect(host.respondToPermission(permission, { behavior: "deny" })).toEqual({ responses: [] });
});

test("captured result renders in live and history tool rows, while foreign shapes decline", async () => {
  const call = {
    callId: end.toolCallId,
    toolName: end.toolName,
    args: start.args,
    status: "completed" as const,
    result: parseToolResult(end.result),
  };
  const live = createPiExtensionHost().mapToolCall(call);
  expect(live?.detail).toEqual({
    type: "plain_text",
    label: "Questions",
    text: "Which snack?: Cookie\nWhich colors?: Red, Blue\nWhat project name?: Nebula",
  });
  const history = await new PiHistoryMapper("pi").mapMessages([
    {
      role: "assistant",
      content: [
        { type: "toolCall", id: start.toolCallId, name: start.toolName, arguments: start.args },
      ],
    },
    {
      role: "toolResult",
      toolCallId: end.toolCallId,
      toolName: end.toolName,
      content: end.result.content,
      details: end.result.details,
    },
  ]);
  expect(history).toContainEqual(
    expect.objectContaining({
      type: "timeline",
      item: expect.objectContaining({
        type: "tool_call",
        status: "completed",
        detail: live?.detail,
      }),
    }),
  );
  expect(
    rpivAskUserQuestion.createSession().mapToolCall?.({
      ...call,
      result: parseToolResult({ content: [], details: { unrelated: true } }),
    }),
  ).toBeUndefined();
});

test("captured cancellation renders as cancelled in the tool row", () => {
  const cancelled = JSON.parse(
    readFileSync(new URL("./fixtures/cancel-result.json", import.meta.url), "utf8"),
  );
  const mapped = createPiExtensionHost().mapToolCall({
    callId: "cancelled",
    toolName: "ask_user_question",
    args: start.args,
    status: "completed",
    result: parseToolResult(cancelled.result),
  });
  expect(mapped?.detail).toEqual({ type: "plain_text", label: "Questions", text: "Cancelled" });
});

test("the Pi agent releases a deferred captured dialog when the form is answered", async () => {
  const pi = new FakePi();
  const client = new PiRpcAgentClient({ logger: pino({ level: "silent" }), runtime: pi });
  const session = await client.createSession({
    provider: "pi",
    cwd: "/tmp/paseo-pi-question-test",
  });
  const runtime = pi.latestSession();
  runtime.emit(start);
  expect(session.getPendingPermissions()).toEqual([]);
  runtime.emit(dialogs[0]);
  const [permission] = session.getPendingPermissions();
  expect(permission.input?.questions).toHaveLength(3);
  expect(runtime.extensionUiResponses).toEqual([]);
  await session.respondToPermission(permission.id, {
    behavior: "allow",
    updatedInput: {
      answers: { Snack: "Cookie", Colors: "Red, Blue", Project: "Nebula" },
    },
  });
  for (const dialog of dialogs.slice(1)) runtime.emit(dialog);
  expect(runtime.extensionUiResponses).toEqual([
    { id: dialogs[0].id, response: { value: dialogs[0].options[1] } },
    { id: dialogs[1].id, response: { value: "1,2" } },
    { id: dialogs[2].id, response: { value: dialogs[2].options[2] } },
    { id: dialogs[3].id, response: { value: "Nebula" } },
  ]);
  expect(session.getPendingPermissions()).toEqual([]);
  await session.close();
});

test("honours selectedActionId on a single-question form and rejects unmatched or bare allow without cancelling", async () => {
  const pi = new FakePi();
  const client = new PiRpcAgentClient({ logger: pino({ level: "silent" }), runtime: pi });
  const session = await client.createSession({
    provider: "pi",
    cwd: "/tmp/paseo-pi-rpiv-selected-action-test",
  });
  const runtime = pi.latestSession();

  await session.startTurn("ask");
  runtime.emit({
    type: "tool_execution_start",
    toolCallId: "call_single",
    toolName: "ask_user_question",
    args: {
      questions: [
        {
          question: "Which drink?",
          header: "Drink",
          options: [
            { label: "Water", description: "Plain" },
            { label: "Juice", description: "Sweet" },
          ],
        },
      ],
    },
  });
  const drinkDialog = {
    id: "drink-dialog",
    type: "extension_ui_request" as const,
    method: "select" as const,
    title: "[Drink] Which drink?",
    options: ["1. Water — Plain", "2. Juice — Sweet", "3. Type something."],
  };
  runtime.emit(drinkDialog);
  const [permission] = session.getPendingPermissions();

  await expect(
    session.respondToPermission(permission.id, { behavior: "allow", selectedActionId: "Soda" }),
  ).rejects.toThrow(/"Water", "Juice"/);
  await expect(session.respondToPermission(permission.id, { behavior: "allow" })).rejects.toThrow(
    /must name the option/,
  );
  expect(runtime.extensionUiResponses).toEqual([]);
  expect(session.getPendingPermissions()).toHaveLength(1);

  await session.respondToPermission(permission.id, {
    behavior: "allow",
    selectedActionId: "Juice",
  });
  expect(runtime.extensionUiResponses).toEqual([
    { id: drinkDialog.id, response: { value: drinkDialog.options[1] } },
  ]);
  expect(session.getPendingPermissions()).toEqual([]);
  await session.close();
});

test("rejects a bare allow or single selectedActionId on a multi-question form without cancelling", () => {
  const { host, permission } = startedHost();

  expect(() =>
    host.respondToPermission(permission, { behavior: "allow", selectedActionId: "Cookie" }),
  ).toThrow(/updatedInput\.answers/);
  expect(() => host.respondToPermission(permission, { behavior: "allow" })).toThrow(
    /must name the option/,
  );

  // The deferred first dialog is still intact and answerable with full updatedInput.answers.
  expect(
    host.respondToPermission(permission, {
      behavior: "allow",
      updatedInput: {
        answers: { Snack: "Cookie", Colors: "Red, Blue", Project: "Nebula" },
      },
    }),
  ).toEqual({ responses: [{ id: dialogs[0].id, response: { value: dialogs[0].options[1] } }] });
});

test("omits the literal CLI hint when a model-supplied question header contains shell metacharacters", () => {
  const host = createPiExtensionHost();
  const maliciousHeader = "'$(sh</tmp/x)'"; // 14 chars, within rpiv's 16-char cap
  host.onToolStart({
    callId: "call_malicious_header",
    toolName: "ask_user_question",
    args: {
      questions: [
        {
          question: "Proceed?",
          header: maliciousHeader,
          options: [
            { label: "Yes", description: "Allow" },
            { label: "No", description: "Reject" },
          ],
        },
      ],
    },
    status: "running",
    result: null,
  });
  const mapped = host.mapDialog(
    {
      id: "malicious-dialog",
      type: "extension_ui_request",
      method: "select",
      title: `[${maliciousHeader}] Proceed?`,
      options: ["1. Yes — Allow", "2. No — Reject", "3. Type something."],
    },
    "pi",
  );
  if (mapped?.type !== "permission") throw new Error("Expected permission");

  let caught: unknown;
  try {
    host.respondToPermission(mapped.request, { behavior: "allow" });
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  const message = (caught as Error).message;
  expect(message).toContain("updatedInput.answers");
  expect(message).not.toContain("--input");
  expect(message).not.toContain("$(");
  expect(message).not.toContain("/tmp/x");
});

test("steers a denial reason before cancelling a multi-question rpiv form", async () => {
  const pi = new FakePi();
  const client = new PiRpcAgentClient({ logger: pino({ level: "silent" }), runtime: pi });
  const session = await client.createSession({
    provider: "pi",
    cwd: "/tmp/paseo-pi-rpiv-deny-steer-test",
  });
  const runtime = pi.latestSession();

  await session.startTurn("ask");
  runtime.emit({ type: "agent_start" });
  runtime.emit(start);
  runtime.emit(dialogs[0]);
  const [permission] = session.getPendingPermissions();

  let releaseSteer!: () => void;
  runtime.steerCompletion = new Promise<void>((resolve) => {
    releaseSteer = resolve;
  });

  const respondPromise = session.respondToPermission(permission.id, {
    behavior: "deny",
    message: "pick sensible defaults without asking",
  });
  await waitForImmediate();

  expect(runtime.steerCalls).toHaveLength(1);
  expect(runtime.steerCalls[0]?.message).toContain("pick sensible defaults without asking");
  expect(runtime.extensionUiResponses).toEqual([]);

  releaseSteer();
  await respondPromise;

  expect(runtime.rpcCallOrder).toEqual(["steer", "extension_ui_response"]);
  expect(runtime.extensionUiResponses).toEqual([
    { id: dialogs[0].id, response: { cancelled: true } },
  ]);
  for (const dialog of dialogs.slice(1)) runtime.emit(dialog);
  expect(runtime.steerCalls).toHaveLength(1);
  expect(runtime.extensionUiResponses).toEqual(
    dialogs.map((dialog: { id: string }) => ({ id: dialog.id, response: { cancelled: true } })),
  );
  await session.close();
});

test("does not steer a denial reason for a stale rpiv form whose tool already ended", async () => {
  const pi = new FakePi();
  const client = new PiRpcAgentClient({ logger: pino({ level: "silent" }), runtime: pi });
  const session = await client.createSession({
    provider: "pi",
    cwd: "/tmp/paseo-pi-rpiv-stale-deny-test",
  });
  const runtime = pi.latestSession();

  await session.startTurn("ask");
  runtime.emit({ type: "agent_start" });
  runtime.emit(start);
  runtime.emit(dialogs[0]);
  const [permission] = session.getPendingPermissions();

  // Tool ends before the user dismisses the stale card; adapter returns { responses: [] }.
  runtime.emit({
    type: "tool_execution_end",
    toolCallId: start.toolCallId,
    toolName: start.toolName,
    result: { content: [], details: { cancelled: true, answers: [] } },
    isError: false,
  });

  await session.respondToPermission(permission.id, {
    behavior: "deny",
    message: "stale dismissal should not steer",
  });

  expect(runtime.steerCalls).toEqual([]);
  expect(runtime.extensionUiResponses).toEqual([]);
  await session.close();
});
