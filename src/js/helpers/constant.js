// promise
// let promise = new Promise(function(resolve, reject) {
//   console.log("hello");

//   chrome.storage.sync.get(["is_host_registered", "hostname"], result => {
//     console.log("hostname ---->", result);
//     resolve(result.hostname);
//   });
// });

// async/await
function x() {
  var promise = new Promise(function(resolve, reject) {
    chrome.storage.sync.get(["is_host_registered", "hostname"], result => {
      console.log("hostname ---->", result);
      resolve(result.hostname);
    });
  });
  return promise;
}

const server = {
  default_playback_speed: 1000,
  matching_threshold: 0.6,
  nlu_matching_threshold: 0.5,
  default_max_tries: 15,
  playback_try_again_interval: 15000,
  second_difference: 2,
  value_verification_max_tries: 10,

  // login: "https://admin.dataphion.com/auth/local",

  // changing
  // strapi_url: "https://admin.dataphion.com",
  nlu_url: "https://ai.dataphion.com/model/parse"
  // strapi_url_graphql: "https://admin.dataphion.com/graphql",
  // vision: "https://admin.dataphion.com/vision",
  // googleVision: "https://admin.dataphion.com/vision/api/PageOCR"
};
const new_server = {
  default_playback_speed: 1000,
  matching_threshold: 0.6,
  nlu_matching_threshold: 0.5,
  default_max_tries: 15,
  playback_try_again_interval: 15000,
  second_difference: 2,
  value_verification_max_tries: 10,
  login: "http://admin.dataphion.com/auth/local",

  // changing
  strapi_url: "http://admin.dataphion.com",
  nlu_url: "http://ai.dataphion.com/model/parse",
  strapi_url_graphql: "http://admin.dataphion.com/graphql",
  vision: "http://13.127.1.213/vision",
  googleVision: "http://13.127.1.213/vision/api/PageOCR"
};

const micro = {
  default_playback_speed: 1000,
  matching_threshold: 0.6,
  nlu_matching_threshold: 0.5,
  default_max_tries: 3,
  playback_try_again_interval: 3000,
  second_difference: 2,
  value_verification_max_tries: 20,

  login: "http://mcl.dataphion.com/auth/local",
  strapi_url: "http://mcl.dataphion.com",
  strapi_url_graphql: "http://mcl.dataphion.com/graphql",
  nlu_url: "http://ai.dataphion.com/model/parse",
  vision: "http://mcl.dataphion.com:9502/vision",
  googleVision: "http://mcl.dataphion.com/vision/api/PageOCR"
};
const dell_server = {
  default_playback_speed: 1000,
  matching_threshold: 0.6,
  nlu_matching_threshold: 0.5,
  default_max_tries: 3,
  playback_try_again_interval: 3000,
  second_difference: 2,
  value_verification_max_tries: 20,

  login: "http://10.93.16.36:1337/auth/local",
  strapi_url: "http://10.93.16.36:1337",
  strapi_url_graphql: "http://10.93.16.36:1337/graphql",
  nlu_url: "http://ai.dataphion.com/model/parse",
  vision: "http://10.93.16.36/vision",
  googleVision: "http://10.93.16.36/vision/api/PageOCR"
};

// export default local;
// export default micro;
export default server;
// export default new_server;

/**
 * INFORMATION OF THE VARIABLES USED
 *
 * matching_threshold: element comparison threshold
 * nlu_matching_threshold: rasa comparison threshold
 * default_max_tries: max tries to perform before calling the vision api
 * playback_try_again_interval: the interval between identifying the element in the page
 * second_difference: must have difference in seconds for dom change for requesting the page capture
 */
