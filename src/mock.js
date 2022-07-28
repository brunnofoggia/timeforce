import _ from 'lodash';

// timeforce.mock
// -------------
var Mock = {};

// Set the mock implementation of `timeforce.persist`
Mock.persist = function (options, config, instance) {
    return new Promise((resolve, reject) => {
        const globalMocks = !instance.name ? {} : (instance._global.mocks || {}) || {};
        const typedMocks = globalMocks[instance.typeName()] || {};
        const mocks = _.merge({}, instance.mocks || {}, typedMocks[instance.name] || {});
        const mock = typeof mocks[options.type] === 'function' ?
            mocks[options.type](instance, options, config) :
            mocks[options.type];
        const delay = instance.mockDelay || instance._global.mockDelay || 0;

        setTimeout(() => {
            if (mock) {
                options.success(mock);
                return resolve(mock);
            }
            options.error();
            reject();
        }, delay);
    });
};

export default Mock;