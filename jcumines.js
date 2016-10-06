/*
Boilerplate code by Joseph Cumines.

This library can be used in both node and the browser, using RequireJS.
 */

require('es6-promise').polyfill();

var jcumines = module.exports = {};

jcumines._workers = {};

/**
One worker at a time tool. Returns a promise
containing input's value.

If no input is passed, then it will return the queued workers.
 */
jcumines.worker = function (key, input) {
	//Initialize the worker if necessary
	if (jcumines._workers[key] == null) {
		jcumines._workers[key] = [];
	}

	if (input == null)
		return jcumines._workers[key].length;

	var at = Promise.resolve(true);
	if (jcumines._workers[key].length > 0)
		at = jcumines._workers[key][jcumines._workers[key].length - 1];

	//Queue the operation behind the worker
	var result = at.then(function (r) {
			return Promise.resolve(input);
		});

	//Create a catching and self removing worker from our result.
	var worker = result['catch'](function (err) {
			//We just return the error (fulfills) because we dont want to kill it
			return err;
		}).then(function (r) {
			//remove the worker from the array if it exists (it should
			var removed = false;
			for (var x = 0; x < jcumines._workers[key].length; x++) {
				if (jcumines._workers[key][x] == worker) {
					jcumines._workers[key].splice(0, 1);
					x--;
					removed = true;
				}
			}
			if (!removed)
				throw new Error('We couldnt self remove a promise in worker queue ' + key);
		});

	//add the worker to the end
	jcumines._workers[key].push(worker);

	//Return the operation as well
	return result;
};

/**
Deep copy of arrays and objects implementation. Only copies directly owned properties.
 */
jcumines.deepCopy = function (obj) {
	if (jcumines.isObject(obj)) {
		var result = {};
		for (var k in obj) {
			if (obj.hasOwnProperty(k))
				result[k] = jcumines.deepCopy(obj[k]);
		}
		return result;
	} else if (jcumines.isArray(obj)) {
		var result = [];
		for (var x = 0; x < obj.length; x++)
			result.push(jcumines.deepCopy(obj[x]));
		return result;
	} else {
		return obj;
	}
};

/**
Async wait, returns a promise.
 */
jcumines.wait = function (ms) {
	try {
		return new Promise(function (fulfill, reject) {
			try {
				var startedAt = Date.now();
				setTimeout(function () {
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
jcumines.isObject = function (input) {
	return typeof input == 'object' && input != null && !Array.isArray(input);
};

/**
Returns true if the variable is an array.
 */
jcumines.isArray = function (input) {
	return input != null && Array.isArray(input);
};

/**
Returns a promise, operates on every on every element of the array, using the callback.

Input must be an array, cb must be a callback taking one argument (the element), can return a promise.
 */
jcumines.promiseAll = function (input, cb) {
	try {
		var copyInput = input.concat([]);
		//done
		if (copyInput.length == 0)
			return Promise.resolve(true);
		var working = copyInput[0];
		copyInput.shift();
		return Promise.resolve(true).then(function (r) {
			return Promise.resolve(cb(working));
		}).then(function (r) {
			//call the next one.
			return jcumines.promiseAll(copyInput, cb);
		});
	} catch (e) {
		console.dir(e);
		return new Promise.reject(e);
	}
};

/**
For each line in a string, perform an action.
Callback is required, will receive the line as param.

Returns promise.
 */
jcumines.forEachLine = function (s, cb) {
	var split = s.match(/[^\r\n]+/g);
	return jcumines.promiseAll(split, cb);
};
