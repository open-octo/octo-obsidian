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
