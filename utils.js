/**
 * The timeoutPromise helper allows you to wrap any promise to fulfill within a timeout.
 *
 * @param {Promise} promise A promise instance
 * @param {BigInteger} timeoutInMilliseconds The time limit in milliseconds to fulfill or reject the promise.
 * @returns {Promise} A pending Promise
 */
async function timeout(promise, timeoutInMilliseconds) {
  return Promise.race([
    promise,
    new Promise(function (resolve, reject) {
      setTimeout(function () {
        reject("timeout");
      }, timeoutInMilliseconds);
    }),
  ]);
}

module.exports = {
  timeout,
};
