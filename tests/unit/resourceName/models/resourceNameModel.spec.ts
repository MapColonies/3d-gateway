import jsLogger from '@map-colonies/js-logger';
import { ResourceNameManager } from '../../../../src/resourceName/models/resourceNameManager';

let resourceNameManager: ResourceNameManager;

describe('ResourceNameManager', () => {
  beforeEach(function () {
    resourceNameManager = new ResourceNameManager(jsLogger({ enabled: false }));
  });
  describe('#getResource', () => {
    it('return the resource of id 1', function () {
      // action
      const resource = resourceNameManager.getResource();

      // expectation
      expect(resource.id).toBe(1);
      expect(resource.name).toBe('ronin');
      expect(resource.description).toBe('can you do a logistics run?');
    });
  });
  describe('#createResource', () => {
    it('return the resource of id 1', function () {
      // action
      const resource = resourceNameManager.createResource({ description: 'meow', name: 'cat' });

      // expectation
      expect(resource.id).toBeLessThanOrEqual(100);
      expect(resource.id).toBeGreaterThanOrEqual(0);
      expect(resource).toHaveProperty('name', 'cat');
      expect(resource).toHaveProperty('description', 'meow');
    });
  });
});
