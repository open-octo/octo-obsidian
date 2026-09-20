import { requestUrl } from 'obsidian';

import { OctoAgentClient } from '@/providers/octo-agent/runtime/OctoAgentClient';

const requestUrlMock = requestUrl as jest.Mock;

describe('OctoAgentClient', () => {
  beforeEach(() => {
    requestUrlMock.mockReset();
    requestUrlMock.mockResolvedValue({ status: 200, text: '{}', json: {} });
  });

  describe('REST calls', () => {
    it('includes the access key on every request when configured', async () => {
      const client = new OctoAgentClient({ baseUrl: 'http://127.0.0.1:8088', accessKey: 'Octo_secret' });
      await (client as any).fetchJson('/api/config');

      expect(requestUrlMock).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://127.0.0.1:8088/api/config?access_key=Octo_secret',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      );
    });

    it('does not append an access key when omitted', async () => {
      const client = new OctoAgentClient({ baseUrl: 'http://127.0.0.1:8088' });
      await (client as any).fetchJson('/api/config');

      expect(requestUrlMock).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'http://127.0.0.1:8088/api/config' }),
      );
    });
  });

  describe('createSession', () => {
    it('sends an empty model so the server applies its own default', async () => {
      requestUrlMock.mockResolvedValue({
        status: 200,
        text: JSON.stringify({ session: { id: 's1', name: '', model: 'k3' } }),
      });
      const client = new OctoAgentClient({ baseUrl: 'http://127.0.0.1:8088' });

      await client.createSession({ source: 'octo' });

      const body = JSON.parse(requestUrlMock.mock.calls[0][0].body);
      expect(body.model).toBe('');
    });

    it('reports the model the server resolved', async () => {
      requestUrlMock.mockResolvedValue({
        status: 200,
        text: JSON.stringify({ session: { id: 's1', name: '', model: 'k3' } }),
      });
      const client = new OctoAgentClient({ baseUrl: 'http://127.0.0.1:8088' });

      const session = await client.createSession();

      expect(session.model).toBe('k3');
    });

    it('leaves the model undefined when the server omits it', async () => {
      requestUrlMock.mockResolvedValue({
        status: 200,
        text: JSON.stringify({ session: { id: 's1', name: '' } }),
      });
      const client = new OctoAgentClient({ baseUrl: 'http://127.0.0.1:8088' });

      const session = await client.createSession();

      expect(session.model).toBeUndefined();
    });
  });

  describe('createSession defaults', () => {
    beforeEach(() => {
      requestUrlMock.mockResolvedValue({
        status: 200,
        text: JSON.stringify({ session: { id: 's1', name: '' } }),
      });
    });

    it("defaults agent_profile to 'default', not a sub-agent profile", async () => {
      // 'general' is octo's delegated sub-agent profile ("return a
      // self-contained result the caller can act on"); a chat session is not
      // that, it is the default profile.
      const client = new OctoAgentClient({ baseUrl: 'http://127.0.0.1:8088' });

      await client.createSession();

      expect(JSON.parse(requestUrlMock.mock.calls[0][0].body).agent_profile).toBe('default');
    });

    it('passes an explicit agent profile through', async () => {
      const client = new OctoAgentClient({ baseUrl: 'http://127.0.0.1:8088' });

      await client.createSession({ agentProfile: 'code-review' });

      expect(JSON.parse(requestUrlMock.mock.calls[0][0].body).agent_profile).toBe('code-review');
    });
  });

  describe('session groups', () => {
    it('files a new session under a project when given one', async () => {
      requestUrlMock.mockResolvedValue({
        status: 200,
        text: JSON.stringify({ session: { id: 's1', name: '' } }),
      });
      const client = new OctoAgentClient({ baseUrl: 'http://127.0.0.1:8088' });

      await client.createSession({ groupId: 'g-123', source: 'octo' });

      const body = JSON.parse(requestUrlMock.mock.calls[0][0].body);
      expect(body.group_id).toBe('g-123');
    });

    it('omits group_id entirely when there is no project', async () => {
      requestUrlMock.mockResolvedValue({
        status: 200,
        text: JSON.stringify({ session: { id: 's1', name: '' } }),
      });
      const client = new OctoAgentClient({ baseUrl: 'http://127.0.0.1:8088' });

      await client.createSession({ source: 'octo' });

      const body = JSON.parse(requestUrlMock.mock.calls[0][0].body);
      expect('group_id' in body).toBe(false);
    });

    it('reads the mounted source folders of each project', async () => {
      requestUrlMock.mockResolvedValue({
        status: 200,
        text: JSON.stringify({
          groups: [
            {
              id: 'g-1',
              name: 'vault',
              working_dir: '/Users/me/Octo/vault',
              source_dirs: ['/Users/me/vault'],
            },
            { id: 'g-2', name: 'no-dirs' },
          ],
        }),
      });
      const client = new OctoAgentClient({ baseUrl: 'http://127.0.0.1:8088' });

      const groups = await client.listSessionGroups();

      expect(groups[0]).toEqual({
        id: 'g-1',
        name: 'vault',
        sourceDirs: ['/Users/me/vault'],
        workingDir: '/Users/me/Octo/vault',
      });
      // A group with no mounts is still a group; it just matches no vault.
      expect(groups[1].sourceDirs).toEqual([]);
    });

    it('creates a project that mounts the given folders', async () => {
      requestUrlMock.mockResolvedValue({
        status: 200,
        text: JSON.stringify({
          group: { id: 'g-9', name: 'vault', source_dirs: ['/Users/me/vault'] },
        }),
      });
      const client = new OctoAgentClient({ baseUrl: 'http://127.0.0.1:8088' });

      const group = await client.createSessionGroup('vault', ['/Users/me/vault']);

      const call = requestUrlMock.mock.calls[0][0];
      expect(call.method).toBe('POST');
      expect(JSON.parse(call.body)).toEqual({
        name: 'vault',
        source_dirs: ['/Users/me/vault'],
      });
      expect(group.id).toBe('g-9');
    });
  });

  describe('parseEvent', () => {
    let client: OctoAgentClient;

    beforeEach(() => {
      client = new OctoAgentClient({ baseUrl: 'http://127.0.0.1:8088' });
    });

    it('parses a question set, keeping label/description/preview apart', () => {
      const event = (client as any).parseEvent({
        type: 'request_user_question',
        session_id: 's1',
        question_id: 'q_1',
        questions: [
          {
            question: 'Which layout?',
            header: 'layout',
            options: [
              { label: 'Sidebar', description: 'nav left', preview: '+--+' },
              'Top tabs',
            ],
          },
          { question: 'Which surfaces?', header: 'surfaces', multi_select: true, options: [{ label: 'Web' }] },
        ],
      });

      expect(event).toEqual({
        type: 'request_user_question',
        session_id: 's1',
        question_id: 'q_1',
        secret: false,
        questions: [
          {
            question: 'Which layout?',
            header: 'layout',
            multi_select: false,
            options: [
              { label: 'Sidebar', description: 'nav left', preview: '+--+' },
              // A bare string is still read as a label rather than dropped.
              { label: 'Top tabs' },
            ],
          },
          {
            question: 'Which surfaces?',
            header: 'surfaces',
            multi_select: true,
            options: [{ label: 'Web', description: '', preview: '' }],
          },
        ],
      });
    });

    it('fills a missing header and drops malformed questions', () => {
      const event = (client as any).parseEvent({
        type: 'request_user_question',
        session_id: 's1',
        question_id: 'q_2',
        questions: [{ options: [{ label: 'A' }] }, { question: 'Real?', options: [] }],
      });

      // The first entry has no question text, so it never reaches the user;
      // the second keeps its generated header.
      expect(event.questions).toEqual([
        { question: 'Real?', header: 'Q2', multi_select: false, options: [] },
      ]);
    });

    it('answers a whole set in one frame, with an outcome', () => {
      const sent: unknown[] = [];
      (client as any).send = (msg: unknown) => sent.push(msg);

      client.answerUserQuestion('q_1', 'clarify', [
        { choices: ['Sidebar'], custom: '', notes: 'wider is better' },
      ]);

      expect(sent).toEqual([
        {
          type: 'user_question_answer',
          question_id: 'q_1',
          outcome: 'clarify',
          answers: [{ choices: ['Sidebar'], custom: '', notes: 'wider is better' }],
        },
      ]);
    });

    it('parses text_delta events', () => {
      const event = (client as any).parseEvent({ type: 'text_delta', session_id: 's1', text: 'hello' });
      expect(event).toEqual({ type: 'text_delta', session_id: 's1', text: 'hello' });
    });

    it('parses assistant_message events with content', () => {
      const event = (client as any).parseEvent({
        type: 'assistant_message',
        session_id: 's1',
        content: 'final answer',
        thinking: 'thought',
      });
      expect(event).toEqual({
        type: 'assistant_message',
        session_id: 's1',
        content: 'final answer',
        thinking: 'thought',
      });
    });

    it('defaults missing assistant_message content to an empty string', () => {
      const event = (client as any).parseEvent({
        type: 'assistant_message',
        session_id: 's1',
      });
      expect(event).toEqual({
        type: 'assistant_message',
        session_id: 's1',
        content: '',
      });
    });

    it('parses session_update events', () => {
      const event = (client as any).parseEvent({
        type: 'session_update',
        session_id: 's1',
        context_usage: 1234,
        permission_mode: 'auto',
      });
      expect(event).toEqual({
        type: 'session_update',
        session_id: 's1',
        context_usage: 1234,
        permission_mode: 'auto',
      });
    });

    it('parses history_user_message events', () => {
      const event = (client as any).parseEvent({
        type: 'history_user_message',
        session_id: 's1',
        content: 'previous user message',
      });
      expect(event).toEqual({
        type: 'history_user_message',
        session_id: 's1',
        content: 'previous user message',
      });
    });

    it('marks unknown event types as unknown', () => {
      const raw = { type: 'custom_event', session_id: 's1', value: 42 };
      const event = (client as any).parseEvent(raw);
      expect(event).toEqual({ type: 'unknown', session_id: 's1', raw });
    });
  });
});
