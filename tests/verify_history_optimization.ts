import { serializeTaskSnapshot } from '../src/utils/taskUtils';

const task = {
    id: 'test_task',
    name: 'Large Task',
    actions: Array(50).fill({ type: 'click', selector: '.btn' }),
    variables: { foo: { type: 'string', value: 'bar' } },
    versions: [],
    last_opened: Date.now()
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

console.time('Serialization Performance');
for (let i = 0; i < iterations; i++) {
    const snapshot = serializeTaskSnapshot(task);
    if (snapshot.includes('"versions"') || snapshot.includes('"last_opened"')) {
        console.error('FAILED: versions or last_opened property should not be present in snapshot');
        process.exit(1);
    }
}
console.timeEnd('Serialization Performance');
console.log('Successfully serialized task 1000 times without the versions or last_opened arrays.');
