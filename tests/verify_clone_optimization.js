const { cloneTaskForVersion } = require('../src/server/utils');

const task = {
    id: 'test_task',
    name: 'Large Task',
    actions: Array(50).fill({ type: 'click', selector: '.btn' }),
    variables: { foo: { type: 'string', value: 'bar' } },
    versions: []
};

// Fill with 30 versions
for (let i = 0; i < 30; i++) {
    task.versions.push({
        id: 'ver_' + i,
        timestamp: Date.now(),
        snapshot: { ...task, versions: undefined }
    });
}

const iterations = 1000;

console.time('Clone Performance');
for (let i = 0; i < iterations; i++) {
    const clone = cloneTaskForVersion(task);
    if (clone.versions) {
        console.error('FAILED: versions property should not be present in clone');
        process.exit(1);
    }
}
console.timeEnd('Clone Performance');
console.log('Successfully cloned task 1000 times without the versions array.');
