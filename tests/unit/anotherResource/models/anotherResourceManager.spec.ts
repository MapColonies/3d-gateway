import jsLogger from '@map-colonies/js-logger';
import { AnotherResourceManager } from '../../../../src/anotherResource/models/anotherResourceManager';

let anotherResourceManager: AnotherResourceManager;

describe('ResourceNameManager', () => {
  beforeEach(function () {
    anotherResourceManager = new AnotherResourceManager(jsLogger({ enabled: false }));
  });
  describe('#getResource', () => {
    it('should return resource of kind avi', function () {
      // action
      const resource = anotherResourceManager.getResource();

      // expectation
      expect(resource.kind).toBe('avi');
      expect(resource.isAlive).toBe(false);
    });
  });
});
