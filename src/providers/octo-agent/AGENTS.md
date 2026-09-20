# Octo Agent Provider

`src/providers/octo-agent/` adapts the Octo Agent server, a local process reachable over WebSocket (live streaming) and HTTP/JSON (session CRUD).

## Ownership

- Server lifecycle (locate binary, spawn, health-probe), WebSocket transport, event parsing, prompt encoding, and settings reconciliation live here. The settings *UI* does not: it is inlined in `src/features/settings/ClaudianSettings.ts`, which reads and writes this provider's config through `settings.ts`.
- Shared code should consume Octo Agent behavior through `ChatRuntime`, provider capabilities, and workspace-service contracts — not through `OctoAgentClient`/`OctoAgentEvent` directly.

## Protocol Rules

- Live turns run over `ws(s)://{host}:{port}/ws`. Session CRUD (`POST /api/sessions`, `GET /api/sessions/:id/messages`, model/permission-mode/working-dir PATCH, `/api/config`, `/api/health`) is plain HTTP/JSON via `fetch`.
- Auth is a single optional `accessKey`, appended as `?access_key=...` on every REST call and on the WS connect URL. There is no header-based auth.
- `OctoAgentClient.parseEvent()` is defensive: unknown `type` values become `{ type: 'unknown', raw }` instead of throwing. Keep new event handling additive in `OctoAgentChatRuntime.handleEvent()`/`handleClientEvent()`.
- The client auto-reconnects on unintentional close and replays `pendingSubscribes` on reopen; `disconnect()` sets `intentionallyClosed` to suppress that.

## Session and History Rules

- History is server-resident. `OctoAgentConversationHistoryService.hydrateConversationHistory()` is an intentional no-op — continuity works by re-subscribing to `providerState.sessionId` on the WS, and `ChatRuntime.loadHistory()` fetches messages on demand from `GET /api/sessions/:id/messages`. Do not add vault-side history persistence here.
- `deleteConversationSession()` is also a no-op: deleting a conversation in the plugin does not delete the server-side session (no public API for it yet).
- `OctoAgentProviderState` is exactly `{ sessionId?: string }`. `buildPersistedOctoAgentState()` returns `undefined`, not `{}`, when there's no session id yet.
- Forking currently reuses the source session id as the new provider state (`buildForkProviderState`) rather than creating an independent server-side copy at this layer.
- A `send_rejected`/`error` event whose message contains "not found" triggers exactly one automatic session-recreate-and-resend per turn (`retriedAfterSessionNotFound`). Do not remove the single-retry guard — it exists to avoid retry loops against a server that keeps rejecting the same session id.
- `session_deleted` from the server invalidates the session (clears `sessionId`/`providerState`) whether or not a query is active; only the in-query path yields a `notice` chunk.

## Runtime Gotchas

- `ensureOctoAgentServerRunning()` only spawns a process if the health probe fails AND `autoStartServer` is on; the spawned process is `detached`/`unref()`'d and not tracked or killed by the plugin — it's a fire-and-forget daemon (the CLI's own `-d` flag backgrounds it).
- `OctoAgentBinaryLocator` is a pure filesystem search (no `which`/PATH shell-out); if it can't find the binary it falls back to the raw `cliPath` string and lets the OS resolve it at spawn time.
- `pendingConfirmations` dedupes by event id and handles the "another client answered first" race: `confirmation_complete` can delete an entry and resolve it before the local `handleConfirmation()` await returns, in which case the `finally` block detects the entry is gone and skips sending a duplicate answer.
- `reloadMcpServers()`, `getSupportedCommands()`, `rewind()`, `setResumeCheckpoint()`, and subagent tool-call loading are all intentional no-ops/stubs — octo-agent manages its own MCP servers, has no runtime command catalog, and has no rewind or subagent concept. `OctoAgentTaskResultInterpreter` is a full no-op for the same reason (no async subagent/Task-tool launch protocol to parse).
- `octoAgentSettingsReconciler` never invalidates a session: both `reconcileModelWithEnvironment()` and `handleEnvironmentChange()` are no-ops. Sessions are server-resident, so they outlive any settings or `OCTO_*` environment change the plugin can make. An env change force-restarts the runtime in place instead of resetting the session.
- Environment variables live in exactly one place: `providerConfigs['octo-agent'].environmentVariables`. They are spread into the spawned `octo serve` process, except `PATH`, which `ensureOctoAgentServerRunning()` always overwrites with `getEnhancedPath()`.
- `capabilities.supportsPlanMode` is `false` even though `permissionMode.ts` and the wire protocol both define a `'plan'` value end-to-end. The mapping exists but the runtime never drives exit-plan-mode behavior and the UI has no plan toggle — don't assume flipping the capability flag alone would make plan mode work.
- `capabilities.reasoningControl: 'effort'`, but `OctoAgentChatUIConfig` exposes no reasoning options (`getReasoningOptions()` → `[]`) even though the wire protocol carries `reasoningEffort`/`showReasoning` fields. Reasoning-effort UI is not wired up yet.
- `OctoAgentInlineEditService` and `OctoAgentInstructionRefineService` run through a separate short-lived `runOctoAgentAuxQuery()` connection (its own session, fixed `permissionMode: 'interactive'`), fully decoupled from the main chat runtime's connection and event buffer.
- Conversation titles are owned by the server. Octo generates a session title after the first completed turn and broadcasts `session_renamed` (`{ session_id, name }`) globally. `OctoAgentChatRuntime` filters that broadcast to its own session and forwards the name through `setSessionRenamedCallback`, which the tab applies via `plugin.applyServerGeneratedTitle()`. The plugin never generates or pushes a title of its own — pushing a non-placeholder name would suppress the server's own generation, so a fresh session's name stays the empty/placeholder value until the broadcast arrives. `renameSession()` is still used, but only for explicit user renames.
