// admin.dataphion.com
// login: "https://admin.dataphion.com/auth/local",

export function giveUrl(endpoint) {
  console.log("url function called --->");
  // return "value";
  return new Promise(function(resolve, reject) {
    chrome.storage.sync.get(["is_host_registered", "hostname"], result => {
      console.log("hostname ---->", result);
      let host = "";
      if (endpoint === "login") {
        host = `${result.hostname}/api/auth/local`;
        resolve(host);
      } else if (endpoint === "strapi_url_graphql") {
        host = `${result.hostname}/api/graphql`;
        resolve(host);
      } else if (endpoint === "strapi_url") {
        host = `${result.hostname}/api`;
        resolve(host);
      } else if (endpoint === "vision_url") {
        host = `${result.hostname}/vision`;
        resolve(host);
      } else if (endpoint === "googleVision_url") {
        host = `${result.hostname}/vision/api/PageOCR`;
        resolve(host);
      }
    });
  });
}
