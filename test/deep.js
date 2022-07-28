import assert from 'assert';
import _ from 'lodash';
import { env, timeforce } from './setup.js';

describe('Deep', function () {
    var json, jsonPlain;
    beforeEach(() => {
        json = {
            name: 'bruno foggia', age: 20, contacts: [
                {
                    email: 'team@99xp.org',
                    phone: '999',
                    address: [
                        {
                            zipcode: '000',
                            state: 'aa',
                            city: 'xx xx'
                        },
                        {
                            zipcode: '111',
                            state: 'bb',
                            city: 'yy yy'
                        },
                    ]
                },
                {
                    email: 'team@.org',
                    phone: '888',
                }
            ],
            dados: {
                cpf: '111',
                rg: '222',
                cnh: '333'
            },
            other: {},
            otherArray: []
        };

        jsonPlain = {
            name: 'bruno foggia',
            age: 20,
            'contacts.0.email': 'team@99xp.org',
            'contacts.0.phone': '999',
            'contacts.0.address.0.zipcode': '000',
            'contacts.0.address.0.state': 'aa',
            'contacts.0.address.0.city': 'xx xx',
            'contacts.0.address.1.zipcode': '111',
            'contacts.0.address.1.state': 'bb',
            'contacts.0.address.1.city': 'yy yy',
            'contacts.1.email': 'team@.org',
            'contacts.1.phone': '888',
            'dados.cpf': '111',
            'dados.rg': '222',
            'dados.cnh': '333',
            other: {},
            otherArray: []
        };
    });

    it('join', function () {
        var result, changed = { hasOwnProperty: true };
        result = timeforce.Deep.join(changed);

        assert.equal(result.hasOwnProperty, true);
    });

    it('join 2 jsons', function () {
        var result = timeforce.Deep.join(json);

        assert.deepEqual(jsonPlain, result);
    });

    it('split', function () {
        var result = timeforce.Deep.split(jsonPlain);
        assert.deepEqual(json, result);
    });

    it('trail', function () {
        var result = timeforce.Deep.trail('contacts.0.address.0.state');
        var expectedResult = [
            'contacts',
            'contacts.0',
            'contacts.0.address',
            'contacts.0.address.0',
            'contacts.0.address.0.state'
        ];
        assert.deepEqual(expectedResult, result);
    });

    it('trail + recursive', function () {
        var result = timeforce.Deep.trail('contacts.0.address.0.state', true);

        var expectedResult = [
            'contacts..address',
            'contacts..address.0',
            'contacts..address..state',
            'contacts',
            'contacts.0',
            'contacts.0.address',
            'contacts.0.address.0',
            'contacts.0.address.0.state',
        ];
        assert.deepEqual(expectedResult, result);
    });

    it('search', function () {
        var key, result;

        key = 'contacts.0.address.0.state';
        result = timeforce.Deep.search(json, key);
        assert.equal(result, jsonPlain[key]);
    });

    it('search multiple', function () {
        var key, result;

        key = 'contacts.0.address..neightboorhood';
        result = timeforce.Deep.search(json, key);

        assert.ok(result.length === 2);
    });

    it('search multiple multilevel', function () {
        var key, result;

        key = 'contacts.0.address..location.neightboorhood';
        result = timeforce.Deep.search(json, key);

        assert.ok(result.length === 2);
    });

    it('search deleted item from array', function () {
        var test = {
            other: {
                data: [
                    {
                        zipcode: '000',
                        state: 'aa',
                        city: 'xx xx'
                    },
                    {
                        zipcode: '000',
                        state: 'aa',
                        city: 'xx xx'
                    },
                ]
            }
        };
        var key, result;

        delete test.other.data[1];
        key = 'other.data..address.0.state';
        result = timeforce.Deep.search(test, key);

        assert.ok(result.length === 2 && typeof result[0] === 'undefined' && result[1] === SyntaxError);
    });

    it('set attr bool', function () {
        var result, changed = { hasOwnProperty: true };

        result = timeforce.Deep.set({}, changed);

        assert.equal(result.hasOwnProperty, true);
    });

    it('set attr 1 sublevel', function () {
        // timeforce.Deep.log = true;
        var result, changed = { a: { key: 'value' } };
        result = timeforce.Deep.set({}, changed);
        // timeforce.Deep.log = false;
        assert.equal(result.a.key, 'value');
    });

    it('set attr value as array', function () {
        // timeforce.Deep.log = true;
        var result, changed = { x: [] };

        result = timeforce.Deep.set({}, changed);
        // timeforce.Deep.log = false;

        assert.ok(_.isArray(result.x) && result.x.length === 0);
    });

    it('set json', function () {
        var result, changed = {
            name: 'another name',
            'contacts.1.email': 'another@email.com',
            'contacts.0.address.1.city': 'zz zz'
        }, changedSplit = timeforce.Deep.split(changed);

        result = timeforce.Deep.set(json, changed);
        assert.equal(result.name, changedSplit.name);
        assert.equal(result.contacts[1].email, changedSplit.contacts[1].email);
        assert.equal(result.contacts[0].address[1].city, changedSplit.contacts[0].address[1].city);
        assert.equal(result.age, json.age);
        assert.equal(result.contacts[0].email, json.contacts[0].email);
        assert.equal(result.contacts[0].address[0].city, json.contacts[0].address[0].city);
        assert.ok(_.isArray(result.contacts));
        assert.ok(_.isArray(result.contacts[0].address));
        assert.ok(_.isPlainObject(result.dados));
    });

    it('set option.unset', function () {
        var result, changed = {
            name: null,
            age: null,
            'contacts.1.email': null,
            'contacts.0.address.1': null,
        };

        result = timeforce.Deep.set(json, changed, { unset: true });

        assert.ok(typeof result.name === 'undefined');
        assert.ok(typeof result.agr === 'undefined');
        assert.ok(typeof result.contacts[1].email === 'undefined');
        assert.ok(typeof result.contacts[0].address[1] === 'undefined');
        assert.ok(_.isArray(result.contacts));
        assert.ok(_.isArray(result.contacts[0].address));
    });
});