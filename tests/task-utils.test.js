
const { cloneTaskForVersion } = require('../lib/task-utils');

describe('cloneTaskForVersion', () => {
    it('should create a deep copy of the task', () => {
        const task = {
            id: '123',
            name: 'Test Task',
            config: {
                retry: 3,
                timeout: 5000
            }
        };

        const clone = cloneTaskForVersion(task);

        expect(clone).toEqual(task);
        expect(clone).not.toBe(task);
        expect(clone.config).not.toBe(task.config);
    });

    it('should remove the versions property from the clone', () => {
        const task = {
            id: '123',
            name: 'Test Task',
            versions: [
                { id: 'v1', timestamp: 123456789 },
                { id: 'v2', timestamp: 987654321 }
            ]
        };

        const clone = cloneTaskForVersion(task);

        expect(clone.versions).toBeUndefined();
        expect(clone.id).toBe(task.id);
        expect(clone.name).toBe(task.name);
    });

    it('should return an empty object if task is null', () => {
        const clone = cloneTaskForVersion(null);
        expect(clone).toEqual({});
    });

    it('should return an empty object if task is undefined', () => {
        const clone = cloneTaskForVersion(undefined);
        expect(clone).toEqual({});
    });

    it('should handle tasks without versions property', () => {
        const task = { id: '123', name: 'Simple Task' };
        const clone = cloneTaskForVersion(task);
        expect(clone).toEqual(task);
    });

    it('should not modify the original task when removing versions', () => {
        const task = {
            id: '123',
            versions: ['v1']
        };

        cloneTaskForVersion(task);

        expect(task.versions).toBeDefined();
        expect(task.versions.length).toBe(1);
    });

    it('should handle complex nested structures', () => {
        const task = {
            id: '123',
            details: {
                steps: [
                    { type: 'click', selector: '#btn' },
                    { type: 'wait', duration: 1000 }
                ]
            }
        };

        const clone = cloneTaskForVersion(task);

        expect(clone).toEqual(task);
        // Modify clone deeply to ensure deep copy
        clone.details.steps[0].type = 'hover';
        expect(task.details.steps[0].type).toBe('click');
    });
});
