/*
Boilerplate code by Joseph Cumines.

This library can be used in both node and the browser, using RequireJS.

Requires es6 compliant Promise implementation.
 */
/* jshint eqnull:true */

var jcumines = module.exports = {};

/**
Avoid accessing this directly.
*/
jcumines._workers = {};

/**
Get all the currently running workers, for a given key.
*/
jcumines.workers = function(key) {
    if (jcumines._workers[key] == null) {
        jcumines._workers[key] = [];
    }
    return jcumines._workers[key];
};

/**
One worker at a time tool. Returns a promise
containing callback's value.

If callback is anything other then a function, then it will be resolved
as a promise, so you can pass an existing promise to the worker queue,
and it will block future callbacks until it is resolved.

Notes for usage: callback is called with the time between when we started
waiting and when we stopped waiting as the first and only argument.

By the time that the result is returned it is guarenteed that the worker
representing the callback has been cleared.
 */
jcumines.worker = function(key, callback) {
    //Initialize the worker array if necessary
    var workers = jcumines.workers(key);

    //the callback we use
    var cb = callback;
    //If it isnt a function then we make it a function that resolves the value of it.
    if (typeof callback !== 'function') {
        cb = function() {
            return callback;
        };
    }

    var at = Promise.resolve(true);
    //Get the back of the queue if we can
    if (workers.length > 0) {
        at = workers[workers.length - 1];
    }
    //Note when we started waiting
    var startedWaiting = Date.now();
    //Queue the operation behind the worker
    var result = at.then(function(r) {
        //Get the value from callback, passing down the time we waited.
        return cb(Date.now() - startedWaiting);
    });

    //Create a catching and self removing worker from our result.
    var worker = result['catch'](function(err) {
        //We just return the error (fulfills) because we dont want to kill it if it failed (still needs to be removed)
        return err;
    }).then(function(r) {
        //remove the worker from the array if it exists (it should, will error if not)
        var removed = false;
        for (var x = 0; x < workers.length; x++) {
            //Nifty scoping here
            if (workers[x] == worker) {
                workers.splice(x, 1);
                x--;
                removed = true;
                break;
            }
        }
        if (!removed)
            throw new Error('We couldnt self remove a promise in worker queue ' + key);

        //Before we go, clear the worker queue reference if its empty
        if (jcumines._workers[key] != null && jcumines._workers[key].length === 0)
            delete jcumines._workers[key];

        return true;
    });

    //add the worker to the end of the worker queue
    workers.push(worker);

    //Resolve / Reject the same as the result, but ensure that the worker is finished, and has been cleared, beforehand.
    return result.then(function(r) {
        return worker.then(function() {
            //Resolve the value from result
            return r;
        });
    })['catch'](function(err) {
        return worker.then(function() {
            //Reject with the error from result
            return Promise.reject(err);
        });
    });
};

/**
Deep copy of arrays and objects implementation. Only copies directly owned properties.
 */
jcumines.deepCopy = function(obj) {
    var result = obj;
    if (jcumines.isObject(obj)) {
        result = {};
        for (var k in obj) {
            if (obj.hasOwnProperty(k))
                result[k] = jcumines.deepCopy(obj[k]);
        }
    } else if (jcumines.isArray(obj)) {
        result = [];
        for (var x = 0; x < obj.length; x++)
            result.push(jcumines.deepCopy(obj[x]));
    }
    return result;
};

/**
Async wait, returns a promise.
 */
jcumines.wait = function(ms) {
    try {
        return new Promise(function(fulfill, reject) {
            try {
                var startedAt = Date.now();
                setTimeout(function() {
                    fulfill(Date.now() - startedAt);
                }, ms);
            } catch (e) {
                reject(e);
            }
        });
    } catch (e) {
        console.dir(e);
        return Promise.reject(e);
    }
};

/**
 * Returns true if the variable is an object.
 */
jcumines.isObject = function(input) {
    return typeof input == 'object' && input != null && !Array.isArray(input);
};

/**
Returns true if the variable is an array.
 */
jcumines.isArray = function(input) {
    return input != null && Array.isArray(input);
};

/**
Returns a promise, operates on every on every element of the array, using the callback.

Input must be an array, cb must be a callback taking one argument (the element), can return a promise.
 */
jcumines.promiseAll = function(input, cb) {
    try {
        var copyInput = input.concat([]);
        //done
        if (copyInput.length === 0)
            return Promise.resolve(true);
        var working = copyInput[0];
        copyInput.shift();
        return Promise.resolve(true).then(function(r) {
            return Promise.resolve(cb(working));
        }).then(function(r) {
            //call the next one.
            return jcumines.promiseAll(copyInput, cb);
        });
    } catch (e) {
        console.dir(e);
        return Promise.reject(e);
    }
};

/**
For each line in a string, perform an action.
Callback is required, will receive the line as param.

Returns promise.
 */
jcumines.forEachLine = function(s, cb) {
    var split = s.match(/[^\r\n]+/g);
    return jcumines.promiseAll(split, cb);
};

/**
Execute a method on a object.

context is the object, functionName is a string deliniated with .,
and args is an array.

Throws an error if it is unable to execute.
 */
jcumines.executeMethodOnObject = function(functionName, context, args) {
    var namespaces = functionName.split(".");
    var func = namespaces.pop();
    for (var i = 0; i < namespaces.length; i++) {
        context = context[namespaces[i]];
    }
    if (context[func] == null || context[func].apply == null)
        throw new Error('Unable to execute ' + functionName + ' on the object provided.');
    return context[func].apply(context, args);
};

/**
Stringify an object, excluding seen objects.

Basic way of serializing circular objects, such as results from mongodb.
 */
jcumines.stringifyExcludeSeen = function(obj) {
    var seen = [];
    return JSON.stringify(obj, function(key, val) {
        if (jcumines.isObject(val)) {
            if (seen.indexOf(val) >= 0) {
                return;
            }
            seen.push(val);
        }
        return val;
    });
};

/**
This object exposes the internal fulfill and resolve methods of a promise.
The promise itself can be accessed using the property promise.
*/
jcumines.BlockingPromise = function() {
    this.promise = new Promise(function(resolve, reject) {
        this.resolve = resolve;
        this.reject = reject;
    }.bind(this));
};