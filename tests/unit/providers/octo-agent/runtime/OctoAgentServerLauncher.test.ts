import { requestUrl } from 'obsidian';

import { probeOctoAgentServer } from '@/providers/octo-agent/runtime/OctoAgentServerLauncher';

const requestUrlMock = requestUrl as jest.Mock;

describe('OctoAgentServerLauncher', () => {
  beforeEach(() => {
    requestUrlMock.mockReset();
    requestUrlMock.mockResolvedValue({ status: 200, text: '{}', json: {} });
  });

  describe('probeOctoAgentServer', () => {
    it('reports running when the health endpoint responds OK', async () => {
      const result = await probeOctoAgentServer('http://127.0.0.1:8088');
      expect(result).toEqual({ running: true });
      expect(requestUrlMock).toHaveBeenCalledWith({
        url: 'http://127.0.0.1:8088/api/health',
        method: 'GET',
        throw: false,
      });
    });

    it('includes the access key on the health probe when provided', async () => {
      const result = await probeOctoAgentServer('http://127.0.0.1:8088', 'Octo_secret');
      expect(result).toEqual({ running: true });
      expect(requestUrlMock).toHaveBeenCalledWith({
        url: 'http://127.0.0.1:8088/api/health?access_key=Octo_secret',
        method: 'GET',
        throw: false,
      });
    });

    it('reports not running when the health endpoint fails', async () => {
      requestUrlMock.mockResolvedValue({ status: 500, text: 'Internal Server Error', json: {} });
      const result = await probeOctoAgentServer('http://127.0.0.1:8088');
      expect(result).toEqual({ running: false });
    });

    it('reports not running when the request throws', async () => {
      requestUrlMock.mockRejectedValue(new Error('Connection refused'));
      const result = await probeOctoAgentServer('http://127.0.0.1:8088');
      expect(result).toEqual({ running: false });
    });
  });
});
