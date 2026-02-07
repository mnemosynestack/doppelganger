
function cloneTaskForVersion(task) {
    const copy = JSON.parse(JSON.stringify(task || {}));
    if (copy.versions) delete copy.versions;
    return copy;
}

module.exports = {
    cloneTaskForVersion
};
