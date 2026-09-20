import { Notice, requestUrl } from 'obsidian';

import type { Conversation } from '@/core/types';
import type OctoPlugin from '@/main';
import { OctoAgentConversationHistoryService } from '@/providers/octo-agent/history/OctoAgentConversationHistoryService';

const requestUrlMock = requestUrl as jest.Mock;
const NoticeMock = Notice as unknown as jest.Mock;

function createPlugin(overrides: Record<string, unknown> = {}): OctoPlugin {
  return {
    settings: {
      providerConfigs: {
        'octo-agent': { host: '127.0.0.1', port: 8088, ...overrides },
      },
    },
  } as unknown as OctoPlugin;
}

function createConversation(providerState?: Record<string, unknown>): Conversation {
  return {
    id: 'conv-1',
    providerId: 'octo-agent',
    sessionId: null,
    providerState,
  } as unknown as Conversation;
}

describe('OctoAgentConversationHistoryService.deleteConversationSession', () => {
  let service: OctoAgentConversationHistoryService;

  beforeEach(() => {
    requestUrlMock.mockReset();
    requestUrlMock.mockResolvedValue({ status: 200, text: '{}' });
    NoticeMock.mockClear?.();
    service = new OctoAgentConversationHistoryService();
  });

  it('deletes the server-side session', async () => {
    const conversation = createConversation({ sessionId: 's-123' });

    await service.deleteConversationSession(conversation, null, createPlugin());

    expect(requestUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'DELETE',
        url: 'http://127.0.0.1:8088/api/sessions/s-123',
      }),
    );
  });

  it('appends the access key when one is configured', async () => {
    const conversation = createConversation({ sessionId: 's-123' });

    await service.deleteConversationSession(
      conversation,
      null,
      createPlugin({ accessKey: 'Octo_secret' }),
    );

    expect(requestUrlMock.mock.calls[0][0].url).toBe(
      'http://127.0.0.1:8088/api/sessions/s-123?access_key=Octo_secret',
    );
  });

  it('encodes the session id', async () => {
    const conversation = createConversation({ sessionId: 'a b/c' });

    await service.deleteConversationSession(conversation, null, createPlugin());

    expect(requestUrlMock.mock.calls[0][0].url).toBe(
      'http://127.0.0.1:8088/api/sessions/a%20b%2Fc',
    );
  });

  it('does nothing when the conversation never had a session', async () => {
    await service.deleteConversationSession(createConversation(), null, createPlugin());

    expect(requestUrlMock).not.toHaveBeenCalled();
  });

  it('swallows a server failure so the local delete still completes', async () => {
    // main.ts removes the conversation from memory before calling this and
    // deletes its metadata after; throwing here would strand the metadata.
    requestUrlMock.mockResolvedValue({ status: 500, text: 'boom' });
    const conversation = createConversation({ sessionId: 's-123' });

    await expect(
      service.deleteConversationSession(conversation, null, createPlugin()),
    ).resolves.toBeUndefined();
  });
});
