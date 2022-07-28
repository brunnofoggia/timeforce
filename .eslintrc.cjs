module.exports = {
    root: true,
    env: {
        node: true,
    },
    extends: ['eslint:recommended'],
    parserOptions: {
        sourceType: "module",
        ecmaVersion: 2020,
    },
    "globals": {
        "attachEvent": false,
        "detachEvent": false,
        "describe": false,
        "it": false,
        "beforeEach": false,
        "afterEach": false,
        "window": false,
        "Symbol": false,
        "document": false,
        "Promise": false,
    },
    "rules": {
        'no-useless-escape': 'off',
    },
}