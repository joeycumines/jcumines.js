//Polyfill Promise
require('es6-promise').polyfill();
var assert = require('assert');
var jcumines = require('../jcumines.js');

describe('jcumines', function() {
    describe('#workers()', function() {
        it('should return an empty array for non existent key', function() {
            assert.equal(jcumines.workers('key1').length, 0);
        });
        it('should return an empty array for non existent key if called again', function() {
            assert.equal(jcumines.workers('key1').length, 0);
        });
        it('should return the correct number of workers as we create and tear down 20 blocking promises', function() {
            var blockers = [];
            for (var x = 0; x < 20; x++) {
                blockers.push(new jcumines.BlockingPromise());
            }
            //setup
            var count = 0;
            return jcumines.promiseAll(blockers, function(blocker) {
                //add the blocker as a worker
                jcumines.worker('key1', blocker.promise);
                count++;
                //check the number of workers
                assert.equal(jcumines.workers('key1').length, count);
            }).then(function() {
                assert.equal(jcumines.workers('key1').length, blockers.length);
                //One by one, clear the blockers and check the count
                return jcumines.promiseAll(blockers, function(blocker) {
                    var worker = jcumines.workers('key1')[0];
                    count--;
                    //Alternate between resolving and rejecting, checking the worker handles it correctly
                    if (count % 2 === 0) {
                        blocker.resolve(count);
                    } else {
                        blocker.reject(count);
                    }
                    return worker['catch'](function(err) {
                        //this should never happen
                        console.dir(err);
                        assert(false);
                    }).then(function(r) {
                        assert(r);
                        assert.equal(jcumines.workers('key1').length, count);
                    });
                });
            });
        });
    });
    describe('#worker()', function() {
        it('BIG TEST THAT NEEDS REPLACING', function() {
            var value = false;
            var setValue = function() {
                value = true;
            };
            var blocker = new jcumines.BlockingPromise();
            jcumines.worker('key2', blocker.promise);
            jcumines.worker('key2', setValue);
            assert.equal(jcumines.workers('key2').length, 2);
            assert.equal(value, false);
            var startedWorking = Date.now();
            var timeWaited = null;
            jcumines.worker('key2', function(r) {
                timeWaited = r;
                return false;
            });
            //set it to resolve in 50ms
            return jcumines.wait(50).then(function(r) {
                assert(r >= 50);
                blocker.resolve(true);
                //so we can run as soon as it resolves, and timeWaited is set.
                return jcumines.worker('key2').then(function() {
                    //Check that time waited is set
                    var timeSpentWorkingActual = Date.now() - startedWorking;
                    assert.equal(timeSpentWorkingActual, timeWaited);
                    assert.equal(jcumines.workers('key2').length, 0);
                    assert.equal(value, true);
                });
            });
        });
        it('TEST BLOCKING LOGIC', function() {
            var blockers = [];
            for (var x = 0; x < 10; x++) {
                blockers.push(new jcumines.BlockingPromise());
            }
            //setup
            var count = 0;
            return jcumines.promiseAll(blockers, function(blocker) {
                //add the blocker as a worker
                jcumines.worker('key1', blocker.promise);
                count++;
                //check the number of workers
                assert.equal(jcumines.workers('key1').length, count);
            }).then(function() {
                //clear the last 4 before the last item
                var toClear = blockers.slice(5, 9);
                return jcumines.promiseAll(toClear, function(blocker) {
                    blocker.resolve(true);
                });
            }).then(function() {
                //the workers are still the same length
                assert.equal(jcumines.workers('key1').length, count);
                //clear the first 4
                var toClear = blockers.slice(0, 4);
                return jcumines.promiseAll(toClear, function(blocker) {
                    var worker = jcumines.workers('key1')[0];
                    blocker.resolve(true);
                    count--;
                    return worker.then(function() {
                        assert.equal(jcumines.workers('key1').length, count);
                    });
                }).then(function() {
                    //Clearing the blocker at index 4 should clear all bar the last one.
                    var worker = jcumines.workers('key1')[jcumines.workers('key1').length - 2];
                    blockers[4].resolve(true);
                    count = count - 5;
                    return worker.then(function() {
                        assert.equal(jcumines.workers('key1').length, count);
                    });
                }).then(function() {
                    //The last one
                    assert.equal(jcumines.workers('key1').length, 1);
                    var worker = jcumines.workers('key1')[0];
                    blockers[9].resolve(true);
                    return worker.then(function() {
                        assert.equal(jcumines.workers('key1').length, 0);
                    });
                });
            });
        });
        it('should guarentee that the worker array state is set correctly when the promise has been resolved', function() {
            var resolveCB = function() {
                return Promise.resolve('we resolved');
            };
            return jcumines.worker('key1', resolveCB).then(function(r) {
                assert.equal(r, 'we resolved');
                assert.equal(jcumines.workers('key1').length, 0);
            })['catch'](function() {
                assert(false);
            });
        });
        it('should guarentee that the worker array state is set correctly when the promise has been rejected', function() {
            var rejectCB = function() {
                return Promise.reject('we rejected');
            };
            return jcumines.worker('key1', rejectCB).then(function() {
                assert(false);
            })['catch'](function(r) {
                assert.equal(r, 'we rejected');
                assert.equal(jcumines.workers('key1').length, 0);
            });
        });
    });
    describe('BlockingPromise', function() {
        it('should resolve correctly', function() {
            blocker = new jcumines.BlockingPromise();
            blocker.resolve('This is the value resolved');
            return blocker.promise.then(function(r) {
                assert.equal(r, 'This is the value resolved');
            })['catch'](function() {
                assert(false);
            });
        });
        it('should reject correctly', function() {
            blocker = new jcumines.BlockingPromise();
            blocker.reject('This is the value rejected');
            return blocker.promise.then(function() {
                assert(false);
            })['catch'](function(r) {
                assert.equal(r, 'This is the value rejected');
            });
        });
    });
});